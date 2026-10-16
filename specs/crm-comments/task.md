# Comentarios por cliente — plan y tareas

**Definición:** [spec.md](spec.md) · **Feature:** crm-comments
**Revisión:** PLAN-1 · **Cobertura:** SPEC-1

## Forma de trabajo

- **Modo de ejecución:** CONTINUOUS.
- **Elección del usuario:** respuesta explícita «Continuar con ambas tareas (recomendado)» a `call_170a48b1e409416886debb5dd78bcbbc`, 2026-10-16. Autoriza las dos tareas aprobadas en secuencia, con comprobaciones/revisión/commits, deteniéndose ante bloqueos o cambios materiales.
- **Aprobación del plan:** APPROVE_CURRENT_PLAN. Respuesta a `call_863e35921c8947bebb81dacfc2ef3909`: «Me parece bien. Lo único que cambiaría el diseño es que en vez de tener un botón que diga literalmente archivar, poner un ícono que represente esto». Cubre SPEC-1/PLAN-1, TASK-001/002, identificación por correo, comentario inicial y rama/dos commits locales propuestos; ajuste visual de archivo expresamente solicitado. No requiere nueva aprobación del mismo ajuste. Diseño actualizado y revalidado por Designer DESIGN_APPROVED/STOPPED.
- **Primera tarea:** TASK-001, después de aprobación y preparación de rama por Delivery.
- **TDD:** ON para comportamiento según convención explícita vigente en `specs/crm-interaction/task.md`, conservada en `specs/crm-ui-ux-vercel/task.md`. Vitest/Testing Library y SQL real local: RED observado antes de implementar, luego GREEN. Las propiedades visuales se verifican con estructura/DOM, sin pruebas que repitan CSS.
- **Diseño:** `comments-v1` con ajuste de ícono solicitado, DESIGN_APPROVED/STOPPED por Designer tras aprobación del usuario y revalidación textual nativa. Cinco frames `g1Ehuv`, `fXt7h`, `TEZ2C`, `E1OzDF`, `wG2Mm`; cinco acciones sustituidas por Lucide archive20 en botón44×44, nombre accesible/tooltip «Archivar comentario», variante foco `v0fCna`. Permisos preservados y sin problemas estructurales reportados. Guardado local no confirmado: conservar el documento vivo y guardar desde Pencil antes de cerrar. Referencias y límites en spec.md. Sin capturas, vídeo, trace, exportaciones ni previews.
- **Entrega aprobada:** una rama `codex/crm-comments` en este checkout, desde main `a822dfe297caeb89f5cd25855aae0e6793f5c2b6`; un commit local por unidad aceptada. La aprobación incluye preparación de esa rama y dos commits locales. Sin push/PR/merge/deploy ni migraciones remotas ni sincronización externa.
- **Preservación:** cambios ajenos detectados en `.gitignore`, `next-env.d.ts` y `tsconfig.json`, fuera del candidato. Verificar estado/HEAD nuevamente al comenzar; no reset/stash/limpieza ni staging general.
- **Rama preparada:** Delivery COMPLETED/STOPPED verificó `codex/crm-comments` desde main/base `a822dfe297caeb89f5cd25855aae0e6793f5c2b6`, HEAD intacto e índice vacío; dirty ajeno preservado por hash. Sin publicación ni commits todavía.
- **Previsión total actual:** WU-001 real +740/−13 en 15 archivos; WU-002 estimada 550–900 líneas. Total aproximado 1.300–1.650 líneas propias, confianza media. La estimación intermedia de SQL resultó conservadora; mismo alcance, arquitectura y dos tareas/unidades coherentes aprobadas. No se comprime ni se separa un contrato inseparable por un umbral artificial.

Un único Implementer escribe aplicación, una tarea a la vez. Se detiene antes de verificación independiente, Reviewer y Delivery. Orchestrator mantiene estos documentos y decisiones. CONTINUOUS avanza sólo dentro de la revisión aprobada y se detiene ante bloqueos, cambios materiales o interrupción del usuario.

## Comprobaciones

