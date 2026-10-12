# Rediseño integral del CRM — plan y tareas

**Definition:** [spec.md](spec.md) · **Feature:** crm-ui-ux-vercel
**Plan revision:** PLAN-5 · **Definition covered:** SPEC-5

## Ejecución y entrega

- **Execution mode:** CONTINUOUS.
- **User's mode choice:** «Aprobar y ejecutar en CONTINUOUS (recomendado)» (2026-10-11).
- **Plan approval:** APPROVE_CURRENT_PLAN.
- **Approval reference:** respuesta explícita del usuario al checkpoint conjunto DESIGN-10/SPEC-5/PLAN-5, seis etapas, TASK-001 inicial, rama y commits locales; questionItemId `[request_user_input_async,call_W2gUQJpdBfP1epAleUvSbO2p,0]`. Autoriza ejecución secuencial de TASK-001–006, pruebas/revisión/commits y reutilización de los dos logos originales según PLAN-5. Sin push/PR/merge/deploy.
- **Estado de recuperación local:** CHECKING TASK-005; candidato14 aprobado por review_002, todos workers detenidos. Entrega local pendiente. TASK-001–004 aceptadas y entregadas; baselines preservados. Registro mínimo local por memoria temporalmente no disponible.
- **First task:** TASK-001 tras aprobación y preparación de rama.
- **TDD and checks:** ON para comportamiento, según convención explícita en `specs/crm-interaction/task.md`. Vitest: RED observado antes de implementar y GREEN después. Cambios puramente visuales necesitan comprobación estructural, contraste/reflujo y revisión nativa, sin tests que repitan CSS. Playwright con fixtures aisladas para flujos integrados; capturas, vídeo y trace desactivados.
- **Delivery propuesta:** una rama `codex/crm-ui-ux-vercel`, preparada por Implementer Delivery después de aprobación, y un commit local por WU aceptada. Sin worktrees ni ramas por tarea. Push, PR, merge y deploy requieren autoridad separada. Sólo Implementer escribe aplicación; Orchestrator mantiene estos dos documentos. Diseñador trabaja únicamente en Pencil.
- **Baseline:** raíz `E:/Freelance/Nexovate-CRM`; rama `main`; HEAD `5d1a195e77568fd9dddcea70b8b67bf645674818`; remote `https://github.com/Thomicurve/Nexovate-CRM.git`. Cambios previos `next-env.d.ts`, `tsconfig.json` y skill instalada `.agents/skills/ui-ux-pro-max/` se preservan y no se incluyen incidentalmente en commits. Revalidar baseline antes de dispatch.
- **Rama preparada:** Delivery COMPLETED/STOPPED verificó `codex/crm-ui-ux-vercel` desde la base exacta anterior, índice vacío, dirty/hashes previos preservados. Sin commits ni publicación. Crear rama requirió escalación después de denegación de index.lock, aprobada automáticamente.
- **Design:** DESIGN-10 DESIGN_APPROVED/STOPPED (revalidado tras aprobación explícita), mismos ocho frames y hoja de `crm-nexovate.pen`; DESIGN-9 aceptado por usuario se conserva. Último ajuste: icono Lucide `arrow-left-right`18 en botón44×44 para ordenar etapa, seis botones desktop IDs originales, móvil `pvEDT`, estadofoco `HtCAV`/tooltip `UoRKO`; menu/expansión/label anotados en contexto nativo verificado. Designer detenido tras comprobar sin recortes en Kanban/estado del menú. Cards/variantes/dash/paleta conservados y prueba de aplicación pendiente. Checkpoint conjunto de diseño/PLAN-5 y CONTINUOUS aprobados. Designer verificó ocho pantallas, estados, tokens, gráficos, seis etapas, variantes y controles. Advertencias previas documentadas en acceso móvil y campos de hoja, sin incompatibilidad material nueva; comportamiento de aplicación pendiente de prueba. IDs/dimensiones/evidencia completa en spec.md.
- **Forecast:** seis unidades; aproximadamente 2.500–4.700 líneas escritas contando pruebas, 25–45 archivos, confianza media. Estimación orientativa, no límite artificial. Las unidades comparten primitives y contratos; una rama permite revisar su integración sin fragmentar el producto.

