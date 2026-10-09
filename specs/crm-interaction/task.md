# Interacción fluida — plan y tareas

**Feature:** crm-interaction · **Definición:** [spec.md](spec.md)
**Plan:** PLAN-1 (aprobado) · **Cobertura:** SPEC-1

## Forma de trabajo

- **Modo:** CONTINUOUS. Decisión del usuario: «Listo plan aprobado, podes hacer las tareas de manera continua sin consultarme. Si surge algo que necesite una respuesta de mi parte podes notificarme» (2026-10-08).
- **Aprobación de PLAN-1/SPEC-1:** APPROVE_CURRENT_PLAN; respuesta al checkpoint conjunto PLAN-1/SPEC-1/DESIGN-4. Autoriza las tres tareas secuenciales, revisión y commits locales. Candidato de diseño verificado antes de implementación.
- **Primera tarea propuesta:** TASK-001.
- **Diseño:** DESIGN-4 aprobado en el checkpoint conjunto y verificado por Designer DESIGN_APPROVED/STOPPED mediante lectura textual de once frames actuales, todos placeholder:false. Kanban escritorio/móvil TGdJv/eGWuA; tabla G3QI5/Q6LoOH; dashboard ZcMoq/G6DZxo; alta modal kpzgD/a2tmDP; edición modal MPpHS/qyhdR; estados gfpz3. Controles/formularios/estados y contratos permanecen. Referencias históricas conservadas. execute/Get informa schema y:0 frente a bounds y:50 (y:1 frente a y:51) y clipping en hijos flex; no se afirma ausencia de recortes ni comprobación funcional de implementación. Motion/foco/gestos son especificación editable, que debe comprobarse en la app.
- **TDD:** ON para comportamiento, según convención explícita vigente del proyecto. RED observado antes de implementación nueva; Vitest/Testing Library y Playwright para pruebas relevantes.
- **Entrega propuesta:** una rama feature/crm-interaction en este mismo checkout, desde el HEAD actual de main bdb31c9061d2576981b41f64dbd6e824ba33064c. Sin ramas por tarea ni worktrees. Una unidad coherente y commit local revisado por tarea. PLAN-1 incluye estos commits locales; push/PR/merge/deploy requieren autoridad propia.
- **Estimación actualizada:** 1.220–1.850 líneas propias añadidas/eliminadas, aproximadamente 18–26 archivos, confianza media. TASK-001 necesita harness de navegador local porque faltan variables de cuentas live; adaptación de comprobación dentro de los mismos criterios, sin cambio de producto, dependencias ni entrega. El modal y la compatibilidad de enlaces concentran la incertidumbre; no se cuentan binarios ni archivos generados.

Un único Implementer escribe aplicación. Detenerlo antes de comprobaciones independientes, Reviewer y Delivery. CONTINUOUS avanza en secuencia sólo dentro del plan aprobado; los bloqueos o cambios materiales requieren consulta. No se habilita sincronización externa.

## Comprobaciones comunes

Pruebas conductuales específicas por tarea, npm run lint, npm run typecheck y git diff --check. npm run build y suite de regresión al integrar cambios que afecten rutas/formulario/kanban. Reutilizar comprobaciones aceptadas cuando el candidato no cambie.

Playwright sin capturas, vídeos ni trazas, ya desactivados en playwright.config.ts. Comprobar DOM, teclado, móvil y consultas en un entorno local aislado; no interferir con servicios del usuario. Las pruebas positivas de escritura usan dobles/locales, sin modificar clientes reales ni crear fixtures de Supabase. Si alguna prueba necesaria requiere permiso adicional, preparar el procedimiento concreto antes de solicitarlo.

**Excepción de comprobación solicitada por el usuario para TASK-003:** «si corriste los test y pasaron, directamente demos por sentado que funciona y listo, en este caso». Se acepta la prueba conductual verde del candidato actual; se detiene la investigación del arranque Vite y no se exige otra comprobación de navegador ni una batería duplicada para cerrar esta tarea. Se conserva revisión y commit locales proporcionales. Los intentos del arnés kanban agotaron el límite esperando assets locales antes de cualquier interacción: no se atribuyen pruebas de gestos en Chrome. WU-001/WU-002 mantienen su evidencia aceptada.

## Tareas

### TASK-001 — Alternar vistas y actualizar datos sin perder contexto

**Estado:** DONE · **Criterios:** AC-001, AC-002 y parte de AC-007.

Separar la vista del ciclo de consulta, conservar navegación/URL y agregar Actualizar en Clientes y Dashboard con progreso y errores recuperables.

