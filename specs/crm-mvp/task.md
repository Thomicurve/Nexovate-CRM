# CRM interno de Nexovate — plan y tareas

**Definición:** [spec.md](spec.md) · **Feature:** crm-mvp
**Plan:** PLAN-1 · **Definición cubierta:** SPEC-1

## Cómo trabajaremos

- **Modo:** ASK_EACH_TASK, elegido explícitamente en el pedido inicial: “vamos a trabajar tarea por tarea” y “no te vas a mandar a hacer todas las tareas iniciales de una”. No se pregunta nuevamente por el modo.
- **Aprobación del plan:** APPROVE_CURRENT_PLAN, SPEC-1/PLAN-1. Respuesta del usuario al pedido de aprobación: “Dale comenza con la task-001” (2026-10-07). Incluye inicio exclusivo de TASK-001 y los commits locales propuestos por unidad revisada.
- **Estado de preparación:** CHECKING, TASK-001; escritor detenido y las siguientes tareas permanecen TODO.
- **Primera tarea propuesta:** TASK-001. Aprobar PLAN-1 permite iniciar únicamente esa tarea; cada siguiente requiere continuación explícita.
- **TDD:** ON por pedido del usuario. Para comportamiento: prueba significativa, RED observado, implementación mínima, GREEN y refactor. Setup y diseño son N/A; no se fabrican tests ni evidencias RED/GREEN.
- **Roles:** Orchestrator conserva decisiones y documentos. Un único Implementer escribe aplicación. Se detiene antes de comprobaciones/revisión independientes; Reviewer revisa cada unidad sustancial. Autenticación, autorización, transacciones, migraciones e instalación requieren verificación independiente adicional.
- **Diseño:** TASK-002 entrega Pencil para revisión; aprobación exacta y verificación de nodos requerida antes de UI material.

## Base observada y límites de entrega

Baseline de preparación verificado: `E:/Freelance/Nexovate-CRM`, rama `master`, repositorio sin HEAD ni remotos, sin package.json ni aplicación. Node `v22.22.3` y npm `10.9.8` disponibles. `psql`, Supabase CLI y Docker no fueron encontrados como comandos; esto no demuestra que exista o no un servicio externo. Para TASK-001 Delivery preparó y verificó `feature/crm-mvp`, todavía sin HEAD antes del primer commit.

El baseline contiene `.agents/`, `.codex/`, `.gitignore` y `AGENTS.md` sin seguimiento Git; `.env` y `crm-nexovate.pen` ya existen y están ignorados. No se ha leído el contenido del `.env` ni del Pencil. Workflow, AGENTS, secretos y Pencil quedan fuera del commit; `.gitignore` está autorizado por TASK-001 y conserva sus reglas preexistentes al agregar los ignorados de la aplicación.

Se aprobó una sola rama de requisito `feature/crm-mvp`, en el checkout actual, preparada por Implementer Delivery. Al no existir HEAD, el primer commit tendrá base vacía; no hay SHA de origen que registrar todavía. No crear ramas por tarea ni worktrees. Un commit local por unidad coherente después de checks y revisión, mediante staging de rutas seleccionadas; autoridad concedida en la respuesta del usuario del 2026-10-07.

Las unidades forman una sola entrega local del MVP. Push, PR, merge, configuración/migraciones/usuarios remotos y deploy no están autorizados por este plan. Vercel se prepara documentalmente en TASK-008; la publicación posterior tendrá su propia autorización y destino verificado.

## Comprobaciones propuestas

TASK-001 creó y documentó estos scripts; su ejecución observada figura en el recibo de la tarea:

- `npm run lint`: ESLint.
- `npm run typecheck`: TypeScript sin emisión.
- `npm run build`: build de Next.js.
- `npm test -- <ruta>`: Vitest para pruebas enfocadas; `npm test` para el conjunto unitario/integración aplicable.
- `npm run test:e2e -- <ruta>`: Playwright para flujos de navegador reales.
- `npm run test:db`: runner de integración SQL contra una base aislada, con migraciones y fixtures sintéticos.

