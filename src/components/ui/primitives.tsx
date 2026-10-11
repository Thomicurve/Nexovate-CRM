import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({ variant = "primary", className = "", type = "button", ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return <button {...props} type={type} className={`ui-button ${variant}-button ${className}`} />;
}

export function FormField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}</div>;
}
