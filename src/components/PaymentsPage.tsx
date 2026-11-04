"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useApp } from "../context/AppContext";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const inputClass = "w-full border-2 border-black bg-white px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#D63031]/30";

export default function PaymentsPage() {
  const { currency, staffSession } = useApp();
  const isCashier = staffSession?.role === "cashier";
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [kind, setKind] = useState<"received" | "paid">("received");
  const [party, setParty] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (isCashier) {
      const { data, error } = await db.rpc("staff_get_payment_context");
      if (error) throw error;
      setCustomers(data?.customers || []);
      setSuppliers(data?.suppliers || []);
      setPurchases(data?.purchases || []);
      setSales(data?.sales || []);
      setPayments(data?.payments || []);
      return;
    }
    const { data: { user } } = await db.auth.getUser();
    if (!user) return;
    const [cu, su, pu, sa, ap] = await Promise.all([
      db.from("customers").select("id,name,phone").eq("userId", user.id).order("name"),
      db.from("suppliers").select("id,name").eq("userId", user.id).order("name"),
      db.from("purchases").select("id,supplier_id,supplier_name,due_amount,timestamp").eq("userId", user.id),
      db.from("sales").select("id,customerId,customerName,paidAmount,dueAmount,timestamp").eq("userId", user.id),
      db.from("account_payments").select("*").eq("userId", user.id).order("timestamp", { ascending: false }),
    ]);
    const firstError = [cu.error, su.error, pu.error, sa.error, ap.error].find(Boolean);
    if (firstError) throw firstError;
    setCustomers(cu.data || []);
    setSuppliers(su.data || []);
    setPurchases(pu.data || []);
    setSales(sa.data || []);
    setPayments(ap.data || []);
  }, [isCashier]);

  useEffect(() => { void load().catch((error) => setMessage(error.message || "Could not load payment register.")); }, [load]);

  const supplierDue = (id: string) => purchases.filter((item) => item.supplier_id === id).reduce((sum, item) => sum + Number(item.due_amount || 0), 0);
  const customerDue = (id: string) => sales.filter((item) => item.customerId === id).reduce((sum, item) => sum + Number(item.dueAmount || 0), 0);
  const parties = kind === "received" ? customers : suppliers.filter((item) => supplierDue(item.id) > 0);
  const totalIn = payments.filter((item) => item.direction === "received").reduce((sum, item) => sum + Number(item.amount || 0), 0)
    + sales.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
  const totalOut = payments.filter((item) => item.direction === "paid").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const customerOutstanding = sales.reduce((sum, item) => sum + Number(item.dueAmount || 0), 0);
  const supplierOutstanding = purchases.reduce((sum, item) => sum + Number(item.due_amount || 0), 0);
  const register = useMemo(() => [
    ...payments,
    ...sales.filter((item) => Number(item.paidAmount || 0) > 0).map((item) => ({
      id: "sale-" + item.id, party_type: "customer", party_id: item.customerId || item.id,
      direction: "received", amount: item.paidAmount, payment_method: item.paymentMethod,
      timestamp: item.timestamp, notes: "Initial receipt against sale " + item.id,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [payments, sales]);

  const money = (value: number) => currency + Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!party) { setMessage("Select a customer or supplier."); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setMessage("Enter an amount greater than zero."); return; }
    const outstanding = kind === "received" ? customerDue(party) : supplierDue(party);
    if (numericAmount > outstanding) { setMessage("The payment cannot exceed the selected party's outstanding balance."); return; }
    setBusy(true);
    setMessage("");
    try {
      if (kind === "received") {
        const { error } = await db.rpc("record_customer_payment", { p_customer_id: party, p_amount: numericAmount, p_method: method, p_notes: note || null });
        if (error) throw error;
      } else {
        const { error } = await db.rpc("record_supplier_payment", { p_supplier_id: party, p_amount: numericAmount, p_method: method, p_notes: note || null });
        if (error) throw error;
      }
      setAmount("");
      setNote("");
      setParty("");
      await load();
      setMessage("Payment recorded successfully. The outstanding invoice balance has been updated.");
    } catch (error: any) {
      setMessage(error.message || "Payment could not be recorded.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-full space-y-6 bg-[#FAF8F5] p-4 text-black md:p-8">
      <header className="flex flex-col gap-2 border-b-4 border-black pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Retail Sync / Financial records</p>
          <h1 className="text-3xl font-black uppercase tracking-tight">Payments & Settlements</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">Manage customer collections and supplier settlements. Each recorded payment is allocated against outstanding invoices.</p>
        </div>
        <span className="w-fit border-2 border-black bg-black px-3 py-2 font-mono text-[10px] font-black uppercase text-white">{isCashier ? "Cashier register" : "Shop owner register"}</span>
      </header>

      {message && <div role="status" className="border-2 border-black bg-amber-100 p-3 text-sm font-bold">{message}</div>}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Money received", value: totalIn, note: "Recorded customer receipts", tone: "bg-[#FFF9E8]" },
          { label: "Money paid", value: totalOut, note: "Recorded supplier settlements", tone: "bg-[#E8F1F8]" },
          { label: "Customer outstanding", value: customerOutstanding, note: "Unpaid customer invoices", tone: "bg-[#F0EDFF]" },
          { label: "Supplier outstanding", value: supplierOutstanding, note: "Unpaid purchase invoices", tone: "bg-[#E7F4EF]" },
        ].map((card) => (
          <div key={card.label} className={`border-2 border-black p-4 shadow-[3px_3px_0_#000] ${card.tone}`}>
            <p className="font-mono text-[10px] font-black uppercase tracking-wider text-zinc-600">{card.label}</p>
            <p className="mt-2 text-2xl font-black tracking-tight">{money(card.value)}</p>
            <p className="mt-1 text-[10px] font-semibold text-zinc-500">{card.note}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="space-y-5 xl:col-span-5">
          <div className="overflow-hidden border-2 border-black bg-white shadow-[4px_4px_0_#000]">
            <div className="border-b-2 border-black bg-black p-4 text-white">
              <h2 className="font-black uppercase">Record a transaction</h2>
              <p className="mt-1 text-xs text-zinc-300">Select the direction, party and payment details.</p>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setKind("received"); setParty(""); setMessage(""); }} className={`border-2 border-black px-3 py-3 text-xs font-black uppercase transition-colors ${kind === "received" ? "bg-[#D63031] text-white shadow-[2px_2px_0_#000]" : "bg-white hover:bg-zinc-100"}`}>Money in · Receive</button>
                <button type="button" onClick={() => { setKind("paid"); setParty(""); setMessage(""); }} className={`border-2 border-black px-3 py-3 text-xs font-black uppercase transition-colors ${kind === "paid" ? "bg-[#D63031] text-white shadow-[2px_2px_0_#000]" : "bg-white hover:bg-zinc-100"}`}>Money out · Pay</button>
              </div>
              <div className="border-l-4 border-[#D63031] bg-[#FAF8F5] p-3">
                <p className="text-xs font-black uppercase">{kind === "received" ? "Customer collection" : "Supplier settlement"}</p>
                <p className="mt-1 text-xs text-zinc-600">{kind === "received" ? "Record money received from a customer against unpaid sales invoices." : "Record money paid to a supplier against unpaid purchase invoices."}</p>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">Select {kind === "received" ? "customer" : "supplier"}</label>
                  <select required className={inputClass} value={party} onChange={(event) => setParty(event.target.value)}>
                    <option value="">{kind === "received" ? "Choose a customer" : "Choose a supplier with outstanding balance"}</option>
                    {parties.map((item) => <option key={item.id} value={item.id}>{item.name} · Due {money(kind === "received" ? customerDue(item.id) : supplierDue(item.id))}</option>)}
                  </select>
                  {party && <p className="mt-1 text-xs font-bold text-zinc-500">Outstanding balance: {money(kind === "received" ? customerDue(party) : supplierDue(party))}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-black uppercase">Amount ({currency})</label>
                    <input required min="0.01" max={party ? (kind === "received" ? customerDue(party) : supplierDue(party)) : undefined} step="0.01" type="number" className={inputClass} placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-black uppercase">Payment method</label>
                    <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value)}>
                      {["Cash", "UPI", "Bank", "Card", "Cheque"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">Reference / notes</label>
                  <input className={inputClass} placeholder="Optional transaction reference" value={note} onChange={(event) => setNote(event.target.value)} />
                </div>
                <button disabled={busy || !parties.length} className="w-full border-2 border-black bg-[#D63031] px-4 py-3 text-xs font-black uppercase text-white shadow-[3px_3px_0_#000] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "PROCESSING…" : kind === "received" ? "RECORD CUSTOMER RECEIPT" : "RECORD SUPPLIER PAYMENT"}</button>
              </form>
              {!parties.length && <p className="border-2 border-dashed border-zinc-300 p-3 text-xs text-zinc-500">{kind === "received" ? "No saved customers are available." : "No suppliers currently have outstanding balances."}</p>}
            </div>
          </div>
          <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000]">
            <h3 className="font-black uppercase">Payment controls</h3>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-600">
              <li>• Customer receipts reduce the oldest outstanding sales invoices first.</li>
              <li>• Supplier payments reduce the oldest outstanding purchase invoices first.</li>
              <li>• Payments above the selected party's outstanding balance are rejected.</li>
              <li>• Each successful transaction is added to the payment register.</li>
            </ul>
          </div>
        </section>

        <section className="overflow-hidden border-2 border-black bg-white shadow-[4px_4px_0_#000] xl:col-span-7">
          <div className="flex flex-col gap-2 bg-black p-4 text-white sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-black uppercase">Payment register</h2><p className="text-xs text-zinc-300">{register.length} transaction records · newest first</p></div>
            <span className="font-mono text-xs font-bold">IN {money(totalIn)} / OUT {money(totalOut)}</span>
          </div>
          <div className="max-h-[900px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-100 font-mono text-[10px] font-black uppercase">
                <tr><th className="p-3">Date</th><th className="p-3">Party</th><th className="p-3">Direction</th><th className="p-3">Method</th><th className="p-3 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {register.map((item) => {
                  const partyName = item.party_type === "customer"
                    ? customers.find((customer) => String(customer.id) === String(item.party_id))?.name
                    : suppliers.find((supplier) => String(supplier.id) === String(item.party_id))?.name;
                  const received = item.direction === "received";
                  return <tr key={item.id} className="border-t border-zinc-200 align-top hover:bg-zinc-50">
                    <td className="whitespace-nowrap p-3 text-xs">{new Date(item.timestamp).toLocaleString("en-IN")}</td>
                    <td className="min-w-[120px] p-3"><span className="font-bold">{partyName || item.party_id || "—"}</span><span className="mt-1 block text-[10px] text-zinc-400">{item.party_type === "customer" ? "Customer" : item.party_type === "supplier" ? "Supplier" : "Sale receipt"}</span></td>
                    <td className="p-3"><span className={`inline-block border px-2 py-1 text-[9px] font-black uppercase ${received ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-red-700 bg-red-50 text-red-800"}`}>{received ? "Received" : "Paid"}</span></td>
                    <td className="p-3 text-xs">{item.payment_method || "—"}</td>
                    <td className={`whitespace-nowrap p-3 text-right font-black ${received ? "text-emerald-700" : "text-[#D63031]"}`}>{received ? "+" : "−"}{money(item.amount)}</td>
                  </tr>;
                })}
                {register.length === 0 && <tr><td colSpan={5} className="p-12 text-center"><p className="font-black uppercase text-zinc-500">No payments recorded yet</p><p className="mt-1 text-xs text-zinc-400">Completed customer receipts and supplier settlements will appear here.</p></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