CONTINUOUS avanza secuencialmente después de aceptar criterios, pruebas, revisión y commit de cada unidad. Se detiene ante bloqueos, cambios materiales o interrupción del usuario. ASK_EACH_TASK solicita continuar/revisar/pausar entre tareas. Ningún modo omite gates de diseño, comprobación o entrega.

## Comprobación compartida

Cada WU recibe revisión independiente después de detener al escritor. Instalación/contratos públicos y cambios de mutación/concurrencia/eliminación requieren además un Implementer nuevo en modo verification-only, sin editar. Ejecución secuencial. Revisar pruebas focalizadas y `npm run lint`, `npm run typecheck`; `npm run build` al cambiar dependencias, límites server/client y al integrar. Al cierre `npm run test` y `npm run test:e2e` en el harness aislado. No reejecutar suites sin cambios que invaliden evidencia. No migraciones previstas; si el alcance requiere SQL, detenerse para presentar el cambio material y pruebas DB correspondientes.

Recorrido local autenticado sólo de lectura. Reflujo/foco/teclado/reduced-motion comprobados con DOM/estilos y herramientas sin imágenes en anchos 390/640/768/1024/1440. Validar comportamiento comercial mediante fixtures aisladas, nunca con clientes reales. No generar capturas/exports. No modificar ni copiar credenciales.

## Tareas

### TASK-001 — Base visual, acceso y navegación

**Status:** DONE · **Criteria:** AC-001, AC-002, AC-013, AC-014

Definir tokens Vercel/Geist con paleta Nexovate y sus logos originales, primitives compartidos y motion GSAP con limpieza/reduced-motion; migrar estructura y acceso, navegación compacta, salto al contenido y contraseña visible/oculta con ayuda existente.

- **Depends on:** aprobación PLAN-5/SPEC-5/DESIGN-10 y rama preparada.
- **Allowed files:** `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(crm)/layout.tsx`, `src/app/login/`, `src/components/auth/`, primitives/motion y shell nuevos en `src/components/ui/`, `src/components/clients/navigation-links.tsx` sólo integración de navegación shell, `package.json`, `package-lock.json`, pruebas focalizadas en `tests/auth/`, `tests/ui/` y E2E del shell/acceso; `public/images/brand/nexovate-mark.png` y `nexovate-logo.png` únicamente como reutilización sin transformar de los dos originales adjuntos, cubierta por aprobación de PLAN-5, sin generar/exportar imágenes. No cambiar política auth.
- **Done when:** criterios aplicables visibles en shell/acceso; dependencias locales fijadas; foco y animaciones limpias tras unmount, reduced-motion y contraseña accesible comprobados; revisión y verificación independiente aceptadas.
- **Checks:** pruebas focalizadas auth/motion, lint/typecheck/build, reflujo shell y contraste.
- **Work units:** WU-001, base + acceso + pruebas, 400–750 líneas/7–12 archivos, confianza media; commit `feat(ui): establish Geist visual system and accessible shell`.
- **Result reference:** candidato TASK-001, SHA256 `164f73c013ca81687d7878b1a26fd9d8b8a2cc42d81cc2f44a3921e52cc20d89` (21 paths; path relativo ordenado + NUL + bytes + NUL). Writer observó RED y GREEN 55 tests/10 archivos, E2E local 1 PASS con reflujo 320/390/640/768/1024/1440, lint/typecheck/build aislados PASS sobre Node22.22.3/npm10.9.8. Verificador independiente: todos PASS, E2E20,1s, digest vigente y PNG originales preservados. Typegen reescribió next-env/tsconfig; restauración exclusivamente por Implementer, hashes previos coincidentes antes/después y verificador comprobó `node node_modules/typescript/bin/tsc --noEmit` PASS sobre configuración restaurada. Verification COMPLETED/STOPPED; recibos restantes reutilizados por candidato intacto. Audit oficial: cinco high en dependencias dev idénticas al baseline, ninguna añadida por Geist/GSAP; sin actualizaciones ajenas. Fuente/tests +447/−86; lock generado y dos originales separados. Revisión pendiente; sin commit todavía.

