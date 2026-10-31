import React from "react";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Package, 
  TrendingUp, 
  Sparkles, 
  Settings as SettingsIcon,
  Store,
  ChevronRight,
  LogOut,
  ShieldCheck
} from "lucide-react";
import { ERPRole } from "../types";
import { ROUTE_ROLES } from "../lib/rolePermissions";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  shopName: string;
  cashInHand?: number;
  currency?: string;
  onLogout?: () => void;
  currentRole: ERPRole;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  shopName,
  cashInHand = 0,
  currency = "$",
  onLogout,
  currentRole,
 }: SidebarProps) {
  // Roles allowed to view each menu item (kept in sync with RoleGuard via ROUTE_ROLES)
  const menuItems = [
    { id: "dashboard", label: "DASHBOARD", icon: LayoutDashboard, roles: ROUTE_ROLES.dashboard },
    { id: "sales", label: "SALES COUNTER", icon: ShoppingCart, roles: ROUTE_ROLES.sales },
    { id: "people", label: "STAFF & PEOPLE", icon: Users, roles: ROUTE_ROLES.people },
    { id: "operations", label: "OPERATIONS", icon: Package, roles: ROUTE_ROLES.operations },
    { id: "insights", label: "LOYALTY INDEX", icon: TrendingUp, roles: ROUTE_ROLES.insights },
    { id: "ai", label: "AI RETAILER", icon: Sparkles, badge: "GEMINI", roles: ROUTE_ROLES.ai },
    { id: "settings", label: "SETTINGS", icon: SettingsIcon, roles: ROUTE_ROLES.settings },
  ];

  const visibleItems = menuItems.filter(item => item.roles.includes(currentRole));

  return (
    <div className="w-64 bg-[#F5F2EB] border-r-4 border-black flex flex-col h-screen text-black select-none font-sans">
      {/* Brand Logo / Shop Name */}
      <div className="p-6 border-b-4 border-black bg-[#FFC300] flex items-center gap-3 relative overflow-hidden">
        {/* Geometric Bauhaus Art Accents */}
        <div className="absolute right-0 top-0 w-16 h-16 bg-[#D63031] rounded-full translate-x-6 -translate-y-6 border-4 border-black pointer-events-none" />
        <div className="absolute right-10 bottom-0 w-8 h-8 bg-[#0055A5] -translate-x-2 translate-y-4 border-2 border-black pointer-events-none" />
        
        <div className="p-2 bg-white border-2 border-black text-black z-10 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <Store className="w-5 h-5" />
        </div>
        <div className="z-10">
          <h1 className="text-sm font-black tracking-tight uppercase truncate w-36 text-black">
            {shopName || "Retail Sync"}
          </h1>
          <p className="text-[9px] text-black font-mono font-bold uppercase tracking-wider font-mono">Bauhaus ERP v1</p>
        </div>
      </div>

      {/* Role is bound to the authenticated Supabase identity; no client-side impersonation. */}
      <div className="mx-4 mt-4 p-3 bg-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] shrink-0">
        <p className="text-[9px] font-black font-mono uppercase text-zinc-500 tracking-wider flex items-center gap-1.5 mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0055A5]" />
          AUTHENTICATED ROLE
        </p>
        <div className="bg-zinc-50 p-2 border border-dashed border-black/30">
          <p className="text-xs font-black text-black font-mono uppercase tracking-tight">
            {currentRole === "admin" ? "SHOP OWNER" : currentRole === "cashier" ? "CASHIER" : "INVENTORY MANAGER"}
          </p>
          <p className="text-[9px] text-zinc-500 font-mono mt-1">Role comes from your signed-in account</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-4 space-y-3 overflow-y-auto bg-[#F5F2EB]">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-xs font-black transition-all group duration-150 border-2 border-black cursor-pointer ${
                isActive 
                  ? "bg-[#D63031] text-white shadow-[4px_4px_0px_0px_#000000] -translate-x-1 -translate-y-0.5" 
                  : "bg-white text-black hover:bg-[#FFC300] hover:shadow-[2px_2px_0px_0px_#000000] hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? "text-white" : "text-black"}`} />
                <span>{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {item.badge && (
                  <span className={`text-[8px] px-1.5 py-0.5 font-bold border border-black rounded-none font-mono ${isActive ? "bg-[#FFC300] text-black" : "bg-[#0055A5] text-white"}`}>
                    {item.badge}
                  </span>
                )}
                <ChevronRight className={`w-3 h-3 ${isActive ? "text-white" : "text-black"}`} />
              </div>
            </button>
          );
        })}

        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-none text-xs font-black transition-all bg-[#FAF8F5] text-black hover:bg-[#D63031] hover:text-white border-2 border-black hover:shadow-[2px_2px_0px_0px_#000000] hover:-translate-y-0.5 cursor-pointer mt-6"
          >
            <div className="flex items-center gap-2.5">
              <LogOut className="w-4 h-4 shrink-0" />
              <span>LOG OUT</span>
            </div>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </nav>

      {/* Footer / Adaptive Metric Widget */}
      <div className="p-4 border-t-4 border-black bg-white shrink-0">
        {currentRole === "inventory_manager" || currentRole === "cashier" ? (
          <div className="bg-[#0055A5] text-white border-2 border-black p-3 rounded-none mb-3 text-left shadow-[3px_3px_0px_0px_#000000]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-[#FFC300] font-bold uppercase tracking-wider font-mono">{currentRole === "inventory_manager" ? "STOCKROOM STATION" : "CASHIER TERMINAL"}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black animate-pulse"></span>
            </div>
            <p className="text-[11px] font-mono font-bold leading-normal text-white">
              {currentRole === "inventory_manager" ? "Inventory workspace active" : "Sales terminal active"}
            </p>
          </div>
        ) : (
          <div className="bg-[#0055A5] text-white border-2 border-black p-3 rounded-none mb-3 text-left shadow-[3px_3px_0px_0px_#000000]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-[#FFC300] font-bold uppercase tracking-wider font-mono">CASH IN HAND</span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#D63031] border border-black animate-pulse"></span>
            </div>
            <p className="text-base font-black tracking-tight font-mono">
              {currency}{cashInHand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        )}
        <p className="text-[9px] text-black font-mono font-bold text-center uppercase tracking-wider">
          RETAIL SYNC • ROLE SYSTEM
        </p>
      </div>
    </div>
  );
}
