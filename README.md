# Nexovate CRM

Base de Next.js App Router en español. TASK-001 prepara herramientas y una página
neutra; login, clientes, datos y dashboard se implementarán en tareas posteriores.

## Instalación y ejecución

Usar Node 22.22.3 y npm 10.9.8. Las dependencias directas están fijadas en
`package.json` y las transitivas en `package-lock.json`.

```sh
npm ci
npm run dev
```

Abrir http://localhost:3000. Para producción local: `npm run build`, luego
`npm run start`. No se necesita Supabase ni leer `.env` para esta base.
`.env` y `.env.*` están ignorados, salvo `.env.example`, que sólo tiene placeholders.
Los comandos de Next pueden cargar automáticamente un `.env` local existente.

## Verificaciones y TDD

| Comando | Propósito |
| --- | --- |
| `npm run lint` | ESLint de aplicación, soporte y configuración |
| `npm run typecheck` | Generar tipos Next y comprobar TypeScript sin emisión |
| `npm run build` | Compilar la aplicación para producción |
| `npm test -- tests/<ruta>.test.ts` | Vitest enfocado, entorno jsdom y Testing Library |
| `npm run test:watch` | Vitest en modo watch para RED/GREEN/refactor |
| `npm run test:e2e -- tests/e2e/<ruta>.spec.ts` | Playwright sobre servidor local de producción |
| `npm run test:db` | Integración SQL de esquema/permisos/RLS en PostgreSQL local nuevo |

No hay suites de negocio en TASK-001. `npm test` y `npm run test:e2e -- --list`
deben informar ausencia de pruebas y salir con error; no se oculta con
`passWithNoTests`. TDD aplica al comportamiento futuro, no a este setup.
Vitest descubre `tests/**/*.test.ts(x)` y excluye E2E/soporte. Playwright usará
`tests/e2e/**/*.spec.ts` o `.test.ts`. No usar Vitest para Server Components
asíncronos ni como sustituto de PostgreSQL/RLS real.

Diagnóstico del navegador: `node tests/support/check-browser.mjs`. Si no hay
Chromium de Playwright, se puede usar Edge local estableciendo
`PLAYWRIGHT_CHANNEL=msedge`, o instalar Chromium localmente mediante
`npx playwright install chromium` (descarga del navegador, sin instalación global).
Con un servidor iniciado, `SMOKE_URL=http://127.0.0.1:3000` añade un chequeo HTTP/DOM.
Playwright desactiva screenshots, video y trace; no crear snapshots visuales.
Ejecutar `npm run build` antes de E2E: el runner inicia `npm run start`.

## PostgreSQL local para pruebas

El runner SQL usa PostgreSQL **17.11** portable x64 para Windows, distribuido por
[EDB](https://www.enterprisedb.com/download-postgresql-binaries) y enlazado por
[PostgreSQL](https://www.postgresql.org/download/windows/). No registra servicios
ni requiere instalación global. No usa `.env` ni las credenciales de Supabase.

Preparación única en PowerShell, desde la raíz del repositorio (si el directorio
ya existe, inspeccionarlo en lugar de sobrescribirlo):

```powershell
if (Test-Path -LiteralPath '.local-postgres') { throw 'Destino existente' }
New-Item -ItemType Directory -Path '.local-postgres' | Out-Null
Invoke-WebRequest -Uri 'https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip' -OutFile '.local-postgres/postgresql-17.11-5-windows-x64-binaries.zip'
Get-FileHash -LiteralPath '.local-postgres/postgresql-17.11-5-windows-x64-binaries.zip' -Algorithm SHA256
Expand-Archive -LiteralPath '.local-postgres/postgresql-17.11-5-windows-x64-binaries.zip' -DestinationPath '.local-postgres'
npm run test:db
```

SHA256 de la descarga observada:
`80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f`.
Es un digest calculado localmente, no una firma ni checksum publicado por EDB.

Cada ejecución crea un cluster nuevo en `.local-postgres/runs/`, usuario sintético
y contraseña aleatoria con SCRAM, puerto libre y escucha sólo en `127.0.0.1`.
Verifica identidad y ruta real del cluster antes de aplicar fixtures/migraciones.
Rechaza cualquier `TEST_DATABASE_URL` presente (incluso vacía), evita configuración
PG heredada y nunca reutiliza una base existente. Al terminar detiene y elimina
únicamente su cluster; si no puede confirmar el cierre, conserva sus datos y falla.
Binarios, ZIP y datos están ignorados por Git. El sandbox Windows puede exigir
autorización de la ejecución local porque bloquea la conexión loopback de psql.

Fixtures emulan sólo roles `anon`/`authenticated`, `auth.users` y `auth.uid()` con
claims sintéticos. Prueban PostgreSQL real con `SET ROLE` sin propietario,
superusuario ni BYPASSRLS; no verifican firma JWT, Supabase Auth, API ni usuarios
remotos. Las aserciones SQL fallan con exit no cero, sin mocks ni falsos verdes.

WU-003 concede lectura compartida a dos UUID de membresía explícita (slots 1/2),
deniega anónimo/tercero y bloquea DML directo sobre clientes, miembros e historial.
No provisiona miembros reales. Las escrituras compartidas vía RPC, correcciones,
atomicidad, idempotencia y concurrencia se implementarán en WU-004; no están
habilitadas todavía. Mantener `crm_private` fuera de los schemas expuestos del API.

## Convenciones

Código en `src/`; alias `@/` → `src/`. Tailwind 4 usa PostCSS y configuración CSS.
`components.json` y `src/lib/utils.ts` preparan shadcn/ui; no hay componentes
funcionales añadidos ni diseño aprobado. Los tokens se completarán con TASK-002.
Next tiene `agentRules: false` para preservar las instrucciones locales de agentes.

Referencias oficiales: [Next/Vitest](https://nextjs.org/docs/app/guides/testing/vitest),
[ESLint](https://nextjs.org/docs/app/api-reference/config/eslint),
[shadcn](https://ui.shadcn.com/docs/components-json) y
[Playwright](https://playwright.dev/docs/test-configuration).
