"use client";

import React, { useEffect, useState } from "react";
import { getSupabaseClient } from "../lib/supabase";
import type { StoreSettings, Product, Staff, StaffLogin } from "../types";


interface SettingsPageProps {
  settings: StoreSettings;
  onUpdateSettings: (updates: Partial<StoreSettings>) => Promise<void>;
  onResetDatabase: () => Promise<void>;
  products: Product[];
  staff: Staff[];
  staffLogins: StaffLogin[];
  currentUser: any;
  onRefresh: () => void;
}

export default function SettingsPage({
  settings,
  onUpdateSettings,
  onResetDatabase,
  products,
  staff,
  staffLogins,
  currentUser,
  onRefresh,
}: SettingsPageProps) {
  const [shopName, setShopName] = useState(settings.shopName);
  const [shopCategory, setShopCategory] = useState(settings.shopCategory || "");
  const [shopSubcategory, setShopSubcategory] = useState(settings.shopSubcategory || "");
  const [productCategories, setProductCategories] = useState(settings.productCategories || []);
  const [expenseCategories, setExpenseCategories] = useState(settings.expenseCategories || []);
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newProductSubcategory, setNewProductSubcategory] = useState("");
  const [selectedProductCategory, setSelectedProductCategory] = useState("");
  const [newExpenseCategory, setNewExpenseCategory] = useState("");
  const [newExpenseSubcategory, setNewExpenseSubcategory] = useState("");
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState("");
  const [taxRate, setTaxRate] = useState(settings.taxRate);
  const [currency, setCurrency] = useState(settings.currency);
  const [startingBalance, setStartingBalance] = useState(settings.startingBalance);
  const [theme, setTheme] = useState(settings.theme || "enterprise");
  const [ownerPassword, setOwnerPassword] = useState(settings.ownerPassword || "");
  const [quickAddIds, setQuickAddIds] = useState<string[]>(settings.quickAddProductIds || []);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Staff terminal access form
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [terminalRole, setTerminalRole] = useState<"cashier" | "inventory_manager">("cashier");
  const [terminalEmail, setTerminalEmail] = useState("");
  const [isOnboarding, setIsOnboarding] = useState(false);

  // Settings are fetched asynchronously after authentication; keep the form in sync.
  useEffect(() => {
    setShopName(settings.shopName || "");
    setShopCategory(settings.shopCategory || "");
    setShopSubcategory(settings.shopSubcategory || "");
    setProductCategories(settings.productCategories || []);
    setExpenseCategories(settings.expenseCategories || []);
    setTaxRate(settings.taxRate ?? 5);
    setCurrency(settings.currency || "Rs");
    setStartingBalance(settings.startingBalance ?? 0);
    setTheme(settings.theme || "enterprise");
    setOwnerPassword(settings.ownerPassword || "");
    setQuickAddIds(settings.quickAddProductIds || []);
  }, [settings]);

  const activeLogins = staffLogins.filter((l) => l.isActive);
  const terminatedLogins = staffLogins.filter((l) => !l.isActive);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      await onUpdateSettings({
        shopName,
        shopCategory,
        shopSubcategory,
        productCategories,
        expenseCategories,
        taxRate,
        currency,
        startingBalance,
        theme,
        ownerPassword: ownerPassword || undefined,
        quickAddProductIds: quickAddIds,
      });
      setMessage("Settings saved successfully!");
    } catch (err: any) {
      setMessage("Error: " + err.message);
    }
    setIsSaving(false);
  };

  const handleAssignTerminalAccess = async () => {
    if (!selectedStaffId || !terminalEmail.trim()) {
      setMessage("Select a staff member and enter their real email address.");
      return;
    }
    const client = getSupabaseClient();
    if (!client || !currentUser) {
      setMessage("Owner session is unavailable. Please sign in again.");
      return;
    }
    setIsOnboarding(true);
    setMessage("");
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) throw new Error("Your owner session has expired. Please sign in again.");
      const response = await fetch("/api/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ staffId: selectedStaffId, email: terminalEmail.trim(), role: terminalRole }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send staff invitation.");
      setMessage(result.message || `Invitation sent to ${terminalEmail.trim()}.`);
      setSelectedStaffId("");
      setTerminalEmail("");
      onRefresh();
    } catch (err: any) {
      setMessage("Error: " + (err?.message || "Unable to invite staff."));
    } finally {
      setIsOnboarding(false);
    }
  };

  const handleTerminate = async (loginId: string) => {
    if (!confirm("Terminate this staff's terminal access? They will lose access to this shop.")) return;
    const client = getSupabaseClient();
    if (!client) { setMessage("Supabase connection is unavailable."); return; }
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) throw new Error("Your owner session has expired. Please sign in again.");
      const response = await fetch("/api/staff/terminate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ loginId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to terminate staff access.");
      setMessage(result.message || "Staff access deactivated.");
      onRefresh();
    } catch (err: any) {
      setMessage("Error: " + (err?.message || "Unable to terminate staff access."));
    }
  };
  const handleReset = async () => {
    if (!confirm("WARNING: This will delete ALL data. Are you sure?")) return;
    if (!confirm("Really sure? This cannot be undone.")) return;
    try {
      await onResetDatabase();
      setMessage("Database reset complete");
    } catch (err: any) {
      setMessage("Error: " + err.message);
    }
  };

  const availableStaff = staff.filter(
    (s) => !s.archived_at && !activeLogins.some((l) => l.staffId === s.id)
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-8 space-y-6 text-black">
      <div className="flex flex-col gap-1 border-b-2 border-black pb-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 font-mono">Retail Sync / Workspace configuration</p><h1 className="text-3xl font-black uppercase tracking-tight text-black">Settings</h1><p className="text-sm text-zinc-600">Manage your store profile, application appearance and staff access.</p></div>

      {message && (
        <div className={`p-3 rounded ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* Global Appearance */}
      <section className="rounded-none border-2 border-black bg-white p-5 md:p-6 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 font-mono">Application-wide preference</p>
          <h2 className="text-lg font-black uppercase tracking-tight text-black">Appearance & Theme</h2>
          <p className="text-sm text-zinc-600">Choose the visual theme for the entire Retail Sync workspace, including Dashboard, Sales, Operations, Insights, Staff and Settings.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4 items-end">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-black font-mono">Workspace theme</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className="w-full border-2 border-black rounded-none bg-white px-3 py-3 text-sm font-bold text-black outline-none focus:ring-2 focus:ring-yellow-400"
            >
              <option value="enterprise">Enterprise</option>
              <option value="bauhaus">Bauhaus</option>
              <option value="glassmorphism">Glassmorphism</option>
              <option value="neumorphism">Neumorphism</option>
              <option value="neo-brutalism">Neo-Brutalism</option>
              <option value="kitsch">Kitsch</option>
              <option value="dark">Dark</option>
              <option value="material">Material</option>
            </select>
          </div>
          <p className="text-xs leading-relaxed text-zinc-600">Your selection is applied across the whole app after you click <strong>Save Settings</strong> below. It is stored with your shop preferences.</p>
        </div>
      </section>

      {/* Shop type and owner-managed categories */}
      <section className="rounded-none border-2 border-black bg-white p-5 md:p-6 space-y-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight text-black">Business Type & Categories</h2>
          <p className="text-sm text-zinc-600">These settings belong to this shop only. Only the shop owner can change category lists.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase mb-2">Shop Category</label>
            <select value={shopCategory} onChange={(e) => { setShopCategory(e.target.value); setShopSubcategory(""); }} className="w-full border-2 border-black bg-white px-3 py-2 text-sm">
              <option value="">Select business type</option>
              {["Grocery & Convenience","Fashion & Apparel","Electronics","Pharmacy & Healthcare","Hardware & Building Supplies","Home & Furniture","Beauty & Personal Care","Restaurant & Food Service","Stationery & Books","General Retail","Other"].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase mb-2">Shop Subcategory</label>
            <input value={shopSubcategory} onChange={(e) => setShopSubcategory(e.target.value)} placeholder="e.g. Supermarket, Kirana, Mobile Store" className="w-full border-2 border-black px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-3 border-2 border-black p-4">
            <h3 className="font-black uppercase text-sm">Product Categories</h3>
            <div className="flex gap-2">
              <input value={newProductCategory} onChange={e => setNewProductCategory(e.target.value)} placeholder="New category" className="min-w-0 flex-1 border-2 border-black px-2 py-2 text-sm" />
              <button type="button" onClick={() => { const name=newProductCategory.trim(); if(name && !productCategories.some((x:any)=>x.name.toLowerCase()===name.toLowerCase())) setProductCategories([...productCategories,{name,subcategories:[]}]); setNewProductCategory(""); }} className="border-2 border-black bg-[#FFC300] px-3 text-xs font-black">ADD</button>
            </div>
            <div className="flex gap-2">
              <select value={selectedProductCategory} onChange={e=>setSelectedProductCategory(e.target.value)} className="min-w-0 flex-1 border-2 border-black px-2 py-2 text-sm"><option value="">Choose category</option>{productCategories.map((x:any)=><option key={x.name} value={x.name}>{x.name}</option>)}</select>
              <input value={newProductSubcategory} onChange={e=>setNewProductSubcategory(e.target.value)} placeholder="Subcategory" className="min-w-0 flex-1 border-2 border-black px-2 py-2 text-sm" />
              <button type="button" onClick={()=>{const name=newProductSubcategory.trim(); if(selectedProductCategory && name) setProductCategories(productCategories.map((x:any)=>x.name===selectedProductCategory?{...x,subcategories:Array.from(new Set([...x.subcategories,name]))}:x)); setNewProductSubcategory("");}} className="border-2 border-black px-3 text-xs font-black">ADD</button>
            </div>
            <div className="space-y-1 text-xs">{productCategories.map((x:any)=><div key={x.name} className="flex justify-between gap-2 border-b py-1"><span><strong>{x.name}</strong>{x.subcategories?.length ? " · "+x.subcategories.join(", ") : ""}</span><button type="button" onClick={()=>setProductCategories(productCategories.filter((v:any)=>v.name!==x.name))} className="text-red-700 font-bold">Remove</button></div>)}</div>
          </div>
          <div className="space-y-3 border-2 border-black p-4">
            <h3 className="font-black uppercase text-sm">Expense Categories</h3>
            <div className="flex gap-2">
              <input value={newExpenseCategory} onChange={e => setNewExpenseCategory(e.target.value)} placeholder="New category" className="min-w-0 flex-1 border-2 border-black px-2 py-2 text-sm" />
              <button type="button" onClick={() => { const name=newExpenseCategory.trim(); if(name && !expenseCategories.some((x:any)=>x.name.toLowerCase()===name.toLowerCase())) setExpenseCategories([...expenseCategories,{name,subcategories:[]}]); setNewExpenseCategory(""); }} className="border-2 border-black bg-[#FFC300] px-3 text-xs font-black">ADD</button>
            </div>
            <div className="flex gap-2">
              <select value={selectedExpenseCategory} onChange={e=>setSelectedExpenseCategory(e.target.value)} className="min-w-0 flex-1 border-2 border-black px-2 py-2 text-sm"><option value="">Choose category</option>{expenseCategories.map((x:any)=><option key={x.name} value={x.name}>{x.name}</option>)}</select>
              <input value={newExpenseSubcategory} onChange={e=>setNewExpenseSubcategory(e.target.value)} placeholder="Subcategory" className="min-w-0 flex-1 border-2 border-black px-2 py-2 text-sm" />
              <button type="button" onClick={()=>{const name=newExpenseSubcategory.trim(); if(selectedExpenseCategory && name) setExpenseCategories(expenseCategories.map((x:any)=>x.name===selectedExpenseCategory?{...x,subcategories:Array.from(new Set([...x.subcategories,name]))}:x)); setNewExpenseSubcategory("");}} className="border-2 border-black px-3 text-xs font-black">ADD</button>
            </div>
            <div className="space-y-1 text-xs">{expenseCategories.map((x:any)=><div key={x.name} className="flex justify-between gap-2 border-b py-1"><span><strong>{x.name}</strong>{x.subcategories?.length ? " · "+x.subcategories.join(", ") : ""}</span><button type="button" onClick={()=>setExpenseCategories(expenseCategories.filter((v:any)=>v.name!==x.name))} className="text-red-700 font-bold">Remove</button></div>)}</div>
          </div>
        </div>
        <p className="text-xs text-zinc-600">Add or remove categories here, then use Save Settings. Staff can select configured categories but cannot edit this list.</p>
      </section>

      {/* Store Settings */}
      <section className="rounded-none border-2 border-black bg-white p-5 md:p-6 space-y-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-base font-black uppercase tracking-tight text-black">Store Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-black font-mono">Shop Name</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full rounded-none border-2 border-black bg-white px-3 py-2.5 text-sm text-black font-mono outline-none transition focus:ring-2 focus:ring-yellow-400"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider mb-2 text-black font-mono">Tax Rate (%)</label>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              className="w-full border-2 border-black rounded-none bg-white px-3 py-2 text-black font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider mb-2 text-black font-mono">Currency Symbol</label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full border-2 border-black rounded-none bg-white px-3 py-2 text-black font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider mb-2 text-black font-mono">Starting Balance</label>
            <input
              type="number"
              value={startingBalance}
              onChange={(e) => setStartingBalance(Number(e.target.value))}
              className="w-full border-2 border-black rounded-none bg-white px-3 py-2 text-black font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider mb-2 text-black font-mono">Owner Password (optional)</label>
            <input
              type="password"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              placeholder="Leave blank to disable"
              className="w-full border-2 border-black rounded-none bg-white px-3 py-2 text-black font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Quick Add Products</label>
          <div className="flex flex-wrap gap-2">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-1 text-sm border rounded px-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quickAddIds.includes(p.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setQuickAddIds([...quickAddIds, p.id]);
                    } else {
                      setQuickAddIds(quickAddIds.filter((id) => id !== p.id));
                    }
                  }}
                />
                {p.name}
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-none border-2 border-black bg-[#FFC300] px-5 py-3 text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </section>

      {/* Your Onboarded Staff */}
      <section className="rounded-none border-2 border-black bg-white p-5 md:p-6 space-y-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-lg font-black uppercase tracking-tight text-black">Your Onboarded Staff</h2>
        {staff.length === 0 ? (
          <p className="text-gray-500">No staff onboarded yet. Add staff in the Staff Management section.</p>
        ) : (
          <div className="space-y-2">
            {staff.filter((s) => !s.archived_at).map((s) => {
              const login = activeLogins.find((l) => l.staffId === s.id);
              return (
                <div key={s.id} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-sm text-gray-500">
                      {s.role} · {s.paymentType} · Rate: {settings.currency}{s.rate}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {login ? (
                      <>
                        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                          ● LOGIN ACTIVE ({login.role})
                        </span>
                        <button
                          onClick={() => handleTerminate(login.id)}
                          className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          Terminate
                        </button>
                      </>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                        No terminal access
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Assign Terminal Access */}
      <section className="rounded-none border-2 border-black bg-white p-5 md:p-6 space-y-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-lg font-black uppercase tracking-tight text-black">Assign Terminal Access</h2>
        <p className="text-sm text-gray-500">
          Send an invitation to the staff member’s individual email address. They will set their own password through Supabase Auth. Multiple cashiers and inventory managers can be active at the same time.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider mb-2 text-black font-mono">Select Staff</label>
            <select
              value={selectedStaffId}
              onChange={(e) => {
                setSelectedStaffId(e.target.value);

              }}
              className="w-full border-2 border-black rounded-none bg-white px-3 py-2 text-black font-mono"
            >
              <option value="">-- Select staff --</option>
              {availableStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider mb-2 text-black font-mono">Terminal Role</label>
            <select
              value={terminalRole}
              onChange={(e) => setTerminalRole(e.target.value as any)}
              className="w-full border-2 border-black rounded-none bg-white px-3 py-2 text-black font-mono"
            >
              <option value="cashier">Cashier</option>
              <option value="inventory_manager">Inventory Manager</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider mb-2 text-black font-mono">Login Email</label>
            <input
              type="email"
              value={terminalEmail}
              onChange={(e) => setTerminalEmail(e.target.value)}
              placeholder="staff@example.com"
              className="w-full border-2 border-black rounded-none bg-white px-3 py-2 text-black font-mono"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleAssignTerminalAccess}
          disabled={isOnboarding || !selectedStaffId || !terminalEmail.trim()}
          className="rounded-none border-2 border-black bg-[#0055A5] px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none disabled:opacity-50"
        >
          {isOnboarding ? "Sending invitation..." : "Send Staff Invitation"}
        </button>
      </section>

      {/* Login History */}
      {terminatedLogins.length > 0 && (
        <section className="rounded-none border-2 border-black bg-white p-5 md:p-6 space-y-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="text-lg font-black uppercase tracking-tight text-black">Terminal Access History</h2>
          <div className="space-y-2">
            {terminatedLogins.map((l) => (
              <div key={l.id} className="flex items-center justify-between border rounded p-3 bg-gray-50">
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-sm text-gray-500">
                    {l.role} · Terminated: {l.terminatedAt ? new Date(l.terminatedAt).toLocaleDateString() : "N/A"}
                  </div>
                </div>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">Inactive</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Danger Zone */}
      <section className="rounded-none border-2 border-red-600 bg-white p-5 md:p-6 space-y-4">
        <h2 className="text-lg font-black uppercase tracking-tight text-black text-red-600">Danger Zone</h2>
        <button
          onClick={handleReset}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Reset All Data
        </button>
      </section>
    </div>
  );
}
