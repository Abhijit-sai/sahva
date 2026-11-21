import Link from "next/link";
import type { Metadata } from "next";
import "./style.css";
export const metadata: Metadata = {
  title: "Sahva · Conversation rooms",
  description: "A voice meeting with live interpretation in each listener’s language.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link className="brand" href="/">
            Sahva<span aria-hidden="true">◖◗</span>
          </Link>
          <span>Conversations without barriers</span>
        </header>
        {children}
      </body>
    </html>
  );
}
