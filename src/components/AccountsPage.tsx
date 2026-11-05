"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useApp } from "../context/AppContext";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
type Supplier = { id: string; name: string; phone?: string | null; address?: string | null; gst_number?: string | null; owner_name?: string | null; email?: string | null; alternate_phone?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null; notes?: string | null };
type Purchase = { id: string; supplier_id: string | null; supplier_name: string; invoice_number?: string | null; total_amount: number; paid_amount: number; due_amount: number; payment_method: string; timestamp: string };
type DueCustomer = { id: string; name: string; phone: string; due: number };

const inputClass = "w-full px-3 py-2.5 border-2 border-black bg-white text-sm font-bold text-black focus:outline-none";
const buttonClass = "px-4 py-2.5 border-2 border-black bg-[#FFC300] text-black text-xs font-black uppercase shadow-[2px_2px_0_#000] hover:translate-y-[-1px]";

export default function AccountsPage() {
  const { currency, products, refreshData } = useApp();
  const [productSource, setProductSource] = useState<"existing" | "new" | "">("");
  const [showProductCreator, setShowProductCreator] = useState(false);
  const [newProductMode, setNewProductMode] = useState<"quick" | "bulk" | "csv">("quick");
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newProductCost, setNewProductCost] = useState("");
  const [newProductSelling, setNewProductSelling] = useState("");
  const [newProductBarcode, setNewProductBarcode] = useState("");
  const [bulkProductRows, setBulkProductRows] = useState([{name:"",category:"",cost:"",selling:"",barcode:""}]);
  const [productImportMessage, setProductImportMessage] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [dueCustomers, setDueCustomers] = useState<DueCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierGst, setSupplierGst] = useState("");
  const [supplierOwner, setSupplierOwner] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierAltPhone, setSupplierAltPhone] = useState("");
  const [supplierCity, setSupplierCity] = useState("");
  const [supplierState, setSupplierState] = useState("");
  const [supplierPostal, setSupplierPostal] = useState("");
  const [supplierCountry, setSupplierCountry] = useState("India");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [purchaseMethod, setPurchaseMethod] = useState("Cash");
  const [supplierPayId, setSupplierPayId] = useState("");
  const [supplierPayAmount, setSupplierPayAmount] = useState("");
  const [customerPayId, setCustomerPayId] = useState("");
  const [customerPayAmount, setCustomerPayAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const money = (value: number) => currency + Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) { setMessage("Please sign in as the shop owner to use Accounts."); setLoading(false); return; }
    const [supplierRes, purchaseRes] = await Promise.all([
      supabase.from("suppliers").select("*").eq("userId", user.id).order("name"),
      supabase.from("purchases").select("*").eq("userId", user.id).order("timestamp", { ascending: false }),
    ]);
    const err = supplierRes.error || purchaseRes.error;
    if (err) setMessage(err.message);
    setSuppliers((supplierRes.data || []) as Supplier[]);
    setPurchases((purchaseRes.data || []) as Purchase[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const supplierBalances = useMemo(() => {
    const map = new Map<string, { id: string; name: string; due: number }>();
    purchases.forEach(p => {
      if (!p.supplier_id) return;
      const row = map.get(p.supplier_id) || { id: p.supplier_id, name: p.supplier_name, due: 0 };
      row.due += Number(p.due_amount || 0);
      map.set(p.supplier_id, row);
    });
    return Array.from(map.values()).filter(x => x.due > 0).sort((a,b) => b.due-a.due);
  }, [purchases]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await action(); await load(); await refreshData(); setMessage("Saved successfully."); }
    catch (e: any) { setMessage(e?.message || "The operation failed."); }
    finally { setBusy(false); }
  };

  const resetSupplierForm = () => {
    setEditingSupplier(null); setSupplierName(""); setSupplierPhone(""); setSupplierAddress("");
    setSupplierGst(""); setSupplierOwner(""); setSupplierEmail(""); setSupplierAltPhone("");
    setSupplierCity(""); setSupplierState(""); setSupplierPostal(""); setSupplierCountry("India"); setSupplierNotes("");
  };
  const editSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier.id); setSupplierName(supplier.name || ""); setSupplierPhone(supplier.phone || "");
    setSupplierAddress(supplier.address || ""); setSupplierGst(supplier.gst_number || "");
    setSupplierOwner(supplier.owner_name || ""); setSupplierEmail(supplier.email || "");
    setSupplierAltPhone(supplier.alternate_phone || ""); setSupplierCity(supplier.city || "");
    setSupplierState(supplier.state || ""); setSupplierPostal(supplier.postal_code || "");
    setSupplierCountry(supplier.country || "India"); setSupplierNotes(supplier.notes || "");
  };
  const addSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const args = { p_name: supplierName, p_phone: supplierPhone || null, p_address: supplierAddress || null,
        p_gst_number: supplierGst || null, p_owner_name: supplierOwner || null, p_email: supplierEmail || null,
        p_alternate_phone: supplierAltPhone || null, p_city: supplierCity || null, p_state: supplierState || null,
        p_postal_code: supplierPostal || null, p_country: supplierCountry || null, p_notes: supplierNotes || null };
      const result = editingSupplier
        ? await supabase.rpc("update_supplier", { p_supplier_id: editingSupplier, ...args })
        : await supabase.rpc("create_supplier", args);
      if (result.error) throw result.error;
      resetSupplierForm();
    });
  };

  const createCatalogProduct = async (row: {name:string;category:string;cost:string;selling:string;barcode:string}) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Please sign in as the shop owner.");
    if (!row.name.trim() || Number(row.cost) < 0 || Number(row.selling) <= 0) throw new Error("Enter a product name, valid cost and selling price.");
    const { data, error } = await supabase.from("products").insert([{ userId: auth.user.id, name: row.name.trim(), category: row.category || "Other", purchasePrice: Number(row.cost) || 0, sellingPrice: Number(row.selling), quantity: 0, barcode: row.barcode.trim() || "SKU-" + Date.now(), lowStockLimit: 5, overstockLimit: 40 }]).select().single();
    if (error) throw error; return data;
  };
  const saveQuickProduct = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setProductImportMessage(""); try { const product = await createCatalogProduct({name:newProductName,category:newProductCategory,cost:newProductCost,selling:newProductSelling,barcode:newProductBarcode}); await refreshData(); setSelectedProduct(product.id); setProductSource("existing"); setShowProductCreator(false); setPurchasePrice(String(product.purchasePrice)); setNewProductName(""); setNewProductCost(""); setNewProductSelling(""); setNewProductBarcode(""); } catch(error:any) { setProductImportMessage(error?.message || "Unable to create product."); } finally { setBusy(false); } };
  const saveBulkProducts = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setProductImportMessage(""); try { const rows=bulkProductRows.filter(row=>row.name.trim()); if(!rows.length) throw new Error("Add at least one product row."); const created=[]; for(const row of rows) created.push(await createCatalogProduct(row)); await refreshData(); setSelectedProduct(created[0].id); setProductSource("existing"); setPurchasePrice(String(created[0].purchasePrice)); setShowProductCreator(false); } catch(error:any) { setProductImportMessage(error?.message || "Bulk product creation failed."); } finally { setBusy(false); } };
  const downloadProductCsvTemplate = () => {
    const template = "name,category,purchasePrice,sellingPrice,barcode\\n";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "retail-sync-product-import-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importProductsCsv = async (file: File) => { setBusy(true); setProductImportMessage(""); try { const raw=await file.text(); const lines=raw.split(/\r?\n/).filter(Boolean); const headers=lines.shift()?.split(",").map(x=>x.trim().toLowerCase()) || []; const idx=(names:string[])=>headers.findIndex(h=>names.includes(h)); const n=idx(["name","product name"]), cat=idx(["category"]), cost=idx(["purchaseprice","purchase_price","cost"]), selling=idx(["sellingprice","selling_price","mrp"]), barcode=idx(["barcode","sku"]); if(n<0||selling<0) throw new Error("CSV needs name and sellingPrice columns."); const auth=await supabase.auth.getUser(); if(!auth.data.user) throw new Error("Please sign in."); const rows=lines.map(line=>line.split(",")).filter(v=>v[n]?.trim()).map(v=>({userId:auth.data.user!.id,name:v[n].trim(),category:cat>=0?(v[cat]||"Other"):"Other",purchasePrice:cost>=0?Number(v[cost])||0:0,sellingPrice:Number(v[selling])||0,quantity:0,barcode:barcode>=0?(v[barcode]||"SKU-"+Date.now()):"SKU-"+Date.now(),lowStockLimit:5,overstockLimit:40})); if(!rows.length) throw new Error("No valid product rows found."); const {data,error}=await supabase.from("products").insert(rows).select(); if(error) throw error; await refreshData(); if(data?.[0]){setSelectedProduct(data[0].id);setProductSource("existing");setPurchasePrice(String(data[0].purchasePrice));} setShowProductCreator(false); } catch(error:any){setProductImportMessage(error?.message||"CSV import failed.");} finally{setBusy(false);} };
  const addPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === selectedProduct);
    const qty = Number(quantity); const cost = Number(purchasePrice || product?.purchasePrice || 0);
    const total = qty * cost; const paid = Number(paidAmount || 0);
    if (productSource !== "existing" || !product || !Number.isInteger(qty) || qty <= 0 || cost < 0 || paid < 0 || paid > total || (paid < total && !selectedSupplier)) { setMessage("Check the product, quantity and paid amount. A supplier is required when any amount remains due."); return; }
    void run(async () => {
      const supplier = suppliers.find(s => s.id === selectedSupplier);
      const { error } = await supabase.rpc("create_purchase", { p_purchase: {
        supplier_id: selectedSupplier || null, supplier_name: supplier?.name || "Unspecified supplier",
        invoice_number: invoiceNumber || null, items: [{ productId: product.id, quantity: qty, purchasePrice: cost }],
        paid_amount: paid, payment_method: purchaseMethod, notes: null
      }});
      if (error) throw error;
      setQuantity("1"); setPurchasePrice(""); setInvoiceNumber(""); setPaidAmount("");
    });
  };

  const paySupplier = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { error } = await supabase.rpc("record_supplier_payment", { p_supplier_id: supplierPayId, p_amount: Number(supplierPayAmount), p_method: paymentMethod, p_notes: null });
      if (error) throw error;
      setSupplierPayAmount("");
    });
  };

  const collectCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { error } = await supabase.rpc("record_customer_payment", { p_customer_id: customerPayId, p_amount: Number(customerPayAmount), p_method: paymentMethod, p_notes: null });
      if (error) throw error;
      setCustomerPayAmount("");
    });
  };

  const totalPayable = supplierBalances.reduce((s,x)=>s+x.due,0);
  const totalReceivable = dueCustomers.reduce((s,x)=>s+x.due,0);

  return <div className="flex-1 overflow-y-auto bg-[#FAF8F5] p-5 md:p-8 text-black space-y-6">
    <header className="border-b-4 border-black pb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-black uppercase">Purchases</h1><p className="text-xs font-mono font-bold text-zinc-600 mt-1">Supplier invoices and stock intake</p></div>
      <button className={buttonClass} onClick={() => void load()} disabled={loading}>Refresh</button>
    </header>
    {message && <div className="p-3 border-2 border-black bg-amber-100 text-sm font-bold">{message}</div>}
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000]"><p className="text-[10px] font-black uppercase text-zinc-500">Supplier outstanding</p><p className="text-2xl font-black mt-2">{money(totalPayable)}</p></div>
      <div className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000]"><p className="text-[10px] font-black uppercase text-zinc-500">Customer outstanding</p><p className="text-2xl font-black mt-2">{money(totalReceivable)}</p></div>
      <div className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000]"><p className="text-[10px] font-black uppercase text-zinc-500">Recorded purchases</p><p className="text-2xl font-black mt-2">{money(purchases.reduce((s,p)=>s+Number(p.total_amount||0),0))}</p></div>
    </section>
    <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <form onSubmit={addPurchase} className="bg-white border-3 border-black p-5 shadow-[4px_4px_0_#000] space-y-3">
        <h2 className="font-black uppercase text-lg border-b-2 border-black pb-2">Record stock purchase</h2>
        <label className="block text-xs font-black uppercase">Supplier</label>
        <select className={inputClass} value={selectedSupplier} onChange={e=>setSelectedSupplier(e.target.value)}><option value="">Choose supplier (optional)</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <label className="block text-xs font-black uppercase">Product source</label>
        <div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>{setProductSource("existing");setSelectedProduct("");setPurchasePrice("");}} className={"p-3 border-2 border-black text-xs font-black uppercase "+(productSource==="existing"?"bg-[#FFC300]":"bg-white")}>Select existing product</button><button type="button" onClick={()=>{setProductSource("new");setShowProductCreator(true);}} className={"p-3 border-2 border-black text-xs font-black uppercase "+(productSource==="new"?"bg-[#FFC300]":"bg-white")}>Add new product</button></div>
        {productSource==="existing" && <select required className={inputClass} value={selectedProduct} onChange={e=>{setSelectedProduct(e.target.value);const p=products.find(x=>x.id===e.target.value);setPurchasePrice(p?String(p.purchasePrice):"");}}><option value="">Choose from existing catalogue</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} — Current stock: {p.quantity}</option>)}</select>}
        {productSource==="new" && <p className="text-xs font-bold bg-zinc-100 p-2">New products are added to the catalogue with zero stock. This purchase invoice adds the purchased quantity.</p>}
        {showProductCreator && <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-3"><div className="bg-[#FAF8F5] border-4 border-black shadow-[6px_6px_0_#000] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
          <div className="flex justify-between items-center"><h3 className="text-lg font-black uppercase">Add products to catalogue</h3><button type="button" onClick={()=>setShowProductCreator(false)} className="border-2 border-black bg-white px-3 py-1 font-black">✕</button></div>
          <div className="grid grid-cols-3 gap-2"><button type="button" onClick={()=>setNewProductMode("quick")} className={"border-2 border-black p-2 text-xs font-black uppercase "+(newProductMode==="quick"?"bg-[#FFC300]":"bg-white")}>Quick Add</button><button type="button" onClick={()=>setNewProductMode("bulk")} className={"border-2 border-black p-2 text-xs font-black uppercase "+(newProductMode==="bulk"?"bg-[#FFC300]":"bg-white")}>Bulk Add</button><button type="button" onClick={()=>setNewProductMode("csv")} className={"border-2 border-black p-2 text-xs font-black uppercase "+(newProductMode==="csv"?"bg-[#FFC300]":"bg-white")}>Import CSV</button></div>
          {newProductMode==="quick" && <form onSubmit={saveQuickProduct} className="grid grid-cols-1 md:grid-cols-2 gap-3"><input required className={inputClass} value={newProductName} onChange={e=>setNewProductName(e.target.value)} placeholder="Product name"/><input className={inputClass} value={newProductCategory} onChange={e=>setNewProductCategory(e.target.value)} placeholder="Category (optional)"/><input required type="number" min="0" step="0.01" className={inputClass} value={newProductCost} onChange={e=>setNewProductCost(e.target.value)} placeholder="Purchase cost"/><input required type="number" min="0.01" step="0.01" className={inputClass} value={newProductSelling} onChange={e=>setNewProductSelling(e.target.value)} placeholder="Selling price / MRP"/><input className={inputClass} value={newProductBarcode} onChange={e=>setNewProductBarcode(e.target.value)} placeholder="Barcode / SKU (optional)"/><button disabled={busy} className={buttonClass}>Create product</button></form>}
          {newProductMode==="bulk" && <form onSubmit={saveBulkProducts} className="space-y-3">{bulkProductRows.map((row,i)=><div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2">{(["name","category","cost","selling","barcode"] as const).map(field=><input key={field} className={inputClass} placeholder={field} value={row[field]} onChange={e=>setBulkProductRows(old=>old.map((x,j)=>j===i?{...x,[field]:e.target.value}:x))}/>)}</div>)}<div className="flex gap-2"><button type="button" onClick={()=>setBulkProductRows(old=>[...old,{name:"",category:"",cost:"",selling:"",barcode:""}])} className="border-2 border-black bg-white px-3 py-2 text-xs font-black">Add row</button><button disabled={busy} className={buttonClass}>Create products</button></div></form>}
          {newProductMode==="csv" && <div className="space-y-3"><div className="space-y-2"><p className="text-xs font-bold">Use the exact template columns below. Product stock starts at zero; the purchase form adds the quantity after import.</p><button type="button" onClick={downloadProductCsvTemplate} className="border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase">Download CSV template</button><div className="overflow-x-auto border border-zinc-300"><table className="w-full text-left text-[11px]"><thead className="bg-zinc-100"><tr><th className="p-2">Column</th><th className="p-2">Requirement</th><th className="p-2">Meaning</th></tr></thead><tbody><tr><td className="p-2 font-mono">name</td><td className="p-2 font-bold">Required</td><td className="p-2">Product name</td></tr><tr><td className="p-2 font-mono">category</td><td className="p-2">Optional</td><td className="p-2">Product category; defaults to Other</td></tr><tr><td className="p-2 font-mono">purchasePrice</td><td className="p-2">Optional</td><td className="p-2">Unit purchase cost; defaults to 0</td></tr><tr><td className="p-2 font-mono">sellingPrice</td><td className="p-2 font-bold">Required</td><td className="p-2">Unit selling price / MRP</td></tr><tr><td className="p-2 font-mono">barcode</td><td className="p-2">Optional</td><td className="p-2">Barcode or SKU; generated if blank</td></tr></tbody></table></div><p className="text-[11px] text-zinc-600">Keep the header row unchanged. Add one product per row and save the file as CSV (comma-separated).</p></div><input type="file" accept=".csv,text/csv" className={inputClass} onChange={e=>{const file=e.target.files?.[0];if(file)void importProductsCsv(file);}}/></div>}
          {productImportMessage && <p className="p-3 border-2 border-black bg-amber-100 text-xs font-bold">{productImportMessage}</p>}
        </div></div>}
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-black uppercase mb-1">Quantity</label><input className={inputClass} type="number" min="1" step="1" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></div><div><label className="block text-xs font-black uppercase mb-1">Cost per unit</label><input className={inputClass} type="number" min="0" step="0.01" required value={purchasePrice} onChange={e=>setPurchasePrice(e.target.value)}/></div></div>
        <div><label className="block text-xs font-black uppercase mb-1">Supplier invoice number</label><input className={inputClass} value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)} placeholder="Optional"/></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-black uppercase mb-1">Paid now</label><input className={inputClass} type="number" min="0" step="0.01" value={paidAmount} onChange={e=>setPaidAmount(e.target.value)} placeholder="0.00"/></div><div><label className="block text-xs font-black uppercase mb-1">Payment method</label><select className={inputClass} value={purchaseMethod} onChange={e=>setPurchaseMethod(e.target.value)}><option>Cash</option><option>UPI</option><option>Bank</option><option>Card</option><option>Cheque</option></select></div></div>
        <p className="text-xs font-bold bg-zinc-100 p-2">Purchase total: {money(Number(quantity||0)*Number(purchasePrice||0))} · Due: {money(Math.max(0,Number(quantity||0)*Number(purchasePrice||0)-Number(paidAmount||0)))}</p>
        <button className={buttonClass} disabled={busy || loading}>Save purchase & add stock</button>
      </form>
    </section>
    <section className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000]">
      <h2 className="font-black uppercase text-lg mb-3">Purchase history</h2>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b-2 border-black text-xs uppercase"><th className="p-2">Date / Invoice</th><th className="p-2">Supplier</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Due</th></tr></thead><tbody>{purchases.map(p=><tr key={p.id} className="border-b border-zinc-200"><td className="p-2">{new Date(p.timestamp).toLocaleDateString("en-IN")}<small className="block text-zinc-500">{p.invoice_number || p.id}</small></td><td className="p-2">{p.supplier_name}</td><td className="p-2 text-right">{money(Number(p.total_amount))}</td><td className="p-2 text-right">{money(Number(p.paid_amount))}</td><td className="p-2 text-right font-black">{money(Number(p.due_amount))}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
