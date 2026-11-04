"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import OperationsPage from "../../components/OperationsPage";
import AccountsPage from "../../components/AccountsPage";
import { useSearchParams } from "next/navigation";

type OperationsTab = "inventory" | "purchases";

export default function OperationsPageRoute() {
  const context = useApp();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<OperationsTab>("inventory");
  const canManagePurchases = context.currentRole === "admin";

  useEffect(() => {
    if (searchParams.get("tab") === "purchases" && canManagePurchases) setActiveTab("purchases");
  }, [searchParams, canManagePurchases]);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#FAF8F5]">
      <div className="shrink-0 px-5 md:px-8 pt-5 border-b-2 border-black bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div><h1 className="text-2xl font-black uppercase">Inventory & Purchases</h1><p className="text-xs font-bold text-zinc-600 mt-1">Manage product catalogue, stock intake and supplier invoices.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setActiveTab("inventory")} className={`px-4 py-2 border-2 border-black text-xs font-black uppercase ${activeTab === "inventory" ? "bg-[#FFC300] shadow-[2px_2px_0_#000]" : "bg-white"}`}>Inventory</button>
            {canManagePurchases && <button type="button" onClick={() => setActiveTab("purchases")} className={`px-4 py-2 border-2 border-black text-xs font-black uppercase ${activeTab === "purchases" ? "bg-[#FFC300] shadow-[2px_2px_0_#000]" : "bg-white"}`}>Purchases</button>}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "inventory" ? <OperationsPage
          products={context.products} expenses={context.expenses} currency={context.currency}
          productCategories={context.settings.productCategories || []}
          onAddProduct={context.handleAddProduct} onUpdateProductStock={context.handleUpdateProductStock}
          onDeleteProduct={context.handleDeleteProduct} onAddExpense={context.handleAddExpense}
        /> : canManagePurchases ? <AccountsPage /> : null}
      </div>
    </div>
  );
}
