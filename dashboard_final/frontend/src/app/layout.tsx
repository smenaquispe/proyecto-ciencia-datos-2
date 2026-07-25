import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StatsBomb — Análisis de Jugadores",
  description: "Dashboard de análisis histórico de jugadores con proyecciones y clustering",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
