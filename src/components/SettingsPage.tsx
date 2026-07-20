import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Save, 
  MessageSquare, 
  AlertTriangle,  
  Trash2,
  Lock,
  Globe,
  Grid,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";
import { StoreSettings, Product } from "../types";

interface SettingsPageProps {
  settings: StoreSettings;
  onUpdateSettings: (settings: StoreSettings) => void;
  onResetDatabase: (options?: { cleanSlate?: boolean; shopName?: string; startingBalance?: number; currency?: string; taxRate?: number }) => void;
  products: Product[];
  operatorRole?: "admin" | "cashier" | "inventory_manager";
}

export default function SettingsPage({
  settings,
  onUpdateSettings,
  onResetDatabase,
  products,
  operatorRole = "admin"
}: SettingsPageProps) {
  const [shopName, setShopName] = useState(settings.shopName);
  const [taxRate, setTaxRate] = useState(settings.taxRate.toString());
  const [currency, setCurrency] = useState(settings.currency);
  const [startingBalance, setStartingBalance] = useState(settings.startingBalance.toString());
  const [selectedQuickAddIds, setSelectedQuickAddIds] = useState<string[]>(
    settings.quickAddProductIds || []
  );

  // Staff Onboarding state variables
  const [ownerPassword, setOwnerPassword] = useState(settings.ownerPassword || "admin");
  const [cashierUsername, setCashierUsername] = useState((settings.staffAccounts as any)?.cashier?.username || "Cashier Desk");
  const [cashierEmail, setCashierEmail] = useState((settings.staffAccounts as any)?.cashier?.email || "cashier@retailsync.com");
  const [cashierPassword, setCashierPassword] = useState((settings.staffAccounts as any)?.cashier?.password || "cashier123");
  const [cashierActive, setCashierActive] = useState((settings.staffAccounts as any)?.cashier?.isActive ?? true);

  const [inventoryUsername, setInventoryUsername] = useState((settings.staffAccounts as any)?.inventory?.username || "Inventory Manager");
  const [inventoryEmail, setInventoryEmail] = useState((settings.staffAccounts as any)?.inventory?.email || "stock@retailsync.com");
  const [inventoryPassword, setInventoryPassword] = useState((settings.staffAccounts as any)?.inventory?.password || "stock123");
  const [inventoryActive, setInventoryActive] = useState((settings.staffAccounts as any)?.inventory?.isActive ?? true);
  const [selectedTheme, setSelectedTheme] = useState<"enterprise" | "bauhaus" | "glassmorphism" | "neumorphism" | "neo-brutalism" | "kitsch" | "dark" | "material">(
    settings.theme || "bauhaus"
  );

  const handleLaunchRealShop = () => {
    const cashValue = parseFloat(startingBalance) || 0;
    if (confirm(`Are you absolutely sure you want to transition to a LIVE shop? This will completely clear the current dummy data sheet and set your initial cash balance to ${currency} ${cashValue}.`)) {
      onResetDatabase({
        cleanSlate: true,
        shopName: shopName.trim() || "M S Traders",
        startingBalance: cashValue,
        currency: currency,
        taxRate: parseFloat(taxRate) || 5
      });
      alert(`Ledger successfully initialized with starting balance of ${currency} ${cashValue}! Ready for real-time operation.`);
    }
  };

  // Sync state if settings doc is loaded asynchronously
  useEffect(() => {
    if (settings) {
      setShopName(settings.shopName);
      setTaxRate(settings.taxRate.toString());
      setCurrency(settings.currency);
      setStartingBalance(settings.startingBalance.toString());
      if (settings.quickAddProductIds) {
        setSelectedQuickAddIds(settings.quickAddProductIds);
      }
      if (settings.theme) {
        setSelectedTheme(settings.theme);
      }
      setOwnerPassword(settings.ownerPassword || "admin");
      setCashierUsername((settings.staffAccounts as any)?.cashier?.username || "Cashier Desk");
      setCashierEmail((settings.staffAccounts as any)?.cashier?.email || "cashier@retailsync.com");
      setCashierPassword((settings.staffAccounts as any)?.cashier?.password || "cashier123");
      setCashierActive((settings.staffAccounts as any)?.cashier?.isActive ?? true);
      setInventoryUsername((settings.staffAccounts as any)?.inventory?.username || "Inventory Manager");
      setInventoryEmail((settings.staffAccounts as any)?.inventory?.email || "stock@retailsync.com");
      setInventoryPassword((settings.staffAccounts as any)?.inventory?.password || "stock123");
      setInventoryActive((settings.staffAccounts as any)?.inventory?.isActive ?? true);
    }
  }, [settings]);

  // Memory logging of SMS from server
  const [smsLog, setSmsLog] = useState<any[]>([]);

  useEffect(() => {
    // Load SMS audit log
    fetch("/api/sms/log")
      .then(res => res.json())
      .then(data => {
        if (data.smsLog) {
          setSmsLog(data.smsLog);
        }
      })
      .catch(err => console.error("Failed to load SMS log:", err));
  }, []);

  const handleToggleProductSelection = (productId: string) => {
    if (selectedQuickAddIds.includes(productId)) {
      setSelectedQuickAddIds(selectedQuickAddIds.filter(id => id !== productId));
    } else {
      if (selectedQuickAddIds.length >= 4) {
        alert("You can select a maximum of 4 quick-add items!");
        return;
      }
      setSelectedQuickAddIds([...selectedQuickAddIds, productId]);
    }
  };

  const handleThemeSelect = (themeId: "enterprise" | "bauhaus" | "glassmorphism" | "neumorphism" | "neo-brutalism" | "kitsch" | "dark" | "material") => {
    setSelectedTheme(themeId);
    onUpdateSettings({
      ...settings,
      theme: themeId
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      shopName,
      taxRate: parseFloat(taxRate) || 0,
      currency,
      startingBalance: parseFloat(startingBalance) || 0,
      quickAddProductIds: selectedQuickAddIds,
      theme: selectedTheme,
      ownerPassword,
      staffAccounts: {
        cashier: {
          username: cashierUsername,
          email: cashierEmail,
          password: cashierPassword,
          isActive: cashierActive
        },
        inventory: {
          username: inventoryUsername,
          email: inventoryEmail,
          password: inventoryPassword,
          isActive: inventoryActive
        }
      }
    });
    alert("Store configurations and staff onboarding credentials saved successfully!");
  };

  const handleStaffSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedAccounts = { ...settings.staffAccounts };
    if (operatorRole === "cashier") {
      updatedAccounts.cashier = {
        username: cashierUsername,
        email: cashierEmail,
        password: cashierPassword,
        isActive: cashierActive
      };
    } else if (operatorRole === "inventory_manager") {
      updatedAccounts.inventory = {
        username: inventoryUsername,
        email: inventoryEmail,
        password: inventoryPassword,
        isActive: inventoryActive
      };
    }
    onUpdateSettings({
      ...settings,
      staffAccounts: updatedAccounts
    });
    alert("Personal operator credentials saved successfully!");
  };

  const triggerReset = () => {
    if (confirm("WARNING: Are you sure you want to reset the databases? This will delete all your transaction details, current stock levels, and staff registers.")) {
      onResetDatabase();
      alert("Database reset completed successfully.");
    }
  };

  if (operatorRole !== "admin") {
    return (
      <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-8 text-black select-none animate-fadeIn">
        {/* Header */}
        <div className="mb-8 border-b-3 border-black pb-6">
          <h2 className="text-2xl font-black uppercase tracking-tight text-black">Operator Profile & Credentials</h2>
          <p className="text-xs text-zinc-700 font-bold font-mono mt-1">Manage your terminal password credentials and active security parameters below.</p>
        </div>

        <div className="max-w-xl bg-white p-6 rounded-none border-3 border-black space-y-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="border-b-2 border-black pb-3">
            <h3 className="font-black uppercase text-black text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-black" />
              <span>Operator Access Lock Settings</span>
            </h3>
          </div>

          <form onSubmit={handleStaffSavePassword} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Your Active ERP Role</label>
              <input 
                type="text" 
                disabled
                value={operatorRole === "cashier" ? "CASHIER OPERATOR" : "STOCK / INVENTORY MANAGER"}
                className="w-full px-3 py-2.5 bg-zinc-100 border-2 border-black text-zinc-500 rounded-none text-sm font-bold focus:outline-none font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Profile Description / Display Name</label>
              <input 
                type="text" 
                disabled
                value={operatorRole === "cashier" ? cashierUsername : inventoryUsername}
                className="w-full px-3 py-2.5 bg-zinc-100 border-2 border-black text-zinc-500 rounded-none text-sm font-bold focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Change Your Access Password / PIN</label>
              <input 
                type="text" 
                required
                value={operatorRole === "cashier" ? cashierPassword : inventoryPassword}
                onChange={(e) => {
                  if (operatorRole === "cashier") {
                    setCashierPassword(e.target.value);
                  } else {
                    setInventoryPassword(e.target.value);
                  }
                }}
                className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none font-mono"
              />
              <p className="text-[10px] text-zinc-500 font-mono mt-1 uppercase">Ensure you remember this password. You will need it to switch back to this operator session on the terminal.</p>
            </div>

            <button 
              type="submit"
              className="px-5 py-2.5 bg-black hover:bg-zinc-800 text-[#FFC300] border-2 border-black rounded-none text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-mono"
            >
              <Save className="w-4 h-4" />
              <span>Save Credentials</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-8 text-black select-none">
      {/* Header */}
      <div className="mb-8 border-b-3 border-black pb-6">
        <h2 className="text-2xl font-black uppercase tracking-tight text-black">System Configurations & Logs</h2>
        <p className="text-xs text-zinc-700 font-bold font-mono mt-1">Modify shop global variables, adjust currency/starting margins, customize checkout hotkeys, and audit outgoing simulated communications.</p>
      </div>
      

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* LEFT PANEL: VARIABLES CONFIGURATION FORM (Col Span 2) */}
        <div className="xl:col-span-2 bg-white p-6 rounded-none border-3 border-black space-y-6 h-fit shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-fadeIn">
          <div className="border-b-2 border-black pb-3 flex items-center justify-between">
            <h3 className="font-black uppercase text-black text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-black" />
              <span>Global Store Variables</span>
            </h3>
          </div>

          {/* THEME SELECTION PANEL */}
          <div className="border-b-2 border-black pb-5">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-black font-mono mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>Visual Identity & Theme Layouts</span>
            </h4>
            <p className="text-xs text-zinc-700 font-bold leading-normal mb-4 font-mono">
              Toggle your storefront interface skin immediately. Select the design archetype that matches your business persona.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { 
                  id: "enterprise", 
                  name: "Enterprise", 
                  use: "Default businesses; clean & data-dense",
                  preview: ["bg-slate-100", "bg-blue-600", "bg-slate-800"],
                  badge: "PRO"
                },
                { 
                  id: "bauhaus", 
                  name: "Bauhaus", 
                  use: "Creative retail; classic primary art",
                  preview: ["bg-[#FFC300]", "bg-[#D63031]", "bg-[#0055A5]"],
                  badge: "SIGNATURE"
                },
                { 
                  id: "glassmorphism", 
                  name: "Glassmorphism", 
                  use: "Premium modern; frosted blur layers",
                  preview: ["bg-pink-500", "bg-purple-600", "bg-blue-500"],
                  badge: "FUTURISTIC"
                },
                { 
                  id: "neumorphism", 
                  name: "Neumorphism", 
                  use: "Soft 3D extruded keys for touchscreen kiosks",
                  preview: ["bg-[#e0e0e0]", "bg-[#bebebe]", "bg-[#ffffff]"],
                  badge: "TACTILE"
                },
                { 
                  id: "neo-brutalism", 
                  name: "Neo-Brutalism", 
                  use: "Bold startups; thick borders & acid neons",
                  preview: ["bg-[#39FF14]", "bg-[#FF1493]", "bg-black"],
                  badge: "HIGH CONTRAST"
                },
                { 
                  id: "kitsch", 
                  name: "Kitsch", 
                  use: "Lifestyle, fashion, toy & boutique stores",
                  preview: ["bg-[#FFB6C1]", "bg-[#FFDAB9]", "bg-[#E6E6FA]"],
                  badge: "PLAYFUL"
                },
                { 
                  id: "dark", 
                  name: "Dark", 
                  use: "Long working hours & night-shift registers",
                  preview: ["bg-[#09090b]", "bg-[#7c3aed]", "bg-[#27272a]"],
                  badge: "NIGHT SHIFT"
                },
                { 
                  id: "material", 
                  name: "Material", 
                  use: "Familiar rounded UI from Android apps",
                  preview: ["bg-[#1a73e8]", "bg-[#ea4335]", "bg-[#34a853]"],
                  badge: "GOOGLE"
                }
              ].map((t) => {
                const isSelected = selectedTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleThemeSelect(t.id as any)}
                    className={`group text-left p-3 border-2 border-black rounded-none flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden select-none h-32 ${
                      isSelected 
                        ? "bg-[#FFC300] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5" 
                        : "bg-white text-zinc-800 hover:bg-zinc-50 hover:shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <p className="font-black text-xs uppercase tracking-tight text-black truncate">{t.name}</p>
                        <span className="text-[7px] font-mono font-bold px-1 py-0.2 bg-black text-white border border-black uppercase tracking-widest shrink-0">
                          {t.badge}
                        </span>
                      </div>
                      <p className="text-[9px] font-mono leading-tight font-bold text-zinc-700 uppercase line-clamp-2 h-7 group-hover:text-black">
                        {t.use}
                      </p>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between w-full">
                      {/* Interactive Color Indicator Dot bar */}
                      <div className="flex gap-1">
                        {t.preview.map((c, idx) => (
                          <div key={idx} className={`w-3.5 h-3.5 border border-black rounded-none ${c}`} />
                        ))}
                      </div>
                      
                      {isSelected ? (
                        <span className="text-[9px] font-black font-mono uppercase bg-black text-[#FFC300] px-1.5 py-0.5 border border-black shrink-0">
                          ACTIVE ✓
                        </span>
                      ) : (
                        <span className="text-[8px] font-black font-mono uppercase text-zinc-400 group-hover:text-black shrink-0 transition-colors">
                          SELECT
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Registered Shop Name</label>
                <input 
                  type="text" 
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none placeholder-zinc-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Default Currency Unit</label>
                <select 
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none cursor-pointer font-mono"
                >
                  <option value="$">US Dollar ($)</option>
                  <option value="Rs.">Indian Rupees (Rs.)</option>
                  <option value="£">British Pounds (£)</option>
                  <option value="€">Euro (€)</option>
                  <option value="¥">Yen (¥)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Default Tax Margin (Rate %)</label>
                <input 
                  type="number" 
                  required
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Yesterday's Closing Cash Balance</label>
                <input 
                  type="number" 
                  required
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* PEAK HOURS QUICK-ADD CUSTOMIZER PER OWNER */}
            <div className="border-t-2 border-black pt-6">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-black font-mono mb-2 flex items-center gap-1.5">
                <Grid className="w-4 h-4" />
                <span>Configure Peak Hours Quick-Add (Max 4 Items)</span>
              </h4>
              <p className="text-xs text-zinc-700 font-bold leading-normal mb-4 font-mono">
                Select which specific products are displayed as hotkeys on your Sales Counter. This is uniquely isolated to your shop's credentials. ({selectedQuickAddIds.length} / 4 Selected)
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto border-2 border-black p-3 bg-[#F5F2EB] mb-6">
                {products.length === 0 ? (
                  <p className="text-xs text-zinc-600 font-bold font-mono italic p-2">No inventory products available to select.</p>
                ) : (
                  products.map((p) => {
                    const isSelected = selectedQuickAddIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleToggleProductSelection(p.id)}
                        className={`p-2.5 border-2 border-black text-left flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                          isSelected ? "bg-[#FFC300] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "bg-white hover:bg-zinc-50 text-zinc-800"
                        }`}
                      >
                        <div>
                          <p className="font-black text-black">{p.name}</p>
                          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{p.category} | {currency}{p.sellingPrice}</p>
                        </div>
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 shrink-0 text-black" />
                        ) : (
                          <Square className="w-4 h-4 shrink-0 text-zinc-400" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ERP STAFF ONBOARDING & TERMINAL ACCESS CONSOLE */}
            <div className="border-t-2 border-black pt-6 bg-[#FEF9E7] p-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 font-mono mb-2 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-800" />
                <span>ERP Staff Onboarding & Terminal Access</span>
              </h4>
              <p className="text-[10px] text-zinc-800 font-bold leading-normal mb-4 font-mono">
                Onboard your employees by creating custom cashier and stock manager logins. You have full authority to terminate access immediately if they leave the shop, keeping all data safe and shared.
              </p>

              <div className="space-y-4">
                {/* 1. Admin/Owner Access Credentials */}
                <div className="bg-white p-3 border border-black space-y-2">
                  <p className="text-[10px] font-black font-mono text-[#D63031] uppercase">1. OWNER / ADMIN RE-ENTRY PASSWORD</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-zinc-600 font-mono mb-1">Admin Password / PIN</label>
                      <input 
                        type="text"
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        placeholder="Default is 'admin'"
                        className="w-full px-2.5 py-1.5 bg-white border-2 border-black text-black text-xs font-bold font-mono rounded-none focus:outline-none"
                      />
                    </div>
                    <div className="text-[9px] text-zinc-600 font-mono leading-relaxed flex items-center">
                      This password is required to switch the terminal back to Admin from locked Cashier/Stock sessions.
                    </div>
                  </div>
                </div>

                {/* 2. Cashier Onboarding Account */}
                <div className="bg-white p-3 border border-black space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black font-mono text-[#0055A5] uppercase">2. CASHIER ONBOARDING PROFILE</p>
                    <button
                      type="button"
                      onClick={() => setCashierActive(!cashierActive)}
                      className={`px-2 py-0.5 text-[8px] font-black border uppercase font-mono cursor-pointer transition-all ${
                        cashierActive ? "bg-emerald-200 text-emerald-800 border-emerald-800 animate-none" : "bg-red-200 text-red-800 border-red-800 font-black animate-pulse"
                      }`}
                    >
                      {cashierActive ? "● Active" : "✕ Access Terminated"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-zinc-600 font-mono mb-1">Cashier Desk Name / User</label>
                      <input 
                        type="text"
                        value={cashierUsername}
                        onChange={(e) => setCashierUsername(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border-2 border-black text-black text-xs font-bold font-mono rounded-none focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-zinc-600 font-mono mb-1">Cashier Login Email</label>
                      <input 
                        type="email"
                        value={cashierEmail}
                        onChange={(e) => setCashierEmail(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border-2 border-black text-black text-xs font-bold font-mono rounded-none focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-zinc-600 font-mono mb-1">Cashier Password / PIN</label>
                      <input 
                        type="text"
                        value={cashierPassword}
                        onChange={(e) => setCashierPassword(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border-2 border-black text-black text-xs font-bold font-mono rounded-none focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Stock Room Manager Onboarding Account */}
                <div className="bg-white p-3 border border-black space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black font-mono text-[#0055A5] uppercase">3. STOCK MANAGER ONBOARDING PROFILE</p>
                    <button
                      type="button"
                      onClick={() => setInventoryActive(!inventoryActive)}
                      className={`px-2 py-0.5 text-[8px] font-black border uppercase font-mono cursor-pointer transition-all ${
                        inventoryActive ? "bg-emerald-200 text-emerald-800 border-emerald-800 animate-none" : "bg-red-200 text-red-800 border-red-800 font-black animate-pulse"
                      }`}
                    >
                      {inventoryActive ? "● Active" : "✕ Access Terminated"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-zinc-600 font-mono mb-1">Stock Manager User / Desk</label>
                      <input 
                        type="text"
                        value={inventoryUsername}
                        onChange={(e) => setInventoryUsername(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border-2 border-black text-black text-xs font-bold font-mono rounded-none focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-zinc-600 font-mono mb-1">Stock Manager Login Email</label>
                      <input 
                        type="email"
                        value={inventoryEmail}
                        onChange={(e) => setInventoryEmail(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border-2 border-black text-black text-xs font-bold font-mono rounded-none focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-zinc-600 font-mono mb-1">Stock Password / PIN</label>
                      <input 
                        type="text"
                        value={inventoryPassword}
                        onChange={(e) => setInventoryPassword(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border-2 border-black text-black text-xs font-bold font-mono rounded-none focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              className="px-5 py-2.5 bg-[#0055A5] hover:bg-[#004488] text-white border-2 border-black rounded-none text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <Save className="w-4 h-4" />
              <span>APPLY & SAVE CONFIGS</span>
            </button>
          </form>

          {/* REAL SHOP LAUNCHER ZONE */}
          <div className="border-t-2 border-black pt-6 mt-6 bg-[#EDF8F5] p-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#137333] font-mono mb-2 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[#137333]" />
              <span>Initialize Live Shop (Zero-Data / Fresh Ledger)</span>
            </h4>
            <p className="text-xs text-zinc-800 font-bold leading-normal mb-4 font-mono">
              Ready to transition from demo sandbox to live business ledger? This will permanently delete all dummy products, pre-loaded sales, and expenses, and let you start your shop (<strong className="text-black">{shopName || "M S Traders"}</strong>) clean with your own cash.
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Your Starting Cash (In-Hand)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-black font-mono text-zinc-600">{currency}</span>
                  <input 
                    type="number"
                    value={startingBalance}
                    onChange={(e) => setStartingBalance(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full pl-8 pr-3 py-2 bg-white border-2 border-black text-black rounded-none text-xs font-bold focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
            <button 
              type="button"
              onClick={handleLaunchRealShop}
              className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-black rounded-none text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wider"
            >
              <Save className="w-4 h-4" />
              <span>START LIVE LEDGER WITH OWN CASH</span>
            </button>
          </div>

          {/* DATABASE STATUS */}
          <div className="border-t-2 border-black pt-6 mt-6 bg-[#EDF8F5] p-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">

            <h4 className="text-xs font-black uppercase tracking-wider text-[#137333] font-mono">
              Database Status
            </h4>

            <p className="text-xs mt-2 text-zinc-700 font-mono">

              RetailSync is securely connected to its cloud database.

              Database configuration is managed by the application administrator.

              No manual setup is required.

            </p>

        <div className="mt-4 inline-flex px-3 py-1 bg-emerald-600 text-white border-2 border-black font-black uppercase text-xs">

                ✓ Connected

          </div>

        </div>
        </div>

        {/* DANGEROUS SYSTEM OPERATIONS ZONE */}

<div className="border-t-2 border-black pt-6 mt-4">
  <h4 className="text-[10px] font-black uppercase tracking-wider text-[#D63031] font-mono mb-2 flex items-center gap-1.5">
    <AlertTriangle className="w-4 h-4" />
    <span>System Danger Zone</span>
  </h4>

  <p className="text-xs text-zinc-700 font-bold leading-normal mb-4">
    Resetting the workspace will permanently remove your shop data.
    This action cannot be undone.
  </p>

  <button
    onClick={triggerReset}
    className="px-4 py-2 bg-[#FCE8E6] hover:bg-[#FADBD8] border-2 border-black text-[#D63031] rounded-none text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
  >
    <Trash2 className="w-3.5 h-3.5" />
    <span>RESET STORE DATA</span>
  </button>
</div>
                   

        {/* RIGHT PANEL: AUDIT OUTGOING SIMULATED SMS COMMISSIONS LOG (Col Span 1) */}
        <div className="bg-white p-6 rounded-none border-3 border-black flex flex-col justify-between h-[650px] overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="h-full flex flex-col">
            <h3 className="font-black uppercase text-black text-base flex items-center gap-2 mb-1 shrink-0">
              <MessageSquare className="w-4 h-4 text-black" />
              <span>Simulated SMS Push Audits</span>
            </h3>
            <p className="text-xs text-zinc-700 font-bold font-mono mb-4 shrink-0">Tracking logs of text notifications dispatched to referral agents</p>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {smsLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-500">
                  <MessageSquare className="w-8 h-8 stroke-2 mb-2 text-black" />
                  <p className="text-xs font-mono font-bold uppercase">No SMS messages triggered yet</p>
                  <p className="text-[10px] mt-1 leading-normal max-w-xs mx-auto text-zinc-600 font-bold">SMS triggers automatically during commission assignment at checkout.</p>
                </div>
              ) : (
                smsLog.map((log) => (
                  <div key={log.id} className="p-3 bg-[#F5F2EB] rounded-none border-2 border-black space-y-2">
                    <div className="flex justify-between items-center text-[9px] font-black text-zinc-700 font-mono">
                      <span>ID: {log.id}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div>
                      <p className="text-xs font-black text-black">{log.agentName} ({log.agentPhone})</p>
                      <p className="text-[10px] text-zinc-800 font-bold mt-1 leading-normal italic bg-white p-2 rounded-none border border-black font-mono">"{log.message}"</p>
                    </div>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-none text-[9px] font-black bg-[#E8F8F5] text-emerald-800 border border-black font-mono">
                      {log.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