**Review reference:** review_001 confirmó digest y baselines; corrigió su único MAJOR (el menú desmontaba el owner de logout pendiente al robar foco GlobalLoading). Writer observó RED y GREEN14/4, E2E1/24,5s, lint y tsc PASS. verify_001 independiente COMPLETED/STOPPED: GREEN14/4, E2E1/22,5s con foco nativo/guardas/una llamada/limpieza, tsc directo PASS, baseline intacto. review_001 correctiva APPROVED/READY_TO_CONTINUE/STOPPED para digest21 `5ad333b8d4d10db65b577acb007a5485a87f7b7b67e3791f4dca5ddc4fa71688`, sin hallazgos. Build previo reutilizado por fronteras/deps intactas.

**Commit reference:** Delivery COMPLETED/STOPPED, `755e7c5e20d844a62beb0049d8cf9544187290fc`, padre `5d1a195e77568fd9dddcea70b8b67bf645674818`, `feat(ui): establish Geist visual system and accessible shell`. 23 paths explícitos: fuente/tests498+/86−, package3+/1−, lock22+/4−, docs197+, dos PNG originales. Blobs/index/digest/baseline verificados; sin publicación. TASK-001 DONE habilita TASK-002 por CONTINUOUS vigente.

### TASK-002 — Clientes: encontrar y leer

**Status:** DONE · **Criteria:** AC-003, AC-004, AC-011, AC-014

Migrar listado/tabla, búsqueda visible de nombre/empresa, panel contextual de filtros, etiquetas removibles, ordenación estable y detalle móvil de lectura. Mantener navegación/retorno coherentes.

- **Depends on:** TASK-001.
- **Allowed files:** `src/components/clients/client-list.tsx`, `clients.module.css`, `navigation-links.tsx`, nuevos componentes de lectura/filtros en esa carpeta; `src/lib/clients/filters.ts`, `server.ts` y auxiliares estrictamente necesarios de consulta/retorno (`model.ts` únicamente allowlist de orden/dirección en returnTo); `src/app/(crm)/clientes/page.tsx`; pruebas de filtros/listado/consultas/retornos y E2E aislado correspondientes.
- **Done when:** filtros/orden/búsqueda concuerdan con datos, URL y regreso; ningún filtro obliga a perder contexto; móvil permite leer todos los datos existentes; vacíos accionables y conteos honestos; contratos validados independientemente.
- **Checks:** RED/GREEN de consultas y navegación, pruebas focalizadas, lint/typecheck, teclado y anchos objetivo del listado.
- **Work units:** WU-002, consulta + presentación + pruebas, 500–900 líneas/6–10 archivos, confianza media; commit `feat(clients): improve search filters sorting and mobile details`.
- **Result reference:** Implementer IMPLEMENTED/STOPPED sobre base `755e7c5e20d844a62beb0049d8cf9544187290fc`. Candidato13paths SHA256 `11b51de03d85051a6f630d1bc5106ada102f0a68689afc08e5804641edb8e9fc`, +513/−135. RED8fallas/41PASS y recuperación de página vacía RED1; writer GREEN75/6files, E2E3/20,7s, lint, tsc directo y build aislado PASS. verify_002 independiente COMPLETED/STOPPED: GREEN75/6files, E2E3/20,3s (390/640/768/1024/1440, foco nativo, filtros, vacíos y regresión vista/refresh/historial), lint/tsc PASS sobre Node22/npm10; digest, HEAD e índice verificados. SDK Supabase real con fetch local, sin SQL live; build del writer reutilizado. Baselines intactos. review/commit pendientes.

