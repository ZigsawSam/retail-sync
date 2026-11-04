import React, { useState, useMemo } from "react";
import { Trash2, Search } from "lucide-react";
import { Product, Expense } from "../types";

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

export default function OperationsPage({
  products,
  currency,
  onDeleteProduct,
  productCategories = []
}: OperationsPageProps) {
  const configuredCategories = useMemo(() => productCategories.flatMap((item) => item.subcategories?.length ? item.subcategories.map((sub) => `${item.name} / ${sub}`) : [item.name]), [productCategories]);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Categories list
  const categories = useMemo(() => ["All", ...Array.from(new Set([...configuredCategories, ...products.map(p => p.category)]))], [products, configuredCategories]);

  // Filtered Inventory Stock Levels
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.barcode.includes(searchQuery) ||
                            p.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, categoryFilter]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-8 text-black select-none">
      {/* Header */}
      <div className="mb-8 border-b-3 border-black pb-6">
        <h2 className="text-2xl font-black uppercase tracking-tight text-black">Inventory Catalogue</h2>
        <p className="text-xs text-zinc-700 font-bold font-mono mt-1">Manage catalogue products and review stock levels. Create products and record purchases from Operations → Purchases & Balances.</p>
      </div>

      {/* Primary Grid split: Restocking inputs vs stock lists */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* RIGHT PANEL: CURRENT INVENTORY STOCK LEVELS (Col Span 2) */}
        <div className="w-full space-y-6 text-black">
          <div className="bg-white p-6 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Filtering bar header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black pb-4 mb-6">
              <h3 className="font-black uppercase text-black text-base flex items-center gap-2">
                <Grid className="w-4 h-4 text-black" />
                <span>Current Catalog Stock Levels</span>
              </h3>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search query field */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-black" />
                  <input 
                    type="text" 
                    placeholder="Search query..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-white border-2 border-black rounded-none text-xs font-black text-black focus:outline-none"
                  />
                </div>

                {/* Category selection filter dropdown */}
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-black" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-2 py-1.5 bg-white border-2 border-black rounded-none text-xs font-black text-black focus:outline-none cursor-pointer"
                  >
                    {categories.map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Catalog Stock levels grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-black text-black font-black text-xs uppercase tracking-wider font-mono">
                    <th className="py-3 px-4">Product Details</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Unit Cost</th>
                    <th className="py-3 px-4 text-center">MRP</th>
                    <th className="py-3 px-4 text-center">Available Stock</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-black font-bold">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-zinc-500 font-mono text-sm">
                        No product inventories found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLowStock = p.quantity <= p.lowStockLimit;
                      const isOverStock = p.quantity >= p.overstockLimit;

                      return (
                        <tr key={p.id} className="hover:bg-[#F5F2EB]/40 transition-colors">
                          <td className="py-4 px-4">
                            <p className="font-black text-black text-sm">{p.name}</p>
                            <p className="text-[10px] text-zinc-500 font-mono mt-0.5">SKU: {p.barcode}</p>
                          </td>
                          <td className="py-4 px-4">
                            <span className="px-2 py-1 bg-[#F5F2EB] border border-black text-black rounded-none text-[10px] font-black font-mono">
                              {p.category}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center font-mono text-sm">{currency}{p.purchasePrice}</td>
                          <td className="py-4 px-4 text-center font-mono text-sm">{currency}{p.sellingPrice}</td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-none text-xs font-black font-mono border border-black ${
                                isLowStock ? "bg-[#FCE8E6] text-[#D63031]" :
                                isOverStock ? "bg-[#FEF5E7] text-amber-700" :
                                "bg-[#E8F8F5] text-emerald-800"
                              }`}>
                                {p.quantity} Units
                              </span>
                              {isLowStock && (
                                <span className="text-[9px] text-[#D63031] font-black font-mono mt-0.5 uppercase">Low Stock!</span>
                              )}
                              {isOverStock && (
                                <span className="text-[9px] text-amber-600 font-black font-mono mt-0.5 uppercase">Overstocked!</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => onDeleteProduct(p.id)}
                                className="p-1.5 bg-[#FCE8E6] hover:bg-[#FADBD8] border-2 border-black text-[#D63031] rounded-none transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
