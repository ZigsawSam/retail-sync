import React, { useState, useMemo } from "react";
import { getShopLocalISOString } from "../lib/dateUtils";
import { 
  Package, 
  Plus, 
  Trash2, 
  Upload, 
  Download, 
  Check, 
  Grid, 
  Sparkles, 
  AlertCircle,
  FileSpreadsheet,
  Search,
  Filter,
  ArrowUpRight
} from "lucide-react";
import { Product, Expense } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface OperationsPageProps {
  products: Product[];
  expenses: Expense[];
  currency: string;
  onAddProduct: (product: Product) => void;
  onUpdateProductStock: (productId: string, newStock: number) => void;
  onDeleteProduct: (productId: string) => void;
  onAddExpense: (expense: Expense) => void;
  productCategories?: { name: string; subcategories: string[] }[];
}

export default function OperationsPage({
  products,
  expenses,
  currency,
  onAddProduct,
  onUpdateProductStock,
  onDeleteProduct,
  onAddExpense,
  productCategories = []
}: OperationsPageProps) {
  // Tabs for restock methods
  const [restockTab, setRestockTab] = useState<"quick" | "bulk" | "csv">("quick");

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Inline restocking states
  const [selectedRestockProdId, setSelectedRestockProdId] = useState("");
  const [inlineRestockQty, setInlineRestockQty] = useState("10");

  // --- Form States: Quick Add ---
  const [quickName, setQuickName] = useState("");
  const [quickCategory, setQuickCategory] = useState(configuredCategories[0] || "Other");
  const [quickPurchasePrice, setQuickPurchasePrice] = useState("");
  const [quickSellingPrice, setQuickSellingPrice] = useState("");
  const [quickQuantity, setQuickQuantity] = useState("");
  const [quickBarcode, setQuickBarcode] = useState("");
  const [quickLowLimit, setQuickLowLimit] = useState("5");
  const [quickOverLimit, setQuickOverLimit] = useState("40");

  // --- Form States: Bulk Add ---
  const [bulkRows, setBulkRows] = useState<Partial<Product>[]>([
    { name: "", category: configuredCategories[0] || "Other", purchasePrice: 0, sellingPrice: 0, quantity: 0, barcode: "" },
    { name: "", category: "Apparel", purchasePrice: 0, sellingPrice: 0, quantity: 0, barcode: "" },
    { name: "", category: "Apparel", purchasePrice: 0, sellingPrice: 0, quantity: 0, barcode: "" }
  ]);

  // --- Form States: CSV Import ---
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploadStatus, setCsvUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [csvLogMessage, setCsvLogMessage] = useState("");

  // Categories list
  const configuredCategories = useMemo(() => productCategories.flatMap((item) => item.subcategories?.length ? item.subcategories.map((sub) => `${item.name} / ${sub}`) : [item.name]), [productCategories]);
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

  // --- Handlers: Quick Add ---
  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName || !quickPurchasePrice || !quickSellingPrice || !quickQuantity) return;

    const newProd: Product = {
      id: "prod-" + Date.now(),
      name: quickName,
      category: quickCategory,
      purchasePrice: parseFloat(quickPurchasePrice),
      sellingPrice: parseFloat(quickSellingPrice),
      quantity: parseInt(quickQuantity),
      barcode: quickBarcode || "SKU-" + Math.floor(100000 + Math.random() * 900000),
      lowStockLimit: parseInt(quickLowLimit) || 5,
      overstockLimit: parseInt(quickOverLimit) || 40
    };

    onAddProduct(newProd);

    // Record an automated Purchase Expense to reduce cash
    const totalCost = newProd.purchasePrice * newProd.quantity;
    if (totalCost > 0) {
      const newExp: Expense = {
        id: "exp-" + Date.now(),
        category: "Inventory Purchase",
        amount: totalCost,
        description: `Purchased initial stock of ${newProd.quantity}x ${newProd.name}`,
        timestamp: getShopLocalISOString()
      };
      onAddExpense(newExp);
    }

    // Reset Form
    setQuickName("");
    setQuickPurchasePrice("");
    setQuickSellingPrice("");
    setQuickQuantity("");
    setQuickBarcode("");
    alert("Product added successfully, and purchase cost registered under store expenses!");
  };

  // --- Handlers: Bulk Row Add ---
  const handleBulkRowChange = (index: number, field: keyof Product, value: any) => {
    const updated = [...bulkRows];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setBulkRows(updated);
  };

  const addBulkRow = () => {
    setBulkRows([...bulkRows, { name: "", category: configuredCategories[0] || "Other", purchasePrice: 0, sellingPrice: 0, quantity: 0, barcode: "" }]);
  };

  const removeBulkRow = (index: number) => {
    setBulkRows(bulkRows.filter((_, idx) => idx !== index));
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = bulkRows.filter(row => row.name && row.sellingPrice && row.quantity);
    if (validRows.length === 0) return;

    let totalBulkCost = 0;
    
    validRows.forEach((row, idx) => {
      const newProd: Product = {
        id: "prod-" + (Date.now() + idx),
        name: row.name!,
        category: row.category || configuredCategories[0] || "Other",
        purchasePrice: Number(row.purchasePrice) || 0,
        sellingPrice: Number(row.sellingPrice) || 0,
        quantity: Number(row.quantity) || 0,
        barcode: row.barcode || "SKU-" + Math.floor(100000 + Math.random() * 900000),
        lowStockLimit: 5,
        overstockLimit: 40
      };

      onAddProduct(newProd);
      totalBulkCost += (newProd.purchasePrice * newProd.quantity);
    });

    if (totalBulkCost > 0) {
      const newExp: Expense = {
        id: "exp-" + Date.now(),
        category: "Inventory Purchase",
        amount: totalBulkCost,
        description: `Bulk restock of ${validRows.length} distinct item lines`,
        timestamp: getShopLocalISOString()
      };
      onAddExpense(newExp);
    }

    // Reset table
    setBulkRows([
      { name: "", category: "Apparel", purchasePrice: 0, sellingPrice: 0, quantity: 0, barcode: "" },
      { name: "", category: "Apparel", purchasePrice: 0, sellingPrice: 0, quantity: 0, barcode: "" }
    ]);
    alert(`Bulk registered ${validRows.length} items successfully! Recorded total purchase cost of ${currency}${totalBulkCost.toFixed(2)} to expenses.`);
  };

  // --- Handlers: CSV Export Template & Import ---
  const downloadCsvTemplate = () => {
    const headers = "name,category,purchasePrice,sellingPrice,quantity,barcode,lowStockLimit,overstockLimit\n";
    const sampleRow = "Vintage Leather Messenger Bag,Apparel,22,55,15,SKU-845920,5,30\n";
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + sampleRow);
    
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "retail_inventory_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split("\n");
        let successCount = 0;
        let totalImportCost = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = line.split(",");
          if (values.length < 4) continue; // must have basic parameters

          const pName = values[0];
          const pCategory = values[1] || "Apparel";
          const pCost = parseFloat(values[2]) || 0;
          const pMrp = parseFloat(values[3]) || 0;
          const pQty = parseInt(values[4]) || 0;
          const pBarcode = values[5] || "SKU-" + Math.floor(100000 + Math.random() * 900000);
          const pLow = parseInt(values[6]) || 5;
          const pOver = parseInt(values[7]) || 40;

          const newProd: Product = {
            id: "prod-" + (Date.now() + i),
            name: pName,
            category: pCategory,
            purchasePrice: pCost,
            sellingPrice: pMrp,
            quantity: pQty,
            barcode: pBarcode,
            lowStockLimit: pLow,
            overstockLimit: pOver
          };

          onAddProduct(newProd);
          totalImportCost += (newProd.purchasePrice * newProd.quantity);
          successCount++;
        }

        if (totalImportCost > 0) {
          const newExp: Expense = {
            id: "exp-" + Date.now(),
            category: "Inventory Purchase",
            amount: totalImportCost,
            description: `Imported ${successCount} items from CSV spreadsheet`,
            timestamp: getShopLocalISOString()
          };
          onAddExpense(newExp);
        }

        setCsvUploadStatus("success");
        setCsvLogMessage(`Successfully imported ${successCount} product lines! Total purchase cost of ${currency}${totalImportCost.toFixed(2)} credited to expenses ledger.`);
      } catch (err) {
        setCsvUploadStatus("error");
        setCsvLogMessage("Parsing error. Please make sure the columns match our template exact format.");
      }
    };

    reader.readAsText(file);
  };

  // --- Handlers: Inline Restock Trigger ---
  const triggerInlineRestock = (p: Product) => {
    setSelectedRestockProdId(p.id);
  };

  const handleInlineRestockSave = () => {
    const p = products.find(prod => prod.id === selectedRestockProdId);
    if (!p) return;

    const addQty = parseInt(inlineRestockQty);
    if (!addQty || addQty <= 0) return;

    const newStock = p.quantity + addQty;
    onUpdateProductStock(p.id, newStock);

    // Record Expense of purchase
    const cost = p.purchasePrice * addQty;
    if (cost > 0) {
      const newExp: Expense = {
        id: "exp-" + Date.now(),
        category: "Inventory Purchase",
        amount: cost,
        description: `Restocked ${addQty}x of ${p.name}`,
        timestamp: getShopLocalISOString()
      };
      onAddExpense(newExp);
    }

    setSelectedRestockProdId("");
    alert(`Successfully restocked ${p.name} with +${addQty} units. Registered procurement expense of ${currency}${cost.toFixed(2)}.`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-8 text-black select-none">
      {/* Header */}
      <div className="mb-8 border-b-3 border-black pb-6">
        <h2 className="text-2xl font-black uppercase tracking-tight text-black">Inventory Restocking & Operations</h2>
        <p className="text-xs text-zinc-700 font-bold font-mono mt-1">Replenish store catalog via single quick adds, bulk spreadsheet arrays, or tabular CSV templates.</p>
      </div>

      {/* Primary Grid split: Restocking inputs vs stock lists */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* LEFT PANEL: RESTOCKING INPUT ENGINE (Col Span 1) */}
        <div className="bg-white p-6 rounded-none border-3 border-black h-fit space-y-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="border-b-2 border-black pb-3">
            <h3 className="font-black uppercase text-black text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-black" />
              <span>Catalog Intake Console</span>
            </h3>
          </div>

          {/* Intake selection buttons */}
          <div className="flex bg-[#F5F2EB] p-1.5 rounded-none border-2 border-black">
            <button 
              onClick={() => setRestockTab("quick")}
              className={`flex-1 py-2 text-xs font-black rounded-none transition-all cursor-pointer ${restockTab === "quick" ? "bg-black text-white" : "text-zinc-700 hover:text-black"}`}
            >
              Quick Add
            </button>
            <button 
              onClick={() => setRestockTab("bulk")}
              className={`flex-1 py-2 text-xs font-black rounded-none transition-all cursor-pointer ${restockTab === "bulk" ? "bg-black text-white" : "text-zinc-700 hover:text-black"}`}
            >
              Bulk Add
            </button>
            <button 
              onClick={() => setRestockTab("csv")}
              className={`flex-1 py-2 text-xs font-black rounded-none transition-all cursor-pointer ${restockTab === "csv" ? "bg-black text-white" : "text-zinc-700 hover:text-black"}`}
            >
              Excel CSV
            </button>
          </div>

          {/* CONTENT: QUICK ADD FORM */}
          {restockTab === "quick" && (
            <form onSubmit={handleQuickAddSubmit} className="space-y-4 text-black">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Product Name</label>
                <input 
                  type="text" 
                  required
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-black text-black rounded-none text-xs font-bold focus:outline-none placeholder-zinc-500"
                  placeholder="e.g. Classic Denim Jacket"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Category</label>
                  <select 
                    value={quickCategory}
                    onChange={(e) => setQuickCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-black text-black rounded-none text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    {(configuredCategories.length ? configuredCategories : ["Grocery & Food","Beverages","Personal Care","Household & Cleaning","Clothing & Apparel","Electronics & Accessories","Other"]).map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Intake Qty</label>
                  <input 
                    type="number" 
                    required
                    value={quickQuantity}
                    onChange={(e) => setQuickQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-black text-black rounded-none text-xs font-bold focus:outline-none"
                    placeholder="e.g. 50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Purchase Cost ({currency})</label>
                  <input 
                    type="number" 
                    required
                    value={quickPurchasePrice}
                    onChange={(e) => setQuickPurchasePrice(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-black text-black rounded-none text-xs font-bold focus:outline-none font-mono"
                    placeholder="e.g. 25"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Retail MRP ({currency})</label>
                  <input 
                    type="number" 
                    required
                    value={quickSellingPrice}
                    onChange={(e) => setQuickSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-black text-black rounded-none text-xs font-bold focus:outline-none font-mono"
                    placeholder="e.g. 59"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Low Alert Count</label>
                  <input 
                    type="number" 
                    value={quickLowLimit}
                    onChange={(e) => setQuickLowLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-black text-black rounded-none text-xs font-bold focus:outline-none font-mono"
                    placeholder="e.g. 5"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Overstock Count</label>
                  <input 
                    type="number" 
                    value={quickOverLimit}
                    onChange={(e) => setQuickOverLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-black text-black rounded-none text-xs font-bold focus:outline-none font-mono"
                    placeholder="e.g. 40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Barcode / SKU (Optional)</label>
                <input 
                  type="text" 
                  value={quickBarcode}
                  onChange={(e) => setQuickBarcode(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-black text-black rounded-none text-xs font-bold focus:outline-none font-mono"
                  placeholder="SKU-845920"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-[#0055A5] hover:bg-[#004488] text-white border-2 border-black rounded-none text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              >
                <Plus className="w-4 h-4" />
                <span>ONBOARD SINGLE PRODUCT</span>
              </button>
            </form>
          )}

          {/* CONTENT: BULK ROW ADD */}
          {restockTab === "bulk" && (
            <form onSubmit={handleBulkSubmit} className="space-y-4 text-black">
              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                {bulkRows.map((row, idx) => (
                  <div key={idx} className="p-3 bg-[#F5F2EB] border-2 border-black rounded-none space-y-2 relative">
                    <button 
                      type="button"
                      onClick={() => removeBulkRow(idx)}
                      className="absolute right-2 top-2 border border-black bg-white w-5 h-5 flex items-center justify-center text-xs text-black font-black hover:bg-[#FCE8E6] cursor-pointer"
                    >
                      ✕
                    </button>
                    <p className="text-[9px] font-black text-black uppercase font-mono">Item #{idx + 1}</p>
                    
                    <input 
                      type="text" 
                      placeholder="Product Name" 
                      required
                      value={row.name} 
                      onChange={(e) => handleBulkRowChange(idx, "name", e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-black rounded-none text-xs text-black focus:outline-none"
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <input 
                        type="number" 
                        placeholder="Cost" 
                        required
                        value={row.purchasePrice || ""} 
                        onChange={(e) => handleBulkRowChange(idx, "purchasePrice", parseFloat(e.target.value))}
                        className="px-2 py-1.5 bg-white border border-black rounded-none text-xs font-mono text-black focus:outline-none"
                      />
                      <input 
                        type="number" 
                        placeholder="MRP" 
                        required
                        value={row.sellingPrice || ""} 
                        onChange={(e) => handleBulkRowChange(idx, "sellingPrice", parseFloat(e.target.value))}
                        className="px-2 py-1.5 bg-white border border-black rounded-none text-xs font-mono text-black focus:outline-none"
                      />
                      <input 
                        type="number" 
                        placeholder="Qty" 
                        required
                        value={row.quantity || ""} 
                        onChange={(e) => handleBulkRowChange(idx, "quantity", parseInt(e.target.value))}
                        className="px-2 py-1.5 bg-white border border-black rounded-none text-xs font-mono text-black focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => addBulkRow()}
                  className="flex-1 py-2 border-2 border-black hover:bg-zinc-100 text-black rounded-none text-xs font-black transition-all cursor-pointer bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  + Add Item Row
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-[#0055A5] hover:bg-[#004488] text-white border-2 border-black rounded-none text-xs font-black transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  Save Bulk Rows
                </button>
              </div>
            </form>
          )}

          {/* CONTENT: EXCEL CSV IMPORT */}
          {restockTab === "csv" && (
            <div className="space-y-5 text-black">
              <div className="p-4 bg-[#F5F2EB] border-2 border-black rounded-none space-y-3">
                <p className="text-xs text-zinc-800 leading-relaxed font-bold">Download our structured Excel/CSV import spreadsheet template, fill details, and upload it back here instantly.</p>
                <button
                  onClick={() => downloadCsvTemplate()}
                  className="w-full py-2 bg-[#FFC300] hover:bg-[#E5B000] text-black border-2 border-black rounded-none text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DOWNLOAD CSV TEMPLATE</span>
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div className="border-3 border-dashed border-black hover:bg-zinc-100 p-8 rounded-none text-center relative bg-white cursor-pointer transition-all">
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleCsvImport}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <FileSpreadsheet className="w-8 h-8 text-black mx-auto mb-2" />
                <p className="text-xs font-black text-black uppercase">Drag CSV here or click</p>
                <p className="text-[10px] text-zinc-600 mt-1 font-mono">Accepts spreadsheet .csv files</p>
              </div>

              {/* Upload Success message feedback */}
              {csvUploadStatus !== "idle" && (
                <div className={`p-4 rounded-none border-2 border-black text-xs ${csvUploadStatus === "success" ? "bg-[#E8F8F5] text-black" : "bg-[#FCE8E6] text-black"}`}>
                  <p className="font-black flex items-center gap-1 uppercase">
                    {csvUploadStatus === "success" ? "✅ CSV Imported Successfully!" : "❌ Import Failed"}
                  </p>
                  <p className="mt-1 font-mono leading-normal font-bold">{csvLogMessage}</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* RIGHT PANEL: CURRENT INVENTORY STOCK LEVELS (Col Span 2) */}
        <div className="xl:col-span-2 space-y-6 text-black">
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
                              {selectedRestockProdId === p.id ? (
                                <div className="flex items-center gap-1.5 bg-[#F5F2EB] p-1 rounded-none border border-black">
                                  <input 
                                    type="number" 
                                    value={inlineRestockQty} 
                                    onChange={(e) => setInlineRestockQty(e.target.value)}
                                    className="w-12 px-1.5 py-0.5 text-xs font-black text-center bg-white border border-black text-black rounded-none focus:outline-none"
                                  />
                                  <button 
                                    onClick={() => handleInlineRestockSave()}
                                    className="p-1 bg-[#0055A5] border border-black text-white rounded-none cursor-pointer hover:bg-[#004488]"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => setSelectedRestockProdId("")}
                                    className="p-1 bg-white border border-black text-black rounded-none cursor-pointer hover:bg-[#F5F2EB] text-xs font-black"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => triggerInlineRestock(p)}
                                  className="px-3 py-1 bg-white border-2 border-black hover:bg-[#F5F2EB] text-black rounded-none text-xs font-black transition-all flex items-center gap-1 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                >
                                  <span>Restock</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              )}

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
