# Interacción fluida de clientes y dashboard

> Organizar el tablero y editar clientes sin abandonar el contexto de trabajo.

**Feature:** crm-interaction · **Definición:** SPEC-1 (aprobada con PLAN-1 el 2026-10-08)
**Plan:** [task.md](task.md)

## Objetivo y alcance

El usuario solicita ordenar las columnas del kanban a gusto, simplificar sus tarjetas, usar modales para alta y edición, evitar consultas al alternar las vistas y actualizar Clientes y Dashboard manualmente.

La mejora conserva los campos, filtros, paginación, seis estados, métricas históricas, validaciones, notificaciones y contratos de guardado existentes. El orden de columnas es una preferencia del navegador; no modifica estados del dominio ni requiere migraciones. No incorpora actualización automática en tiempo real.

## Comportamiento

Kanban y Tabla comparten la misma página de clientes cargada. Alternar sólo cambia su presentación, preserva filtros y página, y mantiene una URL coherente con la vista para recargar o volver con el navegador. Aplicar filtros o cambiar de página sí consulta el conjunto correspondiente.

Clientes y Dashboard ofrecen **Actualizar**, con progreso y protección contra solicitudes repetidas. Clientes conserva filtros, página y vista; Dashboard conserva rango y agrupación. Los guardados y movimientos siguen conciliando su resultado confirmado con los datos mostrados, sin que el usuario deba actualizar para ver su propia operación.

**Nuevo cliente**, **Editar** en tabla y el clic sobre una tarjeta abren el mismo formulario en un modal sobre el contexto actual. El modal de edición muestra los datos completos del cliente y permite modificarlos directamente. No se agrega un paso intermedio de detalle de sólo lectura. Los enlaces existentes de alta/edición continúan funcionando y presentan el formulario modal. Al guardar correctamente, se cierra y se conserva el contexto; errores y conflictos se resuelven dentro del modal.

La tarjeta kanban deja de mostrar **Editar** y **Cambiar estado**. Un clic o activación por teclado abre la edición; un arrastre cambia el estado. Terminar o cancelar un arrastre nunca abre el modal. Un control de arrastre discreto y accesible permite conservar movimientos por teclado sin confundirlos con abrir la tarjeta.

Las columnas se reordenan desde su encabezado; habrá una alternativa accesible por teclado y en móvil. El orden se guarda en localStorage y se reutiliza tras recargar. Esta preferencia no contiene datos de clientes. La selección de columna visible en móvil y los desplazamientos por teclado siguen el orden personalizado.

## Casos relevantes

- localStorage ausente, bloqueado o corrupto: usar el orden inicial y permitir trabajar; filtrar valores desconocidos y completar estados faltantes sin duplicados.
- Movimientos pendientes o con resultado incierto: conservar UUID, datos originales, reintento y conciliación; bloquear operaciones incompatibles para evitar perder la intención en curso.
- Modal: foco inicial, recorrido de foco contenido, retorno al disparador, nombre accesible, Escape/cierre/Cancelar y bloqueo del fondo. Un guardado pendiente o incierto conserva los datos y su reintento.
- Modal en móvil: una columna de campos y desplazamiento interno sin desbordamiento. Mantener controles de cierre y guardado utilizables.
- Apertura y cierre: transición breve de opacidad y pequeña escala, aproximadamente 200 ms, sin rebotes; respetar movimiento reducido.
- Un refresh fallido muestra un error recuperable; no inventa una lista vacía ni métricas cero.

## Criterios de aceptación

- **AC-001 — Vistas sin consulta:** cambiar Kanban/Tabla conserva filas, filtros y página y no dispara otra consulta de clientes. URL, recarga y Atrás/Adelante reflejan la vista correcta.
- **AC-002 — Actualización manual:** Actualizar en Clientes y Dashboard recupera datos actuales conservando sus filtros; presenta progreso y evita duplicados, con error recuperable.
- **AC-003 — Formulario modal:** alta y edición desde los puntos existentes usan un modal y conservan campos, validación, errores, conflictos y reintentos. El éxito cierra el modal, notifica y actualiza el contexto.
- **AC-004 — Accesibilidad y movimiento:** el modal cumple foco, teclado, retorno, fondo bloqueado, móvil y movimiento reducido, con una transición profesional y breve.
- **AC-005 — Tarjeta directa:** clic/teclado sobre tarjeta abre sus datos editables; no existen los botones Editar y Cambiar estado en la tarjeta. Arrastre/cancelación no abren edición.
- **AC-006 — Orden persistente:** reordenar columnas conserva exactamente los seis estados, persiste en el navegador y resiste almacenamiento inválido o inaccesible. El selector móvil y navegación de arrastre respetan ese orden.
- **AC-007 — Conservación funcional:** movimientos, guardados, conflictos, notificaciones, filtros y paginación siguen funcionando; no se alteran SQL, autenticación, métricas históricas ni datos existentes para probar.

## Enfoque propuesto

Separar presentación de consulta en ClientList, aprovechando que las filas actuales ya contienen todos los campos del formulario. La selección de vista y apertura local del modal reutilizan esas filas. Adaptar ClientForm con callbacks de cierre/éxito y conservar sus acciones de servidor y protección de concurrencia. Actualizar sólo en refresh explícito, filtros/paginación o conciliación necesaria tras mutaciones.

Reutilizar @dnd-kit/core para los gestos y mantener separados los identificadores y destinos de columnas y clientes. Extraer normalización/persistencia del orden a una utilidad pequeña comprobable. No se prevé agregar dependencias; cualquier necesidad material cambia el plan antes de instalar.

**Superficies principales:** src/components/clients, src/components/dashboard, src/app/(crm)/clientes y tests/clients, tests/metrics, tests/e2e. Diseño con paleta azul oscura e IBM Plex Sans existentes en crm-nexovate.pen. La propuesta nativa requiere revisión del usuario y verificación de sus nodos antes de implementar UI material.

**Riesgos:** doble gesto clic/drag, remount al cambiar URL, datos obsoletos después de guardar y pérdida de una intención pendiente. Las pruebas observarán estos comportamientos, no sólo clases o estructura. Reversión por commits locales de unidades coherentes; la preferencia de orden puede ignorarse sin afectar datos.
