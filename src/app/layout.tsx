import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexovate CRM",
  description: "CRM interno de Nexovate",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body>{children}</body>
    </html>
  );
}