**Review reference:** review_002 APPROVED/READY_TO_CONTINUE/STOPPED para el digest13 anterior, sin hallazgos. Contraste real de fuentes y baselines Git, incluidos objetos packed, confirma casos previos preservados y cobertura AC-003/004/011/014 aplicable. Reutiliza recibos independientes; sin checks ejecutados por Reviewer. Candidato aceptado para commit local WU-002.

**Commit reference:** Delivery COMPLETED/STOPPED, `6465c3be3dc8410044c993ee9163a12a95526d1e`, padre `755e7c5e20d844a62beb0049d8cf9544187290fc`. 14 paths explícitos (13 aplicación/pruebas + task.md), 526+/144−. Blobs normalizados, bytes locales, índice vacío y baselines verificados; sin publicación. TASK-002 DONE habilita TASK-003 por CONTINUOUS vigente.

### TASK-003 — Kanban claro y operable

**Status:** DONE · **Criteria:** AC-005, AC-011, AC-013, AC-014, AC-015

Migrar columnas/tarjetas y sus menús, distinguir las seis etapas con acentos de color y nombres visibles (encabezado/contador/selector móvil), reforzar jerarquía de tarjetas (nombre/empresa/rubro/metadatos) según referencia y sólo campos existentes, permitir reordenación por clic/teclado en escritorio, recordar etapa móvil, vacíos compactos y contadores sobre resultados actuales. Paleta general, dashboard y diseño de columnas aceptados se conservan.

- **Depends on:** TASK-002.
- **Allowed files:** `src/components/clients/client-kanban.tsx`, `clients.module.css`, componentes Kanban nuevos; `src/lib/clients/column-order.ts` y preferencia de etapa móvil nueva, sin alterar contratos de mutación; tests de Kanban/preferencias y E2E correspondientes.
- **Done when:** tablero usable sin arrastrar; preferencia/fallback deterministas, cambio de etapa visible y scroll contenido; movimiento conserva protecciones; tarjetas jerarquizadas y contadores corresponden al dataset cargado, incluidas variantes largas/incompletas, sin inventar metadatos ni reducir objetivos/foco/lectura en móvil.
- **Checks:** RED/GREEN de preferencias/alternativas, pruebas existentes DnD, lint/typecheck, recorrido con teclado y reflujo móvil/escritorio.
- **Work units:** WU-003, tablero + preferencias + pruebas, 350–650 líneas/4–7 archivos, confianza media; commit `feat(kanban): improve navigation empty states and reorder controls`.
- **Result reference:** Designer revalidó DESIGN_APPROVED/STOPPED mediante lectura nativa sin editar; P1rBO/Zvio5 y variantes vDek2 sin recortes. Implementer IMPLEMENTED/STOPPED sobre HEAD `6465c3be3dc8410044c993ee9163a12a95526d1e`: candidato7 SHA256 `3a9866e8d15aa2c14a991518ed9a435f2919e11d083ca1c873f2f6f37972e0c4`, +299/−69. RED preferencia ausente/menú ausente; GREEN80/6, KanbanE2E5/21,3s y vista/refrescoE2E3/25,5s, lint/tsc PASS Node22/npm10. Tests conservan touch y destino exacto esperando activación observable del sensor. DOM390/640/768/1024/1440, controles44, variantes/vacíos/persistencia/foco comprobados; contraste contador mínimo5,16:1. Sin fronteras/deps/contracts nuevos; build previo reutilizado. Baselines intactos, review/commit pendientes. Detectado cambio ajeno en .gitignore que ignora la skill instalada; excluido de candidato y entregas.

