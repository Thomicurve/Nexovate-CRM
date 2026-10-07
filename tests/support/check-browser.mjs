import { chromium } from "@playwright/test";

let browser;
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
  console.log(`Navegador disponible: Chromium ${browser.version()}`);
  if (process.env.SMOKE_URL) {
    const page = await browser.newPage();
    const response = await page.goto(process.env.SMOKE_URL);
    if (response?.status() !== 200) throw new Error("HTTP smoke falló");
    await page.getByRole("heading", { name: "Nexovate CRM", exact: true }).waitFor();
    console.log("Smoke HTTP/DOM correcto; sin capturas, video ni trace.");
  }
} catch {
  console.error("Diagnóstico falló: verificar navegador local y SMOKE_URL si se usa.");
  process.exitCode = 1;
} finally {
  await browser?.close();
}
