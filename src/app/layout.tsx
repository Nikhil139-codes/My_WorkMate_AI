import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorkMate AI — From Information to Action",
  description:
    "Intelligent enterprise productivity platform Powered by Gemini. Unify workspace knowledge, tasks, and workflows.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#FAFBFC] text-[#172B4D] antialiased flex flex-col">
        {children}
      </body>
    </html>
  );
}