- `npm test -- tests/comments` para contratos, validación, presentación y guardas nuevas; agregar pruebas junto a los consumidores existentes donde corresponda.
- `npm run test:db` usa `scripts/check-test-db.mjs`, binarios PostgreSQL 17.11 locales ya presentes y un cluster nuevo loopback; no acepta una URL externa. Agregar pruebas SQL de comentarios y concurrencia real en `tests/support/sql-concurrency.mjs` o módulo enfocado llamado desde allí. Debe probar migración desde notas preexistentes, no sólo nuevas filas posteriores.
- `npm run lint`, `npm run typecheck` y `git diff --check` por unidad afectada. Preservar los tres archivos ajenos; ningún ajuste automático se incorpora incidentalmente.
- Playwright local aislado para el flujo integrado, siguiendo los harness existentes; nuevo archivo `tests/e2e/client-comments-local.spec.ts` y configuración correspondiente, con screenshot/video/trace off. Comprobar DOM, teclado y anchos objetivo sin clientes reales.
- `npm test` y `npm run build` al integrar TASK-002 por cambio transversal del modelo/formularios. El build comprueba compilación y no demuestra aplicación de SQL remota. No repetir pruebas válidas del mismo candidato sin motivo.
- Verificación-only independiente obligatoria para migración, permisos, idempotencia y concurrencia; Reviewer revisa cada unidad sustancial con evidencia observada. Cierre reutiliza recibos vigentes y comprueba únicamente integración no revisada.

## Tareas

### TASK-001 — Persistencia segura y migración de notas

**Estado:** IN_PROGRESS · **Criterios:** AC-001, AC-003, AC-005, AC-006, AC-007; contratos de AC-002/004.

Implementar migración incremental, persistencia/listado paginado, alta y archivo restringidos, identidad del socio y acciones de servidor. Incluir conversión de notas y comentario inicial atómico, retirando la escritura antigua sin cambiar métricas o permisos de clientes. Esta tarea establece contratos que consumirá la interfaz; no modifica composición visual.

- **Depende de:** aprobación exacta SPEC-1/PLAN-1, modo seleccionado y rama preparada.
- **Archivos permitidos:** nueva migración `supabase/migrations/202610160007_client_comments.sql`; nuevas pruebas `supabase/tests/008_client_comments.sql` y soporte local de migración/concurrencia en `tests/support/` y `scripts/check-test-db.mjs`; nuevo `src/lib/comments/`; nuevo `src/app/(crm)/clientes/comment-actions.ts`; adaptación mínima de `src/lib/clients/{model,mutations,server}.ts` y `src/app/(crm)/clientes/actions.ts` para contrato de comentario inicial y abandono de notas; pruebas correspondientes en `tests/comments/`, `tests/clients/` y `tests/support/sql-fixture.sql`; `README.md` sólo instrucciones de migración y comprobación local. No editar migraciones históricas.
- **Termina cuando:** migración conserva texto exacto y datos de clientes borrados, sin duplicar/atribuir legado; permisos reales distinguen autor/otro socio/legado/no miembro; API no permite editar/borrar; alta inicial y archivo son atómicos e idempotentes; concurrencia/borrado/resultado incierto y paginación estables tienen pruebas reales locales. Las pruebas existentes afectadas se adaptan conservando sus garantías.
- **Checks:** RED/GREEN de pruebas SQL y contratos nuevos; `npm run test:db`; pruebas focalizadas de comentarios y mutaciones de clientes; lint/typecheck/diff-check; verificación independiente de SQL/seguridad/concurrencia y revisión.
- **Unidad:** WU-001, datos + funciones/contratos + pruebas; estimación refinada 1.200–1.500 líneas/~13 archivos, confianza media. Refinamiento por cobertura SQL y compatibilidad de fixtures, sin cambio de producto/arquitectura/tareas. Commit propuesto `feat(comments): persist client history and migrate legacy notes`.
- **Resultado del escritor:** IMPLEMENTED/STOPPED sobre base `a822dfe297caeb89f5cd25855aae0e6793f5c2b6`, candidato15 +740/−13, SHA256 `e0d3c6007e61707ef26491736d291d849aa3ecb3fcff4d00600419f34d49f448` (paths ordenados + NUL + SHA256 bytes + LF). RED observado SQL/contratos; GREEN PostgreSQL17.11 local, migración real de fixtures previas,008+002/004–007 sobre esquema final y001/003 histórico,14 carreras con PIDs/Lock; Vitest73/5files, lint/typecheck/diff-check. Generación Next cambió next-env y el escritor restauró exclusivamente una variante idéntica al hash inicial; tsc directo posterior PASS, baselines3 intactos. UI heredada se retira en TASK-002, dependencia prevista.
- **Verificación independiente:** comments_verify_001 PARTIAL/STOPPED repitió SQL completo/carreras, Vitest73/5, lint/tsc/diff y preservación de digest/baselines. Halló P2 reproducido con probe SQL real: NBSP solo se acepta en ambos RPC, pero JS trim/isComment lo rechaza y la página queda unavailable. Corrección dentro AC-001/002 en curso con el mismo escritor; sin review/commit aún. Revalidar delta antes de Reviewer.
- **Corrección P2 entregada:** escritor IMPLEMENTED/STOPPED, candidato15 `f0aa3e7c232d8cd576a527707afb9c46c9d06425e4cf65f50237de1aa34699c9`, +798/−13. Delta4files agrega58líneas para helper SQL equivalente a los25 blancos de String.trim y RED/GREEN Unicode en CHECK/ambos RPC, sin alterar backfill/texto válido. SQL008/regresiones actuales PASS, Vitest64/4 afectadas PASS, lintfocal/tscdirect/diff/baselines PASS. Una carrera no observó segundo Lock en4s; repetición sólo concurrencia sin cambios pasó14/14, con cleanup. Incidente de estabilidad del harness preservado. Verificador independiente revalida delta; aún sin revisión ni commit.
- **Revalidación independiente:** comments_verify_001 COMPLETED/STOPPED para `f0aa…99c9`, digest/baselines3 intactos. SQL completo exit0,14carreras con Lock/PIDs,64/4 unitarias afectadas, lintfocal/tscdirect/diff PASS; query y resto lint anteriores vigentes. Comparó helper contra todo Unicode:25caracteres exactamente iguales a String.trim; probe independiente rechazó NBSP con22023 en ambosRPC y conservó texto real Unicode/astral/saltos/espacios. No reprodujo timeout de observación anterior. Clusters limpiados. Review WU-001 en curso; sin commit.
- **Revisión:** comments_reviewer APPROVED/READY_TO_CONTINUE/STOPPED para candidato15 `f0aa3e7c232d8cd576a527707afb9c46c9d06425e4cf65f50237de1aa34699c9`, sin hallazgos ni gaps bloqueantes. Fuentes/seguridad/criterios asignados y baselines verificados; reutiliza prueba independiente corregida. Aceptado para commit local WU-001, todavía no DONE hasta verificar entrega.