El runner SQL y destino de prueba necesitan verificación antes de TASK-003; no seleccionar una base de producción ni instalar herramientas globalmente. La inspección de nombres de variables necesarias en `.env`, sin divulgar valores, puede realizarse al iniciar la integración; existencia del archivo no prueba una conexión.

Playwright tendrá screenshots, video y trace desactivados; no usar snapshots visuales ni comandos de captura. Las pruebas de navegador verifican DOM, accesibilidad y comportamiento. Vitest no se usa como sustituto de ejecución real de Server Components asíncronos o de SQL/RLS.

## Tareas

### TASK-001 — Base Next.js y entorno TDD

**Estado:** IN_PROGRESS · **Criterios:** AC-001

Preparar Next.js App Router con TypeScript, Tailwind y convenciones para shadcn/ui, junto a Vitest, Testing Library y Playwright. Registrar versiones concretas compatibles y fijar dependencias localmente. Crear scripts y documentación de ejecución. Mantener la base mínima, sin construir todavía las pantallas funcionales.

- **Depende de:** aprobación explícita de PLAN-1 y de esta primera tarea.
- **Rutas candidatas permitidas:** `package.json`, `package-lock.json`, `next.config.*`, `next-env.d.ts`, `tsconfig.json`, `eslint.config.*`, `postcss.config.*`, `components.json`, `vitest.config.*`, `playwright.config.*`, `.gitignore`, `.env.example` sin valores reales, `src/app/{layout.tsx,page.tsx,globals.css}`, `src/lib/utils.ts`, `tests/setup.*`, `tests/support/**`, `scripts/check-test-db.*`, `README.md`. Nada en `.codex/` ni `.agents/`.
- **Terminada cuando:** instalación local y build reproducibles, tipos/lint correctos, configuración de runners documentada y validada sin pruebas artificiales. Diagnóstico SQL/browser explícito; no afirmar suites de negocio verdes antes de crearlas.
- **Checks:** lint, typecheck y build; inspección de configuraciones y descubrimiento de runners. TDD N/A para setup.
- **Unidad:** WU-001, configuración propia estimada 260–330 líneas / 12–20 archivos, confianza media; ajuste de diagnóstico SQL/browser y documentación de suites todavía ausentes, sin cambio de alcance. Scaffold, componentes copiados y lockfile separados. Commit candidato `chore: bootstrap Next.js and test tooling`.
- **Resultado:** WU-001 implementada, escritor detenido; verificación independiente COMPLETED y Reviewer APPROVED, sin hallazgos. Commit local pendiente. Candidato: 20 archivos de setup, 329 líneas propias, 7 líneas de tipos Next generadas y 8.610 de lockfile; más estos documentos de planificación.
- **Evidencia aceptada:** writer `npm install` y `npm ci` exit 0 (453 paquetes); independiente lint/typecheck/build/npm ls exit 0, navegador Edge real y smoke de producción HTTP 200/heading DOM correctos, servidor cerrado (0 listeners en 3000). Operaciones Next/browser necesitaron escalación exacta por permisos Windows. Vitest y E2E discovery sin suites, exit 1 esperado; SQL diagnóstico exit 1 y ninguna conexión/mutación. Esos resultados no son GREEN de negocio. Runners y fuentes revisados por Reviewer con digest agregado `b12fd1135c48902648edfccfea7fe6e17d8e9aa004cdae3ce9a7287bcb55bb8d`.
- **Límite observado:** Next generó un bloque managed en AGENTS durante el primer dev; retirado con función oficial, `agentRules: false` evita nueva escritura. Hash AGENTS estable durante segundo dev y verificación: `286E15EBA990C4A9CD0385CF967628B7865C876532E0FFD45FD04E936E2B0995`; no existe hash histórico previo al primer dev. El único cambio automático durante verificación fue `next-env.d.ts` de tipos dev a producción, revisado en su versión final (blob `ce4e94a6b10f160ee021fe18939af160d2927dcf`).

### TASK-002 — Diseño de las pantallas en Pencil

**Estado:** TODO · **Criterios:** AC-002, AC-011

Designer inspecciona el archivo existente y define login, navegación, dashboard, panel kanban/tabla y formulario con los campos acordados. Incluye escritorio/móvil y estados vacío, carga, error y conflicto. Entrega nodos editables y solicita revisión a través del Orchestrator.

