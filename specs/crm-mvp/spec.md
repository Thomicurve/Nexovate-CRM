# CRM interno de Nexovate

> Seguimiento compartido de potenciales clientes para los dos socios de una empresa de software.

**Feature:** crm-mvp · **Definición:** SPEC-1 (aprobada junto a PLAN-1 el 2026-10-07)
**Plan y tareas:** [task.md](task.md)

## Objetivo

Centralizar los contactos, su evolución comercial y los resultados históricos en una aplicación privada. El MVP tendrá login, dashboard y panel de clientes, construido con Next.js y PostgreSQL en Supabase, preparado para un futuro despliegue en Vercel.

## Alcance

- Dos usuarios únicos, email y contraseña, con acceso a la misma cartera y las mismas operaciones.
- Crear y editar clientes; creación en estado Contactado.
- Panel kanban con drag and drop y alternativa en tabla.
- Filtros combinables por nombre, estado y fecha.
- Dashboard con Contactados, Reuniones agendadas y Cerrados; totales y evolución por día, mes y año.
- Interfaz en español, siempre en dark mode, con tonos oscuros y azules oscuros.

Quedan fuera de este MVP: registro público, gestión de nuevos usuarios desde la app, eliminación de clientes, importaciones, integración con correo o calendarios, automatizaciones comerciales, facturación y métricas adicionales. No se agrega actualización en tiempo real: cada consulta recupera datos actuales y cada escritura detecta conflictos.

## Decisiones confirmadas por el usuario

- Stack: Next.js y PostgreSQL en Supabase; Vercel como destino futuro. shadcn/ui está permitido y la librería de gráficos queda a criterio técnico.
- TDD para el comportamiento y ejecución tarea por tarea, con aprobación antes de avanzar.
- Cada cliente cuenta una sola vez por etapa en las métricas históricas, en la fecha en que la alcanzó por primera vez.
- Datos: nombre obligatorio; empresa, email, teléfono, notas y fecha de reunión opcionales; fecha de contacto registrada al crear y editable. Se agrega Rubro.

Las convenciones y detalles técnicos que siguen fueron incluidos en SPEC-1 y PLAN-1 aprobados al iniciar TASK-001. El diseño detallado conserva su revisión y aprobación propias en TASK-002.

## Comportamiento

### Login y acceso compartido

Las dos cuentas se provisionan en Supabase Auth. La aplicación no permite registrarse. Ambas identidades autorizadas pueden ver y modificar la cartera completa; cualquier otra identidad y las peticiones sin sesión quedan bloqueadas tanto en el servidor como en la base de datos.

El formulario contiene email y contraseña, muestra progreso y un mensaje claro si falla. Una sesión válida lleva al dashboard; las rutas privadas exigen sesión y membresía autorizada. Cerrar sesión vuelve al login.

### Datos y estados de clientes

Rubro se propone como texto libre opcional. Email vacío es válido; si se informa debe tener formato válido. El nombre no admite contenido vacío o sólo espacios. La fecha de contacto representa cuándo ocurrió el contacto, con valor inicial del momento de creación y posibilidad de corregirla.

Los únicos estados son **Contactado**, **Reunión agendada**, **Cerrado**, **Sin respuesta**, **Respuesta negativa** e **Interesado**. Se permiten cambios entre estos estados sin imponer un embudo rígido. La fecha de reunión es opcional y describe la cita, no el momento en que se cambió el estado.

Cada alta o cambio de estado se guarda con su historial en una misma transacción. Repetir una solicitud o guardar nuevamente el mismo estado no duplica hitos. Si ambos socios editan simultáneamente, una versión obsoleta no sobrescribe silenciosamente a la nueva: se informa el conflicto y se recupera el dato actual.

### Panel de clientes

Kanban es la vista inicial. Tiene una columna por estado, tarjetas legibles y acciones para crear y editar clientes. Arrastrar una tarjeta cambia su estado y persiste el resultado; también se puede cambiar el estado desde el formulario, con teclado o interacción simple.

La vista tabla muestra los mismos clientes y permite las mismas operaciones. Los filtros activos se conservan al alternar vistas. Se propone filtrar por fecha de contacto, con límites inclusivos para el usuario; nombre por coincidencia parcial sin distinguir mayúsculas, y uno o más estados. Se puede limpiar el conjunto de filtros.

Una escritura fallida no deja un cambio aparente guardado: la UI conserva o recupera el estado confirmado e indica el error. Se distinguen carga, cartera vacía y ausencia de resultados por filtros.

