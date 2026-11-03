"use client";

import React from "react";
import { useApp } from "../../context/AppContext";
import Dashboard from "../../components/Dashboard";
import { useRouter } from "next/navigation";

export default function DashboardPageRoute() {
  const router = useRouter();
  const context = useApp();

  const setActiveTab = (tab: string) => {
    router.push(`/${tab}`);
  };

  const handleDashboardUpdateSale = (sale: import("../../types").Sale) => {
    const { id, ...updates } = sale;
    void context.handleUpdateSale(id, updates);
  };

  return (
    <Dashboard 
      products={context.products}
      sales={context.sales}
      expenses={context.expenses}
      staff={context.staff}
      settings={context.settings}
      setActiveTab={setActiveTab}
      onUpdateSettings={context.handleUpdateSettings}
      electronicTxs={context.electronicTxs}
      onAddElectronicTx={context.handleAddElectronicTx}
      onDeleteElectronicTx={context.handleDeleteElectronicTx}
      cheques={context.cheques}
      onAddCheque={context.handleAddCheque}
      onDeleteCheque={context.handleDeleteCheque}
      actualDrawerCash={context.actualDrawerCash}
      onUpdateActualDrawerCash={context.handleUpdateActualDrawerCash}
      onAddSale={context.handleAddSale}
      onUpdateSale={handleDashboardUpdateSale}
      customers={context.customers}
      onAddCustomer={context.handleAddCustomer}
      showInvoiceForm={context.showInvoiceForm}
      setShowInvoiceForm={context.setShowInvoiceForm}
      onAddExpense={context.handleAddExpense}
      onDeleteExpense={context.handleDeleteExpense}
      currentRole={context.currentRole}
      onAddProduct={context.handleAddProduct}
      onUpdateProductStock={context.handleUpdateProductStock}
    />
  );
}
