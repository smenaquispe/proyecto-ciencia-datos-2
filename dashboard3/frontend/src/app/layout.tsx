import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StatsBomb Scout — Analytics",
  description: "Herramienta de análisis táctica para scouting y directores técnicos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
