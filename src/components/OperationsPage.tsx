"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Search, Grid, Filter, History, X } from "lucide-react";
import { Product, Expense } from "../types";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface OperationsPageProps {
  products: Product[];
  expenses?: Expense[];
  currency: string;
  onAddProduct?: (product: Product) => void;
  onUpdateProductStock?: (productId: string, newStock: number) => void;
  onDeleteProduct: (productId: string) => void;
  onAddExpense?: (expense: Expense) => void;
  productCategories?: { name: string; subcategories: string[] }[];
}

type PurchaseHistoryRow = {
  id: string;
  supplier_name: string;
  invoice_number: string | null;
  timestamp: string;
  total_amount: number;
  items: Array<{ productId?: string; quantity?: number; purchasePrice?: number; name?: string }>;
};

export default function OperationsPage({ products, currency, productCategories = [] }: OperationsPageProps) {
  const configuredCategories = useMemo(
    () => productCategories.flatMap((item) => item.subcategories?.length ? item.subcategories.map((sub) => `${item.name} / ${sub}`) : [item.name]),
    [productCategories]
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set([...configuredCategories, ...products.map(p => p.category)]))],
    [products, configuredCategories]
  );
  const filteredProducts = useMemo(() => products.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(q) || p.barcode.includes(searchQuery) || p.category.toLowerCase().includes(q);
    return matchesSearch && (categoryFilter === "All" || p.category === categoryFilter);
  }), [products, searchQuery, categoryFilter]);

  useEffect(() => {
    if (!historyProduct) return;
    let cancelled = false;
    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError("");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (!cancelled) { setHistoryError("Please sign in to view purchase history."); setHistoryLoading(false); }
        return;
      }
      const { data, error } = await supabase.from("purchases")
        .select("id,supplier_name,invoice_number,timestamp,total_amount,items")
        .eq("userId", auth.user.id)
        .order("timestamp", { ascending: false });
      if (cancelled) return;
      if (error) setHistoryError(error.message);
      setPurchaseHistory(((data || []) as PurchaseHistoryRow[]).filter(p =>
        Array.isArray(p.items) && p.items.some(item => item.productId === historyProduct.id)
      ));
      setHistoryLoading(false);
    };
    void loadHistory();
    return () => { cancelled = true; };
  }, [historyProduct]);

  const money = (n: number) => currency + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-5 md:p-8 text-black select-none">
      <div className="mb-6 border-b-2 border-black pb-5">
        <h2 className="text-2xl font-black uppercase tracking-tight">Inventory Catalogue</h2>
        <p className="text-xs text-zinc-700 font-bold mt-1">View products, monitor stock and review historical purchase rates. Add new products and stock only through Purchases.</p>
      </div>

      <div className="bg-white p-5 md:p-6 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4 mb-4">
          <h3 className="font-black uppercase text-base flex items-center gap-2"><Grid className="w-4 h-4" />Current Catalogue Stock</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4" />
              <input type="text" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 pr-3 py-2 bg-white border-2 border-black text-xs font-bold focus:outline-none" />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-2 py-2 bg-white border-2 border-black text-xs font-bold focus:outline-none">
                {categories.map((c, i) => <option key={i} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead><tr className="border-b-2 border-black text-xs uppercase tracking-wider">
              <th className="py-3 px-3">Product</th><th className="py-3 px-3">Category</th>
              <th className="py-3 px-3 text-center">Latest Cost</th><th className="py-3 px-3 text-center">Selling Price</th>
              <th className="py-3 px-3 text-center">Available Stock</th><th className="py-3 px-3 text-right">History</th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-200 font-bold">
              {filteredProducts.length === 0 ? <tr><td colSpan={6} className="text-center py-12 text-zinc-500 text-sm">No products found.</td></tr> :
                filteredProducts.map(p => {
                  const low = p.quantity <= p.lowStockLimit;
                  const over = p.quantity >= p.overstockLimit;
                  return <tr key={p.id} className="hover:bg-[#F5F2EB]/50">
                    <td className="py-4 px-3"><p className="font-black text-sm">{p.name}</p><p className="text-[10px] text-zinc-500 mt-0.5">SKU: {p.barcode}</p></td>
                    <td className="py-4 px-3"><span className="px-2 py-1 bg-[#F5F2EB] border border-black text-[10px] font-black">{p.category}</span></td>
                    <td className="py-4 px-3 text-center font-mono text-sm">{money(p.purchasePrice)}</td>
                    <td className="py-4 px-3 text-center font-mono text-sm">{money(p.sellingPrice)}</td>
                    <td className="py-4 px-3 text-center"><div className="flex flex-col items-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-black border border-black ${low ? "bg-[#FCE8E6] text-[#D63031]" : over ? "bg-[#FEF5E7] text-amber-700" : "bg-[#E8F8F5] text-emerald-800"}`}>{p.quantity} Units</span>
                      {low && <span className="text-[9px] text-[#D63031] font-black mt-1 uppercase">Low Stock</span>}
                      {over && <span className="text-[9px] text-amber-700 font-black mt-1 uppercase">Overstocked</span>}
                    </div></td>
                    <td className="py-4 px-3 text-right"><button onClick={() => setHistoryProduct(p)} className="inline-flex items-center gap-1 border-2 border-black px-3 py-2 text-[10px] font-black uppercase hover:bg-[#FFC300]"><History className="w-3.5 h-3.5"/> Purchase History</button></td>
                  </tr>;
                })}
            </tbody>
          </table>
        </div>
      </div>

      {historyProduct && <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-3" onClick={() => setHistoryProduct(null)}>
        <section className="bg-[#FAF8F5] border-4 border-black shadow-[6px_6px_0_#000] w-full max-w-4xl max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-start gap-3 border-b-2 border-black pb-3">
            <div><h3 className="text-xl font-black uppercase">{historyProduct.name}</h3><p className="text-xs text-zinc-600 font-bold">Purchase history · Current stock: {historyProduct.quantity}</p></div>
            <button onClick={() => setHistoryProduct(null)} className="border-2 border-black bg-white p-2"><X className="w-4 h-4"/></button>
          </div>
          {historyLoading ? <p className="py-8 text-center font-bold">Loading purchase history…</p> :
            historyError ? <p className="p-3 border-2 border-black bg-amber-100 text-sm font-bold">{historyError}</p> :
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead><tr className="border-b-2 border-black text-xs uppercase"><th className="p-2">Date / Invoice</th><th className="p-2">Supplier</th><th className="p-2 text-right">Quantity</th><th className="p-2 text-right">Purchase Rate</th><th className="p-2 text-right">Line Total</th></tr></thead>
              <tbody>{purchaseHistory.map(p => {
                const item = p.items.find(i => i.productId === historyProduct.id);
                if (!item) return null;
                return <tr key={p.id} className="border-b border-zinc-200"><td className="p-2">{new Date(p.timestamp).toLocaleDateString("en-IN")}<small className="block text-zinc-500">{p.invoice_number || p.id}</small></td><td className="p-2">{p.supplier_name}</td><td className="p-2 text-right">{item.quantity ?? "—"}</td><td className="p-2 text-right">{money(Number(item.purchasePrice || 0))}</td><td className="p-2 text-right font-bold">{money(Number(item.quantity || 0) * Number(item.purchasePrice || 0))}</td></tr>;
              })}{purchaseHistory.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-zinc-500">No purchase history found for this product.</td></tr>}</tbody>
            </table></div>}
        </section>
      </div>}
    </div>
  );
}