### TASK-002 — Historial en ficha, archivo y comentario inicial

**Estado:** TODO · **Criterios:** AC-001–AC-008 en integración; presentación AC-002/004/008.

Reemplazar Notas por historial activo/archivado en la ficha y el compositor. Adaptar alta con comentario inicial opcional y edición sin campo de notas. El indicador de Notas de Kanban debe retirarse o adaptarse de forma honesta a los datos disponibles, sin simular contadores. Integrar cargas/errores, permisos, protección del borrador y recuperación de foco; preservar las guardas del formulario y navegación existentes.

- **Depende de:** TASK-001 aceptada/revisada/commit verificado y diseño exacto aprobado y revalidado.
- **Archivos permitidos:** nuevos componentes `src/components/clients/client-comments*`; `src/components/clients/{client-details,client-form,client-modal,client-list,client-kanban}.tsx`, `clients.module.css` y `client-form-exit.ts` únicamente si la guarda compartida lo exige; rutas nuevo/editar de `src/app/(crm)/clientes/` sólo conexión de props; pruebas de comentarios/consumidores en `tests/comments/`, `tests/clients/` y harness/config/spec de comentarios en `tests/e2e/client-comments*`. Harness existentes de formularios/listado sólo para adaptar las nuevas fronteras sin debilitar pruebas previas. Sin rediseño de shell/dashboard.
- **Termina cuando:** crear/archivar/reabrir y consultar archivados funcionan con autores/fechas correctos y sólo controles permitidos; legado conserva marcación; inicial opcional no se pierde ni duplica; borradores/foco/errores/permisos sobreviven recorridos de teclado, red lenta y reintento. Funciona en móvil y escritorio, sin efectos sobre filtros, edición de datos, métricas o borrado lógico. No quedan referencias visibles al editor antiguo.
- **Checks:** RED/GREEN Vitest/Testing Library para comportamiento; `npx playwright test --config tests/e2e/client-comments-local.config.ts`; regresiones focalizadas de formulario/detalle/listado, suite Vitest completa, lint/typecheck/build/diff-check. Verificación independiente de integración de autorización/concurrencia si se altera el contrato aceptado; Reviewer obligatorio. Reutilizar evidencia aceptada de WU-001 cuando siga vigente.
- **Unidad:** WU-002, interfaz + integración + pruebas; 550–900 líneas/7–11 archivos, confianza media. Commit propuesto `feat(clients): show comments and archived history in client details`.
- **Resultado:** pendiente.

## Próximo paso

- **Próxima tarea:** TASK-001.
- **Continuación:** COVERED_BY_CONTINUOUS_PLAN.
- **Decisión del usuario:** PLAN-1/SPEC-1 aprobados con ícono de archivo; modo CONTINUOUS explícito en las referencias anteriores.
- **Consumido por:** TASK-001 seleccionada para Implementer; aprobación CONTINUOUS vigente, diseño revalidado y rama preparada. TASK-002 sigue TODO hasta aceptar su dependencia.
