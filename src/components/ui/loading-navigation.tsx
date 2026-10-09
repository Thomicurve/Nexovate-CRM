"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ComponentProps, type FormEvent } from "react";
import { usePendingLoading } from "./global-loading";

function destination(href: ComponentProps<typeof Link>["href"]) {
  if (typeof href === "string") return href;
  const params = new URLSearchParams();
  if (typeof href.query === "string") return `${href.pathname ?? ""}?${href.query}${href.hash ?? ""}`;
  Object.entries(href.query ?? {}).forEach(([key, value]) => {
    (Array.isArray(value) ? value : [value]).forEach((entry) => { if (entry != null) params.append(key, String(entry)); });
  });
  const search = href.search ?? (params.size ? `?${params}` : "");
  const hash = href.hash ? href.hash.startsWith("#") ? href.hash : `#${href.hash}` : "";
  return `${href.pathname ?? ""}${search}${hash}`;
}

export function LoadingLink(props: ComponentProps<typeof Link>) {
  const router = useRouter(), [pending, transition] = useTransition();
  usePendingLoading(pending);
  return <Link {...props} onNavigate={(event) => {
    let cancelled = false;
    props.onNavigate?.({ preventDefault: () => { cancelled = true; } });
    if (cancelled) { event.preventDefault(); return; }
    event.preventDefault();
    const path = destination(props.as ?? props.href);
    transition(() => props.replace ? router.replace(path, { scroll: props.scroll }) : router.push(path, { scroll: props.scroll }));
  }} />;
}
export function useLoadingFormNavigation() {
  const router = useRouter(), [pending, transition] = useTransition();
  usePendingLoading(pending);
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    const params = new URLSearchParams(); data.forEach((value, key) => { if (typeof value === "string") params.append(key, value); });
    transition(() => router.push(`${new URL(form.action).pathname}?${params}`));
  };
}
