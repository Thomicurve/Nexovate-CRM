# Carga global y limpieza de clientes — plan y tareas

**Feature:** crm-loading-delete · **Plan:** PLAN-2 · **Definición:** [SPEC-2](spec.md)

## Forma de trabajo

- **Modo:** CONTINUOUS, aprobado por el usuario el 2026-10-09; consulta ante bloqueos o cambios materiales.
- **Aprobación:** APPROVE_CURRENT_PLAN. Usuario: «Perfecto, apruebo el plan en modo continuous», con corrección explícita de borrado que PLAN-2/SPEC-2 incorporan: conservar historial y métricas. Las tres tareas y commits locales quedan autorizados.
- **Diseño:** texto de spec.md autorizado por «Ya conecte pencil y te autorizo implementar el diseño». DESIGN-5 verificado por Designer DESIGN_APPROVED/STOPPED: carga escritorio sQ6Ar/PM46t/S8xzy, móvil ye1pw/Vuyy0/tSRGi; edición KhXhV/T8dvvI/Q76Ga; estados nkC9R/FMLQo/cp5wb; selector T8BbO/pTmTX/u0pmK; móvil XyJFp/UWbz8/g0n49f/NlTE4. Paleta e IBM Plex Sans preservadas, nodos originales intactos. Representación estática nativa; pruebas funcionales aún requeridas. No generar capturas, previews, imágenes ni exportaciones.
- **Primera tarea:** TASK-001.
- **TDD:** ON para comportamiento por convención explícita vigente registrada en specs/crm-interaction/task.md. Observar RED antes de escribir comportamiento y GREEN tras implementar.
- **Entrega propuesta:** tres unidades coherentes con revisión y commits locales; una rama codex/crm-loading-delete en checkout actual, sin worktrees ni ramas por tarea. Rama y commits locales autorizados por aprobación de plan. Sin push, PR, merge, deploy o migración remota.
- **Baseline:** E:/Freelance/Nexovate-CRM, rama codex/crm-loading-delete creada por Delivery desde main, HEAD 4d53bb867dfce20f974fde6a58f23c7ea93aadbe. Cambios preexistentes next-env.d.ts y tsconfig.json se preservan y excluyen de commits de la feature.
- **Estimación:** 700–1300 líneas propias en 15–25 archivos, más fuentes oficiales/dependencias React Bits; confianza media. Revisar manifiestos TS-TW antes de instalar; diferencias materiales reabren plan.

Un Implementer escribe una tarea por vez y se detiene antes de Reviewer, comprobación independiente y Delivery. Carga/concurrencia, dependencias y borrado requieren verificación independiente. Sólo Orchestrator cambia estado y registra decisiones.

## Comprobaciones comunes

Vitest/Testing Library y Playwright locales para comportamiento, npm run lint, npm run typecheck, git diff --check; npm run build y regresión afectada al cerrar integración. Playwright sin screenshots, vídeo ni trazas. SQL en PostgreSQL/Supabase local aislado; si no hay entorno verificable se informa bloqueo, sin atribuir aceptación SQL a mocks. No escribir datos de clientes reales.

### TASK-001 — Pantalla global con LatticeLoader

**Estado:** DONE · **Criterios:** AC-001, AC-002, parte AC-006.

Integrar el componente oficial y un ciclo común para operaciones visibles, navegación y fallback de rutas. Resolver la capa sobre dialog, bloqueo/foco, solapamientos, errores y limpieza al desmontar. Reemplazar textos de carga visibles sin eliminar mensajes útiles de error/reintento.

