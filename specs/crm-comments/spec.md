# Comentarios por cliente

> Conservar lo sucedido con cada cliente mediante comentarios con autor y fecha, y un archivo consultable.

**Feature:** crm-comments · **Revisión:** SPEC-1
**Plan y tareas:** [task.md](task.md)

## Necesidad

Las notas actuales son un único texto editable. No registran quién escribió cada observación ni cuándo. El usuario solicita reemplazarlas por comentarios que documenten la relación con el cliente y puedan archivarse sin eliminarse.

## Alcance

- Historial de comentarios dentro de la ficha de un cliente existente, con texto, socio autor y fecha/hora de creación.
- Crear comentarios, archivar y consultar archivados. No hay edición, eliminación ni restauración en esta entrega.
- Sólo el autor puede archivar un comentario nuevo. La autorización debe aplicarse en la base, además de la interfaz.
- Migrar cada nota existente no vacía a una única entrada «Nota anterior», conservando su texto sin inventar autor ni fecha original. Excepción confirmada: cualquiera de los dos socios puede archivar estas entradas sin autor.
- Comentario inicial opcional al crear cliente, guardado atómicamente con el alta; retirar Notas del formulario de edición.
- Mantener autenticación de los dos socios, filtros, tablero, borradores, control de concurrencia, borrado lógico e indicadores actuales.

## Comportamiento esperado

Al abrir la ficha se muestran los comentarios activos, del más reciente al más antiguo, con desempate estable. El texto conserva saltos de línea. Un compositor con etiqueta visible permite agregar un comentario de hasta 5000 caracteres; no acepta contenido vacío. La fecha/hora corresponde a Buenos Aires. La identidad y el momento provienen de la sesión y del servidor, nunca de valores elegidos por el formulario.

El autor dispone de un botón con ícono de archivo, sin texto visible «Archivar», según ajuste explícito aprobado por el usuario. Conserva objetivo de 44×44 px, nombre accesible «Archivar comentario» y tooltip en hover/foco; el ícono es decorativo para lectores de pantalla. Los comentarios ajenos se pueden leer, sin ese control. En el caso especial de una «Nota anterior», ambos socios disponen del control. Archivar quita la entrada del historial activo y conserva el texto, autor y fecha originales, además de quién archivó y cuándo. «Ver archivados» abre una vista diferenciada dentro de la ficha y «Volver a comentarios» regresa al historial activo, con sus etiquetas de texto.

Las entradas históricas indican que no se registraron autor y fecha originales. Su importación tiene metadatos propios, que no se presentan como fecha de creación del comentario. No se infiere el autor a partir de transiciones, última edición o quien ejecute la migración. Las notas de clientes borrados lógicamente también se conservan sin volver a hacer visibles esos clientes.

### Errores y límites

- Al fallar una lectura se conserva el contexto y se ofrece reintento. Las listas activas y archivadas tienen carga, vacío y error diferenciados; nunca se presenta un error como lista vacía.
- Las mutaciones usan una intención idempotente. Doble envío, respuesta perdida y reintento no duplican comentarios ni cambian la fecha/actor del archivo. Un reintento incierto conserva la misma intención y contenido; no permite modificar el borrador y reenviarlo con esa clave.
- Las lecturas paginan sin cortar silenciosamente el historial. Se invalida o reconcilia el resultado tras crear/archivar; respuestas antiguas no sustituyen el cliente o pestaña actual.
- Comentar y archivar no alteran etapas, hitos ni versión de edición de datos del cliente. Cliente ausente o borrado impide nuevas mutaciones; concurrentemente con borrado se serializa el resultado, sin pérdida física del historial.
- Cerrar o navegar con texto sin enviar requiere la protección de borrador; mientras hay resultado incierto, no se presenta el envío como descartado o confirmado.

## Criterios de aceptación

- **AC-001 — Alta atribuida:** un socio autorizado crea comentarios no vacíos de hasta 5000 caracteres. Persisten con su identidad y hora del servidor; ambos socios los pueden leer tras reabrir. Identidad/fecha manipuladas desde el cliente no se aceptan.
- **AC-002 — Historial legible:** ficha con texto, autor identificable, fecha/hora Buenos Aires y orden estable, paginación accesible, saltos de línea y protección ante contenido largo. Carga/error/vacío son explícitos.
- **AC-003 — Archivo autorizado:** sólo el autor archiva comentarios nuevos; cualquiera de los dos socios archiva «Nota anterior». Intentos directos de un socio distinto, anónimo o no miembro se rechazan según la regla, incluso sin interfaz. El archivo conserva los datos y no ofrece eliminación.
- **AC-004 — Consulta de archivados:** «Ver archivados» permite leer entradas archivadas del cliente, incluido quién y cuándo archivó; conserva autor y fecha originales cuando existen. Regreso al historial activo y vacíos accesibles. No hay edición ni eliminación ni restauración.
- **AC-005 — Migración sin invenciones:** cada nota no vacía se conserva exactamente una vez como legado; ninguna nota se pierde, duplica ni atribuye falsamente. Sólo se conoce la fecha de importación. No se descartan datos de clientes borrados. La app deja de utilizar Notas y la base evita seguir mutando el texto antiguo.
- **AC-006 — Alta y edición de cliente:** campo opcional «Comentario inicial» en alta con persistencia atómica e idempotente. Un error revierte ambos registros y un reintento no duplica cliente/comentario. Edición ya no sobrescribe notas ni comentarios. Continúan guardas de borrador/conflicto/fechas y retorno.
- **AC-007 — Integridad y acceso:** sólo socios autenticados acceden al historial. No hay operaciones de edición/borrado físico accesibles para comentarios mediante API ordinaria. Claves foráneas y políticas preservan identidad/historial; indicadores y transiciones no cambian por comentar/archivar. Concurrencia, idempotencia, cliente borrado y respuesta incierta tienen pruebas independientes.
- **AC-008 — Interacción accesible:** controles de al menos 44 px, foco visible, recorrido completo por teclado que incluya compositor, navegación entre listas, recuperación del foco y protección del borrador. Sin desborde global en 390/640/768/1024/1440 px; reduced-motion y estilo actual conservados.