- **Dependencias:** aprobación de PLAN-1, modo y diseño de controles.
- **Archivos permitidos:** src/components/clients/client-list.tsx, src/app/(crm)/clientes/page.tsx, src/components/dashboard/dashboard.tsx y sus CSS; tests/clients/list.test.tsx, tests/clients/kanban.test.tsx, tests/metrics/dashboard.test.tsx; pruebas de navegador acotadas bajo tests/e2e para vistas/refresh.
- **Termina cuando:** cambiar vista no provoca una consulta adicional; filtros/página/URL y Atrás/Adelante funcionan; ambos refresh preservan parámetros y muestran progreso/error. AC cubiertos con pruebas observadas, revisión y commit verificado.
- **Checks:** Vitest de listado/kanban/dashboard; Playwright local de cambios de vista, historial y conteo de solicitudes; comprobaciones comunes.
- **WU-001:** comportamiento y pruebas; forecast actualizado 470–550 líneas/11–12 archivos, confianza media. Incluye harness local con componentes reales, datos simulados y navegador, sin atribuirle prueba RSC/Supabase live. El test live queda preparado pero no ejecutable hasta disponer de los correos/project ref de prueba; no se modifica configuración privada. Se conserva una unidad coherente y el mismo commit propuesto feat: reuse client data across views and add refresh controls.
- **Resultado:** WU-001 aceptada y commit local a46b9f5712a8e9cc784ba08601824cbe13d7a7bb, padre bdb31c9061d2576981b41f64dbd6e824ba33064c; 12 archivos +446/-27 y dos documentos, blobs verificados/índice vacío. Digest candidato 7da8e7cc44c1bd9323c38c4e6fa801cb5fd6aed562d19f0c6ddc0d425b7b4b0e. RED observado (vista/refresh, transición sin snapshot, lock/historial); GREEN Clientes16/16 y Dashboard14/14, Playwright local/lint/typecheck/build aislados/diff-check PASS. Fresh Verification-only COMPLETED/STOPPED: Vitest30/3 y browserlocal1/38,7s PASS, digest inicial/final igual. Reviewer APPROVED/READY_TO_CONTINUE/STOPPED, sin hallazgos; next-env/tsconfig sin diff de contenido y excluidos. Browser live se detuvo antes de login por configuración de cuentas ausente; no se acredita RSC/Supabase live.

### TASK-002 — Alta y edición en modal accesible y animado

**Estado:** DONE · **Criterios:** AC-003, AC-004 y parte de AC-007.

Reutilizar el formulario para apertura local, cierre y guardado sobre el listado; adaptar los enlaces existentes para presentar el mismo modal y preservar el contexto de retorno.

- **Dependencias:** TASK-001 aceptada y diseño modal aprobado/verificado.
- **Archivos permitidos:** src/components/clients/client-form.tsx, client-list.tsx y clients.module.css; nuevo client-modal.tsx en el mismo directorio; src/app/(crm)/clientes/nuevo/page.tsx y [id]/editar/page.tsx; tests/clients/form.test.tsx, list.test.tsx y nuevo modal.test.tsx; tests/e2e/clients-form.spec.ts, crm-flow.spec.ts y prueba acotada del modal. tests/e2e/client-view-refresh-local.spec.ts sólo adaptación del stub saveClient que rechaza escrituras por el nuevo import de ClientList y timeout del caso 60→90s por arranque Vite frío, sin debilitar comprobaciones ni ampliar esperas de producto. Actions sólo si una adaptación demostrada es necesaria, conservando contrato y guards, con sus pruebas tests/clients/boundaries.test.ts.
- **Termina cuando:** nuevo/editar usan el modal; guardados, validación, conflicto y reintento funcionan sin perder información; cierre y retorno, teclado/móvil/movimiento reducido comprobados. Las rutas directas existentes siguen siendo utilizables. Revisión y commit aceptados.
- **Checks:** Vitest formulario/modal/listado/boundaries; Playwright local de apertura/cierre/foco, móvil, enlaces directos y guardados simulados; comprobaciones comunes, build y regresión afectada.
- **WU-002:** modal, adaptación del formulario/rutas y pruebas; forecast actualizado 450–800 líneas/15 archivos, confianza media. La diferencia de archivos corresponde al harness local y adaptación de regresión ya autorizados; no cambia producto, arquitectura ni entrega. Unidad cohesionada aun si supera el umbral orientativo de 400. Commit propuesto feat: create and edit clients in an animated modal.
- **Resultado:** WU-002 aceptada y commit fd810bda3b0f051d0f8a46edc26dfe24348da3f9, padre a46b9f5712a8e9cc784ba08601824cbe13d7a7bb, blobs/16 paths/índice vacío verificados. Candidato 15 archivos +443/-39 (482 líneas), digest raw paths+NUL+bytes+NUL cd04923eac971f33fb2bdc5a1aa0522ebd4a1fc11afb11cf53355776e5311855. RED/GREEN apertura/callback, guard de submit/cierre, foco tras conflicto y eliminación del disparador por filtro. Unit38/38 final y contratos/moves vigentes; browser modal3/3 focalizados y regresión vistas1/1, lint/typecheck/build aislados/diff-check PASS. Verification-only independiente COMPLETED/STOPPED: Vitest6/91 en 43,51s y Chrome modal3/3 en 57,3s PASS; repeticiones idénticas escaladas tras ENOENT de caché/denegación de localhost anteriores a interacción. Digest inicial/final igual y puerto3112 cerrado. Reviewer APPROVED/READY_TO_CONTINUE/STOPPED sin hallazgos. No cambios a actions/backend. next-env/tsconfig preservados byte por byte y excluidos. Browser local con componentes reales/HTTP simulado; no prueba Next RSC/Supabase live.