- **Depende de:** TASK-001 aceptada; SPEC-1 aprobado.
- **Superficie permitida:** `crm-nexovate.pen` mediante herramientas nativas Pencil. No escribir aplicación ni generar imágenes/exportaciones.
- **Terminada cuando:** el usuario aprueba la versión exacta y Designer verifica que sus nodos siguen correspondiendo a la aprobación y criterios.
- **Checks:** consultas textuales de nodos, layout, dimensiones, textos y estados; revisión del usuario en el documento real. TDD N/A.
- **Unidad:** WU-002, nodos editables, líneas no aplicables. El archivo ya está ignorado: no afirmar un commit de diseño. Orchestrator registra IDs/aprobación en este plan; Delivery puede incluir sólo esa actualización de documentación autorizada.
- **Resultado:** documento/nodos/aprobación pendientes; no diseño inspeccionado todavía.

### TASK-003 — Datos, autorización e historial consistente

**Estado:** TODO · **Criterios:** AC-003, AC-005 (modelo), AC-006, AC-009 (hitos)

Definir y probar migraciones de clientes, dos miembros autorizados, transiciones y primeros hitos. Autorizar la cartera compartida mediante RLS y permisos. Implementar altas/actualizaciones atómicas con validación, control de versión e idempotencia; corregir fecha de contacto junto a su hito y auditoría. Sin pantallas ni escrituras a un Supabase remoto sin autorización concreta.

- **Depende de:** TASK-001 y TASK-002 aceptadas; entorno PostgreSQL aislado y runner reales disponibles antes de implementar el comportamiento SQL.
- **Rutas candidatas permitidas:** `supabase/migrations/**`, `supabase/tests/**`, `supabase/config.toml` si necesario, `src/lib/clients/**`, `src/lib/database/**`, `src/types/database.ts`, `tests/clients/**`, `tests/database/**`, soporte SQL acotado de `tests/support/**` y `scripts/**`, `README.md`/`.env.example` sólo para integración.
- **Terminada cuando:** dos miembros comparten lectura/escritura; anónimo/tercero son rechazados; no autoasignación de membresía ni modificación directa de historial; seis estados válidos; rollback, repetición, corrección y dos escrituras concurrentes comprobados contra PostgreSQL real.
- **Checks:** RED/GREEN de pruebas de dominio y `test:db`, lint/typecheck/build afectados; verificación independiente de RLS/permisos/transacciones.
- **Unidades:** WU-003 autorización/esquema, 200–350 líneas / 4–8 archivos; WU-004 transiciones/hitos/concurrencia, 250–450 / 5–9 archivos. Confianza media-baja. Commits candidatos `feat: restrict shared CRM data to two members` y `feat: persist client transitions and milestones atomically`.
- **Resultado:** pendiente. Sin prueba SQL real esta tarea no puede ser DONE.

### TASK-004 — Login y protección de la aplicación

**Estado:** TODO · **Criterios:** AC-003 (aplicación), AC-004, AC-011 (login)

Integrar Supabase Auth SSR, login email/password, logout, validación de identidad/membresía y rutas/operaciones protegidas. Usar el diseño aprobado. No incorporar registro público ni privilegios de bypass RLS en la app.

- **Depende de:** TASK-002 y TASK-003 aceptadas; configuración y dos identidades de prueba verificadas.
- **Rutas candidatas permitidas:** `src/lib/supabase/**`, `src/lib/auth/**`, `src/app/login/**`, `src/app/(crm)/layout.tsx`, `src/proxy.ts` o equivalente de la versión elegida, `src/components/auth/**`, componentes shadcn estrictamente necesarios en `src/components/ui/**`, `tests/auth/**`, `tests/e2e/auth*`, `.env.example`/`README.md` sólo para Auth, manifest/lockfile para dependencias requeridas.
- **Terminada cuando:** ingreso de ambos miembros, error de credenciales, expiración/renovación de sesión, denegación de tercero y acceso sin sesión, protección de operaciones y logout comprobados.
- **Checks:** RED/GREEN unitario y E2E Auth; lint/typecheck/build; verificación y revisión independientes de seguridad.
- **Unidad:** WU-005, 350–650 líneas propias / 10–16 archivos, confianza media. Mantener comportamiento de sesión y sus tests juntos aunque supere 400 líneas. Commit candidato `feat: add restricted CRM login and session protection`.
- **Resultado:** pendiente.

