# Nexovate CRM

Base de Next.js App Router en español, con login SSR y destino privado mínimo.
El esquema, permisos y mutaciones SQL de TASK-003 están implementados y probados
localmente. Las tres migraciones y las dos cuentas autorizadas están provisionadas
en Supabase; ingreso, logout y renovación SSR tienen pruebas reales del proveedor.
La expiración natural de JWT también está verificada; la duración final sigue en
una hora. Pantallas de clientes y métricas quedan para tareas posteriores.

## Instalación y ejecución

Usar Node 22.22.3 y npm 10.9.8. Las dependencias directas están fijadas en
`package.json` y las transitivas en `package-lock.json`.

```sh
npm ci
npm run dev
```

Abrir http://localhost:3000. Para producción local: `npm run build`, luego
`npm run start`. El ingreso privado requiere la configuración pública de Supabase.
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

`npm test` ejecuta las suites Auth unitarias/RTL actuales; Playwright descubre
y ejecuta las pruebas Auth locales y live. Las primeras usan seams simulados;
las live requieren el proyecto y las dos cuentas reales, sin sustituir Auth por mocks.
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
para una intención nueva usar otro UUID. Tras la migración004, el conflicto de
versión produce `PT409` (`client_version_conflict`); `40001` corresponde sólo al
contrato legado. Recuperar estado y decidir la siguiente operación.
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
`components.json` y `src/lib/utils.ts` preparan shadcn/ui. El login reproduce
DESIGN-2 aprobado en `crm-nexovate.pen` y carga IBM Plex Sans desde el paquete
local, sin peticiones a Google Fonts. Las demás pantallas siguen pendientes.
Next tiene `agentRules: false` para preservar las instrucciones locales de agentes.

