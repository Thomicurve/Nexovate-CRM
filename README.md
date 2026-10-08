# Nexovate CRM

CRM privado en español con Next.js App Router, login SSR, clientes en Kanban/tabla,
filtros, formularios y dashboard histórico. Las cinco migraciones y las dos cuentas
autorizadas están provisionadas en Supabase. Auth, persistencia, conflictos,
movimientos y métricas tienen pruebas reales; la duración JWT final es una hora.
La preparación para Vercel está documentada; no se ha realizado un despliegue.

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

`npm test` ejecuta las suites unitarias/RTL de Auth, clientes y métricas con seams
simulados. Playwright verifica rutas locales e integración con las dos cuentas
reales. Los casos live con fixtures son opt-in y requieren su permiso específico;
no activar sus flags para una comprobación readonly ni sustituir Auth por mocks.
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

`tests/e2e/crm-flow.spec.ts` comprueba navegación integrada de ambos socios con
Tab/Enter/Escape, foco visible y etiquetas en escritorio1440/móvil390: login,
dashboard cargado, Kanban/tabla, filtros, borrador cancelado y logout/protección.
Es readonly para datos de negocio y exige cartera vacía; bloquea POSTs privados
durante el recorrido. Reutiliza los casos aceptados para CRUD/historial/conflictos.
Con `.env` y las variables privadas live descritas abajo, sin flags administrativas:

```powershell
$env:PLAYWRIGHT_CHANNEL='msedge'
npm run test:e2e -- tests/e2e/crm-flow.spec.ts --workers=1 --retries=0
```

## Preparación para Vercel