### Dashboard e historial

Se muestran tres métricas: clientes contactados, clientes que alcanzaron Reunión agendada y clientes que alcanzaron Cerrado. Cada cliente aporta como máximo un hito a cada métrica. Volver a una etapa ya alcanzada no incrementa su total; salir de ella no elimina su aporte.

Para Contactado se propone usar la fecha de contacto indicada. Una corrección de esa fecha mueve ese único hito al período correcto y deja registro de la corrección, conservando el momento de creación y las transiciones originales. Los otros dos hitos usan la fecha de primera transición registrada por el servidor. Cambiar la fecha de la cita no mueve el hito Reunión agendada. Pasar directamente de Contactado a Cerrado no inventa una reunión.

Cada métrica muestra total histórico, total del rango seleccionado y una serie agrupable por día, mes o año. Los intervalos sin actividad muestran cero. Se propone la zona **America/Argentina/Buenos_Aires** para agrupación y filtros; instantes almacenados en UTC y presentación local. El rango se traduce a inicio inclusivo y siguiente límite exclusivo para evitar errores de fin de día.

## Criterios de aceptación

- **AC-001 — Base verificable:** instalación local reproducible, scripts de desarrollo, pruebas, tipos, lint y build documentados y ejecutados con resultado observado.
- **AC-002 — Diseño:** login, dashboard, kanban, tabla y formulario definidos en el archivo Pencil existente, con estados de carga/error/vacío, comportamiento responsive y aprobación explícita del diseño antes de UI material.
- **AC-003 — Acceso restringido:** únicamente las dos identidades autorizadas acceden a datos compartidos; denegación demostrada para anónimo y un tercer usuario, incluso mediante acceso directo a la base/API.
- **AC-004 — Login:** ingreso válido, error de credenciales, protección de rutas y operaciones, renovación de sesión y cierre de sesión comprobados.
- **AC-005 — Clientes:** alta persistente en Contactado y edición de los campos acordados, incluido Rubro, con validación de nombre/email/fechas.
- **AC-006 — Transiciones:** los seis estados persisten con historial atómico; solicitudes repetidas no duplican hitos y los conflictos no producen sobrescritura silenciosa.
- **AC-007 — Tabla y filtros:** tabla y kanban comparten filtros combinados por nombre, estado y fecha de contacto, incluyendo límites de fechas, limpieza y resultados vacíos.
- **AC-008 — Kanban:** drag and drop persiste cambios entre columnas, con alternativa accesible y recuperación verificable ante error o conflicto.
- **AC-009 — Métricas históricas:** primera etapa alcanzada por cliente, sin duplicados al regresar ni pérdida al salir; corrección de fecha de contacto y distinción de fecha de reunión cubiertas por pruebas.
- **AC-010 — Períodos:** totales y series por día/mes/año correctos para rango, zona horaria, intervalos vacíos y límites de mes/año.
- **AC-011 — Uso y estética:** dark mode oscuro/azul profesional, etiquetas en español, foco visible, formularios y navegación utilizables con teclado, diseño usable en escritorio y móvil.
- **AC-012 — Integración y entrega:** flujo real de login → alta → edición → cambio de estado → filtros → dashboard → logout comprobado; configuración e instrucciones para Vercel preparadas sin afirmar un despliegue no realizado.

## Enfoque propuesto

- Next.js App Router, TypeScript y Tailwind; shadcn/ui para componentes. Versiones concretas se verifican al instalar y se fijan con lockfile.
- Supabase Auth con sesiones SSR; clientes Supabase separados para navegador/servidor y verificaciones de autorización en cada operación.
- Tablas para clientes, miembros autorizados, transiciones y primeros hitos. RLS con membresía explícita; los dos miembros comparten acceso. El cliente no puede concederse membresía ni modificar libremente el historial.
- Mutaciones transaccionales en PostgreSQL con control de versión e idempotencia. No agregar ORM ni infraestructura adicional sin necesidad demostrada.
- Recharts mediante los componentes de gráficos de shadcn/ui; dnd-kit para las interacciones del kanban, confirmando la API/versiones compatibles antes de implementar.
- Vitest y Testing Library para reglas/componentes; Playwright para comportamiento real. Pruebas SQL de integración para RLS/transacciones; entorno de base de pruebas todavía por verificar. Sin capturas, imágenes, videos ni trazas que generen imágenes.
- RED observado antes de implementar comportamiento, luego GREEN y refactor. La preparación de herramientas y el diseño Pencil no requieren pruebas artificiales de comportamiento.

