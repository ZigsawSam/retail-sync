"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext";
import { Expense } from "../types";
import { isToday, getShopLocalISOString } from "../lib/dateUtils";

const todayInput = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const paymentMethods = ["Cash", "UPI", "Cheque", "Card", "Bank"];

export default function ExpensesRegisterPage() {
  const { expenses, currency, handleAddExpense, handleUpdateExpense, handleDeleteExpense, staffSession, settings } = useApp();
  const isCashier = staffSession?.role === "cashier";
  const categories = (settings.expenseCategories || []).map((item) => item.name).filter(Boolean);
  const [category, setCategory] = useState(categories[0] || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState(todayInput);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerAmount, setDrawerAmount] = useState("");
  const [drawerReason, setDrawerReason] = useState("");
  const [drawerAction, setDrawerAction] = useState<"add" | "withdraw">("add");

  useEffect(() => {
    if (categories.length && !categories.includes(category)) setCategory(categories[0]);
    if (!categories.length) setCategory("");
  }, [categories.join("|"), category]);

  const money = (value: number) => currency + Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const todayExpenses = useMemo(() => expenses.filter((item) => isToday(item.timestamp)), [expenses]);
  const summary = useMemo(() => paymentMethods.map((paymentMethod) => ({
    paymentMethod,
    total: todayExpenses.filter((item) => (item.paymentMethod || "Cash") === paymentMethod && !["Drawer Cash Addition", "Drawer Cash Withdrawal"].includes(item.category))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
  })), [todayExpenses]);

  const resetForm = () => {
    setEditingId(null);
    setCategory(categories[0] || "");
    setAmount("");
    setDescription("");
    setMethod("Cash");
    setDate(todayInput());
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categories.length) {
      setMessage("Add at least one expense category in Settings → Business Type & Categories before recording an expense.");
      return;
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (editingId) {
        await handleUpdateExpense(editingId, { category, amount: numericAmount, description: description.trim(), paymentMethod: method, timestamp: new Date(date + "T12:00:00").toISOString() });
        setMessage("Expense updated successfully.");
      } else {
        await handleAddExpense({ category, amount: numericAmount, description: description.trim(), paymentMethod: method, timestamp: new Date(date + "T12:00:00").toISOString() } as any);
        setMessage("Expense recorded successfully.");
      }
      resetForm();
    } catch (error: any) {
      setMessage(error?.message || "Could not save the expense.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setCategory(categories.includes(expense.category) ? expense.category : (categories[0] || ""));
    setAmount(String(expense.amount));
    setDescription(expense.description || "");
    setMethod(expense.paymentMethod || "Cash");
    const parsed = new Date(expense.timestamp);
    setDate(Number.isNaN(parsed.getTime()) ? todayInput() : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitDrawerAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(drawerAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !drawerReason.trim()) {
      setMessage("Enter a valid drawer amount and reason.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await handleAddExpense({
        category: drawerAction === "add" ? "Drawer Cash Addition" : "Drawer Cash Withdrawal",
        amount: drawerAction === "add" ? -numericAmount : numericAmount,
        description: drawerReason.trim(),
        paymentMethod: "Cash",
        timestamp: getShopLocalISOString(),
      } as any);
      setDrawerAmount("");
      setDrawerReason("");
      setMessage(drawerAction === "add" ? "Cash added to the drawer." : "Cash withdrawal recorded.");
    } catch (error: any) {
      setMessage(error?.message || "Drawer adjustment could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm("Delete this expense record? This cannot be undone.")) return;
    setBusy(true);
    try {
      await handleDeleteExpense(id);
      if (editingId === id) resetForm();
      setMessage("Expense deleted.");
    } catch (error: any) {
      setMessage(error?.message || "Could not delete the expense.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full w-full bg-[#FAF8F5] p-4 text-black md:p-8 space-y-6">
      <header className="flex flex-col gap-2 border-b-4 border-black pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Retail Sync / Financial records</p>
          <h1 className="text-3xl font-black uppercase tracking-tight">Expenses & Cash Book</h1>
          <p className="mt-1 text-sm text-zinc-600">Record operating expenses, review the complete ledger and reconcile drawer movements.</p>
        </div>
        <span className="w-fit border-2 border-black bg-black px-3 py-2 font-mono text-[10px] font-black uppercase text-white">{isCashier ? "Cashier register" : "Shop owner register"}</span>
      </header>

      {message && <div role="status" className="border-2 border-black bg-amber-100 p-3 text-sm font-bold">{message}</div>}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {summary.map(({ paymentMethod, total }) => (
          <div key={paymentMethod} className="border-2 border-black bg-white p-4 shadow-[3px_3px_0_#000]">
            <p className="font-mono text-[10px] font-black uppercase tracking-wider text-zinc-500">{paymentMethod} expenses · today</p>
            <p className="mt-2 text-xl font-black">{money(total)}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-5">
          <section className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_#000]">
            <div className="mb-4 border-b-2 border-black pb-3">
              <h2 className="text-lg font-black uppercase">{editingId ? "Edit expense" : "Record an expense"}</h2>
              <p className="text-xs text-zinc-500">{isCashier ? "New expenses can be recorded. Existing entries are view-only." : "Record, edit and manage shop operating expenses."}</p>
            </div>
            {!categories.length ? (
              <div className="border-2 border-dashed border-zinc-400 bg-zinc-50 p-4 text-sm text-zinc-700">
                No expense categories are configured. Add categories in <strong>Settings → Business Type & Categories → Expense Categories</strong>, then save settings.
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">Transaction date</label>
                  <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="w-full border-2 border-black bg-white px-3 py-3 text-sm font-bold" />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">Expense category</label>
                  <select required value={category} onChange={(event) => setCategory(event.target.value)} className="w-full border-2 border-black bg-white px-3 py-3 text-sm font-bold">
                    {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-black uppercase">Amount ({currency})</label>
                    <input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="w-full border-2 border-black px-3 py-3 text-sm font-bold" />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] font-black uppercase">Payment method</label>
                    <select value={method} onChange={(event) => setMethod(event.target.value)} className="w-full border-2 border-black bg-white px-3 py-3 text-sm font-bold">
                      {paymentMethods.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] font-black uppercase">Description</label>
                  <input required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What was this expense for?" className="w-full border-2 border-black px-3 py-3 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button disabled={busy} className="flex-1 border-2 border-black bg-[#D63031] px-4 py-3 text-xs font-black uppercase text-white shadow-[3px_3px_0_#000] disabled:opacity-50">{busy ? "SAVING…" : editingId ? "UPDATE EXPENSE" : "SAVE EXPENSE"}</button>
                  {editingId && <button type="button" onClick={resetForm} className="border-2 border-black px-4 py-3 text-xs font-black uppercase">Cancel</button>}
                </div>
              </form>
            )}
          </section>

          <section className="border-2 border-black bg-[#FFF9E8] p-5 shadow-[4px_4px_0_#000]">
            <h2 className="text-lg font-black uppercase">Cash drawer movement</h2>
            <p className="mb-4 text-xs text-zinc-600">Record cash added to the drawer or cash removed from it. These entries are tracked separately from operating expenses.</p>
            <form onSubmit={submitDrawerAdjustment} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDrawerAction("add")} className={`border-2 border-black px-3 py-2 text-xs font-black uppercase ${drawerAction === "add" ? "bg-emerald-200" : "bg-white"}`}>Cash in (+)</button>
                <button type="button" onClick={() => setDrawerAction("withdraw")} className={`border-2 border-black px-3 py-2 text-xs font-black uppercase ${drawerAction === "withdraw" ? "bg-red-100" : "bg-white"}`}>Cash out (−)</button>
              </div>
              <input required type="number" min="0.01" step="0.01" value={drawerAmount} onChange={(event) => setDrawerAmount(event.target.value)} placeholder="Amount" className="w-full border-2 border-black bg-white px-3 py-3 text-sm font-bold" />
              <input required value={drawerReason} onChange={(event) => setDrawerReason(event.target.value)} placeholder="Reason / reference" className="w-full border-2 border-black bg-white px-3 py-3 text-sm" />
              <button disabled={busy} className="w-full border-2 border-black bg-black px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-50">{busy ? "SAVING…" : "SAVE DRAWER ADJUSTMENT"}</button>
            </form>
          </section>
        </div>

        <section className="overflow-hidden border-2 border-black bg-white shadow-[4px_4px_0_#000] xl:col-span-7">
          <div className="flex flex-col gap-2 bg-black p-4 text-white sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-black uppercase">Expense register</h2><p className="text-xs text-zinc-300">{expenses.length} total records · newest first</p></div>
            <span className="font-mono text-xs font-bold">TODAY: {todayExpenses.length}</span>
          </div>
          <div className="max-h-[850px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-100 text-[10px] font-black uppercase">
                <tr><th className="p-3">Date</th><th className="p-3">Category / description</th><th className="p-3">Method</th><th className="p-3 text-right">Amount</th>{!isCashier && <th className="p-3">Actions</th>}</tr>
              </thead>
              <tbody>
                {[...expenses].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((item) => {
                  const isDrawer = item.category === "Drawer Cash Addition" || item.category === "Drawer Cash Withdrawal";
                  return <tr key={item.id} className="border-t border-zinc-200 align-top hover:bg-zinc-50">
                    <td className="whitespace-nowrap p-3 text-xs">{new Date(item.timestamp).toLocaleDateString("en-IN")}</td>
                    <td className="min-w-[180px] p-3"><span className="font-bold">{item.category === "Drawer Cash Addition" ? "Cash in (float)" : item.category === "Drawer Cash Withdrawal" ? "Cash out (drop)" : item.category}</span><p className="mt-1 text-xs text-zinc-500">{item.description}</p>{item.loggedByName && <p className="mt-1 text-[10px] text-zinc-400">Recorded by {item.loggedByName}</p>}</td>
                    <td className="p-3 text-xs">{item.paymentMethod || "Cash"}{isDrawer && <span className="block text-[10px] text-zinc-400">Drawer</span>}</td>
                    <td className={`whitespace-nowrap p-3 text-right font-black ${item.amount < 0 ? "text-emerald-700" : "text-black"}`}>{money(Math.abs(item.amount))}</td>
                    {!isCashier && <td className="whitespace-nowrap p-3"><div className="flex gap-2"><button type="button" onClick={() => startEdit(item)} className="text-xs font-bold underline">Edit</button><button type="button" disabled={busy} onClick={() => void deleteExpense(item.id)} className="text-xs font-bold text-red-700 underline disabled:opacity-50">Delete</button></div></td>}
                  </tr>;
                })}
                {expenses.length === 0 && <tr><td colSpan={isCashier ? 4 : 5} className="p-10 text-center text-sm text-zinc-500">No expense records yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
