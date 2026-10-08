# CRM interno de Nexovate — plan y tareas

**Definición:** [spec.md](spec.md) · **Feature:** crm-mvp
**Plan:** PLAN-1 · **Definición cubierta:** SPEC-1

## Cómo trabajaremos

- **Modo:** ASK_EACH_TASK, elegido explícitamente en el pedido inicial: “vamos a trabajar tarea por tarea” y “no te vas a mandar a hacer todas las tareas iniciales de una”. No se pregunta nuevamente por el modo.
- **Aprobación del plan:** APPROVE_CURRENT_PLAN, SPEC-1/PLAN-1. Respuesta del usuario al pedido de aprobación: “Dale comenza con la task-001” (2026-10-07). Incluye inicio exclusivo de TASK-001 y los commits locales propuestos por unidad revisada.
- **Estado de preparación:** WAITING_FOR_USER, TASK-003 completada con dos unidades verificadas, revisadas y entregadas. TASK-004 y siguientes permanecen TODO.
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

**Estado:** DONE · **Criterios:** AC-002, AC-011 (diseño)

Designer inspecciona el archivo existente y define login, navegación, dashboard, panel kanban/tabla y formulario con los campos acordados. Incluye escritorio/móvil y estados vacío, carga, error y conflicto. Entrega nodos editables y solicita revisión a través del Orchestrator.

- **Depende de:** TASK-001 aceptada; SPEC-1 aprobado.
- **Superficie permitida:** `crm-nexovate.pen` mediante herramientas nativas Pencil. No escribir aplicación ni generar imágenes/exportaciones.
- **Terminada cuando:** el usuario aprueba la versión exacta y Designer verifica que sus nodos siguen correspondiendo a la aprobación y criterios.
- **Checks:** consultas textuales de nodos, layout, dimensiones, textos y estados; revisión del usuario en el documento real. TDD N/A.
- **Unidad:** WU-002, nodos editables, líneas no aplicables. El archivo ya está ignorado: no afirmar un commit de diseño. Orchestrator registra IDs/aprobación en este plan; Delivery puede incluir sólo esa actualización de documentación autorizada.
- **Resultado actual:** DONE, DESIGN_APPROVED. DESIGN-2 guardado en `E:/Freelance/Nexovate-CRM/crm-nexovate.pen`, aprobado visualmente y verificado después de aprobación; Designer detenido y Reviewer APPROVED. WU-002 documental entregada en commit local verificado `06e809fea227ca8e1f026a51d01874b71cb4bbec` (`docs: record approved CRM design`), padre `6000e85bc10a8bd8e93bd4797ece6a8fc93d55e6`: única ruta este plan, 20 adiciones y 6 eliminaciones. Pencil ignorado, sin commit de diseño ni cambios de aplicación. Se conservan 14 pantallas, cuatro atlas de estados, tres componentes reutilizables y 20 raíces contando el frame inicial blanco/vacío `bi8Au` (800×600).
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

**Estado:** DONE · **Criterios:** AC-003 (SQL), AC-005 (modelo/operaciones), AC-006, AC-009 (hitos)

Definir y probar migraciones de clientes, dos miembros autorizados, transiciones y primeros hitos. Autorizar la cartera compartida mediante RLS y permisos. Implementar altas/actualizaciones atómicas con validación, control de versión e idempotencia; corregir fecha de contacto junto a su hito y auditoría. Sin pantallas ni escrituras a un Supabase remoto sin autorización concreta.