### TASK-005 — Alta, edición, tabla y filtros

**Estado:** TODO · **Criterios:** AC-005, AC-006 (edición), AC-007 (tabla), AC-011 (panel)

Crear el panel de clientes con tabla, formulario de alta/edición y filtros combinables. Nombre obligatorio; empresa, email, teléfono, Rubro, notas y cita opcionales; fecha contacto editable. Conservar filtros en la navegación y presentar errores/conflictos útiles.

- **Depende de:** TASK-002, TASK-003 y TASK-004 aceptadas.
- **Rutas candidatas permitidas:** `src/app/(crm)/clientes/**`, `src/components/clients/**`, `src/components/ui/**` estrictamente necesarios, `src/lib/clients/**`, `tests/clients/**`, `tests/e2e/clients*`; manifest/lockfile sólo para dependencias requeridas.
- **Terminada cuando:** alta/edición persisten en base real y se mantienen al recargar; validaciones correctas; nombre/estado/fecha combinados y límites inclusivos; estados carga/vacío/sin resultados/error/conflicto; cambio de estado manual accesible.
- **Checks:** RED/GREEN de formularios/consultas/filtros; E2E CRUD/filtros y checks estáticos/build afectados; revisión después de detener escritor.
- **Unidades:** WU-006 formulario/operaciones, 400–700 líneas / 8–12 archivos; WU-007 tabla/filtros, 400–650 / 7–11 archivos. Confianza media-baja. Commits candidatos `feat: create and edit prospective clients` y `feat: list and filter shared clients`.
- **Resultado:** pendiente.

### TASK-006 — Kanban, drag and drop y cambio de vista

**Estado:** TODO · **Criterios:** AC-007 (vistas), AC-008, AC-011 (kanban)

Agregar la vista inicial kanban con seis columnas y alternancia a tabla. Reutilizar consultas, filtros, formulario y operaciones de TASK-005. Integrar drag and drop accesible con confirmación de persistencia y restauración del estado correcto ante fallo.

- **Depende de:** TASK-005 aceptada y diseño exacto aprobado.
- **Rutas candidatas permitidas:** componentes kanban/switch en `src/components/clients/**`, `src/app/(crm)/clientes/**`, operación compartida en `src/lib/clients/**`, `tests/clients/**`, `tests/e2e/kanban*`; manifest/lockfile para dnd-kit compatible.
- **Terminada cuando:** mismos clientes/filtros en tabla y kanban; movimiento entre columnas por puntero/teclado y alternativa desde formulario; estado guardado tras recarga; fallo/conflicto sin cambio ficticio ni hitos duplicados.
- **Checks:** RED/GREEN de interacción y E2E de persistencia/fallo/conflicto; lint/typecheck/build y revisión.
- **Unidad:** WU-008, 350–650 líneas / 6–10 archivos, confianza media. Commit candidato `feat: add client kanban and view switch`.
- **Resultado:** pendiente.

### TASK-007 — Dashboard con métricas históricas

**Estado:** TODO · **Criterios:** AC-009, AC-010, AC-011 (dashboard)

Agregar totales y series de Contactados, Reuniones agendadas y Cerrados con selector de rango y agrupación día/mes/año. Consultar primeros hitos respetando autorización y representar períodos vacíos.

