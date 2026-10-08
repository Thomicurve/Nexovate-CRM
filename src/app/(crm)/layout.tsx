import type { ReactNode } from "react";
import { NavigationLinks } from "@/components/clients/navigation-links";
import { requireMember } from "@/lib/auth/require-member";
import { logout } from "@/app/login/actions";

export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: ReactNode }) {
  await requireMember();
  return (
    <div className="crm-shell">
      <aside className="crm-navigation">
        <p className="brand">Nexovate</p>
        <nav aria-label="Navegación principal">
          <NavigationLinks />
          <form action={logout}><button className="nav-row" type="submit">Cerrar sesión</button></form>
        </nav>
      </aside>
      <main className="crm-content">{children}</main>
    </div>
  );
}
