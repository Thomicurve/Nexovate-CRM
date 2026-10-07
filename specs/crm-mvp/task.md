# CRM interno de Nexovate — plan y tareas

**Definición:** [spec.md](spec.md) · **Feature:** crm-mvp
**Plan:** PLAN-1 · **Definición cubierta:** SPEC-1

## Cómo trabajaremos

- **Modo:** ASK_EACH_TASK, elegido explícitamente en el pedido inicial: “vamos a trabajar tarea por tarea” y “no te vas a mandar a hacer todas las tareas iniciales de una”. No se pregunta nuevamente por el modo.
- **Aprobación del plan:** APPROVE_CURRENT_PLAN, SPEC-1/PLAN-1. Respuesta del usuario al pedido de aprobación: “Dale comenza con la task-001” (2026-10-07). Incluye inicio exclusivo de TASK-001 y los commits locales propuestos por unidad revisada.
- **Estado de preparación:** CHECKING, DESIGN-2 aprobado, verificado y revisado; entrega documental de TASK-002 en curso. TASK-003 y siguientes permanecen TODO.
- **Primera tarea del plan:** TASK-001, completada con su autorización consumida. Cada siguiente tarea requiere continuación explícita.
- **TDD:** ON por pedido del usuario. Para comportamiento: prueba significativa, RED observado, implementación mínima, GREEN y refactor. Setup y diseño son N/A; no se fabrican tests ni evidencias RED/GREEN.
- **Roles:** Orchestrator conserva decisiones y documentos. Un único Implementer escribe aplicación. Se detiene antes de comprobaciones/revisión independientes; Reviewer revisa cada unidad sustancial. Autenticación, autorización, transacciones, migraciones e instalación requieren verificación independiente adicional.
- **Diseño:** TASK-002 entrega Pencil para revisión; aprobación exacta y verificación de nodos requerida antes de UI material.

## Base observada y límites de entrega

Baseline de preparación verificado: `E:/Freelance/Nexovate-CRM`, rama `master`, repositorio sin HEAD ni remotos, sin package.json ni aplicación. Node `v22.22.3` y npm `10.9.8` disponibles. `psql`, Supabase CLI y Docker no fueron encontrados como comandos; esto no demuestra que exista o no un servicio externo. Para TASK-001 Delivery preparó y verificó `feature/crm-mvp`, todavía sin HEAD antes del primer commit.

El baseline contiene `.agents/`, `.codex/`, `.gitignore` y `AGENTS.md` sin seguimiento Git; `.env` y `crm-nexovate.pen` ya existen y están ignorados. No se ha leído el contenido del `.env` ni del Pencil. Workflow, AGENTS, secretos y Pencil quedan fuera del commit; `.gitignore` está autorizado por TASK-001 y conserva sus reglas preexistentes al agregar los ignorados de la aplicación.

Se aprobó una sola rama de requisito `feature/crm-mvp`, en el checkout actual, preparada por Implementer Delivery. WU-001 quedó en el primer commit `092b23df66503c0c2ba4c92b7509d1dc861ff0b6`, sin padres ni SHA de origen. No crear ramas por tarea ni worktrees. Un commit local por unidad coherente después de checks y revisión, mediante staging de rutas seleccionadas; autoridad concedida en la respuesta del usuario del 2026-10-07.

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

**Estado:** DONE · **Criterios:** AC-001

Preparar Next.js App Router con TypeScript, Tailwind y convenciones para shadcn/ui, junto a Vitest, Testing Library y Playwright. Registrar versiones concretas compatibles y fijar dependencias localmente. Crear scripts y documentación de ejecución. Mantener la base mínima, sin construir todavía las pantallas funcionales.

