"use client";

import React from "react";
import { useApp } from "../../context/AppContext";
import AIAssistant from "../../components/AIAssistant";

export default function AIPageRoute() {
  const context = useApp();

  return (
    <AIAssistant 
      products={context.products}
      customers={context.customers}
      sales={context.sales}
      shopName={context.settings.shopName}
    />
  );
}
