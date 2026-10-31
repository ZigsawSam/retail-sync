"use client";

import React, { useState, useMemo } from "react";
import { 
  Package, 
  AlertTriangle, 
   RefreshCw, 
   CheckCircle,
 } from "lucide-react";
import { Product } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface InventoryDashboardProps {
  products: Product[];
    onUpdateProductStock: (id: string, qty: number) => void;
 }

export default function InventoryDashboard({
  products,
  onUpdateProductStock
}: InventoryDashboardProps) {

  // Toast / Status messages
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Quick Stock Edit Dialog
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [quickStockVal, setQuickStockVal] = useState("");


  // Low Stock threshold: products with quantity <= lowStockLimit
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.quantity <= (p.lowStockLimit || 5));
  }, [products]);

  const handleUpdateStockSubmit = (e: React.FormEvent, productId: string) => {
    e.preventDefault();
    const parsedQty = parseInt(quickStockVal, 10);
    if (isNaN(parsedQty) || parsedQty < 0) {
      triggerToast("Please enter a valid stock level");
      return;
    }
    onUpdateProductStock(productId, parsedQty);
    triggerToast("Stock count adjusted successfully!");
    setEditingProdId(null);
    setQuickStockVal("");
  };


  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-8 text-black select-none font-sans">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 bg-white border-3 border-black text-black px-5 py-3 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 flex items-center gap-2.5 font-mono text-xs font-black"
          >
            <CheckCircle className="w-4 h-4 text-[#D63031]" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b-4 border-black pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-black text-[#FFC300] border-2 border-black text-[10px] font-black uppercase tracking-wider mb-2 font-mono">
            <Package className="w-3.5 h-3.5" />
            <span>Station: Stockroom & Stock Control</span>
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-black">Inventory Manager Center</h2>
          <p className="text-xs text-zinc-600 font-mono mt-1 uppercase tracking-widest font-bold">Role active • Warehousing Node • Stock levels monitored real-time</p>
        </div>

      </div>

      {/* Warehousing Key Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        
        {/* Total Unique SKUs */}
        <div className="bg-white p-5 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[9px] text-zinc-500 font-black uppercase font-mono tracking-wider">TOTAL ACTIVE SKUs</p>
          <p className="text-2xl font-black font-mono mt-2">{products.length} Products</p>
          <div className="text-[10px] text-zinc-500 font-bold mt-2 font-mono uppercase">
            Distinct catalog items
          </div>
        </div>

        {/* Low Stock Items count */}
        <div className={`p-5 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${
          lowStockProducts.length > 0 ? "bg-[#FFC300]" : "bg-white"
        }`}>
          <p className="text-[9px] text-zinc-800 font-black uppercase font-mono tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>LOW STOCK CRITICALS</span>
          </p>
          <p className="text-2xl font-black font-mono mt-2">{lowStockProducts.length} Items</p>
          <div className="text-[10px] text-zinc-800 font-bold mt-2 font-mono uppercase">
            Threshold limit: &le; 5 units
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: low-stock warnings and quick updates */}
        <div className="lg:col-span-12 space-y-8">
          
          {/* Low Stock alert banner */}
          <div className="bg-white p-6 rounded-none border-3 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-2 border-black pb-3 mb-4">
              <h3 className="text-lg font-black uppercase text-black flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#D63031]" />
                <span>Critical Stock Level Warnings</span>
              </h3>
              <p className="text-xs text-zinc-600 font-bold font-mono">
                Review and correct stock counts to avoid out-of-stock POS bottlenecks.
              </p>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-500 text-emerald-800 font-mono text-xs font-black uppercase text-center">
                &check; All inventory stocks are perfectly matched above replenishment threshold lines.
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {lowStockProducts.map(p => (
                  <div key={p.id} className="p-3.5 border-2 border-black bg-[#FFC300]/15 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-black text-xs uppercase">{p.name}</p>
                      <p className="text-[10px] font-mono text-zinc-600 mt-1">Barcode: {p.barcode} • Cat: {p.category}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="block text-[8px] font-bold font-mono uppercase text-zinc-500">STOCK LEVEL</span>
                        <span className="font-mono text-xs font-black text-red-600">{p.quantity} Units left</span>
                      </div>

                      {editingProdId === p.id ? (
                        <form onSubmit={(e) => handleUpdateStockSubmit(e, p.id)} className="flex items-center gap-1.5">
                          <input 
                            type="number"
                            min="0"
                            placeholder="Qty..."
                            value={quickStockVal}
                            onChange={(e) => setQuickStockVal(e.target.value)}
                            className="w-16 px-1.5 py-1 text-xs font-mono font-bold border-2 border-black focus:outline-none"
                            autoFocus
                          />
                          <button 
                            type="submit"
                            className="px-2 py-1 bg-black text-white text-[10px] font-mono font-black uppercase"
                          >
                            Save
                          </button>
                        </form>
                      ) : (
                        <button 
                          onClick={() => {
                            setEditingProdId(p.id);
                            setQuickStockVal(p.quantity.toString());
                          }}
                          className="px-2.5 py-1 bg-[#D63031] text-white border-2 border-black hover:bg-[#E54849] font-mono text-[10px] font-black uppercase shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]"
                        >
                          Replenish
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* QUICK REPLENISH LIST */}
          <div className="bg-white p-6 rounded-none border-3 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-2 border-black pb-3 mb-4">
              <h3 className="text-lg font-black uppercase text-black flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#0055A5]" />
                <span>Quick Count & Stockroom Sheet</span>
              </h3>
              <p className="text-xs text-zinc-600 font-bold font-mono">
                Adjust stock levels of any catalog item instantly.
              </p>
            </div>

            <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b-2 border-black bg-zinc-100 text-[10px] font-black uppercase text-zinc-600">
                    <th className="py-2.5 px-3">Product SKU</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">In-Stock</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className="border-b border-zinc-200 hover:bg-zinc-50">
                      <td className="py-2.5 px-3">
                        <span className="block font-black text-black uppercase">{p.name}</span>
                        <span className="text-[10px] text-zinc-500">Barcode: {p.barcode}</span>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600">{p.category}</td>
                      <td className={`py-2.5 px-3 text-right font-black ${p.quantity <= (p.lowStockLimit || 5) ? "text-red-600" : "text-black"}`}>
                        {p.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {editingProdId === p.id ? (
                          <form onSubmit={(e) => handleUpdateStockSubmit(e, p.id)} className="flex items-center justify-center gap-1">
                            <input 
                              type="number"
                              min="0"
                              value={quickStockVal}
                              onChange={(e) => setQuickStockVal(e.target.value)}
                              className="w-12 px-1 py-0.5 text-xs font-mono font-bold border-2 border-black"
                              autoFocus
                            />
                            <button 
                              type="submit"
                              className="px-1.5 py-0.5 bg-black text-white text-[9px] font-black uppercase"
                            >
                              Go
                            </button>
                          </form>
                        ) : (
                          <button 
                            onClick={() => {
                              setEditingProdId(p.id);
                              setQuickStockVal(p.quantity.toString());
                            }}
                            className="px-2 py-0.5 border border-black hover:bg-zinc-100 font-black text-[9px] uppercase"
                          >
                            Set Qty
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
