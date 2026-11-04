"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useApp } from "../context/AppContext";
import { Product, Customer } from "../types";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
type Supplier = { id: string; name: string; phone?: string | null };
type Purchase = { id: string; supplier_id: string | null; supplier_name: string; invoice_number?: string | null; total_amount: number; paid_amount: number; due_amount: number; payment_method: string; timestamp: string };
type DueCustomer = { id: string; name: string; phone: string; due: number };

const inputClass = "w-full px-3 py-2.5 border-2 border-black bg-white text-sm font-bold text-black focus:outline-none";
const buttonClass = "px-4 py-2.5 border-2 border-black bg-[#FFC300] text-black text-xs font-black uppercase shadow-[2px_2px_0_#000] hover:translate-y-[-1px]";

export default function AccountsPage() {
  const { currency, products, customers, refreshData } = useApp();
  const [ownerId, setOwnerId] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [dueCustomers, setDueCustomers] = useState<DueCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
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
    setOwnerId(user.id);
    const [supplierRes, purchaseRes, salesRes] = await Promise.all([
      supabase.from("suppliers").select("id,name,phone").eq("userId", user.id).order("name"),
      supabase.from("purchases").select("*").eq("userId", user.id).order("timestamp", { ascending: false }),
      supabase.from("sales").select('"customerId","customerName","customerPhone","dueAmount"').eq("userId", user.id).gt("dueAmount", 0),
    ]);
    const err = supplierRes.error || purchaseRes.error || salesRes.error;
    if (err) setMessage(err.message);
    setSuppliers((supplierRes.data || []) as Supplier[]);
    setPurchases((purchaseRes.data || []) as Purchase[]);
    const grouped = new Map<string, DueCustomer>();
    (salesRes.data || []).forEach((sale: any) => {
      if (!sale.customerId) return;
      const current = grouped.get(sale.customerId) || { id: sale.customerId, name: sale.customerName || "Customer", phone: sale.customerPhone || "", due: 0 };
      current.due += Number(sale.dueAmount || 0);
      grouped.set(sale.customerId, current);
    });
    setDueCustomers(Array.from(grouped.values()).filter(x => x.due > 0).sort((a,b) => b.due-a.due));
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

  const addSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { error } = await supabase.rpc("create_supplier", { p_name: supplierName, p_phone: supplierPhone || null, p_address: null, p_notes: null });
      if (error) throw error;
      setSupplierName(""); setSupplierPhone("");
    });
  };

  const addPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === selectedProduct);
    const qty = Number(quantity); const cost = Number(purchasePrice || product?.purchasePrice || 0);
    const total = qty * cost; const paid = Number(paidAmount || 0);
    if (!product || !Number.isInteger(qty) || qty <= 0 || cost < 0 || paid < 0 || paid > total) { setMessage("Check the product, quantity, cost and paid amount."); return; }
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
      <div><h1 className="text-3xl font-black uppercase">Purchases & Credit Ledger</h1><p className="text-xs font-mono font-bold text-zinc-600 mt-1">Inventory purchases, supplier payables and customer receivables</p></div>
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
        <label className="block text-xs font-black uppercase">Product</label>
        <select required className={inputClass} value={selectedProduct} onChange={e=>{setSelectedProduct(e.target.value);const p=products.find(x=>x.id===e.target.value);setPurchasePrice(p?String(p.purchasePrice):"");}}><option value="">Select existing product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} — Stock: {p.quantity}</option>)}</select>
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-black uppercase mb-1">Quantity</label><input className={inputClass} type="number" min="1" step="1" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></div><div><label className="block text-xs font-black uppercase mb-1">Cost per unit</label><input className={inputClass} type="number" min="0" step="0.01" required value={purchasePrice} onChange={e=>setPurchasePrice(e.target.value)}/></div></div>
        <div><label className="block text-xs font-black uppercase mb-1">Supplier invoice number</label><input className={inputClass} value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)} placeholder="Optional"/></div>
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-black uppercase mb-1">Paid now</label><input className={inputClass} type="number" min="0" step="0.01" value={paidAmount} onChange={e=>setPaidAmount(e.target.value)} placeholder="0.00"/></div><div><label className="block text-xs font-black uppercase mb-1">Payment method</label><select className={inputClass} value={purchaseMethod} onChange={e=>setPurchaseMethod(e.target.value)}><option>Cash</option><option>UPI</option><option>Bank</option><option>Card</option><option>Cheque</option></select></div></div>
        <p className="text-xs font-bold bg-zinc-100 p-2">Purchase total: {money(Number(quantity||0)*Number(purchasePrice||0))} · Due: {money(Math.max(0,Number(quantity||0)*Number(purchasePrice||0)-Number(paidAmount||0)))}</p>
        <button className={buttonClass} disabled={busy || loading}>Save purchase & add stock</button>
      </form>
      <div className="space-y-5">
        <form onSubmit={addSupplier} className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000] space-y-3">
          <h2 className="font-black uppercase text-lg border-b-2 border-black pb-2">Add supplier</h2>
          <input required className={inputClass} value={supplierName} onChange={e=>setSupplierName(e.target.value)} placeholder="Supplier / firm name"/>
          <input className={inputClass} value={supplierPhone} onChange={e=>setSupplierPhone(e.target.value)} placeholder="Phone number (optional)"/>
          <button className={buttonClass} disabled={busy}>Save supplier</button>
        </form>
        <form onSubmit={paySupplier} className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000] space-y-3">
          <h2 className="font-black uppercase text-lg border-b-2 border-black pb-2">Pay supplier</h2>
          <select required className={inputClass} value={supplierPayId} onChange={e=>setSupplierPayId(e.target.value)}><option value="">Select supplier</option>{supplierBalances.map(s=><option key={s.id} value={s.id}>{s.name} · Due {money(s.due)}</option>)}</select>
          <input required className={inputClass} type="number" min="0.01" step="0.01" value={supplierPayAmount} onChange={e=>setSupplierPayAmount(e.target.value)} placeholder="Payment amount"/>
          <select className={inputClass} value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option>Cash</option><option>UPI</option><option>Bank</option><option>Card</option><option>Cheque</option></select>
          <button className={buttonClass} disabled={busy}>Record supplier payment</button>
        </form>
      </div>
    </section>
    <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000] space-y-3">
        <h2 className="font-black uppercase text-lg">Supplier balances</h2>
        {loading ? <p>Loading…</p> : supplierBalances.length===0 ? <p className="text-sm text-zinc-500">No outstanding supplier balances.</p> : supplierBalances.map(s=><div key={s.id} className="flex justify-between border-b border-zinc-200 py-2"><span className="font-bold">{s.name}</span><strong>{money(s.due)}</strong></div>)}
      </div>
      <div className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000] space-y-3">
        <h2 className="font-black uppercase text-lg">Customer balances</h2>
        {loading ? <p>Loading…</p> : dueCustomers.length===0 ? <p className="text-sm text-zinc-500">No outstanding customer balances. New Store Credit sales will appear here when linked to a saved customer.</p> : dueCustomers.map(s=><div key={s.id} className="flex justify-between border-b border-zinc-200 py-2"><span className="font-bold">{s.name}<small className="block text-zinc-500">{s.phone}</small></span><strong>{money(s.due)}</strong></div>)}
        <form onSubmit={collectCustomer} className="pt-3 border-t-2 border-black space-y-3">
          <h3 className="font-black uppercase text-sm">Receive customer payment</h3>
          <select required className={inputClass} value={customerPayId} onChange={e=>setCustomerPayId(e.target.value)}><option value="">Select customer</option>{dueCustomers.map(c=><option key={c.id} value={c.id}>{c.name} · Due {money(c.due)}</option>)}</select>
          <input required className={inputClass} type="number" min="0.01" step="0.01" value={customerPayAmount} onChange={e=>setCustomerPayAmount(e.target.value)} placeholder="Amount received"/>
          <select className={inputClass} value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option>Cash</option><option>UPI</option><option>Bank</option><option>Card</option><option>Cheque</option></select>
          <button className={buttonClass} disabled={busy}>Record customer collection</button>
        </form>
      </div>
    </section>
    <section className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000]">
      <h2 className="font-black uppercase text-lg mb-3">Purchase history</h2>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b-2 border-black text-xs uppercase"><th className="p-2">Date / Invoice</th><th className="p-2">Supplier</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Due</th></tr></thead><tbody>{purchases.map(p=><tr key={p.id} className="border-b border-zinc-200"><td className="p-2">{new Date(p.timestamp).toLocaleDateString("en-IN")}<small className="block text-zinc-500">{p.invoice_number || p.id}</small></td><td className="p-2">{p.supplier_name}</td><td className="p-2 text-right">{money(Number(p.total_amount))}</td><td className="p-2 text-right">{money(Number(p.paid_amount))}</td><td className="p-2 text-right font-black">{money(Number(p.due_amount))}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
