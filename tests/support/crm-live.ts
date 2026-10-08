import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { parseEnv } from "node:util";
import { expect, type Locator, type Page } from "@playwright/test";

export async function crmLiveAccounts() {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "CRM_LIVE_PROJECT_REF",
    "CRM_OWNER_EMAIL", "CRM_PARTNER_EMAIL", "CRM_OWNER_PASSWORD", "CRM_PARTNER_PASSWORD"];
  const selected: string[] = [];
  for await (const line of createInterface({ input: createReadStream(".env"), crlfDelay: Infinity })) {
    if (names.includes(/^\s*(?:export\s+)?([A-Z_]+)\s*=/.exec(line)?.[1] ?? "")) selected.push(line);
  }
  const values = parseEnv(selected.join("\n"));
  for (const name of names) if (process.env[name] !== undefined) values[name] = process.env[name]!;
  for (const name of names) expect(Boolean(values[name]), `Falta ${name}`).toBe(true);
  const url = new URL(values.NEXT_PUBLIC_SUPABASE_URL!);
  expect(url.protocol === "https:" && /^[a-z0-9]{20}$/.test(values.CRM_LIVE_PROJECT_REF!) &&
    url.hostname === `${values.CRM_LIVE_PROJECT_REF}.supabase.co`).toBe(true);
  expect(values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.startsWith("sb_publishable_")).toBe(true);
  return ["OWNER", "PARTNER"].map((role) => ({ email: values[`CRM_${role}_EMAIL`]!, password: values[`CRM_${role}_PASSWORD`]! }));
}

// Reach the control through the browser's actual tab order, never locator.focus().
export async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let step = 0; step < 80; step++) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      await expect(target).toBeFocused();
      expect(await target.evaluate((element) => {
        const style = getComputedStyle(element);
        return element.matches(":focus-visible") && style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
      }), "El control alcanzado con Tab tiene foco visible").toBe(true);
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("Control no alcanzable mediante Tab");
}
