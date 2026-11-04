"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import Sidebar from "../components/Sidebar";
import AuthPage from "../components/AuthPage";
import RoleGuard from "../components/RoleGuard";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const {
    currentUser,
    isLoading,
    currentRole,
    handleRoleChange,
    operatorRole,
    handleSwitchOperator,
    settings,
    cashInHand,
    currency,
    handleLogout,
    supabaseError,
    setSupabaseError
  } = useApp();

  const [errorBannerExpanded, setErrorBannerExpanded] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  // Redirect from root "/" to "/dashboard"
  useEffect(() => {
    if (!isLoading && currentUser && pathname === "/") {
      router.replace("/dashboard");
    }
  }, [isLoading, currentUser, pathname, router]);

  const handleLocalBypass = () => {
    const localUser = {
      uid: "local-demo",
      email: "sandbox@retailsync.local",
      displayName: "Demo Operator"
    };
    localStorage.setItem("retail_sync_local_user", JSON.stringify(localUser));
    window.location.reload();
  };

  // Splash Loading Screen
  if (isLoading) {
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
    <div className={`flex min-h-screen w-full overflow-x-hidden font-sans bg-[#FAF8F5] text-zinc-900 ${themeClassName}`}>
      {/* Persistent Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        shopName={settings.shopName} 
        cashInHand={cashInHand}
        currency={currency}
        onLogout={handleLogout}
        currentRole={currentRole}
        onChangeRole={handleRoleChange}
        operatorRole={operatorRole}
        handleSwitchOperator={handleSwitchOperator}
      />

      {/* Dynamic Viewport */}
      <div className="flex-1 min-w-0 min-h-screen flex flex-col relative">
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
                        {step.startsWith("ALTER TABLE") || step.includes("ROW LEVEL SECURITY") || step.includes("DISABLE ROW LEVEL SECURITY") ? (
                          <div className="mt-2 mb-2">
                            <span className="text-[10px] font-black text-black uppercase block mb-1">
                              Paste and run this query in your Supabase SQL Editor:
                            </span>
                            <div className="relative">
                              <pre className="block bg-zinc-100 p-2.5 border-2 border-black text-[10px] text-black font-mono overflow-x-auto whitespace-pre select-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">
                                {`ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE "electronicTxs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE cheques DISABLE ROW LEVEL SECURITY;
ALTER TABLE "actualDrawerCash" DISABLE ROW LEVEL SECURITY;`}
                              </pre>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE "electronicTxs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE cheques DISABLE ROW LEVEL SECURITY;
ALTER TABLE "actualDrawerCash" DISABLE ROW LEVEL SECURITY;`);
                                  setSqlCopied(true);
                                  setTimeout(() => setSqlCopied(false), 2000);
                                }}
                                className={`absolute right-2 top-2 px-2 py-1 border border-black text-[9px] font-bold uppercase cursor-pointer shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all ${
                                  sqlCopied ? "bg-emerald-400 text-black font-black" : "bg-white hover:bg-zinc-100 text-zinc-800"
                                }`}
                              >
                                {sqlCopied ? "✓ Copied!" : "Copy SQL"}
                              </button>
                            </div>
                          </div>
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

        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overscroll-y-contain" style={{ WebkitOverflowScrolling: "touch" }}>
          <RoleGuard currentRole={currentRole}>
            {children}
          </RoleGuard>
        </main>
      </div>
    </div>
  );
}