- **Depende de:** TASK-003, TASK-004 y TASK-006 aceptadas; diseño aprobado.
- **Rutas candidatas permitidas:** `src/lib/metrics/**`, `src/app/(crm)/dashboard/**`, `src/components/dashboard/**`, componentes gráficos necesarios en `src/components/ui/**`, migración de agregaciones en `supabase/migrations/**`, `supabase/tests/**`, `tests/metrics/**`, `tests/e2e/dashboard*`; manifest/lockfile para Recharts.
- **Terminada cuando:** totales y series coinciden con fixtures SQL reales; regreso a etapa no duplica, salida no borra, saltos no inventan etapas, corrección contacto mueve sólo su hito, fecha cita no altera hito; zona local y límites día/mes/año correctos.
- **Checks:** RED/GREEN de agregación/dominio SQL y componentes; E2E dashboard; lint/typecheck/build; comprobación independiente de permisos/consultas SQL si cambian.
- **Unidades:** WU-009 métricas SQL/dominio, 200–350 líneas / 5–8 archivos; WU-010 dashboard, 250–450 / 6–10 archivos. Confianza media-baja. Commits candidatos `feat: aggregate historical CRM milestones` y `feat: display CRM dashboard trends`.
- **Resultado:** pendiente.

### TASK-008 — Validación del MVP y preparación para Vercel

**Estado:** TODO · **Criterios:** AC-001–AC-012 (integración), especialmente AC-012

Completar pruebas del flujo integrado y documentar configuración, provisión de dos cuentas, migraciones y pasos de despliegue en Vercel. Reutilizar evidencia válida de unidades anteriores y comprobar las integraciones aún no cubiertas. La verificación independiente y revisión final ocurren después de detener al escritor; reparaciones se asignan al alcance responsable.

- **Depende de:** TASK-001–TASK-007 aceptadas, commits locales verificados y evidencia de seguridad/SQL real disponible.
- **Rutas candidatas permitidas:** `tests/e2e/crm-flow*`, `tests/e2e/accessibility*`, `tests/support/**`, `README.md`, `.env.example` sin secretos; ajustes mínimos de config de comprobaciones si se justifican. Sin ejecutar deploy ni modificar producción.
- **Terminada cuando:** flujo real completo de ambos socios y denegación de tercero comprobados; comportamiento responsive/accesible verificado sin imágenes; pruebas aplicables, tipos, lint y build aceptados; instrucciones Vercel coherentes y gaps materiales resueltos.
- **Checks:** test unitario aplicable, test:db, test:e2e, lint/typecheck/build; verificación independiente enfocada en integración pendiente y revisión de entrega. Sin repetir idéntica evidencia ya aceptada para candidatos sin cambios.
- **Unidad:** WU-011, 100–200 líneas propias / 3–6 archivos, confianza media. Commit candidato `test: verify CRM flow and document Vercel setup`.
- **Resultado:** pendiente. Una guía de despliegue no demuestra publicación remota.

## Estimación y decisiones del plan

Ocho tareas, once unidades coherentes; aproximadamente **2.760–4.780 líneas propias** entre código, SQL, pruebas y documentación, confianza media-baja. No sumar como autoría scaffold, componentes shadcn copiados, lockfile o nodos Pencil. Archivos compartidos entre unidades no se cuentan como archivos únicos diferentes. El tamaño se mide sobre el candidato real antes de cada commit; un crecimiento material se comunica antes de alterar las unidades previstas.

Propuestas explícitas incluidas: cartera compartida con permisos iguales; Rubro como texto opcional; fecha del filtro = fecha de contacto; zona Buenos Aires; corrección de fecha contacto actualiza su hito con auditoría; los demás hitos conservan fecha de primera transición; stack de gráficos/pruebas y diseño candidato según SPEC-1. El diseño detallado tendrá aprobación propia en TASK-002.

Pendiente verificar en la tarea pertinente: nodos Pencil, nombres de variables sin exponer valores, proyecto Supabase y dos identidades, entorno SQL aislado, navegador de pruebas y autorizaciones concretas para operaciones remotas. Esos recursos no bloquean preparar TASK-001, pero no se presume su disponibilidad al cerrar tareas posteriores.

## Siguiente paso

- **Próxima tarea:** TASK-001 — Base Next.js y entorno TDD.
- **Continuación:** CONTINUE_TASK para TASK-001.
- **Decisión del usuario:** “Dale comenza con la task-001”, después de presentar SPEC-1/PLAN-1 e incluir commits locales revisados.
- **Consumida por:** Implementer TASK-001; no autoriza TASK-002 ni operaciones remotas. Delivery verificó `feature/crm-mvp` unborn e índice vacío antes de iniciar el escritor.
