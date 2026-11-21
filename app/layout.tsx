import Link from "next/link";
import type { Metadata } from "next";
import "./style.css";
export const metadata: Metadata = {
  title: "Sahva · Conversation rooms",
  description: "A shared voice room for Telugu and English conversations.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link className="brand" href="/">
            Sahva<span aria-hidden="true">◖◗</span>
          </Link>
          <span>తెలుగు / English</span>
        </header>
        {children}
      </body>
    </html>
  );
}