**Review reference:** review_002 WU-003 APPROVED/READY_TO_CONTINUE/STOPPED para digest7 vigente, sin hallazgos ni gaps bloqueantes. Blobs reales/diff confirman invariantes comerciales y pruebas previas preservados; sin nuevo riesgo alto que exija verificación adicional. Fuentes compatibles con DESIGN-10 y AC-005/011/013/014/015, reutilizando recibos writer. .gitignore ajeno SHA256 `D50FA6D29618A1B9151CA9EAEB4BCFC124F8A88CA8834369A3AC1C59021DDE5D`, preservado y excluido.

**Commit reference:** Delivery COMPLETED/STOPPED, `a07d2240aa25237a86325834e4c373b37e89af85`, padre `6465c3be3dc8410044c993ee9163a12a95526d1e`. Ocho paths explícitos (siete candidato + task.md), 310+/76−; blobs normalizados/raw/index/baselines comprobados, sin publicación. TASK-003 DONE habilita TASK-004.

### TASK-004 — Formularios, conflictos y eliminación

**Status:** DONE · **Criteria:** AC-006, AC-007, AC-008, AC-011, AC-013, AC-014

Migrar formularios/diálogo, resumen de errores enlazado, protección de borradores al salir, comparación explícita ante conflicto y confirmación de eliminación accesible como alternativa al gesto mantenido.

- **Depends on:** TASK-002, TASK-003.
- **Allowed files:** `src/components/clients/client-form.tsx`, `client-modal.tsx`, `clients.module.css`, componentes de confirmación/conflicto nuevos; `src/components/ui/HoldButton.tsx`; rutas nueva/editar cliente y auxiliares de navegación existentes necesarios (`client-list.tsx` sólo coordinación restoreView/modal/History, conservando guardas de movimiento); tests de formularios/modal/conflictos/delete y E2E aislado. `src/lib/clients/{mutations,delete,moves}.ts` sólo si adaptación mínima imprescindible, conservando invariantes y con prueba independiente.
- **Done when:** salidas con/sin cambios e in-flight distinguidas; borrador permanece tras conflicto/cancelar salida; se comparan campos y usuario resuelve; errores enfocados/descriptos; eliminación por teclado sin temporizador comparte guardas. Sin retry inseguro ni doble envío.
- **Checks:** RED/GREEN de pérdida de borrador, validación, conflictos, intención única y resultado incierto; E2E aislado de confirmación/salida; lint/typecheck; verificación independiente obligatoria de seguridad/concurrencia antes de review/commit.
- **Work units:** WU-004, coherencia del borrador/mutación + pruebas, 650–1.100 líneas/6–10 archivos, confianza media-baja; commit `feat(clients): protect drafts and make conflict and delete flows accessible`.
- **Result reference:** Designer revalidó NCQd8/dGwWf/krCtl/yQIxf/YVCNo. Candidato final14 SHA256 `4cbf6e1389781920d9037f94da9da830b8f18777edd5f094e4193f88669d40cf`, 650+/111−. Formularios agrupados, errores enlazados/enfocados, borradores protegidos, comparación de nueve campos con elección explícita y precisión de fechas; confirmación normal y Hold comparten guardas. RED8 más eliminación normal ausente; RED correctivo2/8 tras hallazgo independiente de salida conflictiva inline/direct. Corrección conserva borrador/bloqueo/foco y sólo libera al descartar, con copy honesta; no cambios comerciales/backend/dependencias.

**Implementation choice:** History usa índice nativo cuando existe; fallback conservador restaura editor/state original sin sobrescribir destino, puede sustituir historial hacia delante. Cancelación repetida sin crecimiento/bucles probada. Adaptación de client-list limitada a coordinación History/foco. Harness Kanban espera registro efectivo del listener KeyboardSensor diferido, restaura addEventListener y conserva destinos/assertions; sin tiempos arbitrarios. Hasta14 paths por helpers/harness de reproducción, sin nuevo alcance funcional.

