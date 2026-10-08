import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  realpathSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runConcurrency } from "../tests/support/sql-concurrency.mjs";

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const local = join(root, ".local-postgres");
const bin = join(local, "pgsql", "bin");
const exe = (name) => join(bin, `${name}${process.platform === "win32" ? ".exe" : ""}`);
let run;
let started = false;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith("PG")));
env.PGCLIENTENCODING = "UTF8";

function command(name, args, options = {}) {
  const result = spawnSync(exe(name), args, {
    cwd: root, env, encoding: "utf8", windowsHide: true, timeout: 60_000, ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${name} falló: ${result.error?.message ?? result.stderr ?? "sin diagnóstico"}`);
  }
  return result.stdout?.trim() ?? "";
}

function insideWorkspace(path) {
  const real = realpathSync(path);
  if (!real.startsWith(`${root}${sep}.local-postgres${sep}`)) {
    throw new Error("Ruta de pruebas fuera del directorio local autorizado");
  }
  return real;
}

async function unusedPort() {
  const server = createServer();
  await new Promise((accept, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", accept);
  });
  const port = server.address().port;
  await new Promise((accept) => server.close(accept));
  return port;
}

try {
  if ("TEST_DATABASE_URL" in process.env) throw new Error("TEST_DATABASE_URL no se acepta: sólo se permite un cluster nuevo gestionado por este runner");
  if (!existsSync(bin)) throw new Error("Faltan binarios portables en .local-postgres/pgsql/bin; ver README");
  if (lstatSync(local).isSymbolicLink() || realpathSync(local) !== local) {
    throw new Error("El directorio PostgreSQL local no puede ser un enlace");
  }
  const version = command("postgres", ["--version"]);
  if (version !== "postgres (PostgreSQL) 17.11") throw new Error("Se requiere PostgreSQL portable 17.11");
  const runs = join(local, "runs");
  mkdirSync(runs, { recursive: true });
  insideWorkspace(runs);
  run = mkdtempSync(join(runs, "wu003-"));
  insideWorkspace(run);
  const data = join(run, "data");
  const passwordFile = join(run, "password");
  env.PGPASSWORD = randomBytes(32).toString("hex");
  writeFileSync(passwordFile, env.PGPASSWORD, { mode: 0o600 });
  command("initdb", ["-D", data, "-U", "crm_test_admin", "--encoding=UTF8", "--locale=C", "--auth=scram-sha-256", `--pwfile=${passwordFile}`]);
  rmSync(passwordFile);
  writeFileSync(join(data, "pg_hba.conf"), "host all all 127.0.0.1/32 scram-sha-256\n");
  const port = await unusedPort();
  // Detached postgres must not inherit pipe handles from spawnSync on Windows.
  command("pg_ctl", ["-D", data, "-l", join(run, "server.log"), "-w", "-t", "20", "-o", `-h 127.0.0.1 -p ${port}`, "start"], { stdio: "ignore" });
  started = true;
  const connect = ["-X", "-h", "127.0.0.1", "-p", String(port), "-U", "crm_test_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
  const sql = (source) => command("psql", [...connect, "-At"], { input: source });
  const identity = JSON.parse(sql("select json_build_object('user', current_user, 'host', host(inet_server_addr()), 'data', current_setting('data_directory'), 'listen', current_setting('listen_addresses'))::text;"));
  if (identity.user !== "crm_test_admin" || identity.host !== "127.0.0.1" ||
      realpathSync(identity.data) !== realpathSync(data) || identity.listen !== "127.0.0.1") {
    throw new Error("La conexión no corresponde al cluster nuevo aislado");
  }
  console.log(`${version}; cluster nuevo verificado en loopback, puerto ${port}`);
  sql(readFileSync(join(root, "tests/support/sql-fixture.sql"), "utf8"));
  const migrations = join(root, "supabase/migrations");
  if (existsSync(migrations)) {
    for (const file of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
      sql(readFileSync(join(migrations, file), "utf8"));
    }
  }
  const tests = readdirSync(join(root, "supabase/tests")).filter((name) => name.endsWith(".sql")).sort();
  if (!tests.length) throw new Error("No hay pruebas SQL; no se acepta un falso GREEN");
  for (const file of process.argv.includes("--concurrency-only") ? [] : tests) {
    sql(readFileSync(join(root, "supabase/tests", file), "utf8"));
    console.log(`PASS ${file}`);
  }
  const session = (source, applicationName) => new Promise((accept) => {
    const child = spawn(exe("psql"), [...connect, "-Atq"], {
      cwd: root, env: { ...env, PGAPPNAME: applicationName }, windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill(), 15_000);
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      clearTimeout(timeout);
      accept({ status: -1, stdout, stderr: error.message });
    });
    child.once("close", (status) => {
      clearTimeout(timeout);
      accept({ status, stdout, stderr });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(source);
  });
  await runConcurrency({ sql, session });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (run) {
    const data = join(run, "data");
    try {
      // A failed start may still have created a server; never delete a live cluster.
      if (started || existsSync(join(data, "postmaster.pid"))) {
        command("pg_ctl", ["-D", data, "-w", "-t", "20", "-m", "fast", "stop"]);
      }
      insideWorkspace(run);
      rmSync(run, { recursive: true });
      console.log("Cluster de esta ejecución detenido y eliminado.");
    } catch {
      console.error("No se pudo confirmar limpieza; se preservó el directorio de esta ejecución para inspección.");
      process.exitCode = 1;
    }
  }
}
