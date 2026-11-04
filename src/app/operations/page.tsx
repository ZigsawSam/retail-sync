"use client";

import React from "react";
import { useApp } from "../../context/AppContext";
import OperationsPage from "../../components/OperationsPage";

export default function OperationsPageRoute() {
  const context = useApp();

  return (
    <OperationsPage 
      products={context.products}
      expenses={context.expenses}
      currency={context.currency}
      productCategories={context.settings.productCategories || []}
      onAddProduct={context.handleAddProduct}
      onUpdateProductStock={context.handleUpdateProductStock}
      onDeleteProduct={context.handleDeleteProduct}
      onAddExpense={context.handleAddExpense}
    />
  );
}
