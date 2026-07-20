"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useApp } from "../../context/AppContext";

const SettingsPage = dynamic(() => import("../../components/SettingsPage"), { ssr: false });

export default function SettingsPageRoute() {
  const context = useApp();

  return (
    <SettingsPage 
      settings={context.settings}
      onUpdateSettings={context.handleUpdateSettings}
      onResetDatabase={context.handleResetDatabase}
      products={context.products}
      staff={context.staff}           // ← ADDED: pass staff array from context
      operatorRole={context.operatorRole}
      currentUser={context.currentUser}  // ← ADDED: pass current user for DB queries
    />
  );
}