- **Depende de:** aprobación explícita de PLAN-1 y de esta primera tarea.
- **Rutas candidatas permitidas:** `package.json`, `package-lock.json`, `next.config.*`, `next-env.d.ts`, `tsconfig.json`, `eslint.config.*`, `postcss.config.*`, `components.json`, `vitest.config.*`, `playwright.config.*`, `.gitignore`, `.env.example` sin valores reales, `src/app/{layout.tsx,page.tsx,globals.css}`, `src/lib/utils.ts`, `tests/setup.*`, `tests/support/**`, `scripts/check-test-db.*`, `README.md`. Nada en `.codex/` ni `.agents/`.
- **Terminada cuando:** instalación local y build reproducibles, tipos/lint correctos, configuración de runners documentada y validada sin pruebas artificiales. Diagnóstico SQL/browser explícito; no afirmar suites de negocio verdes antes de crearlas.
- **Checks:** lint, typecheck y build; inspección de configuraciones y descubrimiento de runners. TDD N/A para setup.
- **Unidad:** WU-001, configuración propia estimada 260–330 líneas / 12–20 archivos, confianza media; ajuste de diagnóstico SQL/browser y documentación de suites todavía ausentes, sin cambio de alcance. Scaffold, componentes copiados y lockfile separados. Commit candidato `chore: bootstrap Next.js and test tooling`.
- **Resultado:** WU-001 aceptada y commit local verificado `092b23df66503c0c2ba4c92b7509d1dc861ff0b6` (`chore: bootstrap Next.js and test tooling`); verificación independiente COMPLETED y Reviewer APPROVED, sin hallazgos. Commit de 22 rutas: 20 archivos de setup y dos documentos del plan. Numstat raíz: 331 líneas finales de setup (329 nuevas más dos reglas preexistentes de `.gitignore`), 7 líneas de tipos Next generadas, 8.610 de lockfile y 268 de planificación, total 9.216 adiciones. Workflow, AGENTS, secretos y Pencil fuera de staging; índice vacío verificado.
- **Evidencia aceptada:** writer `npm install` y `npm ci` exit 0 (453 paquetes); independiente lint/typecheck/build/npm ls exit 0, navegador Edge real y smoke de producción HTTP 200/heading DOM correctos, servidor cerrado (0 listeners en 3000). Operaciones Next/browser necesitaron escalación exacta por permisos Windows. Vitest y E2E discovery sin suites, exit 1 esperado; SQL diagnóstico exit 1 y ninguna conexión/mutación. Esos resultados no son GREEN de negocio. Runners y fuentes revisados por Reviewer con digest agregado `b12fd1135c48902648edfccfea7fe6e17d8e9aa004cdae3ce9a7287bcb55bb8d`.
- **Límite observado:** Next generó un bloque managed en AGENTS durante el primer dev; retirado con función oficial, `agentRules: false` evita nueva escritura. Hash AGENTS estable durante segundo dev y verificación: `286E15EBA990C4A9CD0385CF967628B7865C876532E0FFD45FD04E936E2B0995`; no existe hash histórico previo al primer dev. El único cambio automático durante verificación fue `next-env.d.ts` de tipos dev a producción, revisado en su versión final (blob `ce4e94a6b10f160ee021fe18939af160d2927dcf`).

### TASK-002 — Diseño de las pantallas en Pencil

**Estado:** IN_PROGRESS · **Criterios:** AC-002, AC-011

Designer inspecciona el archivo existente y define login, navegación, dashboard, panel kanban/tabla y formulario con los campos acordados. Incluye escritorio/móvil y estados vacío, carga, error y conflicto. Entrega nodos editables y solicita revisión a través del Orchestrator.

