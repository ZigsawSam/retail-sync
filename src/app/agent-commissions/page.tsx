"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";

export default function AgentCommissionsPage() {
  const { commissionLedger = [], commissionAgents = [], currency, handleRecordAgentCommissionPayment } = useApp();
  const [agentPhone, setAgentPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const summaries = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; earned: number; paid: number; due: number }>();
    commissionLedger.forEach((row: any) => {
      const key = row.agent_phone;
      const item = map.get(key) || { name: row.agent_name, phone: key, earned: 0, paid: 0, due: 0 };
      item.earned += Number(row.commission_amount || 0);
      item.paid += Number(row.paid_amount || 0);
      item.due += Number(row.commission_amount || 0) - Number(row.paid_amount || 0);
      map.set(key, item);
    });
    commissionAgents.forEach((agent: any) => {
      if (!map.has(agent.phone)) map.set(agent.phone, { name: agent.name, phone: agent.phone, earned: 0, paid: 0, due: 0 });
    });
    return [...map.values()].sort((a, b) => b.due - a.due);
  }, [commissionLedger, commissionAgents]);

  const selected = summaries.find((a) => a.phone === agentPhone);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      await handleRecordAgentCommissionPayment(agentPhone, Number(amount), method, notes);
      setMessage("Agent payment recorded and allocated to outstanding commissions.");
      setAmount("");
      setNotes("");
    } catch (error: any) {
      setMessage(error?.message || "Payment could not be recorded.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-6 md:p-8 text-black">
      <div className="mb-6 border-b-3 border-black pb-5">
        <h1 className="text-2xl font-black uppercase">Agent Commission Ledger</h1>
        <p className="mt-1 text-xs font-bold font-mono text-zinc-600">Commission earned from completed sales, payouts recorded against the oldest outstanding entries.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {[
          ["Earned", summaries.reduce((s,a)=>s+a.earned,0)],
          ["Paid", summaries.reduce((s,a)=>s+a.paid,0)],
          ["Outstanding", summaries.reduce((s,a)=>s+a.due,0)]
        ].map(([label,value]) => <div key={String(label)} className="bg-white border-2 border-black p-4 shadow-[3px_3px_0_#000]">
          <p className="text-[10px] font-black uppercase text-zinc-500">{label}</p>
          <p className="text-xl font-black font-mono mt-1">{currency}{Number(value).toFixed(2)}</p>
        </div>)}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="bg-white border-2 border-black p-4 overflow-x-auto">
          <h2 className="font-black uppercase border-b-2 border-black pb-3 mb-3">Agent Balances</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[10px] uppercase border-b border-zinc-300"><th className="py-2">Agent</th><th className="py-2 text-right">Earned</th><th className="py-2 text-right">Paid</th><th className="py-2 text-right">Due</th></tr></thead>
            <tbody>{summaries.map((a) => <tr key={a.phone} className="border-b border-zinc-100">
              <td className="py-3"><div className="font-bold">{a.name}</div><div className="text-[10px] text-zinc-500">{a.phone}</div></td>
              <td className="text-right font-mono">{currency}{a.earned.toFixed(2)}</td>
              <td className="text-right font-mono">{currency}{a.paid.toFixed(2)}</td>
              <td className="text-right font-mono font-black">{currency}{a.due.toFixed(2)}</td>
            </tr>)}
            {summaries.length===0 && <tr><td colSpan={4} className="py-8 text-center text-zinc-500">No agent commissions recorded yet.</td></tr>}</tbody>
          </table>
        </section>
        <form onSubmit={submit} className="bg-white border-2 border-black p-4 h-fit space-y-3">
          <h2 className="font-black uppercase border-b-2 border-black pb-3">Record Agent Payout</h2>
          <label className="block text-xs font-bold">Agent
            <select required value={agentPhone} onChange={e=>setAgentPhone(e.target.value)} className="mt-1 w-full border-2 border-black p-2 text-sm">
              <option value="">Select agent</option>
              {summaries.filter(a=>a.due>0).map(a=><option key={a.phone} value={a.phone}>{a.name} — {a.phone} (Due {currency}{a.due.toFixed(2)})</option>)}
            </select>
          </label>
          {selected && <p className="text-xs font-bold">Outstanding: {currency}{selected.due.toFixed(2)}</p>}
          <label className="block text-xs font-bold">Amount
            <input required type="number" min="0.01" step="0.01" max={selected?.due || undefined} value={amount} onChange={e=>setAmount(e.target.value)} className="mt-1 w-full border-2 border-black p-2 text-sm" />
          </label>
          <label className="block text-xs font-bold">Payment method
            <select value={method} onChange={e=>setMethod(e.target.value)} className="mt-1 w-full border-2 border-black p-2 text-sm">
              {["Cash","UPI","Bank Transfer","Cheque","Card"].map(m=><option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold">Notes
            <input value={notes} onChange={e=>setNotes(e.target.value)} className="mt-1 w-full border-2 border-black p-2 text-sm" placeholder="Optional reference" />
          </label>
          <button disabled={saving || !selected || Number(amount)<=0 || Number(amount)> (selected?.due||0)} className="w-full bg-[#FFC300] border-2 border-black p-3 text-xs font-black uppercase disabled:opacity-50">{saving?"Recording…":"Record payout"}</button>
          {message && <p className="text-xs font-bold">{message}</p>}
        </form>
      </div>
      <section className="mt-6 bg-white border-2 border-black p-4 overflow-x-auto">
        <h2 className="font-black uppercase border-b-2 border-black pb-3 mb-3">Commission Entries</h2>
        <table className="w-full text-xs">
          <thead><tr className="text-left uppercase border-b border-zinc-300"><th className="py-2">Sale ID</th><th>Agent</th><th className="text-right">Commission</th><th className="text-right">Paid</th><th className="text-right">Status</th><th className="text-right">Date</th></tr></thead>
          <tbody>{commissionLedger.map((row:any)=><tr key={row.id} className="border-b border-zinc-100"><td className="py-2 font-mono">{row.sale_id}</td><td>{row.agent_name}</td><td className="text-right font-mono">{currency}{Number(row.commission_amount).toFixed(2)}</td><td className="text-right font-mono">{currency}{Number(row.paid_amount).toFixed(2)}</td><td className="text-right uppercase font-bold">{row.status}</td><td className="text-right">{new Date(row.created_at).toLocaleDateString()}</td></tr>)}
          {commissionLedger.length===0 && <tr><td colSpan={6} className="py-6 text-center text-zinc-500">No commission entries yet.</td></tr>}</tbody>
        </table>
      </section>
    </div>
  );
}