## Diseño propuesto

Trabajar en `crm-nexovate.pen`, existente y todavía no inspeccionado. Paleta candidata: fondo `#080E1B`, navegación `#0B1426`, superficie `#121F35`, separación `#243750`, acción `#477BD8` y texto `#E6EDF8`. Tipografía candidata: IBM Plex Sans, con jerarquía compacta y cifras tabulares. Contenido alineado a la izquierda; navegación lateral en escritorio y compacta en móvil.

El foco del panel es la evolución de cada contacto: nombre, empresa/rubro y fecha legibles en tarjetas y filas. Dashboard con tres métricas y series de tendencia; etiquetas de estado acompañan al color. Documento/nodos/versiones y aprobación visual se registrarán después de inspección y diseño real en TASK-002; esta descripción no equivale a un diseño aprobado.

## Riesgos y recuperación

Autenticación/RLS, migraciones, transacciones y configuración de secretos requieren comprobaciones independientes tras detener al escritor. Un mock no prueba seguridad en PostgreSQL. Un entorno SQL o navegador no disponible se informa como evidencia pendiente antes de cerrar la tarea afectada.

Los cambios de aplicación se entregan por unidades revisadas y commits locales autorizados. Migraciones se prueban en una base aislada antes de cualquier operación remota; no se resetea una base existente. Ninguna configuración, usuario, migración ni deploy remoto se modifica con la sola preparación del plan.

## Ampliación — SPEC-2 (aprobada junto a PLAN-2 y DESIGN-3)

El usuario solicitó mejorar el feedback y la interacción del panel existente tras completar el MVP. SPEC-1 y sus resultados se conservan; esta ampliación no agrega pantallas, estados comerciales, cambios de Supabase ni despliegue.

- **AC-013 — Guardado confirmado:** tras crear o actualizar exitosamente, volver al listado general de clientes conservando la vista y filtros válidos de retorno; mostrar una notificación clara de cliente creado o actualizado que sobreviva a esa navegación. Un fallo, conflicto o resultado incierto conserva el formulario y sus opciones de recuperación, sin anunciar éxito ni abandonar datos pendientes.
- **AC-014 — Arrastre desde la tarjeta:** iniciar drag con puntero desde cualquier zona no interactiva de la tarjeta; Editar y otros controles siguen funcionando sin iniciar un arrastre accidental. Conservar movimiento con teclado, cancelación, versión/conflictos y replay del intento. Adaptar touch/scroll sin bloquear el uso móvil.
- **AC-015 — Destino y feedback del movimiento:** resaltar la columna válida bajo la tarjeta con borde/fondo y señal textual, además de una tarjeta distinguible durante drag. Quitar el resaltado al salir, cancelar o terminar. Notificar cambio de estado sólo después de respuesta confirmada; errores/conflictos siguen explicando cómo recuperarse. Soltar en origen, fuera de columnas o cancelar no crea una mutación ni una notificación de éxito.
- **AC-016 — Orden del kanban:** columnas y selector móvil en orden Contactado, Interesado, Reunión agendada, Cerrado, Sin respuesta y Respuesta negativa. El orden es de presentación del kanban; se conservan los seis estados, sus colores, filtros y semántica histórica.

DESIGN-3 aprobado: extensión de la paleta oscura/azul y tipografía existentes, notificación global en la esquina superior derecha de escritorio y ajustada al ancho móvil, mensaje en español, cierre accesible y anuncio de lector de pantalla sin robar foco. Resaltado de destino azul con indicación «Soltar aquí», movimiento discreto y respeto a preferencia de movimiento reducido. Documento/nodos concretos y verificación se conservan en task.md. Usuario confirmó el candidato editable y PLAN-2/SPEC-2 mediante «Perfecto lo veo bien, podes continuar con la tarea», en respuesta al pedido conjunto de aprobación de TASK-009.

## Referencias técnicas consultadas

- [Next.js: pruebas](https://nextjs.org/docs/app/guides/testing) y [Vitest](https://nextjs.org/docs/app/guides/testing/vitest).
- [Supabase: Auth con Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs), [configuración de registro](https://supabase.com/docs/guides/auth/general-configuration) y [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [shadcn/ui: gráficos con Recharts](https://ui.shadcn.com/docs/components/base/chart).
- [dnd-kit: accesibilidad](https://dndkit.com/legacy/guides/accessibility/) y [Playwright: opciones de pruebas](https://playwright.dev/docs/api/class-testoptions).
