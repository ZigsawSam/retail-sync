"use client";

import React, { useMemo, useState } from "react";
import { Search, ShoppingCart, Receipt, Package, Award } from "lucide-react";
import { Product, Sale, Customer, StoreSettings } from "../types";
import { isToday } from "../lib/dateUtils";

interface CashierDashboardProps {
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  settings: StoreSettings;
  setActiveTab: (tab: string) => void;
  currency: string;
}

export default function CashierDashboard({
  sales,
  products,
  customers,
  settings,
  setActiveTab,
  currency,
}: CashierDashboardProps) {
  const [custSearch, setCustSearch] = useState("");
  const todaySales = useMemo(() => sales.filter((sale) => isToday(sale.timestamp)), [sales]);
  const shiftSales = useMemo(() => todaySales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0), [todaySales]);
  const averageTicket = todaySales.length ? shiftSales / todaySales.length : 0;
  const searchedCustomer = useMemo(() => {
    const query = custSearch.trim().toLowerCase();
    if (!query) return null;
    return customers.find((customer) =>
      (customer.phone || "").toLowerCase().includes(query) ||
      customer.name.toLowerCase().includes(query)
    ) || null;
  }, [custSearch, customers]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F6] p-8 text-black select-none font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b-4 border-black pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFC300] border-2 border-black text-[10px] font-black uppercase tracking-wider mb-2 font-mono">
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Sales terminal</span>
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight">Cashier Dashboard</h2>
          <p className="text-xs text-zinc-600 font-mono mt-1 uppercase tracking-widest font-bold">Sales and customer service workspace</p>
        </div>
        <button
          onClick={() => setActiveTab("sales")}
          className="flex items-center gap-3 px-6 py-3.5 bg-[#D63031] text-white border-3 border-black rounded-none text-sm font-black tracking-wider hover:bg-[#E54849] transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          <ShoppingCart className="w-5 h-5" />
          <span>OPEN POS COUNTER</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#FFC300] p-5 border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[9px] text-zinc-700 font-black uppercase font-mono tracking-wider">SHIFT SALES</p>
          <p className="text-2xl font-black font-mono mt-2">{currency}{shiftSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-zinc-700 font-bold mt-2 font-mono uppercase">Sales recorded today</p>
        </div>
        <div className="bg-white p-5 border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[9px] text-zinc-500 font-black uppercase font-mono tracking-wider">BILLS COMPLETED</p>
          <p className="text-2xl font-black font-mono mt-2">{todaySales.length}</p>
          <p className="text-[10px] text-zinc-500 font-bold mt-2 font-mono uppercase">Today's invoices</p>
        </div>
        <div className="bg-white p-5 border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[9px] text-zinc-500 font-black uppercase font-mono tracking-wider">AVERAGE BASKET</p>
          <p className="text-2xl font-black font-mono mt-2">{currency}{averageTicket.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-zinc-500 font-bold mt-2 font-mono uppercase">Average invoice value</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white border-3 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 border-b-2 border-black pb-3 mb-4">
            <Search className="w-5 h-5" />
            <h3 className="text-sm font-black uppercase">Customer lookup</h3>
          </div>
          <input
            type="search"
            value={custSearch}
            onChange={(event) => setCustSearch(event.target.value)}
            placeholder="Search by customer name or phone"
            className="w-full px-4 py-3 bg-zinc-50 border-2 border-black text-sm font-mono focus:outline-none"
          />
          {custSearch.trim() && (
            searchedCustomer ? (
              <div className="mt-4 p-4 bg-[#FFC300]/20 border-2 border-black">
                <div className="flex items-center gap-2 font-black"><Award className="w-4 h-4" />{searchedCustomer.name}</div>
                <p className="text-xs font-mono mt-2">{searchedCustomer.phone}</p>
                <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                  <div><p className="text-zinc-500 uppercase font-bold">Points</p><p className="font-black">{searchedCustomer.points}</p></div>
                  <div><p className="text-zinc-500 uppercase font-bold">Tier</p><p className="font-black">{searchedCustomer.tier}</p></div>
                  <div><p className="text-zinc-500 uppercase font-bold">Visits value</p><p className="font-black">{currency}{Number(searchedCustomer.totalSpent || 0).toLocaleString()}</p></div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-xs text-zinc-500 font-mono">No matching customer found.</p>
            )
          )}
        </section>

        <section className="bg-white border-3 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 border-b-2 border-black pb-3 mb-4">
            <Package className="w-5 h-5" />
            <h3 className="text-sm font-black uppercase">Product availability</h3>
          </div>
          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-zinc-600">Products available in catalogue</span>
            <span className="font-black">{products.length}</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {products.slice(0, 8).map((product: Product) => (
              <div key={product.id} className="flex items-center justify-between border-b border-zinc-200 py-2 text-xs">
                <span className="font-semibold truncate pr-3">{product.name}</span>
                <span className="font-mono font-black">{product.quantity} in stock</span>
              </div>
            ))}
            {products.length === 0 && <p className="text-xs text-zinc-500">No products are available.</p>}
          </div>
          <button onClick={() => setActiveTab("sales")} className="mt-4 w-full px-4 py-2 bg-black text-white text-xs font-black uppercase">
            <Receipt className="inline w-4 h-4 mr-2" />Go to checkout
          </button>
        </section>
      </div>
    </div>
  );
}
