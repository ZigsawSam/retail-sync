"use client";

import React, { useState } from "react";
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

  const activeLogins = staffLogins.filter((l) => l.isActive);
  const terminatedLogins = staffLogins.filter((l) => !l.isActive);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");
    try {
      await onUpdateSettings({
        shopName,
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
    (s) => !activeLogins.some((l) => l.staffId === s.id)
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      {message && (
        <div className={`p-3 rounded ${message.includes("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* Store Settings */}
      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-semibold">Store Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Shop Name</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency Symbol</label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Starting Balance</label>
            <input
              type="number"
              value={startingBalance}
              onChange={(e) => setStartingBalance(Number(e.target.value))}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Theme</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className="w-full border rounded px-3 py-2"
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
          <div>
            <label className="block text-sm font-medium mb-1">Owner Password (optional)</label>
            <input
              type="password"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              placeholder="Leave blank to disable"
              className="w-full border rounded px-3 py-2"
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
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </section>

      {/* Your Onboarded Staff */}
      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-semibold">Your Onboarded Staff</h2>
        {staff.length === 0 ? (
          <p className="text-gray-500">No staff onboarded yet. Add staff in the Staff Management section.</p>
        ) : (
          <div className="space-y-2">
            {staff.map((s) => {
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
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          ● LOGIN ACTIVE ({login.role})
                        </span>
                        <button
                          onClick={() => handleTerminate(login.id)}
                          className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                        >
                          Terminate
                        </button>
                      </>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
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
      <section className="border rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-semibold">Assign Terminal Access</h2>
        <p className="text-sm text-gray-500">
          Send an invitation to the staff member’s individual email address. They will set their own password through Supabase Auth. Multiple cashiers and inventory managers can be active at the same time.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Staff</label>
            <select
              value={selectedStaffId}
              onChange={(e) => {
                setSelectedStaffId(e.target.value);

              }}
              className="w-full border rounded px-3 py-2"
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
            <label className="block text-sm font-medium mb-1">Terminal Role</label>
            <select
              value={terminalRole}
              onChange={(e) => setTerminalRole(e.target.value as any)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="cashier">Cashier</option>
              <option value="inventory_manager">Inventory Manager</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Login Email</label>
            <input
              type="email"
              value={terminalEmail}
              onChange={(e) => setTerminalEmail(e.target.value)}
              placeholder="staff@example.com"
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <button
          onClick={handleAssignTerminalAccess}
          disabled={isOnboarding || !selectedStaffId}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {isOnboarding ? "Sending invitation..." : "Send Staff Invitation"}
        </button>
      </section>

      {/* Login History */}
      {terminatedLogins.length > 0 && (
        <section className="border rounded-lg p-4 space-y-4">
          <h2 className="text-lg font-semibold">Terminal Access History</h2>
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
      <section className="border border-red-200 rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-semibold text-red-600">Danger Zone</h2>
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
