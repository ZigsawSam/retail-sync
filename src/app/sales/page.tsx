"use client";

import React from "react";
import { useApp } from "../../context/AppContext";
import SalesPage from "../../components/SalesPage";

export default function SalesPageRoute() {
  const context = useApp();

  return (
    <SalesPage 
      products={context.products}
      customers={context.customers}
      sales={context.sales}
      shopName={context.settings.shopName}
      taxRate={context.settings.taxRate}
      currency={context.currency}
      onAddSale={context.handleAddSale}
      onAddProduct={context.handleAddProduct}
      onAddCustomer={context.handleAddCustomer}
      showInvoiceForm={context.showInvoiceForm}
      setShowInvoiceForm={context.setShowInvoiceForm}
      quickAddProductIds={context.settings.quickAddProductIds}
    />
  );
}