- **Depende de:** TASK-001 aceptada; SPEC-1 aprobado.
- **Superficie permitida:** `crm-nexovate.pen` mediante herramientas nativas Pencil. No escribir aplicación ni generar imágenes/exportaciones.
- **Terminada cuando:** el usuario aprueba la versión exacta y Designer verifica que sus nodos siguen correspondiendo a la aprobación y criterios.
- **Checks:** consultas textuales de nodos, layout, dimensiones, textos y estados; revisión del usuario en el documento real. TDD N/A.
- **Unidad:** WU-002, nodos editables, líneas no aplicables. El archivo ya está ignorado: no afirmar un commit de diseño. Orchestrator registra IDs/aprobación en este plan; Delivery puede incluir sólo esa actualización de documentación autorizada.
- **Resultado actual:** DESIGN_APPROVED, DESIGN-2 guardado en `E:/Freelance/Nexovate-CRM/crm-nexovate.pen`, aprobado visualmente y verificado después de aprobación; Designer detenido y Reviewer APPROVED. Entrega documental pendiente: tarea todavía IN_PROGRESS, sin commit de diseño. Se conservan 14 pantallas, cuatro atlas de estados, tres componentes reutilizables y 20 raíces contando el frame inicial blanco/vacío `bi8Au` (800×600).
- **Guardado DESIGN-1 verificado:** ante ausencia de Save nativo documentado, el usuario confirmó “Ya guardé el documento en esa ruta”. Metadata observada: 626.350 bytes, 2026-10-07 19:57:08, frente al baseline 315 bytes/18:52:07. Designer consultó de nuevo mediante `execute` con el filePath exacto y confirmó las mismas 20 raíces, IDs, dimensiones y tema sin mutaciones. La persistencia se apoya en recibo del usuario y metadata; Get confirma el documento vivo, no una recarga desde disco (no API reload documentada). Después de los ajustes DESIGN-2, metadata permanece en 626.350 bytes/19:57:08: no extender el recibo anterior a esta revisión. Guardado solicitado al usuario.
- **Pantallas DESIGN-2 (IDs conservados de DESIGN-1; escritorio / móvil):** login `xMkjY` / `NQqFz`; dashboard `XG4yp` / `Z4avcU`; kanban `Y13jn` / `vPRAZ`; tabla `tk9VI` / `FBMNw`; nuevo cliente `rx3yq` / `GR2eT`; editar cliente `sShbV` / `LtlWO`; filtros `GjJkU` / `fjBZ8`. Escritorios en y=800, móviles en y=2200; dashboard escritorio x=1540, kanban x=3368. Viewport no modificado: no hay API textual documentada de encuadre.
- **Componentes y estados:** componentes `d9lgV` (botones `bA1Jp`/`RBX9B`, tarjeta `zxVXd`); atlas acceso/validación `R7TJoX`, cartera/recuperación `Vh4hi`, dashboard `Ct9eY`, móvil `sRMT2`, en y=4100. Incluyen carga, vacío, sin resultados, errores de credenciales/guardado/consulta, validación, rollback y conflicto con recarga confirmada. Datos ficticios etiquetados, sin funcionalidad runtime afirmada.
- **Tokens candidatos:** IBM Plex Sans; base oscura/azul de SPEC-1, acción ajustada a `#386BC0` y borde de controles `#597697` para contraste. Texto blanco/acción 5,21:1, texto secundario/superficie 8,08:1, principal/superficie 14,01:1 y foco/acción 3,10:1. Objetivos de interacción 44 px y alternativa al drag desde formulario representados.
- **Checks y límite:** consultas textuales observadas: 1.241 nodos de esquema, 157 referencias, sin nombres vacíos, placeholders pendientes, texto menor de 12 px, texto sin fill ni intersecciones entre raíces. Se ampliaron cuatro contenedores. La API Get devuelve bounds divergentes (y declarada 13 frente a y de bounds 63) y 675 flags clipped sobre 1.476 nodos expandidos; no se descartan ni prueban recorte visual. Composición/posibles recortes requieren revisión del usuario en Pencil antes de aprobación; no hubo capturas ni revisión visual automática.
- **Revisión del usuario:** colores de DESIGN-1 aceptados y dirección general favorable; no aprobación del diseño completo. Solicita cambiar la barra de navegación que llama “de la derecha”, porque sus menús parecen botones de tamaños distintos, y centrar el login dentro de un modal/caja en lugar de campos sueltos. Autoriza esos ajustes en el mismo documento y dentro de TASK-002; candidato siguiente DESIGN-2. Mantener paleta, normalizar navegación como lista profesional de elementos uniformes y agrupar login centrado en escritorio/móvil. Designer debe inspeccionar la navegación real antes de interpretar la referencia derecha/izquierda.
- **Ajustes DESIGN-2:** navegación observada lateral izquierda en escritorio y superior en móvil, conservando ubicación. Dashboard, Clientes y Cerrar sesión reemplazados por 36 filas uniformes: 160×44 px escritorio, 114×44 px móvil, padding lateral 12 px y texto a la izquierda; activo con superficie oscura y borde lateral azul de 2 px. Login escritorio panel `mEgyK` 420×476 px, padding 32, bounds x510/y212 dentro de 1440×900; móvil `YVDOK` 342×460 px, padding 24, bounds x24/y250 dentro de 390×960. Ambos centrados en los dos ejes, superficie `#121F35`, borde 1 px y radio 10 px. Atlas acceso `H7JCE`, `CQQAI`, `jJPml` y `Cv8m3` con la misma superficie/borde/radio. Paleta, tipografía, IDs de pantallas y demás contenidos conservados; 19 nombres actualizados a DESIGN-2.
- **Mapping navegación DESIGN-2 (Dashboard/Clientes/Cerrar sesión):** dashboard escritorio `x83MC0/QKd2r/NRgcf`, móvil `JampY/bpTkf/z68UnF`; kanban `Y2Jwp/y9tDXf/LUwEv`, móvil `xylC8/We3cZ/JSPQo`; tabla `zeW5s/Bnl6Y/pCVWW`, móvil `Fr0vh/N9GuY/wkU9x`; alta `qtlGT/jVuCY/r5yPOI`, móvil `M8BCB/W6pEV2/NrDNo`; edición `M94dCy/b5d9v/KMzMz`, móvil `q7gsZI/TnbLg/wmYAN`; filtros `X6Xyfp/TK7kF/k5IoX0`, móvil `gtcb5/rvu9x/EMqJy`.
- **Checks DESIGN-2:** Designer verificó textualmente 36 filas de igual tamaño y centrado del panel de login en ambos tamaños. Consultas acotadas de login y atlas acceso devolvieron cero flags de clipping; no equivalen a revisión visual ni resuelven todos los flags históricos de DESIGN-1. Sin capturas/exportaciones ni cambios de aplicación. Orchestrator comprobó que sólo este plan tiene cambios tracked; workflow y AGENTS siguen untracked.
- **Guardado DESIGN-2:** el usuario confirmó “Ya guardé DESIGN-2”; metadata posterior del archivo exacto: 654.791 bytes, 2026-10-07 20:18:15. El recibo y el cambio frente a DESIGN-1 acreditan este guardado. Designer realizó consulta fresca read-only con el filePath exacto: confirmó 20 raíces, nombres DESIGN-2, IDs de todas las pantallas, 18 filas de 160×44 y 18 de 114×44 con padding `[0,12]`, y ambos paneles de login con dimensiones/padding acordados y diferencia de centro `[0,0]`. Sin mutaciones. La API confirma documento vivo; no se afirma recarga desde disco ni aprobación visual.
- **Aprobación exacta:** ante la presentación de DESIGN-2, el usuario respondió “Si ahora lo veo perfecto, continua con las task-002” (2026-10-07). Se registra DESIGN-2 aprobado y autorización de completar exclusivamente TASK-002; no habilita TASK-003 ni otra tarea.
- **Verificación posterior a aprobación:** Designer devolvió DESIGN_APPROVED tras consulta fresca read-only con el filePath exacto. Confirmó 20 raíces y todos los IDs, 36 filas uniformes, paneles login centrados, seis estados exactos, atlas de carga/vacío/sin resultados/error/validación/rollback/conflicto, paleta/tipografía y foco de 2 px/objetivos de 44 px/alternativa al drag definidos. AC-002 y AC-011 cubiertos para diseño; interacción y accesibilidad runtime se verificarán en las tareas de aplicación. Sin mutaciones ni recarga desde disco afirmada.
- **Revisión WU-002:** Reviewer APPROVED, sin hallazgos, candidato `task.md` SHA256 `C2FF1EFB8F6867AEB46C89DA13FE3EFCA29F19DCCBCE360454EC99646A39B2D8`. Aceptó AC-002 y cobertura de diseño AC-011, aprobación exacta, verificación posterior y límites de persistencia/runtime. Delivery documental autorizado en esta misma rama; no autoriza TASK-003.

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

- **Próxima tarea:** TASK-002 — Diseño de las pantallas en Pencil; depende de TASK-001 aceptada, ya satisfecha.
- **Continuación:** Cierre exclusivo de TASK-002 tras aprobación de DESIGN-2; no iniciar TASK-003.
- **Decisión del usuario:** “Si ahora lo veo perfecto, continua con las task-002” (2026-10-07). Aprueba la versión exacta DESIGN-2 y autoriza completar esta tarea.
- **Consumida por:** Designer verificación posterior de DESIGN-2, seguida de Reviewer y Delivery documental. Las operaciones remotas siguen sin autorización.
- **Memoria de esta revisión:** la identidad de runtime dejó de estar registrada después de compactación; escrituras de memoria suspendidas según el hook del host. Este plan conserva el handoff y el checkpoint, sin inventar una sesión.
