"use client";

import React, { useState, useMemo } from "react";
import { 
  Package, 
  Plus, 
  AlertTriangle, 
  DollarSign, 
  RefreshCw, 
  FileSpreadsheet, 
  CheckCircle,
  Hash
} from "lucide-react";
import { Product, Expense, StoreSettings } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { getShopLocalISOString } from "../lib/dateUtils";

interface InventoryDashboardProps {
  products: Product[];
  expenses: Expense[];
  settings: StoreSettings;
  setActiveTab: (tab: string) => void;
  onAddProduct: (prod: Product) => void;
  onUpdateProductStock: (id: string, qty: number) => void;
  onAddExpense: (expense: Expense) => void;
  currency: string;
}

export default function InventoryDashboard({
  products,
  expenses,
  settings,
  setActiveTab,
  onAddProduct,
  onUpdateProductStock,
  onAddExpense,
  currency
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

  // Create Product Form States
  const [newProdName, setNewProdName] = useState("");
  const [newProdBarcode, setNewProdBarcode] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Groceries");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdCostPrice, setNewProdCostPrice] = useState("");
  const [newProdQty, setNewProdQty] = useState("");
  const [newProdSupplier, setNewProdSupplier] = useState("");

  // Low Stock threshold: products with quantity <= lowStockLimit
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.quantity <= (p.lowStockLimit || 5));
  }, [products]);

  const totalInventoryValue = useMemo(() => {
    return products.reduce((sum, p) => sum + (p.quantity * p.sellingPrice), 0);
  }, [products]);

  const totalInvestmentValue = useMemo(() => {
    return products.reduce((sum, p) => sum + (p.quantity * (p.purchasePrice || p.sellingPrice * 0.7)), 0);
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

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdBarcode || !newProdPrice || !newProdCostPrice || !newProdQty) {
      triggerToast("Please fill all required inputs");
      return;
    }

    const priceNum = parseFloat(newProdPrice);
    const costPriceNum = parseFloat(newProdCostPrice);
    const qtyNum = parseInt(newProdQty, 10);

    if (isNaN(priceNum) || priceNum < 0 || isNaN(costPriceNum) || costPriceNum < 0 || isNaN(qtyNum) || qtyNum < 0) {
      triggerToast("Numeric values must be valid non-negative counts");
      return;
    }

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      name: newProdName,
      barcode: newProdBarcode,
      category: newProdCategory,
      purchasePrice: costPriceNum,
      sellingPrice: priceNum,
      quantity: qtyNum,
      lowStockLimit: 5,
      overstockLimit: 100
    };

    onAddProduct(newProduct);
    
    // Log as Inventory Purchase Expense
    const expenseCost = costPriceNum * qtyNum;
    if (expenseCost > 0) {
      onAddExpense({
        id: `exp-${Date.now()}`,
        category: "Inventory Purchase",
        amount: expenseCost,
        description: `Procured stock: ${qtyNum}x ${newProdName}`,
        paymentMethod: "Cash",
        timestamp: getShopLocalISOString()
      });
    }

    triggerToast(`Created product ${newProdName} and recorded purchase!`);
    
    // Clear state
    setNewProdName("");
    setNewProdBarcode("");
    setNewProdPrice("");
    setNewProdCostPrice("");
    setNewProdQty("");
    setNewProdSupplier("");
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
            <span>Station: Stockroom & Procurement</span>
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-black">Inventory Manager Center</h2>
          <p className="text-xs text-zinc-600 font-mono mt-1 uppercase tracking-widest font-bold">Role active • Warehousing Node • Stock levels monitored real-time</p>
        </div>

        <div>
          <button 
            onClick={() => setActiveTab("operations")}
            className="flex items-center gap-3 px-6 py-3.5 bg-black text-white border-3 border-black rounded-none text-sm font-black tracking-wider hover:bg-zinc-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-5 h-5 text-white" />
            <span>MANAGE ALL PRODUCTS CATALOG</span>
          </button>
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

        {/* Total Wholesale Capital */}
        <div className="bg-white p-5 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[9px] text-zinc-500 font-black uppercase font-mono tracking-wider">CAPITAL INVESTMENT</p>
          <p className="text-2xl font-black font-mono mt-2">{currency}{totalInvestmentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          <div className="text-[10px] text-zinc-500 font-bold mt-2 font-mono uppercase">
            Asset cost basis value
          </div>
        </div>

        {/* Estimated Retail Value */}
        <div className="bg-[#0055A5] p-5 rounded-none border-3 border-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[9px] text-[#FFC300] font-black uppercase font-mono tracking-wider">POTENTIAL REVENUE</p>
          <p className="text-2xl font-black font-mono mt-2">{currency}{totalInventoryValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          <div className="text-[10px] text-white/95 font-semibold mt-2 font-mono uppercase">
            Valued at full ticket prices
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: low-stock warnings and quick updates */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Low Stock alert banner */}
          <div className="bg-white p-6 rounded-none border-3 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-2 border-black pb-3 mb-4">
              <h3 className="text-lg font-black uppercase text-black flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#D63031]" />
                <span>Critical Stock Level Warnings</span>
              </h3>
              <p className="text-xs text-zinc-600 font-bold font-mono">
                Procure or adjust stock counts immediately to avoid out-of-stock POS bottlenecks.
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
                    <th className="py-2.5 px-3 text-right">Wholesale Cost</th>
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
                      <td className="py-2.5 px-3 text-right font-black">
                        {currency}{(p.purchasePrice || p.sellingPrice * 0.7).toFixed(2)}
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

        {/* Right Column: Add New Product and Procurement logging */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* PROCUREMENT INCOMING FORM */}
          <div className="bg-white p-6 rounded-none border-3 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-2 border-black pb-3 mb-4">
              <h3 className="text-lg font-black uppercase text-black flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <span>Log Procured Consignment</span>
              </h3>
              <p className="text-xs text-zinc-600 font-bold font-mono">
                Log newly procured stock batches. This adds items to the SKU levels and generates expense logs automatically.
              </p>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-[10px] font-black uppercase mb-1.5 text-zinc-700">Product Name *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Premium Basmati Rice"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border-2 border-black rounded-none font-bold text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase mb-1.5 text-zinc-700">Barcode / SKU *</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. 8901058"
                    value={newProdBarcode}
                    onChange={(e) => setNewProdBarcode(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border-2 border-black rounded-none font-bold text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase mb-1.5 text-zinc-700">Category *</label>
                  <select 
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border-2 border-black rounded-none font-bold text-xs focus:outline-none"
                  >
                    <option value="Groceries">Groceries</option>
                    <option value="Cosmetics">Cosmetics</option>
                    <option value="Stationery">Stationery</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-black uppercase mb-1.5 text-zinc-700">Cost Price *</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    placeholder="Cost"
                    value={newProdCostPrice}
                    onChange={(e) => setNewProdCostPrice(e.target.value)}
                    className="w-full px-2 py-2.5 bg-white border-2 border-black rounded-none font-bold text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase mb-1.5 text-zinc-700">Retail Price *</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    placeholder="Retail"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="w-full px-2 py-2.5 bg-white border-2 border-black rounded-none font-bold text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase mb-1.5 text-zinc-700">Initial Qty *</label>
                  <input 
                    type="number"
                    required
                    placeholder="Qty"
                    value={newProdQty}
                    onChange={(e) => setNewProdQty(e.target.value)}
                    className="w-full px-2 py-2.5 bg-white border-2 border-black rounded-none font-bold text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase mb-1.5 text-zinc-700">Consignment Supplier / Vendor</label>
                <input 
                  type="text"
                  placeholder="e.g. Apex Agri Products Ltd."
                  value={newProdSupplier}
                  onChange={(e) => setNewProdSupplier(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border-2 border-black rounded-none font-bold text-xs focus:outline-none"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-3 bg-black hover:bg-zinc-800 text-white border-2 border-black rounded-none text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              >
                PROCUR STOCK & LOG INVENTORY EXPENSE
              </button>
            </form>
          </div>

          {/* STOCKROOM NOTEBOARD */}
          <div className="bg-[#FFC300]/10 p-5 border-2 border-[#FFC300] font-mono text-xs">
            <p className="font-black uppercase tracking-wider text-black flex items-center gap-1.5 mb-1.5">
              <Hash className="w-4 h-4 text-[#D63031]" />
              <span>STOCK PROTOCOLS</span>
            </p>
            <ul className="list-disc pl-4 space-y-1 text-zinc-700 leading-relaxed font-semibold text-[11px]">
              <li>Upon batch arrival, count and verify barcode/SKU numbers before adding them to the virtual catalog.</li>
              <li>Always enter actual wholesale procurement cost price to track precise gross margin levels on sales charts.</li>
              <li>Re-log damaged/spoiled stocks under appropriate "Other" or "Spoilage" expense claims on the dashboard ledger.</li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}
