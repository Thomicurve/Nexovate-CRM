# Nexovate CRM

Base de Next.js App Router en español. TASK-001 prepara herramientas y una página
neutra; login, clientes, datos y dashboard se implementarán en tareas posteriores.

## Instalación y ejecución

Usar Node 22.22.3 y npm 10.9.8. Las dependencias directas están fijadas en
`package.json` y las transitivas en `package-lock.json`.

```sh
npm ci
npm run dev
```

Abrir http://localhost:3000. Para producción local: `npm run build`, luego
`npm run start`. No se necesita Supabase ni leer `.env` para esta base.
`.env` y `.env.*` están ignorados, salvo `.env.example`, que sólo tiene placeholders.
Los comandos de Next pueden cargar automáticamente un `.env` local existente.

## Verificaciones y TDD

| Comando | Propósito |
| --- | --- |
| `npm run lint` | ESLint de aplicación, soporte y configuración |
| `npm run typecheck` | Generar tipos Next y comprobar TypeScript sin emisión |
| `npm run build` | Compilar la aplicación para producción |
| `npm test -- tests/<ruta>.test.ts` | Vitest enfocado, entorno jsdom y Testing Library |
| `npm run test:watch` | Vitest en modo watch para RED/GREEN/refactor |
| `npm run test:e2e -- tests/e2e/<ruta>.spec.ts` | Playwright sobre servidor local de producción |
| `npm run test:db` | Diagnóstico de prerrequisitos SQL; aún no ejecuta integración |

No hay suites de negocio en TASK-001. `npm test` y `npm run test:e2e -- --list`
deben informar ausencia de pruebas y salir con error; no se oculta con
`passWithNoTests`. TDD aplica al comportamiento futuro, no a este setup.
Vitest descubre `tests/**/*.test.ts(x)` y excluye E2E/soporte. Playwright usará
`tests/e2e/**/*.spec.ts` o `.test.ts`. No usar Vitest para Server Components
asíncronos ni como sustituto de PostgreSQL/RLS real.

Diagnóstico del navegador: `node tests/support/check-browser.mjs`. Si no hay
Chromium de Playwright, se puede usar Edge local estableciendo
`PLAYWRIGHT_CHANNEL=msedge`, o instalar Chromium localmente mediante
`npx playwright install chromium` (descarga del navegador, sin instalación global).
Con un servidor iniciado, `SMOKE_URL=http://127.0.0.1:3000` añade un chequeo HTTP/DOM.
Playwright desactiva screenshots, video y trace; no crear snapshots visuales.
Ejecutar `npm run build` antes de E2E: el runner inicia `npm run start`.

`test:db` siempre sale con error hasta TASK-003: falta implementar el runner real,
migraciones y fixtures sintéticos. Requerirá `psql` y `TEST_DATABASE_URL` de una
base aislada verificada. No carga `.env`, conecta ni modifica bases. La existencia
de una variable no prueba aislamiento ni conectividad. TASK-003 reemplazará este
diagnóstico con ejecución SQL real antes de implementar comportamiento de datos.

## Convenciones

Código en `src/`; alias `@/` → `src/`. Tailwind 4 usa PostCSS y configuración CSS.
`components.json` y `src/lib/utils.ts` preparan shadcn/ui; no hay componentes
funcionales añadidos ni diseño aprobado. Los tokens se completarán con TASK-002.
Next tiene `agentRules: false` para preservar las instrucciones locales de agentes.

Referencias oficiales: [Next/Vitest](https://nextjs.org/docs/app/guides/testing/vitest),
[ESLint](https://nextjs.org/docs/app/api-reference/config/eslint),
[shadcn](https://ui.shadcn.com/docs/components-json) y
[Playwright](https://playwright.dev/docs/test-configuration).
