# Nexovate CRM

Base de Next.js App Router en español, con herramientas y una página neutra.
El esquema, permisos y mutaciones SQL de TASK-003 están implementados y probados
localmente. Auth, pantallas de clientes y dashboard quedan para tareas posteriores;
la aplicación todavía no está integrada con un Supabase remoto.

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

Las migraciones conceden lectura compartida a dos UUID de membresía explícita
(slots 1/2), deniegan anónimo/tercero y bloquean DML directo sobre clientes,
miembros, historial, auditoría y ledger. No provisionan miembros reales.
Mantener `crm_private` fuera de los schemas expuestos del API.

## Contrato de mutaciones SQL

Los miembros pueden ejecutar tres RPCs; el actor se deriva de `auth.uid()` y se
valida la membresía en cada llamada, incluidos replays:

| RPC | Parámetros |
| --- | --- |
| `create_client` | `p_request_id` UUID, `p_payload` objeto JSON |
| `update_client` | UUID request/client, `p_expected_version` bigint, objeto JSON parcial |
| `change_client_status` | UUID request/client, versión esperada, `p_status` del enum |

Payload: `name`, `company`, `rubro`, `email`, `phone`, `notes`, `contact_at`,
`meeting_at`; actualización también acepta `status`. Todos son strings o null,
con restricciones del modelo; `name` y `contact_at` no admiten null. Campos
omitidos se conservan al editar; null limpia los opcionales. Alta exige nombre,
inicia siempre Contactado y usa tiempo de servidor si se omite `contact_at`.
No se aceptan actor, ID, versión ni fechas de auditoría dentro del payload.

Cada solicitud necesita un UUID nuevo por intención, conservándolo al reintentar
la misma llamada. Ledger privado por `(actor, request_id)` compara operación,
cliente, versión y JSON canónico; replay exacto devuelve la respuesta original,
aunque el cliente haya avanzado después. Refrescar lectura si se necesita estado
actual. Cambiar payload/operación/versión con ese ID produce SQLSTATE `22023`;
para una intención nueva usar otro UUID. Conflicto de versión produce `40001`
(`client_version_conflict`); recuperar estado y decidir la siguiente operación.
No reintentar una escritura obsoleta cambiando silenciosamente su versión.

Cliente, eventos, primeros hitos, corrección de contacto y ledger se guardan en
la misma transacción. Sólo cambios efectivos de estado agregan eventos; volver
no duplica hitos ni salir los borra. Contactado usa `contact_at`; corrección mueve
ese hito y registra old/new/actor/instante sin reescribir eventos. `meeting_at` no
mueve el hito de Reunión agendada. No hay eliminación expuesta ni bypass desde app.

`npm run test:db` ejecuta SQL y tres carreras reales de sesiones psql distintas:
versión obsoleta, replay idéntico y payload cambiado concurrente. El harness exige
PIDs distintos y observa espera `Lock` mientras la primera transacción mantiene
su escritura abierta; no sustituye concurrencia con llamadas seriales. Para
enfocar esas carreras: `npm run test:db -- --concurrency-only`. Una pausa SQL de
tres segundos mantiene el lock para observar la segunda conexión; no es un mock.
Fixtures y limitaciones Supabase/JWT anteriores siguen aplicando. Los wrappers
usan SECURITY DEFINER/search_path vacío; el worker privado no tiene EXECUTE caller.

## Convenciones

Código en `src/`; alias `@/` → `src/`. Tailwind 4 usa PostCSS y configuración CSS.
`components.json` y `src/lib/utils.ts` preparan shadcn/ui; no hay componentes
funcionales añadidos. DESIGN-2 está aprobado en `crm-nexovate.pen`; componentes,
pantallas y tokens de la aplicación se implementarán en tareas posteriores.
Next tiene `agentRules: false` para preservar las instrucciones locales de agentes.

Referencias oficiales: [Next/Vitest](https://nextjs.org/docs/app/guides/testing/vitest),
[ESLint](https://nextjs.org/docs/app/api-reference/config/eslint),
[shadcn](https://ui.shadcn.com/docs/components-json) y
[Playwright](https://playwright.dev/docs/test-configuration).
