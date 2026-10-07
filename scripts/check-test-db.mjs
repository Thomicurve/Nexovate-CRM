import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const missing = [];
if (!process.env.TEST_DATABASE_URL) missing.push("TEST_DATABASE_URL no definida");
const psql = spawnSync("psql", ["--version"], { encoding: "utf8" });
if (psql.error || psql.status !== 0) missing.push("psql no disponible");
if (!existsSync("supabase/tests")) missing.push("Pruebas SQL pendientes de TASK-003");
if (!existsSync("supabase/migrations")) missing.push("Migraciones pendientes de TASK-003");

for (const item of missing) console.error(item);
console.error("Runner de integración SQL pendiente de TASK-003; no se ejecutó SQL.");
process.exitCode = 1;