## Enfoque aprobado

Continuar con Next.js, React, CSS Modules y Supabase. Incorporar una tabla de comentarios separada del registro de cliente, con referencia a identidad de socio, texto, metadatos de creación/importación y archivo. Proteger lectura con las políticas existentes de membresía y canalizar escrituras por funciones restringidas y transaccionales con idempotencia. El texto y los metadatos originales son inmutables después de crear/importar.

Identificación visible aprobada: correo de la cuenta del socio, obtenido por el servidor y expuesto únicamente a miembros mediante consulta restringida. El repositorio no contiene nombres de socios ni una tabla de perfiles; no se inventará una correspondencia de nombres. El UUID sigue siendo la identidad de autorización y el correo es presentación. No se abre acceso general a usuarios de Auth.

Preparar una migración incremental, sin modificar migraciones históricas ni eliminar la columna antigua como paso destructivo. Migrar las notas y bloquear sus escrituras futuras; mantener compatibilidad necesaria de las respuestas existentes. Probar con PostgreSQL local desechable y clientes ficticios; esta entrega no aplica cambios al servicio de Supabase usado por los socios.

- **Código comprobado:** `src/components/clients/{client-details,client-form,client-modal,client-list,client-kanban}.tsx`; `src/lib/clients/{model,server,mutations}.ts`; `src/app/(crm)/clientes/actions.ts`; `src/lib/auth/require-member.ts`; `supabase/migrations/202610090006_logical_client_delete.sql`.
- **Diseño:** nativo `comments-v1` con ajuste de ícono expresamente solicitado, DESIGN_APPROVED/STOPPED por Designer tras aprobación del usuario y revalidación textual. Documento vivo `crm-nexovate.pen`: activos escritorio `g1Ehuv`, archivados escritorio `fXt7h`, activos móvil `TEZ2C`, archivados móvil `E1OzDF` y estados/formularios `wG2Mm`. Alta inicial `BneLW`, edición sin Notas `vm8Ml` y legado `eBYOY`. Cinco acciones individuales usan Lucide archive20 en botones44×44, nombre accesible/tooltip «Archivar comentario»; variante foco `v0fCna`, tooltip `J7qvr5`, botón `WFGSl`. Se conserva Geist y los tokens existentes; diseños históricos `i0fY9`, `GkyQb`, `yWhWP` preservados. Designer verificó cinco candidatos sin problemas estructurales reportados y ausencia de etiquetas individuales «Archivar», sin revisión mediante imágenes ni prueba de aplicación. **Persistencia pendiente:** las herramientas no ofrecen guardar; el archivo local aún tiene 2.048.602 bytes y fecha 2026-10-12 05:16:02 UTC, por lo que estos nodos se confirman únicamente en el documento vivo. Guardar desde Pencil antes de cerrar; si ese estado se pierde, reconstruir y revalidar antes de implementar, sin fingir que está en disco.
- **Riesgo principal:** migración y permisos/idempotencia. Verificación independiente obligatoria con SQL real local y revisión después de detener al escritor.
- **Reversión:** preservar el texto antiguo y no borrar comentarios. Antes de aplicar remotamente, coordinar versión de base y aplicación; una reversión de interfaz no debe reactivar el editor de notas ni prometer que retira una migración aplicada. La aplicación remota tiene autoridad aparte.

## Decisiones confirmadas y pendientes

El usuario confirmó «Sí, conservar como Nota anterior» y «Sin edición; solo el autor archiva» en las respuestas a `call_8b62993243ea40a4907c46343a664a6e`. Confirmó «Cualquiera de los dos socios» para archivar legado sin autor en `call_2c49c41d6e4c4294a3fb7011c66ded9f`.

Usuario aprobó SPEC-1/PLAN-1 y candidato con un ajuste expreso: usar un ícono en el control individual de archivo, respuesta a `call_863e35921c8947bebb81dacfc2ef3909`. Eligió CONTINUOUS en `call_170a48b1e409416886debb5dd78bcbbc`. Designer actualizó/revalidó ese ajuste y devolvió DESIGN_APPROVED/STOPPED; permisos y alcance no cambian. Autoridad de ejecución y entrega local en task.md.
