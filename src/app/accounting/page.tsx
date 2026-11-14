"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useApp } from "../../context/AppContext";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const INPUT = "w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#0055A5]";
const LABEL = "mb-1 block text-[10px] font-black uppercase tracking-wider text-zinc-700";
const BUTTON = "border-2 border-black px-4 py-2.5 text-xs font-black uppercase shadow-[2px_2px_0_#000] disabled:cursor-not-allowed disabled:opacity-50";
type Party = { id: string; name: string };
type Account = { id: string; code: string; name: string };
type ProductRow = { id: string; name: string; quantity: string; unit_cost: string };
type PartyRow = { id: string; name: string; amount: string };
type General = { cash: string; bank: string; clearing: string; fixedAssets: string; accumulatedDepreciation: string; taxPayable: string; otherLiabilities: string; ownerCapital: string; drawings: string };
const EMPTY_GENERAL: General = { cash: "", bank: "", clearing: "", fixedAssets: "", accumulatedDepreciation: "", taxPayable: "", otherLiabilities: "", ownerCapital: "", drawings: "" };
const n = (v: string) => Math.max(0, Number(v || 0));
const money = (v: number) => "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OpeningBalancesPage() {
  const { currentUser, currentRole, products } = useApp();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [inventory, setInventory] = useState<ProductRow[]>([]);
  const [receivables, setReceivables] = useState<PartyRow[]>([]);
  const [payables, setPayables] = useState<PartyRow[]>([]);
  const [general, setGeneral] = useState<General>(EMPTY_GENERAL);
  const [initialized, setInitialized] = useState(false);
  const [batch, setBatch] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [approveEquity, setApproveEquity] = useState(false);
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setMessage("");
    const [settingsRes, accountRes, batchRes, customerRes, supplierRes] = await Promise.all([
      supabase.from("accounting_settings").select("owner_id,currency_code,books_start_date").eq("owner_id", currentUser.id).maybeSingle(),
      supabase.from("accounts").select("id,code,name").eq("owner_id", currentUser.id).order("code"),
      supabase.from("accounting_opening_balance_batches").select("*").eq("owner_id", currentUser.id).maybeSingle(),
      supabase.from("customers").select("id,name").eq("userId", currentUser.id).order("name"),
      supabase.from("suppliers").select("id,name").eq("userId", currentUser.id).order("name"),
    ]);
    const err = settingsRes.error || accountRes.error || batchRes.error || customerRes.error || supplierRes.error;
    if (err) setMessage(err.message);
    setInitialized(!!settingsRes.data && settingsRes.data.currency_code === "INR" && settingsRes.data.books_start_date === "2026-09-01");
    setAccounts((accountRes.data || []) as Account[]);
    setBatch(batchRes.data || null);
    const customerList = (customerRes.data || []) as Party[];
    const supplierList = (supplierRes.data || []) as Party[];
    setCustomers(customerList); setSuppliers(supplierList);
    setInventory(products.map(p => ({ id: p.id, name: p.name, quantity: "", unit_cost: "" })));
    setReceivables(customerList.map(p => ({ ...p, amount: "" })));
    setPayables(supplierList.map(p => ({ ...p, amount: "" })));
    setLoading(false);
  }, [currentUser, products]);

  useEffect(() => { void load(); }, [load]);

  const accountByCode = useMemo(() => new Map(accounts.map(a => [a.code, a])), [accounts]);
  const inventoryValue = inventory.reduce((s, p) => s + n(p.quantity) * n(p.unit_cost), 0);
  const arValue = receivables.reduce((s, p) => s + n(p.amount), 0);
  const apValue = payables.reduce((s, p) => s + n(p.amount), 0);
  const debitTotal = n(general.cash) + n(general.bank) + n(general.clearing) + n(general.fixedAssets) + inventoryValue + arValue + n(general.drawings);
  const creditTotal = n(general.accumulatedDepreciation) + n(general.taxPayable) + n(general.otherLiabilities) + n(general.ownerCapital) + apValue;
  const equityResidual = debitTotal - creditTotal;
  const linesBalancedWithoutEquity = Math.abs(equityResidual) < 0.0001;

  const updateProduct = (id: string, key: "quantity" | "unit_cost", value: string) =>
    setInventory(rows => rows.map(row => row.id === id ? { ...row, [key]: value } : row));
  const updateParty = (kind: "ar" | "ap", id: string, value: string) =>
    (kind === "ar" ? setReceivables : setPayables)(rows => rows.map(row => row.id === id ? { ...row, amount: value } : row));

  const makeItems = () => {
    const items: any[] = [];
    const addAccount = (code: string, debit: number, credit: number) => {
      if (debit <= 0 && credit <= 0) return;
      items.push({ item_type: "account", account_code: code, debit, credit });
    };
    addAccount("1000", n(general.cash), 0);
    addAccount("1010", n(general.bank), 0);
    addAccount("1020", n(general.clearing), 0);
    addAccount("1500", n(general.fixedAssets), 0);
    addAccount("1590", 0, n(general.accumulatedDepreciation));
    addAccount("2050", 0, n(general.taxPayable));
    addAccount("2100", 0, n(general.otherLiabilities));
    addAccount("3000", 0, n(general.ownerCapital));
    addAccount("3100", n(general.drawings), 0);
    inventory.filter(p => n(p.quantity) > 0 || n(p.unit_cost) > 0).forEach(p => items.push({
      item_type: "inventory", reference_id: p.id, quantity: n(p.quantity), unit_cost: n(p.unit_cost),
      debit: Number((n(p.quantity) * n(p.unit_cost)).toFixed(4)), credit: 0, memo: "Verified opening stock at 2026-08-31"
    }));
    receivables.filter(p => n(p.amount) > 0).forEach(p => items.push({
      item_type: "customer_receivable", reference_id: p.id, debit: n(p.amount), credit: 0, memo: "Opening customer balance at 2026-08-31"
    }));
    payables.filter(p => n(p.amount) > 0).forEach(p => items.push({
      item_type: "supplier_payable", reference_id: p.id, debit: 0, credit: n(p.amount), memo: "Opening supplier balance at 2026-08-31"
    }));
    const residual = Number((debitTotal - creditTotal).toFixed(4));
    if (residual > 0) addAccount("3900", 0, residual);
    if (residual < 0) addAccount("3900", Math.abs(residual), 0);
    return items;
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await action(); }
    catch (error: any) { setMessage(error?.message || "The operation failed."); }
    finally { setBusy(false); }
  };

  const initialize = () => run(async () => {
    const { error } = await supabase.rpc("initialize_accounting", {
      p_currency_code: "INR", p_books_start_date: "2026-09-01"
    });
    if (error) throw error;
    await load();
    setMessage("INR accounting initialized for 1 September 2026.");
  });

  const saveAndValidate = () => run(async () => {
    if (Math.abs(equityResidual) > 0.0001 && !approveEquity) throw new Error("Review and explicitly approve the Opening Balance Equity difference before continuing.");
    if (!makeItems().length || makeItems().length < 2) throw new Error("Enter at least two opening balance lines.");
    const { data: batchId, error: createError } = await supabase.rpc("create_accounting_opening_balance_batch", {
      p_notes: notes || "Owner-entered opening balances as at 31 August 2026",
      p_items: makeItems()
    });
    if (createError) throw createError;
    const { data, error } = await supabase.rpc("validate_accounting_opening_balance_batch", { p_batch_id: batchId });
    if (error) throw error;
    setValidation(data); await load();
    setMessage("Opening balances saved and validated. Review the reconciliation totals before posting.");
  });

  const discardDraft = () => run(async () => {
    if (!batch?.id || batch.status === "posted") throw new Error("Only an unposted draft can be discarded.");
    if (!window.confirm("Discard this unposted opening-balance draft? You can then correct the figures and create a new draft.")) return;
    const { error } = await supabase.rpc("discard_accounting_opening_balance_draft", { p_batch_id: batch.id });
    if (error) throw error;
    setBatch(null); setValidation(null); setApproveEquity(false);
    setMessage("Unposted draft discarded. You can now correct the opening balances.");
    await load();
  });

  const post = () => run(async () => {
    if (!batch?.id || batch.status !== "validated") throw new Error("Only a validated opening balance batch can be posted.");
    if (!window.confirm("Post the 31 August 2026 opening balances to the immutable accounting journal? This cannot be edited; corrections require reversal entries.")) return;
    const { data, error } = await supabase.rpc("post_accounting_opening_balance_batch", { p_batch_id: batch.id });
    if (error) throw error;
    setMessage("Opening journal posted: " + data);
    await load();
  });

  if (currentRole !== "admin") return <div className="p-8 text-sm font-bold">Only the shop owner can manage opening balances.</div>;

  return (
    <div className="min-h-full bg-[#FAF8F5] p-4 md:p-8 text-black">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b-4 border-black pb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D63031]">Phase 2 · Central accounting</p>
          <h1 className="mt-1 text-2xl md:text-3xl font-black uppercase">Opening balances</h1>
          <p className="mt-2 text-sm font-bold text-zinc-600">Enter the verified closing position as at 31 August 2026. These figures establish the opening position for books beginning 1 September 2026.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase">
            <span className="border-2 border-black bg-[#FFC300] px-2 py-1">Currency: INR</span>
            <span className="border-2 border-black bg-white px-2 py-1">Snapshot: 31 Aug 2026</span>
            <span className="border-2 border-black bg-white px-2 py-1">Books start: 1 Sep 2026</span>
          </div>
        </header>

        {message && <div className="border-2 border-black bg-amber-50 p-3 text-sm font-bold">{message}</div>}
        {loading ? <div className="border-2 border-black bg-white p-6 font-bold">Loading accounting setup…</div> :
          !initialized ? (
            <section className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000]">
              <h2 className="font-black uppercase">Initialize accounting</h2>
              <p className="mt-2 text-sm text-zinc-600">This creates the INR chart of accounts and fixes the accounting start date. It does not post opening balances or alter sales, purchases, stock, cash or bank records.</p>
              <button disabled={busy} onClick={initialize} className={BUTTON + " mt-4 bg-[#FFC300]"}>{busy ? "Please wait…" : "Initialize INR accounting"}</button>
              <p className="mt-3 text-xs text-zinc-500">Requires the Phase 2A ledger migration to have been installed first.</p>
            </section>
          ) : batch?.status === "posted" ? (
            <section className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000]">
              <h2 className="font-black uppercase text-emerald-700">Opening balances posted</h2>
              <p className="mt-2 text-sm">Journal entry: <strong>{batch.journal_entry_id}</strong></p>
              <p className="text-xs text-zinc-500 mt-1">The posted opening journal is immutable. Corrections require a reversal.</p>
            </section>
          ) : batch ? (
            <section className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000] space-y-3">
              <h2 className="font-black uppercase">Saved opening batch</h2>
              <p className="text-sm">Status: <strong className="uppercase">{batch.status}</strong></p>
              {validation && <pre className="overflow-auto bg-zinc-100 p-3 text-xs">{JSON.stringify(validation, null, 2)}</pre>}
              {batch.status === "validated" && <button disabled={busy} onClick={post} className={BUTTON + " bg-[#FFC300]"}>{busy ? "Posting…" : "Post opening journal"}</button>}
              {batch.status !== "posted" && <button disabled={busy} onClick={discardDraft} className={BUTTON + " bg-white"}>Discard unposted draft and correct</button>}
              <p className="text-xs text-zinc-500">A saved draft cannot be edited in place. You can safely discard an unposted draft and enter corrected figures. Posted journals cannot be deleted.</p>
            </section>
          ) : (
            <>
              <section className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="font-black uppercase">1. Cash, bank and balance sheet</h2><p className="text-xs text-zinc-500 mt-1">Use statement/count balances at 31 August, not current balances.</p></div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {([
                    ["cash","Cash on hand (₹)"],["bank","Bank balance (₹)"],["clearing","UPI / card / cheque in transit (₹)"],
                    ["fixedAssets","Fixed assets (₹)"],["accumulatedDepreciation","Accumulated depreciation (₹)"],
                    ["taxPayable","Tax payable (₹)"],["otherLiabilities","Other liabilities (₹)"],
                    ["ownerCapital","Verified owner capital (₹)"],["drawings","Owner drawings balance (₹)"]
                  ] as [keyof General,string][]).map(([key,label]) => <label key={key}><span className={LABEL}>{label}</span><input className={INPUT} type="number" min="0" step="0.01" value={general[key]} onChange={e=>setGeneral(g=>({...g,[key]:e.target.value}))} placeholder="0.00" /></label>)}
                </div>
              </section>

              <section className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000]">
                <h2 className="font-black uppercase">2. Inventory at 31 August</h2>
                <p className="mt-1 text-xs text-zinc-500">Enter verified stock quantity in base units and verified historical cost per base unit. Current stock quantity and purchase price are not copied into this snapshot.</p>
                <div className="mt-3 space-y-2">
                  {inventory.map(p=><div key={p.id} className="grid grid-cols-1 gap-2 border-b border-zinc-200 pb-2 sm:grid-cols-[1fr_150px_170px_150px] sm:items-center">
                    <span className="text-sm font-bold">{p.name}</span>
                    <input className={INPUT} type="number" min="0" step="0.0001" placeholder="Base quantity" value={p.quantity} onChange={e=>updateProduct(p.id,"quantity",e.target.value)} />
                    <input className={INPUT} type="number" min="0" step="0.0001" placeholder="Cost / base unit ₹" value={p.unit_cost} onChange={e=>updateProduct(p.id,"unit_cost",e.target.value)} />
                    <span className="text-sm font-black sm:text-right">{money(n(p.quantity)*n(p.unit_cost))}</span>
                  </div>)}
                  {!inventory.length && <p className="text-sm text-zinc-500">No products found for this shop.</p>}
                </div>
                <div className="mt-3 text-right text-sm font-black">Inventory total: {money(inventoryValue)}</div>
              </section>

              <section className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000]">
                <h2 className="font-black uppercase">3. Customer outstanding balances</h2>
                <p className="mt-1 text-xs text-zinc-500">Enter each customer's unpaid invoices as at 31 August.</p>
                <div className="mt-3 space-y-2">{receivables.map(p=><div key={p.id} className="grid grid-cols-[1fr_180px] items-center gap-2 border-b border-zinc-200 pb-2"><span className="text-sm font-bold">{p.name}</span><input className={INPUT} type="number" min="0" step="0.01" placeholder="Due ₹" value={p.amount} onChange={e=>updateParty("ar",p.id,e.target.value)} /></div>)}</div>
                <div className="mt-3 text-right text-sm font-black">Receivables total: {money(arValue)}</div>
              </section>

              <section className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000]">
                <h2 className="font-black uppercase">4. Supplier outstanding balances</h2>
                <p className="mt-1 text-xs text-zinc-500">Enter unpaid supplier invoices as at 31 August.</p>
                <div className="mt-3 space-y-2">{payables.map(p=><div key={p.id} className="grid grid-cols-[1fr_180px] items-center gap-2 border-b border-zinc-200 pb-2"><span className="text-sm font-bold">{p.name}</span><input className={INPUT} type="number" min="0" step="0.01" placeholder="Due ₹" value={p.amount} onChange={e=>updateParty("ap",p.id,e.target.value)} /></div>)}</div>
                <div className="mt-3 text-right text-sm font-black">Payables total: {money(apValue)}</div>
              </section>

              <section className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000]">
                <h2 className="font-black uppercase">5. Balance and review</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="bg-zinc-100 p-3"><p className={LABEL}>Debits before opening equity</p><p className="text-lg font-black">{money(debitTotal)}</p></div>
                  <div className="bg-zinc-100 p-3"><p className={LABEL}>Credits before opening equity</p><p className="text-lg font-black">{money(creditTotal)}</p></div>
                  <div className="bg-[#FFC300] border-2 border-black p-3"><p className={LABEL}>Opening equity difference</p><p className="text-lg font-black">{money(Math.abs(equityResidual))}</p><p className="text-[10px] font-bold">{linesBalancedWithoutEquity ? "No difference" : equityResidual > 0 ? "Proposed credit to opening balance equity" : "Proposed debit to opening balance equity"}</p></div>
                </div>
                {!linesBalancedWithoutEquity && <label className="mt-4 flex items-start gap-2 text-xs font-bold"><input type="checkbox" checked={approveEquity} onChange={e=>setApproveEquity(e.target.checked)} className="mt-0.5" /><span>I have reviewed this unexplained difference and authorize it to be recorded temporarily in Opening Balance Equity. This is not owner capital or profit.</span></label>}
                <label className="mt-4 block"><span className={LABEL}>Evidence / reconciliation notes</span><textarea className={INPUT+" min-h-20"} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Record cash count, bank statement date, inventory valuation basis and supporting references…" /></label>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button disabled={busy} onClick={()=>void load()} className={BUTTON+" bg-white"}>Refresh data</button>
                  <button disabled={busy || (!linesBalancedWithoutEquity && !approveEquity)} onClick={saveAndValidate} className={BUTTON+" bg-[#FFC300]"}>{busy ? "Validating…" : "Save and validate opening balances"}</button>
                </div>
              </section>
            </>
          )}
        }
      </div>
    </div>
  );
}
