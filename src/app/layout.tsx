import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Observations",
  description: "Observations system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar">
      <body style={{ margin: 0, fontFamily: "system-ui" }}>{children}</body>
    </html>
  );
}
