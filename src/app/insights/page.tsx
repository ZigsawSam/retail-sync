"use client";

import React from "react";
import { useApp } from "../../context/AppContext";
import InsightsPage from "../../components/InsightsPage";

export default function InsightsPageRoute() {
  const context = useApp();

  return (
    <InsightsPage 
      customers={context.customers}
      products={context.products}
      sales={context.sales}
      currency={context.currency}
      onAddCustomer={context.handleAddCustomer}
    />
  );
}