**Checks and review:** writer GREEN75/9, consumidores16/2, correctivos37/3; navegador modal7, delete7, vista3, Kanban5. verify_004 independiente75/9+modal7 y correctivo37/3+delete7/25,7s, lint/tsc PASS Node22/npm10; defecto inicial resuelto, restantes recibos vigentes reutilizados. DOM390/640/768/1024/1440 y390×450 reflujo200% equivalente, sin afirmar zoom nativo/NextRSC/SQL externo. Build previo reutilizable. Sandbox cache/localhost requirió repeticiones exactas escaladas aprobadas; sólo .last-run.json residual. review_002 WU-004 APPROVED/READY_TO_CONTINUE/STOPPED sin hallazgos/gaps, doce blobs baseline SHA1 validados, diseño compatible; identidad/index/baselines3 intactos.

**Commit reference:** Delivery COMPLETED/STOPPED verificó `fb4299a6c7ebd73ff357e5fb1f85575beb7a77c2`, padre `a07d2240aa25237a86325834e4c373b37e89af85`. Quince paths exactos, candidato14 + task.md, 672+/119−; blobs normalizados y raw locales comprobados, baselines3/índice intactos, sin publicación. TASK-004 DONE habilita TASK-005.

### TASK-005 — Dashboard útil en todos los anchos

**Status:** IN_PROGRESS · **Criteria:** AC-009, AC-010, AC-011, AC-013, AC-014

Migrar dashboard con indicadores superiores y gráfico temporal combinado de líneas/áreas no apiladas inspirado en la referencia del usuario; arreglar fechas/agrupación, períodos rápidos, explicación de tendencia/comparación y composición responsive, manteniendo accesibilidad y semántica histórica. Series de los tres hitos existentes, sin inventar métricas monetarias/metas.

- **Depends on:** TASK-001, TASK-004.
- **Allowed files:** `src/components/dashboard/`, `src/lib/metrics/`, `src/app/(crm)/dashboard/page.tsx`, auxiliares existentes de fechas compartidos cuando sea imprescindible; tests de métricas/query/dashboard y E2E aislado.
- **Done when:** draft/applied nunca se confunden; presets usan límites locales correctos; comparación definida con base real o ausencia explícita; resalte justificado; gráfico legible sin desborde a 640 px y series extensas con tabla accesible.
- **Checks:** RED/GREEN fechas/agrupación/presets y períodos comparados; pruebas focalizadas métricas; lint/typecheck/build; verificación independiente de queries/semántica; DOM/reflujo y teclado.
- **Work units:** WU-005, períodos + métricas + presentación + pruebas, 400–750 líneas/5–8 archivos, confianza media; commit `feat(dashboard): clarify periods trends and responsive charts`.
- **Implementation forecast:** mapeo del writer ajusta a unos14 paths/700–900 líneas de churn por harness E2E aislado nuevo y adaptación de pruebas existentes, sin nuevos resultados funcionales. Misma WU coherente; comparación UI explícita usa segunda RPC readonly sólo tras validar el rango actual, sin cambiar SQL/decoder/auth. Presets completan borrador y Aplicar confirma fechas/agrupación conjuntamente. dashboard.spec.ts/dashboard-live-flow.ts adaptan expectativas obsoletas de autoaplicación y tres gráficos/tablas a la UI aprobada, conservando totales y flujo comercial; no se ejecutan sobre datos reales ni se afirma evidencia live.
- **Result reference:** Designer DESIGN_APPROVED/STOPPED revalidó W57BkW/Tv6LS, KPI3 y panel combinado YQD3p/DGZRW, trazos lineales/áreas independientes/tokens/foco44. Tabla abierta/series extensas/cero/desconocido gobernados por AC; móvil refluye tercer preset. Candidato final14 SHA256 `5da583f1572debe491a31ffb73c488da53518eee0c6c18dd3b56b3a4481139ad`, 444+/121− sobre base `fb4299a6c7ebd73ff357e5fb1f85575beb7a77c2`. Borrador conjunto, comparación inclusiva real, errores conservan datos, tabla2000/too_many y rótulo inválido sin período aplicado. Decoder/RPC/auth/SQL/deps/mutaciones intactos.

