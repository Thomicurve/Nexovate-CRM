# Carga global y limpieza de clientes

**Feature:** crm-loading-delete · **Definición:** SPEC-2 aprobada el 2026-10-09
**Plan:** [task.md](task.md)

## Objetivo y alcance

Reemplazar mensajes de carga por una pantalla superpuesta con LatticeLoader, permitir borrar clientes desde su edición mediante HoldButton y sustituir Kanban/Tabla por RubberSegment. Usar las variantes oficiales TS-TW de React Bits, revisar su código y dependencias antes de incorporarlas y conservar el estilo azul oscuro e IBM Plex Sans del CRM.

La carga cubre las operaciones visibles de la aplicación: login/logout, navegación que consulta datos, filtros/paginación, actualización de Clientes/Dashboard, alta, edición, movimiento y borrado. Las consultas internas del servidor pertenecen al mismo ciclo visible; no se propone interceptar globalmente fetch ni mostrar carga por prefetch silencioso. El selector de vistas local sigue sin consultar al servidor.

## Comportamiento aprobado

La pantalla ocupa todo el viewport, muestra LatticeLoader centrado sobre un fondo azul oscuro translúcido y bloquea interacción mientras exista una operación pendiente. Debe aparecer sobre el modal nativo dialog, cuya capa superior no se resuelve sólo con z-index. Al resolver, fallar o cancelar la operación se retira; el error recuperable queda visible y un resultado incierto conserva la intención para reintentar. Operaciones solapadas no pueden retirar prematuramente el indicador. Navegación cancelada y desmontajes no dejan una pantalla bloqueada.

En edición, debajo de las acciones de guardado, una sección separada presenta «Mantener para borrar» con HoldButton durante 2 segundos y una advertencia explícita. Soltar antes cancela; teclado y táctil funcionan; operaciones pendientes o inciertas impiden acciones incompatibles. El hold confirma la intención, pero sólo la respuesta del servidor permite mostrar «Cliente eliminado».

**Borrado aprobado:** lógico y atómico del cliente; se conserva el registro, sus transiciones, hitos y registros dependientes. El cliente desaparece del listado, búsquedas y edición activa, y sus hitos siguen contabilizados en las métricas históricas. Usar una marca deleted_at y excluir clientes borrados de lecturas operativas; las métricas no filtran esa marca. No se incorpora restauración en la UI. La autorización sigue limitada a miembros del CRM, sin DML directo para usuarios. Controlar versión concurrente, UUID de intención y reintentos idempotentes; conservar un recibo idempotente de borrado y rechazar guardados/movimientos posteriores al borrado. No aplicar migraciones ni ejecutar borrados en Supabase remoto como parte de la implementación local.

Tras el éxito, cerrar la edición, notificar, conciliar listado y Dashboard, mantener filtros/vista y recuperar una página válida si se borra su último resultado. Error/conflicto conserva contexto y ofrece una resolución explícita.

RubberSegment conserva Kanban/Tabla, filtros, página, URL, historial y selección por teclado. Mantener colores existentes: fondo #080e1b, superficie #121f35, texto #e6edf8, secundario #a6b7ce, acción #386bc0 y foco #a6caff. El borrado usa el color de error existente #f0aeb5 con contraste legible. La animación responde a la acción y respeta movimiento reducido.

## Criterios de aceptación

- **AC-001:** todas las operaciones visibles enumeradas muestran la pantalla hasta resolver; estados de error/cancelación y solapamiento la retiran correctamente.
- **AC-002:** la pantalla bloquea puntero/teclado, aparece sobre la edición modal y conserva/restaura foco sin bloqueos residuales; móvil y movimiento reducido utilizables.
- **AC-003:** borrado autenticado, atómico, con versión e idempotencia; dependencias e indicadores respetan la política de borrado aprobada. Reintentos no borran otros clientes ni duplican efectos.
- **AC-004:** HoldButton exige 2 segundos continuos, cancelación temprana no llama al servidor y éxito sólo se anuncia tras confirmación. Errores/conflictos/reintentos y navegación posterior son recuperables.
- **AC-005:** RubberSegment cambia únicamente la presentación, conserva datos y URL/historial sin nueva consulta, con selección accesible y foco tras cerrar el modal.
- **AC-006:** alta, edición, movimientos, autenticación, filtros, métricas y notificaciones existentes conservan su comportamiento fuera de la política explícita de borrado.

## Riesgos y decisiones pendientes

La base actual usa ON DELETE RESTRICT en transiciones, hitos y eventos. El borrado lógico preserva esas relaciones; exige migración, exclusión en lecturas operativas y protección de mutaciones concurrentes. Verificar en base local aislada sin datos reales. La migración remota requiere autoridad separada.

Pencil conectado y documento crm-nexovate.pen observado el 2026-10-09. Usuario autoriza implementar el diseño textual y los componentes oficiales: «Ya conecte pencil y te autorizo implementar el diseño». Designer verificará convenciones y documentará estados nativos sin generar imágenes; esta autorización permite implementar el diseño descrito sin un nuevo checkpoint rutinario.

Decisión del usuario 2026-10-09: «Perfecto, apruebo el plan en modo continuous. El borrado no debe eliminar el historial y dejar de contar al cliente en metricas. Ya conecte pencil y te autorizo implementar el diseño». SPEC-2 incorpora esa corrección explícita: historial y métricas preservados. No hay decisiones de producto pendientes.