Estos pasos preparan una publicación futura; requieren elegir destino y autorizar
el despliegue. [Vercel soporta Next.js directamente](https://vercel.com/docs/frameworks/full-stack/nextjs),
sin un `vercel.json` adicional para esta aplicación.

1. Seleccionar el repositorio/revisión aprobados, preset **Next.js** y raíz del
   repositorio. Configurar [Node22.x](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
   conforme a `engines`; Vercel administra sus versiones menores/parches.
2. Usar instalación `npm ci`, build `npm run build` y directorio de salida automático
   de Next.js, según la [configuración oficial](https://vercel.com/docs/builds/configure-a-build).
   Conservar el lockfile. No ejecutar migraciones ni pruebas con fixtures en el build.
3. Definir únicamente `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   de `.env.example` en cada entorno elegido (Production y, si corresponde, Preview/Development).
   Deben existir antes del build: [Next incorpora las variables públicas al bundle](https://nextjs.org/docs/app/guides/environment-variables).
   Un cambio requiere otro build. No cargar passwords, variables `CRM_*`, PAT,
   contraseña DB, secret key ni `service_role`; pertenecen al harness o administración.
4. Verificar el proyecto Supabase acordado, migraciones001–005 en orden, Email/Password,
   signup deshabilitado y exactamente dos cuentas/bindings. El procedimiento de
   provisión está abajo; no recrear ni reaplicar sobre un proyecto ya provisionado.
   El login actual usa contraseña sin callback externo. Para futuros flujos de
   confirmación/reset, revisar [Site URL y redirects](https://supabase.com/docs/guides/auth/redirect-urls)
   contra el dominio autorizado; no agregar comodines o proveedores automáticamente.
5. Después de una publicación autorizada, comprobar HTTPS, ingreso de ambos socios,
   navegación, logout y rechazo posterior de rutas privadas con `no-store` en el
   destino real. Cualquier prueba que escriba clientes necesita su lifecycle aprobado.
   Build local e instrucciones no acreditan despliegue, URL ni configuración remota.

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

## Métricas históricas — WU-009

La migración `202610080005_dashboard_metrics.sql`, aplicada y verificada en Supabase
con autorización específica, agrega el RPC readonly
`dashboard_metrics(p_from date, p_until date, p_grouping text)`.
Usa SECURITY INVOKER, RLS y membresía explícita. PUBLIC y anon no tienen EXECUTE;
authenticated lo tiene, con grants predeterminados de postgres y service_role conservados.
El guard de identidad y membresía corre antes de leer, incluso con bypass de RLS.
Una consulta STABLE mantiene el mismo snapshot
para totales y series, sin descargar hitos mediante paginación REST.

`src/lib/metrics/server.ts` comprueba membresía antes de validar parámetros o consultar.
`desde`, `hasta` y `agrupacion=day|month|year` usan fechas inclusivas en Buenos Aires;
el valor inicial son los últimos siete días locales, incluido hoy. Cada métrica
incluye total histórico, total del rango y buckets calendario en orden, incluso ceros.
Las series con más de 2.000 períodos devuelven `too_many_buckets`, cardinalidad y
totales completos, sin truncar; elegir Mes/Año o reducir el rango (en Año, reducirlo).
Errores de consulta o respuestas incoherentes producen `unavailable`, nunca ceros.

`npm test -- tests/metrics` comprueba parser/contrato/boundary mediante seams SDK;
`npm run test:db` demuestra agregación, historial, zona, permisos y más de 1.000 hitos
en PostgreSQL nuevo aislado. Ninguno acredita aplicación remota de esta migración.

## Dashboard — WU-010

El dashboard distingue totales del rango e históricos, permite aplicar fechas
explícitamente y cambiar Día/Mes/Año sobre el rango ya aplicado. Gráficos Recharts
3.10.1 usan teclado y tooltip; cada serie ofrece una tabla semántica con todos los
períodos, incluidos ceros. Carga, sin historial, sin actividad en rango, rango inválido,
serie excesiva y fallo de consulta tienen mensajes y acciones propios.

`tests/e2e/dashboard.spec.ts` comprueba SSR, controles y escritorio/móvil sin clientes
nuevos. Declara si observó datos disponibles o fallo de RPC; un fallo no prueba charts.
Después de build, usar Edge con screenshots/video/trace desactivados como los demás casos.

El caso TASK-007 de `clients-live.spec.ts` requiere permiso específico de fixtures y
limpieza antes de `CRM_DASHBOARD_LIVE_WRITE=1`; es incompatible con las otras dos flags.
Reutiliza el lifecycle y cleanup existentes sin cambios, prefijo legado `WU006-<UUID>`
y máximo dos clientes por run. El flow registra solicitudes antes de cada escritura,
espera respuesta y snapshot confirmado, y conserva el intent completo ante outcome incierto.
Recovery exige ledger completo; cleanup bloquea IDs propios y rechaza snapshots o solicitudes
desconocidos antes de borrar únicamente dependencias, pares ledger y esos dos clientes.
No borrar por prefijo ni reintentar un DELETE incierto; leer su resultado.

Con autorización específica, la migración005 y su registro exacto se aplicaron en una
transacción, conservando las cuatro versiones anteriores, configuración y cuentas.
La primera prueba real TASK-007 pasó en Edge (23,7 s): ambos miembros, retorno y salto
de etapas, corrección de contacto y cita independiente, totales y series Día/Mes/Año,
gráficos con tooltip por teclado, tablas completas y móvil390 sin overflow.
Recovery, cleanup propio y sign-outs terminaron; readback confirmó las cinco tablas
de negocio vacías, sin escrituras activas, y función/ACL/historial/configuración intactos.
La repetición independiente autorizada pasó en Edge (21,5 s / 25,1 s total), con el
mismo caso TASK-007 y máximo dos fixtures. Confirmó primeros hitos, regreso/salto,
contacto/cita, totales Día/Mes/Año, SVG por teclado, tablas y móvil, además del conflicto
HTTP409/PT409 con rollback confirmado. Cleanup dejó las cinco tablas vacías;
Auth/REST, función/ACL y las cinco versiones de migración permanecieron intactos.

## Convenciones

Código en `src/`; alias `@/` → `src/`. Tailwind 4 usa PostCSS y configuración CSS.
`components.json` y `src/lib/utils.ts` preparan shadcn/ui. El login reproduce
DESIGN-2 aprobado en `crm-nexovate.pen` y carga IBM Plex Sans desde el paquete
local, sin peticiones a Google Fonts. Dashboard, Kanban, tabla y formularios
implementan también el diseño aprobado.
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
   `202610070003_membership_bridge.sql`, `202610080004_rpc_conflict_errors.sql` y
   `202610080005_dashboard_metrics.sql`
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
La tabla y los filtros de TASK-005 están implementados. TASK-006 agrega Kanban como
vista inicial, con seis columnas en escritorio y una columna seleccionable en móvil.

La lista combina nombre parcial sin distinguir mayúsculas (incluidos caracteres
literales como `*`, `%` o `[]`), uno o varios estados y fechas de contacto inclusivas
en Buenos Aires. Usa `nombre`, `estado` repetible, `desde` y `hasta` en la URL.
La página `pagina` y `vista=tabla` (o `vista=kanban`, predeterminada) conservan el
conjunto al navegar, crear, editar o cancelar. Aplicar filtros vuelve a la primera
página; limpiar conserva la vista. Ambas vistas usan los mismos 50 clientes y total;
los conteos de las columnas corresponden sólo a esa página. Estado visible en móvil
elige una columna sin modificar los filtros.
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

Los movimientos usan `@dnd-kit/core` 6.3.1: puntero o Enter/Espacio para levantar y
confirmar, flechas izquierda/derecha para cambiar de columna y Escape para cancelar.
En móvil, Editar permite elegir cualquiera de los seis estados desde el formulario.
La operación autenticada envía exclusivamente el estado, UUID de solicitud y versión
esperada. No reconvierte fechas ni sobrescribe otros campos. Una operación pendiente
bloquea nuevos movimientos y navegación del panel; ante un resultado incierto se
restaura la tarjeta y se reintenta con la misma intención. Un conflicto recupera la
versión confirmada y ofrece volver a editar, sin sobrescribir al socio.

El procedimiento real TASK-006 está preparado en `tests/e2e/kanban-live-flow.ts` y
comparte el harness de `clients-live.spec.ts`. Requiere autorización específica nueva
antes de habilitar `CRM_KANBAN_LIVE_WRITE=1`; no usar a la vez `CRM_CLIENTS_LIVE_WRITE`.
Todo el caso crea como máximo dos fixtures. Conserva el prefijo técnico legado WU006
para reutilizar las guardas exactas de recuperación/limpieza ya revisadas. El parser
registra intenciones de acciones antes de permitir enviarlas y rechaza sobres
desconocidos; retries idénticos conservan un único par actor/request. El caso comprueba
puntero/teclado/cancelación, recarga, pérdida de respuesta después del commit con replay,
conflicto entre socios, hitos sin duplicados, vistas/filtros y alternativa móvil.
Con autorización específica, el caso real TASK-006 pasó en Edge (33,5 s): movimientos
por puntero/teclado y recarga, cancelación y drop fuera sin escrituras, pérdida de
respuesta después de confirmar el ledger, replay del mismo UUID, conflicto real
HTTP409/PT409 sin sobrescribir al socio y regreso por etapas sin repetir hitos.
También comprobó tarjetas móviles de326px en columna358px, edición manual de estado,
cambio de vista y retorno con filtros. Recuperación, limpieza guardada y cierre de
sesiones terminaron; readback confirmó las cinco tablas de negocio en cero.
El harness espera destinos, guardados y navegación confirmados antes de sus lecturas;
si falla, conserva el último intento de cinco campos en stdout para recuperarlo.
Una corrida anterior se detuvo correctamente ante un outcome incierto y requirió
limpieza específica revisada de dos IDs/nueve solicitudes con snapshots y locks;
no se clasificó como rollback ni se alteraron las guardas. SQL, Auth, permisos,
duración JWT y configuración de Supabase conservaron sus valores originales.

TASK-009 conserva esa recuperación y cambia el retorno de alta/edición al listado
con filtros/vista válidos. La notificación global usa la respuesta confirmada de la
acción; no acepta indicadores de éxito en la URL. Se cierra a los seis segundos de
tiempo activo y pausa con foco o puntero encima. El cuerpo de las tarjetas inicia
drag con ratón; Editar sigue disponible. Shift permite seleccionar texto; en móvil
se conserva el scroll táctil y la alternativa Editar. El kanban muestra Contactado,
Interesado, Reunión agendada, Cerrado, Sin respuesta y Respuesta negativa.

Para checks aislados del desarrollo existente, usar `CRM_CHECK_ISOLATED=1`: build
y start emplean `.next-task009`, y Playwright emplea puerto3109 sin reutilizar el
servidor3000. Next puede regenerar `next-env.d.ts` y `tsconfig.json`; capturar sus
bytes antes del build y restaurar sólo la generación propia después. `tsc --noEmit
--incremental false` permite comprobar tipos sin ejecutar typegen sobre desarrollo.
`tests/e2e/client-feedback-readonly.spec.ts` bloquea POSTs de negocio y verifica
drag/cancelación sólo sobre tarjetas existentes; si no hay clientes declara el gap.

El opt-in `CRM_FEEDBACK_LIVE_WRITE=1` prepara el recorrido positivo TASK-009 con
máximo dos fixtures, alta/edición/retorno/notificaciones y movimientos confirmados,
replay/conflicto/cleanup exacto del harness. Es exclusivo frente a los otros tres
flags de fixtures y requiere una revisión y permiso nuevo antes de ejecutarse.
Sólo ese modo admite una cartera existente: filtra la UI por su prefijo único,
restringe cada escritura a solicitudes registradas/UUIDs propios y valida también
el formulario multipart de la edición manual del kanban. Los otros tres modos
conservan su guard de baseline vacío. Antes del recorrido y después del cleanup
compara conteos y SHA256 calculados en el servidor para las cinco tablas de negocio,
excluyendo sólo IDs propios; no devuelve filas de clientes ni timestamps de Auth.
Un cambio ajeno provoca un fallo explícito y no autoriza su limpieza. El DELETE
exacto con snapshots/ledger desconocido/readback y el helper de recuperación
permanecen sin ampliar su alcance. Esta preparación no se ha ejecutado contra
Supabase; las corridas históricas no demuestran los nuevos éxitos en navegador.