**Checks:** RED20/57 más rótulo inválido y RED1 del mes1900 permitido. Writer GREEN78/3, dashboardE2E5/20,3s, refresh focal1/17,2s, lint/tsc/build aislado PASS. verify_005 independiente77/3 y E2E5/17,9s,136 rangos contiguos de igual cantidad inclusiva; correctiva dominio47/2,29s, lint/tsc PASS, defecto de mes1900 resuelto. Límites1900/9999/invalidDate/calendario local comprobados. DOM390/640/768/1024/1440 y390×450/reduced-motion, controles44/teclado, áreas desde0/picos independientes; contraste líneas4,44/7,62/11,61 y secundario8,55. Build preservó bytes protegidos en finally mismo proceso. Sandbox requirió repeticiones exactas escaladas. Dos E2E4/5 iniciales por build simultáneo y lectura prematura ResizeObserver: espera de geometría real, afectado1/1 y final5/5 PASS, sin relajar nooverflow; mantener build/navegador secuenciales. No evidencia live/NextRSC/SQL ni zoom nativo; índice/baselines3 intactos.

**Review reference:** review_002 WU-005 APPROVED/READY_TO_CONTINUE/FINAL STOPPED, mismo digest14, sin hallazgos ni gaps bloqueantes. Diez blobs baseline SHA1 validados y diff exacto del test restante, fuentes/pruebas y diseño nativo compatibles con AC-009/010/011/013/014; evidencia independiente vigente. Entrega local pendiente.

### TASK-006 — Estados comunes y cierre integrado

**Status:** TODO · **Criteria:** AC-001, AC-011, AC-012, AC-013, AC-014; integración AC-002–AC-010 y AC-015

Completar feedback de operaciones, esperas y recuperación, límites error/not-found, retorno de reintento y coherencia de vacíos/toasts. Revisar integración de todas las superficies, rendimiento y lifecycle de movimiento.

- **Depends on:** TASK-001–TASK-005 aceptadas y entregadas.
- **Allowed files:** `src/components/ui/{global-loading,loading-navigation,notifications}.tsx` y estilos asociados, `LatticeLoader.tsx` únicamente para integración conservando patrón; nuevos `error.tsx`/`not-found.tsx` en `src/app/` y `(crm)/`; ajustes puntuales de contexto/retorno/feedback en superficies ya migradas; tests/UI/E2E correspondientes.
- **Done when:** loader expresa operación, errores/esperas ofrecen recuperación segura, retorno de edición válido; todos los criterios cuentan con evidencia vigente y commits por WU; sin regresiones auth/mutaciones/histórico ni desborde global. Cualquier cambio material de diseño/alcance vuelve a aprobación antes de implementarlo.
- **Checks:** RED/GREEN de feedback y recuperación, lint/typecheck/build, suite Vitest y E2E aislado final; reflujo/foco/reduced-motion/lifecycle; revisión sólo de nuevo diff e integración no revisada, reusando recibos aceptados.
- **Work units:** WU-006, recuperación + integración + pruebas, 200–550 líneas/5–9 archivos, confianza media; commit `feat(ui): unify operation feedback and safe recovery states`.
- **Result reference:** pendiente.

## Próximo paso

- **Next task:** TASK-005; IN_PROGRESS, única tarea seleccionada.
- **Continuation:** COVERED_BY_CONTINUOUS_PLAN.
- **User decision:** checkpoint conjunto DESIGN-10/SPEC-5/PLAN-5 aprobado y CONTINUOUS explícito; TASK-001–004 comprobadas, revisadas y entregadas mediante commits locales verificados. Próxima TASK-005.
- **Consumed by:** revalidación nativa y dispatch único Implementer TASK-005; permiso continuo válido únicamente para PLAN-5.
- **Recuperación local:** estos documentos y el documento nativo mantienen el alcance. Memoria atribuida al agente temporalmente no disponible: registro de identidad runtime no confirmado; no intentar guardar sin registro del host.
