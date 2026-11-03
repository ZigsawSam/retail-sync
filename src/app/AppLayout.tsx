"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import Sidebar from "../components/Sidebar";
import AuthPage from "../components/AuthPage";
import RoleGuard from "../components/RoleGuard";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeftRight, X } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    currentUser,
    authLoading,
    currentRole,
     settings,
    cashInHand,
    currency,
    handleLogout,
    supabaseError,
    setSupabaseError
  } = useApp();

  const [errorBannerExpanded, setErrorBannerExpanded] = useState(false);
  const [converterOpen, setConverterOpen] = useState(false);
  const [amount, setAmount] = useState("1");
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("INR");
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [rateDate, setRateDate] = useState("");
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState("");

  const currencyCodes = (() => {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "currency") => string[] };
    return (intl.supportedValuesOf?.("currency") || ["AED","AUD","BDT","CAD","CNY","EUR","GBP","INR","JPY","NZD","PKR","SAR","SGD","USD","ZAR"])
      .filter((code) => /^[A-Z]{3}$/.test(code)).sort();
  })();
  const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });
  const formatCurrency = (value: number, code: string) => new Intl.NumberFormat("en", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(value);

  useEffect(() => {
    if (!converterOpen) return;
    const controller = new AbortController();
    setRateLoading(true);
    setRateError("");
    fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Exchange-rate service is unavailable.");
        return response.json();
      })
      .then((data) => {
        if (data.result !== "success" || !data.rates) throw new Error("Could not retrieve exchange rates.");
        setRates(data.rates);
        setRateDate(data.time_last_update_utc || "");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setRateError(error.message || "Unable to load exchange rates.");
      })
      .finally(() => { if (!controller.signal.aborted) setRateLoading(false); });
    return () => controller.abort();
  }, [converterOpen, fromCurrency]);
  const convertedAmount = rates && Number.isFinite(Number(amount)) ? Number(amount || 0) * (rates[toCurrency] || 0) : null;

  const pathname = usePathname();
  const router = useRouter();

  // Redirect from root "/" to "/dashboard"
  useEffect(() => {
    if (!authLoading && currentUser && pathname === "/") {
      router.replace("/dashboard");
    }
  }, [authLoading, currentUser, pathname, router]);

  const handleLocalBypass = () => {
    const localUser = {
      uid: "local-demo",
      email: "sandbox@retailsync.local",
      displayName: "Demo Operator"
    };
    localStorage.setItem("retail_sync_local_user", JSON.stringify(localUser));
    window.location.reload();
  };

  // Invitation and recovery links must be reachable before an app session exists.
  if (pathname === "/auth/reset-password") {
    return <>{children}</>;
  }

  // Splash Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen w-screen bg-[#FAF8F5] flex flex-col items-center justify-center select-none font-sans">
        <div className="p-8 border-3 border-black bg-[#FFC300] shadow-[6px_6px_0px_0px_#000000] text-center max-w-sm space-y-4">
          <div className="w-12 h-12 border-4 border-black border-t-transparent animate-spin mx-auto bg-white rounded-none" />
          <p className="text-sm font-black uppercase text-black tracking-wider font-mono">Welcome back! Setting up your space...</p>
          <p className="text-[10px] text-zinc-700 font-mono font-bold uppercase leading-normal">Verifying your security credentials so you can start selling safely.</p>
          
          <div className="pt-2 border-t border-dashed border-black/30">
            <button
              onClick={handleLocalBypass}
              className="w-full py-2.5 bg-black text-[#FFC300] hover:bg-zinc-800 border-2 border-black text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1"
            >
              ⚡ Enter Offline Demo Mode
            </button>
            <p className="text-[9px] text-zinc-600 font-mono mt-1.5 uppercase">Skip network setup to explore the registers instantly</p>
          </div>
        </div>
      </div>
    );
  }

  // Auth Gate
  if (!currentUser) {
    return <AuthPage onAuthSuccess={() => router.push("/dashboard")} />;
  }

  // Get current active tab (e.g. "/dashboard" -> "dashboard")
  const activeTab = (!pathname || pathname === "/") ? "dashboard" : (pathname.split("/")[1] || "dashboard");
  const setActiveTab = (tab: string) => {
    router.push(`/${tab}`);
  };

  const activeTheme = settings.theme || "bauhaus";
  const themeClassName = `theme-${activeTheme}`;

  return (
    <div className={`flex h-screen w-screen overflow-hidden font-sans bg-[#FAF8F5] text-zinc-900 select-none ${themeClassName}`}>
      {/* Persistent Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        shopName={settings.shopName} 
        cashInHand={cashInHand}
        currency={currency}
        onLogout={handleLogout}
        currentRole={currentRole}
       />

      {/* Dynamic Viewport */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-14 shrink-0 bg-white border-b-2 border-black px-4 md:px-6 flex items-center justify-end gap-3">
          <button type="button" onClick={() => setConverterOpen(true)} className="inline-flex items-center gap-2 border-2 border-black bg-[#FFC300] px-3 py-2 text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000000] hover:translate-y-[-1px]">
            <ArrowLeftRight className="h-4 w-4" /> Currency converter
          </button>
        </header>
        {converterOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="currency-converter-title">
            <div className="w-full max-w-lg border-4 border-black bg-[#FAF8F5] p-5 shadow-[8px_8px_0_0_#000]">
              <div className="mb-5 flex items-center justify-between">
                <h2 id="currency-converter-title" className="text-lg font-black uppercase">Currency converter</h2>
                <button type="button" onClick={() => setConverterOpen(false)} aria-label="Close converter" className="border-2 border-black bg-white p-2"><X className="h-4 w-4" /></button>
              </div>
              <label className="mb-2 block text-[10px] font-black uppercase">Amount</label>
              <input type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} className="mb-4 w-full border-2 border-black bg-white p-3 text-lg font-bold" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className="mb-2 block text-[10px] font-black uppercase">From</label>
                  <select value={fromCurrency} onChange={(event) => setFromCurrency(event.target.value)} className="w-full border-2 border-black bg-white p-3 text-sm font-bold">
                    {currencyCodes.map((code) => <option key={code} value={code}>{currencyNames.of(code) || code} ({code})</option>)}
                  </select>
                </div>
                <div><label className="mb-2 block text-[10px] font-black uppercase">To</label>
                  <select value={toCurrency} onChange={(event) => setToCurrency(event.target.value)} className="w-full border-2 border-black bg-white p-3 text-sm font-bold">
                    {currencyCodes.map((code) => <option key={code} value={code}>{currencyNames.of(code) || code} ({code})</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-5 border-2 border-black bg-[#FFC300] p-4">
                <p className="text-[10px] font-black uppercase">Converted amount</p>
                <p className="mt-1 break-words text-2xl font-black">{rateLoading ? "Loading rate…" : convertedAmount === null ? "—" : formatCurrency(convertedAmount, toCurrency)}</p>
                {rates && <p className="mt-2 text-[10px] font-bold">1 {fromCurrency} = {(rates[toCurrency] || 0).toLocaleString("en", { maximumFractionDigits: 6 })} {toCurrency}</p>}
              </div>
              {rateError && <p className="mt-3 text-xs font-bold text-red-700">{rateError}</p>}
              {rateDate && <p className="mt-3 text-[10px] text-zinc-600">Rate data last updated: {rateDate}. Rates are indicative; verify before financial transactions.</p>}
              <p className="mt-3 text-[10px] text-zinc-500">Available to all signed-in roles. This does not change shop records or transaction values.</p>
            </div>
          </div>
        )}
        {supabaseError && (
          <div className="bg-amber-50 border-b-3 border-black p-4 flex flex-col gap-2 relative z-50 shadow-[0_4px_0_0_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-amber-400 border-2 border-black font-black text-[10px] uppercase animate-pulse">
                  ⚠ Database Attention Required
                </span>
                <span className="font-bold text-xs uppercase text-zinc-800">
                  {supabaseError.friendlyMessage}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setErrorBannerExpanded(!errorBannerExpanded)}
                  className="px-3 py-1 bg-black text-white hover:bg-zinc-800 border-2 border-black text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(255,255,255,1)]"
                >
                  {errorBannerExpanded ? "Hide Troubleshooting" : "Get Database Fix Query"}
                </button>
                <button
                  onClick={() => setSupabaseError(null)}
                  className="px-2 py-0.5 bg-zinc-200 hover:bg-zinc-300 border-2 border-black text-xs font-black cursor-pointer shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                  title="Dismiss warning"
                >
                  ✕
                </button>
              </div>
            </div>

            {errorBannerExpanded && (
              <div className="mt-3 bg-white border-2 border-black p-3 space-y-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div>
                  <h4 className="text-xs font-black uppercase text-black tracking-wide">Error Details:</h4>
                  <p className="text-[11px] text-zinc-700 font-mono mt-0.5 select-all">{supabaseError.originalMessage}</p>
                </div>

                <div>
                  <h4 className="text-xs font-black uppercase text-black tracking-wide">Troubleshooting Instructions:</h4>
                  <ul className="list-disc pl-4 mt-1.5 space-y-1.5 text-[11px] text-zinc-700">
                    {supabaseError.troubleshootingSteps.map((step, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {step.includes("ROW LEVEL SECURITY") || step.includes("DISABLE ROW LEVEL SECURITY") ? (
                          <span className="font-semibold text-amber-800">Do not disable Row-Level Security. Restore access with tenant-scoped policies and verify permissions for this authenticated user. Ask an administrator to review the Supabase schema and policies before applying any SQL.</span>
                        ) : (
                          step
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <RoleGuard currentRole={currentRole}>
              {children}
            </RoleGuard>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