- **Depende de:** TASK-001 y TASK-002 aceptadas; entorno PostgreSQL aislado y runner reales disponibles antes de implementar el comportamiento SQL.
- **Rutas candidatas permitidas:** `supabase/migrations/**`, `supabase/tests/**`, `supabase/config.toml` si necesario, `src/lib/clients/**`, `src/lib/database/**`, `src/types/database.ts`, `tests/clients/**`, `tests/database/**`, soporte SQL acotado de `tests/support/**` y `scripts/**`, `README.md`/`.env.example` sólo para integración. `.gitignore` sólo para excluir binarios y datos de la instancia PostgreSQL de pruebas local; herramientas locales bajo una carpeta ignorada del proyecto, sin instalación global ni servicio del sistema.
- **Terminada cuando:** dos miembros comparten lectura/escritura; anónimo/tercero son rechazados; no autoasignación de membresía ni modificación directa de historial; seis estados válidos; rollback, repetición, corrección y dos escrituras concurrentes comprobados contra PostgreSQL real.
- **Checks:** RED/GREEN de pruebas de dominio y `test:db`, lint/typecheck/build afectados; verificación independiente de RLS/permisos/transacciones.
- **Unidades:** WU-003 autorización/esquema y runner SQL aislado, previsión actualizada 450–650 líneas / 6–8 archivos (inicialmente 200–350 / 4–8); crecimiento por soporte necesario de cluster local seguro y pruebas RLS reales, comunicado antes del SQL. Se conserva la unidad coherente y el alcance aprobado. WU-004 transiciones/hitos/concurrencia, previsión actualizada 650–850 líneas / 5–7 rutas (inicialmente 250–450 / 5–9), por RPCs, ledger de idempotencia, auditoría y pruebas de rollback/concurrencia con dos sesiones; comunicado antes de implementación. Sin nuevas dependencias ni UI, se conserva unidad coherente y alcance aprobado. Confianza media-baja. Commits candidatos `feat: restrict shared CRM data to two members` y `feat: persist client transitions and milestones atomically`.
- **Resultado:** DONE; autorización del usuario “si, autorizo” al checkpoint TASK-003 consumida (2026-10-07). WU-003 y WU-004 aceptadas con RED/GREEN SQL real, verificación independiente, Reviewer APPROVED y commits locales verificados. PostgreSQL portable local aislado comprobado; no configuración/provisión/migración remota. Inspección inicial encontró comandos SQL/Docker/Supabase CLI fuera de PATH y servicios no accesibles; `.env` leído sólo por nombres, sin usar/divulgar valores. La presencia de credenciales remotas no acreditó un destino de pruebas ni autorizó migraciones remotas.
- **Prerrequisito SQL local:** rutas usuales de PostgreSQL/Docker no existen, `TEST_DATABASE_URL` ausente también en proceso y WSL informa no instalado. Implementer puede preparar binarios PostgreSQL portables de origen oficial/referenciado por PostgreSQL dentro de carpeta ignorada, con cluster nuevo y datos sintéticos, exclusivamente loopback y sin registrar servicios. Verificar versión, destino y runner antes de observar RED de comportamiento. No usar credenciales existentes ni base remota.
- **Origen portable verificado:** página oficial PostgreSQL Windows enlaza binarios EDB; PostgreSQL 17.11 x64 descargado de `https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip`, versión ejecutada y digest local reconciliados por escritor y verificador. No se infiere la versión del Supabase remoto.
- **Recibo del escritor WU-003, previo a aceptación:** ocho rutas (migración esquema/RLS, dos suites SQL, fixture, runner, README, `.env.example`, `.gitignore`), 457 líneas finales, 384 adiciones/20 eliminaciones contando archivos nuevos; fuera de este plan y workflow. Membresía por dos slots/UUID distintos, clientes y campos/estados acordados, transiciones/hitos con RLS; lectura de ambos y denegación de anónimo/tercero. Sin DML directo; RPCs atómicas y correcciones correspondían a WU-004, posteriormente completada. Helper SECURITY DEFINER con search_path vacío, nombres cualificados y EXECUTE sólo authenticated. No miembros reales provisionados.
- **Pruebas observadas del escritor WU-003:** PostgreSQL/psql 17.11, descarga portable completada; SHA256 local `80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f`, sin firma/checksum del vendor afirmados. RED SQL real exit 1 por tabla `crm_members` ausente, después de verificar cluster nuevo/fixtures; GREEN final exit 0, dos suites y 53 aserciones. Lint y diff-check exit 0. Rechazo de TEST_DATABASE_URL sintética antes de conectar y limpieza final 0 runs/procesos/listeners de puertos observados. Fallos iniciales de setup Windows (pipes/permiso TCP/canonicalización) resueltos, no contabilizados como RED. `test:db` requiere escalación exacta por bloqueo loopback del sandbox. Sin cambios TS/frontend/dependencias: typecheck/build no repetidos. Fixtures simulan auth.uid/users/claims/roles; no prueban Supabase Auth/API/JWT remoto.
- **Verificación independiente WU-003:** COMPLETED, escritor detenido. `npm run test:db` escalado exit 0, ambas suites/53 aserciones, PostgreSQL 17.11 y cluster nuevo verificado; lint y diff-check exit 0. Ejecución sandbox exit 1 por TCP10013, fallo de entorno separado del RED. Rechazo de TEST_DATABASE_URL sintética y vacía exit 1 antes de crear/conectar. Inspección ACL/RLS/roles sin bypass y helper de privilegios mínimos conforme. Ocho hashes de fuentes y AGENTS idénticos antes/después; migración SHA256 `DFF336E93A5521794B15611B40671755D38B0A1F693DD57C4628CEE057D32FC6`, runner `4467372BAC0AA4423EA504A0D286473E3FE1BE17139E306C6E2969EFEACF5769`. 0 runs/procesos y listeners en puertos 63449/51550; consulta de listeners escalada read-only. No cambios de fuentes. Typecheck/build N/A justificado por superficies sin TS/config/dependencias. WU-004 y Supabase remoto siguen fuera de esta evidencia.
- **Revisión WU-003:** Reviewer APPROVED, sin hallazgos; digest agregado de ocho fuentes `591eb19e10bd13e8270f4a25a611d8c706fbee7decbf56616c36eace993a5814`. Aceptó permisos/RLS de lectura, modelo y runner aislado con pruebas SQL independientes. Entrega local de esta unidad autorizada; TASK-003 permanece IN_PROGRESS hasta WU-004.
- **Entrega WU-003:** commit local verificado `4f35368f52889e9a67cddc06a16071ffe9b5b0ff` (`feat: restrict shared CRM data to two members`), padre `101e4f522d0bf924a3d318204e004e17dc3a886e`. Nueve rutas seleccionadas: ocho fuentes más este plan, 398 adiciones/27 eliminaciones (fuentes 384/20 y plan 14/7). Hashes revisados y staging coincidentes; índice vacío, sin cambios tracked restantes y workflow/AGENTS preservados. Continúa exclusivamente WU-004, sin pedir otra autorización para la misma TASK-003.
- **Recibo del escritor WU-004, previo a aceptación:** RPCs de alta/edición/cambio de estado, historial/primeros hitos, corrección con auditoría, versión e idempotencia. Escritor detenido, candidato cinco rutas/617 líneas finales, 410 adiciones/7 eliminaciones incluyendo nuevas. RED de mutaciones y ejecución enfocada de concurrencia observado en PostgreSQL real por RPC `create_client` ausente; no se afirmó una carrera ejecutada durante ese RED. GREEN final del escritor exit 0, tres suites SQL/124 aserciones (39+14+71) y tres carreras reales con procesos/PIDs distintos y espera Lock observada. Lint y diff-check exit 0; 0 runs/procesos/listeners de puertos observados, AGENTS sin cambios. Este recibo precede a la verificación, revisión y entrega que sustentan DONE.
- **Contrato y cobertura WU-004:** `create_client`, `update_client`, `change_client_status`; actor derivado de auth.uid y membresía validada incluso en replay. Wrappers SECURITY DEFINER/search_path vacío, worker privado INVOKER sin EXECUTE caller. Ledger por actor/request compara operación/cliente/versión/payload JSON canónico; replay exacto devuelve snapshot original, payload distinto 22023, versión obsoleta 40001. Tests verifican corrección Contactado con auditoría conservando eventos/creación, meeting_at independiente, todos los estados y opcionales, salto/regreso, rollback de cliente/historia/hito/audit/reserva. Concurrencia final del escritor: versión PIDs 22704/25208 (una confirmada y una 40001), replay 19024/5152 (una entidad y respuesta idéntica), mismatch 13652/18092 (una confirmada y una 22023); espera Lock observada en las tres, 10 aserciones SQL adicionales y checks JS. Fuentes detenidas: migración SHA256 `1466AE39711B2FA92FFDF81051CAEB675F91BC48E3550071DC2A90BF3AE621D6`, runner `CC50B387D92E69C0A58D28EBD357404D3268DDD043092121576C6FBD2DE7499D`, harness `4473DA6FF98C407EDB48830324B1BAF82460EF32378E01238CD6A18E22722CD2`. No TS/config/manifest cambiados, typecheck/build N/A; sin integración Supabase/Auth/API ni usuarios reales.
- **Verificación independiente WU-004:** COMPLETED, `npm run test:db` escalado exit 0 sobre PostgreSQL 17.11 y cluster nuevo verificado, puerto 60726; tres suites/124 aserciones más 10 SQL del harness y checks JS. Carreras con espera Lock: versión PIDs 14636/8388 (una confirmada, otra 40001 sin efectos del perdedor), replay 21268/20588 (misma respuesta/una entidad-evento-hito-ledger), mismatch 19808/19320 (segunda 22023/sin entidad extra). Lint y diff-check exit 0; TEST_DATABASE_URL sintética y vacía rechazadas antes de cluster. Cinco hashes y AGENTS estables antes/después; 0 runs/procesos/listeners en puerto observado. RPCs/worker/ledger/ACL y corrección/rollback inspeccionados conforme. Typecheck/build N/A sin cambios TS/config/dependencias, no repetir fallo TCP sandbox conocido. Sin mutaciones de fuentes ni prueba remota/runtime de app.
- **Revisión WU-004/cobertura TASK-003:** Reviewer APPROVED técnico, sin hallazgos bloqueantes; digest de cinco fuentes `fd610a72e2178f6ce7df55cb408de536f7ec6a189ed965760269533f28acbaa6`. Reutilizó WU-003 sin regresión y aceptó AC-003 SQL, AC-005 modelo/alta/edición, AC-006 y reglas de hitos/correcciones AC-009. MINOR documental: intro/Convenciones README todavía describen datos/diseño como pendientes; corrección exclusiva de esas frases encargada a Implementer. No invalida pruebas SQL; requiere readback/revisión del delta documental antes de entrega.
- **MINOR WU-004 resuelto:** Implementer corrigió sólo dos bloques de README; Reviewer de delta documental APPROVED, sin hallazgos. README final 145 líneas, SHA256 `EF6762969731DF64A9D1BF91AE11FA53348EDC293425E1A3B0B3679870FA80BF`; reconstrucción de los bloques anteriores reproduce hash anterior, otras cuatro fuentes de WU-004 sin cambios. Candidato final cinco rutas/620 líneas finales. Diff-check exit 0, TDD N/A para copy; se reutilizan pruebas SQL/concurrencia y revisión técnica válidas para la entrega.
- **Entrega WU-004 y cierre:** commit local verificado `5ac8b2430bbb109402ba6a7ed736e1936c826c46` (`feat: persist client transitions and milestones atomically`), padre `4f35368f52889e9a67cddc06a16071ffe9b5b0ff`. Seis rutas seleccionadas: cinco fuentes más este plan, 426 adiciones/14 eliminaciones (fuentes 416/10 y plan 10/4). Hashes/staging/commit coincidentes, índice vacío y sin cambios tracked pendientes al entregar. TASK-003 completa para datos y operaciones SQL locales; pruebas finales cubren ambas migraciones y tres carreras. Auth/API/JWT de Supabase, usuarios reales, pantallas y agregaciones de dashboard pertenecen a tareas posteriores. TASK-004 espera nueva autorización.

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