### TASK-003 — Tarjetas directas y columnas reordenables

**Estado:** DONE · **Criterios:** AC-005, AC-006 y cierre de AC-007.

Abrir el modal desde la tarjeta completa, retirar acciones actuales y separar apertura de arrastre. Agregar orden de columnas persistido localmente y alternativas por teclado/móvil.

- **Dependencias:** TASK-002 aceptada y diseño kanban aprobado/verificado.
- **Archivos permitidos:** src/components/clients/client-kanban.tsx, client-list.tsx y clients.module.css; nueva utilidad src/lib/clients/column-order.ts; tests/clients/kanban.test.tsx y nuevo column-order.test.ts; tests/e2e/client-feedback-readonly.spec.ts, kanban-live-flow.ts y prueba acotada de interacción kanban. Conservar procedimientos/guards remotos; no ejecutarlos con escrituras implícitas.
- **Termina cuando:** clic y teclado abren detalle editable, los botones anteriores no aparecen y el drag nunca abre el modal; reordenar/persistir/restaurar funciona incluso ante almacenamiento inválido; orden personalizado rige teclado/móvil; movimientos/reintentos/conflictos y notificaciones conservados. Criterios integrados, revisión y commit aceptados.
- **Checks:** Vitest kanban/orden/moves/form/list; Playwright local de clic vs drag, cancelación, teclado/móvil y persistencia; comprobaciones comunes, build y suite de regresión final. Cierre reutiliza evidencias aceptadas y revisa sólo integración no cubierta.
- **WU-003:** tarjetas, orden y pruebas; forecast actualizado 550–800 líneas/9–11 archivos, confianza media. La separación de gestos, almacenamiento adverso y controles móvil/teclado requiere prueba local propia; mismo producto, arquitectura, criterios y entrega, sin dependencias nuevas. Se conserva la unidad coherente dentro del forecast global aprobado. Commit propuesto feat: reorder kanban columns and open client cards directly.
- **Resultado:** WU-003 aceptada y commit 38d504d6a5614eba68c5fdb049510ce948b91fd8, padre fd810bda3b0f051d0f8a46edc26dfe24348da3f9; paths/11 blobs/índice vacío verificados. Candidato 10 archivos +395/-71 (466 líneas), digest raw paths+NUL+bytes+NUL 028277fef89b3240e544a61585b0b29404531c4761e2a812c9139418f284f11c. Prueba conductual final14/14 en 9,40s, lint/typecheck aislado/diff-check PASS; next-env/tsconfig restaurados byte por byte y ningún proceso propio activo. Chrome local caso de tarjeta1/1 PASS (31,677s, ejecución59,052s): apertura, selección, modifiers, arrastre/cancelación, lock incierto y reintento, antes de ajustes finales de lint a lectura diferida/ref estable; los bytes finales tienen unit/lint/types. Casos de columnas/móvil/storage preparados sin ejecutar; cierre acepta la excepción humana expresa arriba, sin nueva batería completa ni build duplicado. No cambios a actions/backend/SQL/auth/dependencias. Reviewer APPROVED/READY_TO_CONTINUE/STOPPED, sin hallazgos, incluido cierre integrado reutilizando recibos WU-001/WU-002.

## Próximo paso

- **Estado final:** DONE. TASK-001, TASK-002 y TASK-003 aceptadas y entregadas en rama feature/crm-interaction; último commit de producto 38d504d6a5614eba68c5fdb049510ce948b91fd8.
- **Continuación:** COVERED_BY_CONTINUOUS_PLAN, PLAN-1.
- **Cierre:** AC-001 a AC-007 aceptados, sin tareas pendientes. Cambios guardados en commits locales; no se ejecutaron operaciones de publicación. Memoria externa suspendida por el hook de runtime sin identidad registrada; estos documentos y los commits conservan la continuidad suficiente.