- **Dependencias:** plan/modo/diseño aprobados; rama preparada por Delivery.
- **Archivos permitidos:** src/components/ui, src/components/auth/login-form.tsx, src/components/clients, src/components/dashboard/dashboard.tsx, src/app/layout.tsx, src/app/globals.css, src/app/(crm)/layout.tsx, loading.tsx bajo src/app y enlaces/formularios que inician las operaciones enumeradas; package.json/package-lock.json/components.json; tests de auth/clients/metrics/ui y harness acotados tests/e2e.
- **Termina cuando:** AC-001/002 probados en modal, navegación, acciones, fallos y concurrencia; revisión y commit local aceptados.
- **WU-001:** indicador, conexiones y pruebas. Fuentes oficiales se distinguen de código propio en revisión.
- **Resultado:** WU-001 comprobada y Reviewer APPROVED/READY_TO_CONTINUE/STOPPED, commit f1a3e4ad0e3164c1db97c75ff678b3fdd413cf6c verificado, padre 4d53bb867dfce20f974fde6a58f23c7ea93aadbe, 30 paths e índice vacío. Código propio 377+/46-, fuente oficial adaptada 264 líneas y specs 102 aparte. RED lifecycle 3 fallos observados, RED browser overflow compartido corregido. GREEN writer y fresh Verification-only: Vitest 61/61, Playwright local 4/4, lint y diff-check; writer typecheck/build finales PASS. Digest src/tests/components.json e6b8c1bda9c4c341af4bb19d01eb60a372c0b7f647168a8facafb4b231cda392 igual en verificación. Browser usa componentes reales y navegación Next simulada, sin prueba RSC/Supabase live. Un run writer falló intermitentemente Cancelar tras error (3/4); fresh 4/4 no reprodujo, atribución inconclusa. Configs generadas next-env/tsconfig regresaron a contenido baseline sin diff textual; no se atribuye conservación byte por byte ni se incluyen en commit. React Bits adaptado 264 líneas aparte de código propio; sin nuevas dependencias.

### TASK-002 — Borrado lógico con HoldButton

**Estado:** DONE · **Criterios:** AC-003, AC-004, parte AC-006.

Migración transaccional deleted_at, recibos idempotentes y acción de servidor autenticada; excluir borrados de lecturas operativas y rechazar edición/movimientos posteriores, conservar historial y métricas; integrar HoldButton en edición, conciliación, notificaciones y reintento sin anunciar éxito prematuro. Respetar la política aprobada sobre historial y métricas.

- **Dependencias:** TASK-001 aceptada; política de borrado aprobada.
- **Archivos permitidos:** nueva migración supabase/migrations, src/lib/clients, src/app/(crm)/clientes, src/components/clients, src/components/ui/HoldButton.tsx o destino oficial equivalente, package.json/package-lock.json; pruebas tests/clients, supabase/tests y tests/e2e acotadas; tests/support/sql-concurrency.mjs y scripts/check-test-db.mjs sólo para integrar comprobación local aislada necesaria.
- **Termina cuando:** hold/cancelación/error/conflicto/éxito probados; autorización, rollback atómico, versión, reintentos y efectos en métricas comprobados en base local aislada; verificación independiente, review y commit aceptados.
- **WU-002:** contrato SQL/server, UI y pruebas coherentes.
- **Corrección aceptada:** Reviewer APPROVED/STOPPED sobre candidato24 b6b919a31196f148bf2065564561b3c637eb8e1d8644af37ead064fef72200ae: gate compartido remove/retry evita operación incompatible; retry de borrado incierto conserva UUID. RED4 y GREEN47 writer; fresh Vitest321/321, browserdelete2/2, lint/diff PASS. Hashes SQL/server/concurrency idénticos conservan SQL001–007+6concurrencias y globalLoading4 aceptados. Configs byte idénticas antes/después y excluidas. Commit 7428a21da8ba2ecce789e64e8d594d67bd10d13d verificado, padre f1a3e4ad0e3164c1db97c75ff678b3fdd413cf6c, 25 paths e índice vacío. Propio516+/25-, HoldButton oficial adaptado364 y docs8+/7- aparte.
- **Resultado:** candidato inicial 24 paths 9d0b629edbde8c66b6c792510ab7267cea7b90b3c9623c8d40791d2e48a42a87 STOPPED. Fresh Verification-only SQL001–007 y concurrencia real 6 PASS (cluster PostgreSQL17.11 nuevo loopback detenido/eliminado); browser delete2/global4 PASS, lint/diff PASS, Vitest316/317. Reviewer CHANGES_REQUESTED: ClientForm155/36 retry borrado permite acción tras guardado incierto; corrección gate y RED/GREEN requerida. Kanban.test70 assertion foco síncrona tras DOM removal antes cleanup microtask; browser no reprodujo defecto producto; esperar foco y scroll finales sin debilitar criterios. Implementer reabierto sólo para esas correcciones UI/tests; SQL unchanged conserva evidencia por path. Cancelación temprana browser synthetic, positivos teclado/touch CDP trusted; transporte/router simulado, no remoto/RSC. Writer build/typecheck finales PASS y configs restauradas byte por byte.

