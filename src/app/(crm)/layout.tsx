import type { ReactNode } from "react";
import { CrmShell } from "@/components/ui/crm-shell";
import { requireMember } from "@/lib/auth/require-member";
import { logout } from "@/app/login/actions";
import { NotificationProvider } from "@/components/ui/notifications";

export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: ReactNode }) {
  await requireMember();
  return (
    <NotificationProvider><CrmShell logout={logout}>{children}</CrmShell></NotificationProvider>
  );
}
