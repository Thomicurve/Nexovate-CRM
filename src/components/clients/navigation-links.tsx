"use client";
import { LoadingLink as Link } from "@/components/ui/loading-navigation";
import { usePathname } from "next/navigation";
export function NavigationLinks() {
  const path = usePathname();
  return <>{[["/dashboard", "Dashboard"], ["/clientes", "Clientes"]].map(([href, label]) => {
    const active = path === href || path.startsWith(`${href}/`);
    return <Link key={href} href={href} className={`nav-row${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>{label}</Link>;
  })}</>;
}