Ocho tareas, once unidades coherentes; previsión actualizada aproximadamente **3.410–5.480 líneas propias** entre código, SQL, pruebas y documentación, confianza media-baja (inicialmente 2.760–4.780). Ajuste de TASK-003 por runner PostgreSQL aislado y pruebas reales de seguridad/transacciones; sin cambio de tareas, alcance ni unidades de entrega. No sumar como autoría scaffold, componentes shadcn copiados, lockfile o nodos Pencil. Archivos compartidos entre unidades no se cuentan como archivos únicos diferentes. El tamaño se mide sobre el candidato real antes de cada commit; un crecimiento material se comunica antes de alterar las unidades previstas.

Convenciones aprobadas incluidas: cartera compartida con permisos iguales; Rubro como texto opcional; fecha del filtro = fecha de contacto; zona Buenos Aires; corrección de fecha contacto actualiza su hito con auditoría; los demás hitos conservan fecha de primera transición; stack de gráficos/pruebas según SPEC-1. Diseño detallado DESIGN-2 aprobado y verificado en TASK-002.

Diseño Pencil y entorno SQL local aislado verificados; nombres de variables inspeccionados sin exponer valores. Pendiente verificar en la tarea pertinente: proyecto Supabase y dos identidades, configuración de Auth/API, navegador del flujo integrado y autorizaciones concretas para operaciones remotas. No se presume su disponibilidad al cerrar tareas posteriores.

## Siguiente paso

- **Próxima tarea:** TASK-004 — Login y protección de la aplicación; TASK-002 y TASK-003 aceptadas. Configuración Supabase y dos identidades de prueba aún necesitan verificación dentro de esa tarea.
- **Continuación:** PENDING; esperar autorización explícita para TASK-004, estado TODO. No preparar la siguiente tarea en segundo plano.
- **Decisión anterior consumida:** “si, autorizo” (2026-10-07) al checkpoint explícito de TASK-003 autorizó esta tarea y sus pruebas locales. Ambas unidades completadas con verificación/revisión/commits; no se reutiliza esa autorización para TASK-004.
- **Límite:** operaciones remotas, provisión de usuarios, migraciones a Supabase y deploy siguen sin autorización.
- **Memoria de esta revisión:** la identidad de runtime dejó de estar registrada después de compactación; escrituras de memoria suspendidas según el hook del host. Este plan conserva el handoff y el checkpoint, sin inventar una sesión.