### TASK-003 — Selector RubberSegment e integración

**Estado:** DONE · **Criterios:** AC-005, AC-006.

Incorporar variante oficial TS-TW y reemplazar el selector actual conservando URL/historial, consulta única, filtros/página y retorno de foco. Adaptar estilos al CRM y comprobar integración de las tres mejoras.

- **Dependencias:** TASK-001 y TASK-002 aceptadas.
- **Archivos permitidos:** src/components/clients/client-list.tsx, client-modal.tsx, clients.module.css, componente oficial en src/components/ui; package.json/package-lock.json y components.json si instalación oficial lo requiere; tests/clients/list.test.tsx, modal.test.tsx, kanban.test.tsx (adaptar semántica del selector preservando criterios) y harness locales tests/e2e de vistas/modal.
- **Termina cuando:** no hay nueva consulta al alternar; historial/teclado/foco/móvil funcionales y regresión aceptada. Revisión/commit local y criterios globales verificados.
- **WU-003:** selector e integración final; reutilizar pruebas aceptadas de candidatos sin cambios.
- **Adaptación de regresión:** actualizar únicamente referencias semánticas del selector en tests/e2e/client-view-refresh.spec.ts, clients-form.spec.ts, crm-flow.spec.ts, kanban-live-flow.ts y kanban-interaction-local.spec.ts. Conservar criterios; pruebas live no se ejecutan ni atribuyen como aceptación remota.
- **Entorno de prueba:** tests/clients/delete-list.test.tsx permite stub ResizeObserver para montar el selector nuevo, sin alterar criterios del borrado.
- **Resultado:** candidato17 b9508a802b9247e0bc4ee5298e0ea8d13383bcaddfeb4164c3abbb30b1dc8484 IMPLEMENTED/STOPPED. RubberSegment oficial adaptado416 líneas (Git415), motion fijado12.43.0 sin updates ajenos; selector controlado local History API, teclado y fallback foco al radio seleccionado. RED2 list observado; writerGREEN321/321, browserview1/modalfilter1, lint/typecheck/build/diff PASS. Configs preservadas byte por byte; SQL/server sin cambios. Suites live sólo adaptación semántica no ejecutadas, harness local simula Next/transporte.
- **Aceptación:** fresh Verification-only321/321, browserview1/modalfilter1/delete2, lint/diff PASS; candidato17 idéntico antes/después y configs preservadas. Reviewer WU-003 + integración APPROVED/STOPPED, AC005/006 y convivencia aceptadas. Reutilizados WU001/002 review/SQL001–007+6concurrencias/global4 intactos; no repeticiones sin cambios. Commit local WU003 verificado inicialmente 4fc74b1b72ab19d7a241bfb7091dde70bbede132, padre7428a21da8ba2ecce789e64e8d594d67bd10d13d y 18 paths exactos; cierre documental se incorpora a la misma unidad. Propio72+/54-, vendor415, lock69 aparte; índice vacío y configs pre/post idénticas.

## Próximo paso

- **Feature:** DONE.
- **Tarea activa:** ninguna; TASK-001/002/003 DONE.
- **Continuación:** PLAN-2/SPEC-2 CONTINUOUS completado con criterios, comprobaciones, revisión y tres commits locales aceptados.
- **Próxima acción:** entrega del resultado local. Migración Supabase remota, publicación, push, PR y merge fuera de la autorización actual.
