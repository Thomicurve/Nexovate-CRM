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

**Estado:** IN_PROGRESS · **Criterios:** AC-001, AC-002, parte AC-006.

Integrar el componente oficial y un ciclo común para operaciones visibles, navegación y fallback de rutas. Resolver la capa sobre dialog, bloqueo/foco, solapamientos, errores y limpieza al desmontar. Reemplazar textos de carga visibles sin eliminar mensajes útiles de error/reintento.

- **Dependencias:** plan/modo/diseño aprobados; rama preparada por Delivery.
- **Archivos permitidos:** src/components/ui, src/components/auth/login-form.tsx, src/components/clients, src/components/dashboard/dashboard.tsx, src/app/layout.tsx, src/app/globals.css, src/app/(crm)/layout.tsx, loading.tsx bajo src/app y enlaces/formularios que inician las operaciones enumeradas; package.json/package-lock.json/components.json; tests de auth/clients/metrics/ui y harness acotados tests/e2e.
- **Termina cuando:** AC-001/002 probados en modal, navegación, acciones, fallos y concurrencia; revisión y commit local aceptados.
- **WU-001:** indicador, conexiones y pruebas. Fuentes oficiales se distinguen de código propio en revisión.
- **Resultado:** WU-001 comprobada y Reviewer APPROVED/READY_TO_CONTINUE/STOPPED, commit pendiente. RED lifecycle 3 fallos observados, RED browser overflow compartido corregido. GREEN writer y fresh Verification-only: Vitest 61/61, Playwright local 4/4, lint y diff-check; writer typecheck/build finales PASS. Digest src/tests/components.json e6b8c1bda9c4c341af4bb19d01eb60a372c0b7f647168a8facafb4b231cda392 igual en verificación. Browser usa componentes reales y navegación Next simulada, sin prueba RSC/Supabase live. Un run writer falló intermitentemente Cancelar tras error (3/4); fresh 4/4 no reprodujo, atribución inconclusa. Configs generadas next-env/tsconfig regresaron a contenido baseline sin diff textual; no se atribuye conservación byte por byte ni se incluyen en commit. React Bits oficial 306 líneas aparte de código propio; sin nuevas dependencias.

### TASK-002 — Borrado lógico con HoldButton

**Estado:** TODO · **Criterios:** AC-003, AC-004, parte AC-006.

Migración transaccional deleted_at, recibos idempotentes y acción de servidor autenticada; excluir borrados de lecturas operativas y rechazar edición/movimientos posteriores, conservar historial y métricas; integrar HoldButton en edición, conciliación, notificaciones y reintento sin anunciar éxito prematuro. Respetar la política aprobada sobre historial y métricas.

- **Dependencias:** TASK-001 aceptada; política de borrado aprobada.
- **Archivos permitidos:** nueva migración supabase/migrations, src/lib/clients, src/app/(crm)/clientes, src/components/clients, src/components/ui/HoldButton.tsx o destino oficial equivalente, package.json/package-lock.json; pruebas tests/clients, supabase/tests y tests/e2e acotadas; tests/support/sql-concurrency.mjs y scripts/check-test-db.mjs sólo para integrar comprobación local aislada necesaria.
- **Termina cuando:** hold/cancelación/error/conflicto/éxito probados; autorización, rollback atómico, versión, reintentos y efectos en métricas comprobados en base local aislada; verificación independiente, review y commit aceptados.
- **WU-002:** contrato SQL/server, UI y pruebas coherentes.
- **Resultado:** pendiente.

### TASK-003 — Selector RubberSegment e integración

**Estado:** TODO · **Criterios:** AC-005, AC-006.

Incorporar variante oficial TS-TW y reemplazar el selector actual conservando URL/historial, consulta única, filtros/página y retorno de foco. Adaptar estilos al CRM y comprobar integración de las tres mejoras.

- **Dependencias:** TASK-001 y TASK-002 aceptadas.
- **Archivos permitidos:** src/components/clients/client-list.tsx, client-modal.tsx, clients.module.css, componente oficial en src/components/ui; package.json/package-lock.json; tests/clients/list.test.tsx, modal.test.tsx y harness locales tests/e2e de vistas/modal.
- **Termina cuando:** no hay nueva consulta al alternar; historial/teclado/foco/móvil funcionales y regresión aceptada. Revisión/commit local y criterios globales verificados.
- **WU-003:** selector e integración final; reutilizar pruebas aceptadas de candidatos sin cambios.
- **Resultado:** pendiente.

## Próximo paso

- **Feature:** CHECKING.
- **Tarea activa:** TASK-001 IN_PROGRESS.
- **Continuación:** COVERED_BY_CONTINUOUS_PLAN PLAN-2/SPEC-2; tres tareas secuenciales autorizadas; TASK-001 seleccionada para único Implementer.
- **Próxima acción:** Delivery commit WU-001 aceptada; después TASK-002 dentro del grant CONTINUOUS.
