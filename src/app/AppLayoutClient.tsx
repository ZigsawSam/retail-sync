"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { AppProvider } from "../context/AppContext";

const AppLayout = dynamic(() => import("./AppLayout"), { ssr: false });

interface AppLayoutClientProps {
  children: React.ReactNode;
}

export default function AppLayoutClient({ children }: AppLayoutClientProps) {
  useEffect(() => {
    // Unregister any lingering legacy service workers from previous SPA frameworks
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
          console.log("Unregistered legacy service worker:", registration.active?.scriptURL);
        }
      });
    }
  }, []);

  return (
    <AppProvider>
      <AppLayout>{children}</AppLayout>
    </AppProvider>
  );
}