Referencias oficiales: [Next/Vitest](https://nextjs.org/docs/app/guides/testing/vitest),
[ESLint](https://nextjs.org/docs/app/api-reference/config/eslint),
[shadcn](https://ui.shadcn.com/docs/components-json) y
[Playwright](https://playwright.dev/docs/test-configuration).

## Auth SSR y preparación del proyecto Supabase

La app acepta únicamente `NEXT_PUBLIC_SUPABASE_URL` (HTTPS) y
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`), según `.env.example`.
No usa una secret key ni `service_role`. Cada petición crea su cliente servidor;
Proxy conserva cookies renovadas/eliminadas en request y response, incluso al
redirigir, junto a headers `Cache-Control`, `Expires` y `Pragma`. Todas las rutas
de aplicación tienen `private, no-store`; páginas privadas son dinámicas.
`getUser()` valida identidad contra Auth antes de consultar el RPC booleano
`current_user_is_crm_member()`. `getSession()` nunca decide autorización.
Layout, página privada y DAL vuelven a comprobar acceso. Toda futura operación
privada debe llamar `requireMember()` y usar su cliente sin keys privilegiadas.
El login valida credenciales y membresía en su propia action. Logout valida la
identidad, cierra la sesión local y limpia sólo cookies del proyecto; también está
disponible para una cuenta denegada o cuando Auth no responde. No revoca sesiones
de otros dispositivos ni habilita registro público.

El puente de la migración `202610070003_membership_bridge.sql` es SECURITY INVOKER,
con `search_path` vacío y EXECUTE sólo para `authenticated`. Reutiliza el helper
privado existente; no abre lectura de `crm_members` ni expone el schema privado.

La provisión remota inicial quedó verificada: registro público deshabilitado,
tres versiones exactas `202610070001`, `202610070002` y `202610070003` con SQL
igual al revisado, dos cuentas confirmadas y slots 1/2 explícitos. No se crearon
clientes ni se cambiaron proveedores o keys. La duración JWT final es 3600 segundos.
Para otra provisión autorizada, conservar estas guardas:

1. En Supabase Auth, mantener Email/Password habilitado y deshabilitar **Allow new
   users to sign up**. No hay formulario ni endpoint de registro en la app.
2. Provisionar exclusivamente las dos cuentas acordadas mediante administración
   de Auth. Establecer contraseñas en Supabase por un canal privado; no escribirlas
   en chat, repositorio, fixtures ni documentación. Verificar confirmación de email
   y acceso efectivo; anotar los dos UUID distintos, sin deducirlos del email.
3. Revisar historial de migraciones y esquema del proyecto. Aplicar, en orden,
   las migraciones `202610070001_shared_crm_schema.sql`,
   `202610070002_atomic_client_mutations.sql` y
   `202610070003_membership_bridge.sql` y `202610080004_rpc_conflict_errors.sql`
   sólo si aún no están aplicadas; no recrear
   tablas ni repetir scripts a ciegas sobre datos existentes.
4. En una transacción administrativa, consultar `public.crm_members` y comprobar
   los UUID contra `auth.users`. Si la tabla está vacía, insertar explícitamente
   slots 1 y 2 con esos UUID. Si ya tiene exactamente esos miembros, conservarla.
   Si cualquier slot pertenece a otra identidad o la configuración es parcial,
   detenerse para revisión: no usar upsert, DELETE ni reasignación automática.
5. Confirmar que Data API expone `public`, nunca `crm_private`; comprobar el RPC
   con cada cuenta autenticada, y su denegación para tercero/anónimo. No ejecutar
   el runner local contra este proyecto ni copiar su fixture de Auth/roles.
6. Verificar ingreso de ambos miembros, error de contraseña, logout, expiración y
   renovación real con cookies en dos peticiones sucesivas. Confirmar además
   denegación de tercero y de llamadas directas a operaciones/rutas privadas.

`npm test -- tests/auth` verifica guards, actions, cookies y formulario con seams
SDK simulados; no acredita Auth remoto. `PLAYWRIGHT_CHANNEL=msedge npm run
test:e2e -- tests/e2e/auth-local.spec.ts` usa servidor Next de producción y navegador
real para rutas sin sesión, validación nativa, logout local sin identidad y geometría
desktop/móvil. En PowerShell establecer `$env:PLAYWRIGHT_CHANNEL='msedge'` antes
del comando. Screenshots, video y trace permanecen desactivados. `npm run test:db`
comprueba el puente con dos UUID sintéticos, tercero y anon bajo roles reales;
es PostgreSQL local, no Supabase Auth/Data API. Las pruebas de ingreso/renovación
real usan `tests/e2e/auth-live.spec.ts`. No hay suites saltadas ni backend Auth
ficticio presentado como evidencia real.

Para repetir las pruebas live, completar los placeholders `CRM_LIVE_PROJECT_REF`,
`CRM_OWNER_EMAIL`, `CRM_PARTNER_EMAIL`, `CRM_OWNER_PASSWORD` y
`CRM_PARTNER_PASSWORD` sólo en `.env` ignorado o variables privadas del proceso.
El archivo `.env` local es obligatorio incluso al inyectar todos los valores;
las variables del proceso prevalecen como overrides. El harness selecciona esos
valores y las dos variables públicas; no carga PAT, secretos de
administración, contraseña DB ni token GitHub. No modifica configuración remota.
Después de `npm run build`, ejecutar en PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL='msedge'
$env:PLAYWRIGHT_NO_COPY_PROMPT='1'
npm run test:e2e -- tests/e2e/auth-live.spec.ts --workers=1
```

Los cuatro casos verifican ambos miembros con Auth `getUser()`, RPC booleano,
lectura RLS, payload inválido sin nuevas filas, ingreso UI/SSR, logout, contraseña
incorrecta, RPCs anónimos y renovación real con cookies en peticiones sucesivas.
La renovación fuerza sólo metadata SDK vencida, conserva el JWT firmado intacto
y exige un refresh token nuevo validado por el proveedor. No acredita expiración
criptográfica natural; esa comprobación usa el caso administrativo separado.

El modo `CRM_LIVE_NATURAL_EXPIRY=1` está disponible y deshabilitado por defecto;
registra un caso adicional, sin marcarlo como skip. Es una operación administrativa
que requiere autorización explícita del ajuste global y `SUPABASE_ACCESS_TOKEN`
privado. No ejecutarlo en una verificación readonly. Comprueba proyecto saludable,
dos cuentas/binding acordado, cartera vacía, signup deshabilitado y TTL 3600;
cambia sólo `jwt_exp` a 300, emite dos JWT con `exp-iat=300` y restaura 3600 en
`finally` antes de esperar, con readback de todos los flags. Conserva JWT/cookies
sólo en memoria y espera en tramos de hasta 30 segundos. Luego comprueba rechazo
del JWT viejo y SSR con refresh válido/revocado. El proveedor recomienda al menos
[cinco minutos](https://supabase.com/docs/guides/auth/sessions); no se afirma un
mínimo técnico obligatorio. Tras autorización explícita de ese ajuste global,
el caso pasó con ambos JWT emitidos válidos y vencidos naturalmente: Auth rechazó
los tokens viejos, SSR renovó la sesión con refresh válido (200, cookies nuevas y
segunda petición 200) y rechazó la sesión con refresh revocado (307 al ingreso
con `reason=expired`). El readback confirmó TTL 3600 y todos los demás flags
idénticos al baseline antes de esperar. El TTL final permanece en 3600 segundos.

Antes del binding se ejecutó además el modo `CRM_LIVE_EXPECT_UNBOUND=1`: una de
las dos cuentas reales autenticadas fue rechazada por RLS/RPC/SSR y por la UI.
Ese modo sirve sólo durante una provisión con membresía todavía vacía; no borrar
ni reasignar miembros para repetirlo. No representa una tercera identidad remota.
Las pruebas no insertan clientes, no usan un cliente administrativo para validar
autorización y no exportan sesiones, cookies, imágenes, video o trace.

Referencias oficiales: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs)
y [validación getUser](https://supabase.com/docs/reference/javascript/auth-getuser).

## Formulario de clientes — WU-006

`/clientes/nuevo` y `/clientes/[id]/editar` usan RPCs autenticados, con guard
independiente en páginas, action y DAL. Alta siempre Contactado; edición incluye
los seis estados. Nombre obligatorio, email opcional validado, campos vacíos
opcionales como null y fechas en Buenos Aires. La fecha de contacto inicial la
registra SQL al crear; fechas existentes sin editar conservan segundos/fracciones.
Horarios históricos inexistentes o ambiguos requieren corrección; un instante
original explícito sin cambios conserva su precisión. Una versión obsoleta muestra
el dato confirmado y exige Volver a editar. Fallos ambiguos mantienen datos/UUID
y bloquean cambiar el payload hasta reintentar; corregir un fallo definitivo genera
un nuevo intent. Cancelar conserva únicamente parámetros de filtros permitidos.

`npm test -- tests/clients` comprueba reglas/RPC/guardas/RTL con seams simulados;
no acredita persistencia remota. `tests/e2e/clients-form.spec.ts` utiliza la cuenta
owner ya provisionada para comprobar geometría desktop/móvil, zona independiente
del navegador, validación del servidor y navegación/logout, sin altas ni ediciones.
Requiere `.env` local y los parámetros privados/publicados de las pruebas Auth.

`tests/e2e/clients-live.spec.ts` es el caso CRUD opt-in. Tras aplicar la reparación004,
el caso remoto completo pasó con ambas cuentas: alta, edición y recarga, conflicto
HTTP409/`PT409`/`client_version_conflict`, conflicto en pantalla con versión3,
Volver a editar y guardado consciente con versión4, segundo alta y replay sin duplicado.
La recuperación y limpieza guardada terminaron; el readback confirmó las cinco
tablas de negocio en cero. El fixture del run anterior también quedó eliminado.
Requiere autorización específica de fixtures y limpieza antes de habilitar
`CRM_CLIENTS_LIVE_WRITE=1`; no correr en verificación readonly. Comprueba proyecto
explícito saludable, dos identidades/binding correctos y cartera/historia vacías.
Crea como máximo dos fixtures `WU006-<UUIDdelrun>` mediante UI/RPCs de usuario;
prueba recarga, edición de fechas/estado, conflicto entre socios y replay sin
duplicado. IDs, snapshots completos y pares actor/requestUUID viven sólo en memoria.
La limpieza administrativa bloquea únicamente esas filas, exige snapshots exactos
(incluyendo versión/fechas/nombre), prefix del run y solicitudes conocidas; detiene
ante cambio inesperado. Borra dependencias y ledger sólo de esas identidades de
fixtures, luego clientes, en una transacción. Un outcome incierto se lee antes de
cualquier reintento; no usa TRUNCATE/reset ni borra datos anteriores o de terceros.
La tabla y los filtros de TASK-005 están implementados; kanban queda para TASK-006.

La lista combina nombre parcial sin distinguir mayúsculas (incluidos caracteres
literales como `*`, `%` o `[]`), uno o varios estados y fechas de contacto inclusivas
en Buenos Aires. Usa `nombre`, `estado` repetible, `desde` y `hasta` en la URL.
La página `pagina` conserva el conjunto al navegar, crear, editar o cancelar;
aplicar filtros vuelve a la primera página y limpiar vuelve a `/clientes`.
La consulta paginada muestra 50 filas por página y obtiene el total exacto;
una respuesta truncada o sin total se presenta como error, sin ocultar clientes.
Las fechas calendario se validan desde 1900 y los días con cambios históricos de
hora abarcan desde su primer instante válido hasta el siguiente día local.

WU-007 comprobó 97 pruebas unitarias/RTL de clientes, lint, tipos y build.
El caso real existente pasó en Edge con escritorio1440/móvil390 y navegador en
Tokyo: tabla compartida, búsqueda literal, filtros combinados/ambos días,
retorno desde alta/edición, panel inline con Cancelar/Escape y foco, rango
inválido, sin resultados, limpieza de filtros y Estado/Editar en la misma columna
móvil. Una página posterior fuera de rango se reconoce sólo con HTTP416/`PGRST103`:
no inventa un total ni filas vacías y ofrece volver a la primera página conservando
filtros. La respuesta real tuvo data/count nulos y la recuperación con Enter pasó.
Un primer fallo fue del harness al comparar el orden de claves URL;
se corrigió la comparación semántica tras confirmar la limpieza. El run final
pasó con los mismos dos fixtures y sus guardas de recuperación/cleanup intactas;
readback final confirmó clientes, transiciones, hitos, correcciones y ledger0,
Auth2/members2, JWT3600 y signup deshabilitado. No se repitieron pruebas SQL/Auth
sin cambios. Capturas/video/trace están apagados; los metadatos textuales generados
por el runner se eliminaron al cerrar la comprobación, sin reportes persistentes.

La migración incremental `202610080004_rpc_conflict_errors.sql`, aplicada y
verificada en el proyecto remoto, cambia los errores de negocio `client_version_conflict` e
`incomplete_request` de `40001` a `PT409` (HTTP 409). El consumidor distingue sus
mensajes exactos; una reserva incompleta conserva el intent y no muestra un
conflicto de versión. No reescribe las tres migraciones anteriores ni altera grants.
Antes de la reparación, el diagnóstico remoto devolvió HTTP 504 sin código; el
caso legado `40001`/HTTP 500 de las pruebas unitarias es compatibilidad defensiva.
Supabase documenta [reintentos del proveedor con errores 40001 personalizados](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).
La versión `202610080004`/`rpc_conflict_errors` registra la fuente revisada fielmente;
historial001–003, función, owner y permisos quedaron verificados. Duración JWT3600,
signup deshabilitado y las dos membresías permanecen iguales. El caso CRUD requiere
su permiso explícito de fixtures/limpieza; no borrar por prefijo genérico.
