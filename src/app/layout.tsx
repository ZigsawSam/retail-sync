import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import AppLayoutClient from "./AppLayoutClient";

export const metadata: Metadata = {
  title: "Retail Sync - Retail Operations Hub",
  description: "Retail operations and inventory sync application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <AppLayoutClient>
          {children}
        </AppLayoutClient>
      </body>
    </html>
  );
}
