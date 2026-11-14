import React, { useState } from "react";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  Package, 
  Wallet,
  Coins,
  ReceiptText,
  History,
  ContactRound,
  TrendingUp, 
  Sparkles, 
  Settings as SettingsIcon,
  BookOpen,
  Store,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Lock,
  Unlock
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
  onChangeRole: (role: ERPRole) => void;
  operatorRole: ERPRole;
  handleSwitchOperator: (role: ERPRole, password?: string, email?: string) => Promise<{ success: boolean; message: string }>;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  shopName,
  cashInHand = 0,
  currency = "$",
  onLogout,
  currentRole,
  onChangeRole,
  operatorRole,
  handleSwitchOperator
}: SidebarProps) {
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [selectedSwitchRole, setSelectedSwitchRole] = useState<ERPRole>("admin");
  const [switchEmail, setSwitchEmail] = useState("");
  const [switchPassword, setSwitchPassword] = useState("");
  const [switchError, setSwitchError] = useState("");

  const handleOpenSwitchModal = (role: ERPRole) => {
    setSelectedSwitchRole(role);
    setSwitchEmail("");
    setSwitchPassword("");
    setSwitchError("");
    setIsSwitchModalOpen(true);
  };

  const handleExecuteSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSwitchError("");
    const res = await handleSwitchOperator(selectedSwitchRole, switchPassword, switchEmail);
    if (res.success) {
      setIsSwitchModalOpen(false);
      setSwitchEmail("");
      setSwitchPassword("");
    } else {
      setSwitchError(res.message);
    }
  };

  // Roles allowed to view each menu item (kept in sync with RoleGuard via ROUTE_ROLES)
  const menuItems = [
    { id: "dashboard", label: "DASHBOARD", icon: LayoutDashboard, roles: ROUTE_ROLES.dashboard },
    { id: "sales", label: "SALES COUNTER", icon: ShoppingCart, roles: ROUTE_ROLES.sales },
    { id: "people", label: "STAFF & PEOPLE", icon: Users, roles: ROUTE_ROLES.people },
    { id: "operations", label: "INVENTORY & PURCHASES", icon: Package, roles: ROUTE_ROLES.operations },
    { id: "parties", label: "PARTIES", icon: ContactRound, roles: ROUTE_ROLES.parties },
    { id: "payments", label: "PAYMENTS", icon: Wallet, roles: ROUTE_ROLES.payments },
    { id: "agent-commissions", label: "AGENT COMMISSIONS", icon: Coins, roles: ROUTE_ROLES["agent-commissions"] },
    { id: "expenses", label: "EXPENSES", icon: ReceiptText, roles: ROUTE_ROLES.expenses },
    { id: "transactions", label: "TRANSACTION HISTORY", icon: History, roles: ROUTE_ROLES.transactions },
    { id: "accounting", label: "ACCOUNTING", icon: BookOpen, roles: ROUTE_ROLES.accounting },
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

      {/* Interactive ERP Role Switcher Console */}
      <div className="mx-4 mt-4 p-3 bg-white border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-black font-mono uppercase text-zinc-500 tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0055A5]" />
            <span>OPERATOR SESSION</span>
          </p>
          {operatorRole === "admin" ? (
            <button 
              onClick={() => handleOpenSwitchModal("cashier")}
              title="Lock Terminal / Switch to Staff"
              className="text-zinc-500 hover:text-black cursor-pointer transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button 
              onClick={() => handleOpenSwitchModal("admin")}
              title="Unlock Owner Controls"
              className="text-[#D63031] hover:text-[#b82021] flex items-center gap-1 font-mono text-[8px] font-black uppercase cursor-pointer"
            >
              <Unlock className="w-3 h-3 animate-bounce" />
              <span>Unlock Admin</span>
            </button>
          )}
        </div>

        {/* If session is locked as cashier or stock manager, hide other roles entirely */}
        {operatorRole !== "admin" ? (
          <div className="flex items-center justify-between bg-zinc-50 p-2 border border-dashed border-black/30">
            <div>
              <p className="text-[9px] font-black font-mono uppercase text-zinc-400">ACTIVE OPERATOR</p>
              <p className="text-xs font-black text-black font-mono uppercase tracking-tight">
                {operatorRole === "cashier" ? "CASHIER ROLE" : "STOCK MANAGER"}
              </p>
            </div>
            <button
              onClick={() => handleOpenSwitchModal("admin")}
              className="px-2 py-1 bg-black text-white hover:bg-zinc-800 text-[8px] font-black uppercase tracking-wider border border-black cursor-pointer shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
            >
              Switch User
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'admin', label: 'ADMIN', color: '#D63031' },
              { id: 'cashier', label: 'CASHIER', color: '#FFC300' },
              { id: 'inventory_manager', label: 'STOCK', color: '#0055A5' },
            ].map((r) => {
              const isSelected = currentRole === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => onChangeRole(r.id as ERPRole)}
                  style={{ 
                    backgroundColor: isSelected ? r.color : '#FFFFFF', 
                    color: isSelected ? (r.id === 'cashier' ? '#000000' : '#FFFFFF') : '#000000' 
                  }}
                  className={`py-1 text-[8px] font-black border border-black rounded-none transition-all cursor-pointer text-center uppercase tracking-tighter ${
                    isSelected 
                      ? 'shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5' 
                      : 'hover:bg-zinc-100'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Operator Switch Authenticator Modal */}
      {isSwitchModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#FAF8F5] border-4 border-black p-6 w-full max-w-sm rounded-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-fadeIn text-black">
            <div className="border-b-2 border-black pb-3 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-black" />
              <h3 className="font-black uppercase text-sm tracking-tight">OPERATOR AUTHENTICATOR</h3>
            </div>

             <form onSubmit={handleExecuteSwitch} className="space-y-4">
              {operatorRole === "admin" ? (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">
                    Select Destination Operator
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "admin", label: "ADMIN / OWNER" },
                      { id: "cashier", label: "CASHIER" },
                      { id: "inventory_manager", label: "STOCK ROOM" }
                    ].map((roleOpt) => {
                      const isSel = selectedSwitchRole === roleOpt.id;
                      return (
                        <button
                          key={roleOpt.id}
                          type="button"
                          onClick={() => setSelectedSwitchRole(roleOpt.id as ERPRole)}
                          className={`py-2 text-[9px] font-black border-2 border-black rounded-none text-center uppercase tracking-tighter transition-all cursor-pointer ${
                            isSel ? "bg-[#FFC300] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5" : "bg-white text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {roleOpt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-100 p-2.5 border border-dashed border-black/30 font-mono text-[10px] font-black uppercase">
                  Destination Operator: <span className="text-[#D63031]">ADMIN / OWNER</span>
                  <p className="text-[9px] text-zinc-500 font-normal mt-1 lowercase leading-tight">
                    Enter the Admin/Owner password below to authorize and unlock full dashboard controls.
                  </p>
                </div>
              )}

              {(selectedSwitchRole === "cashier" || selectedSwitchRole === "inventory_manager") && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">
                    Operator Email / Login
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Enter onboarded email..."
                    value={switchEmail}
                    onChange={(e) => setSwitchEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-black text-black rounded-none text-xs font-bold focus:outline-none font-mono mb-3"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">
                  Operator Password / PIN
                </label>
                <input
                  type="password"
                  required
                  placeholder={
                    selectedSwitchRole === "admin" 
                      ? "Default is 'admin'" 
                      : selectedSwitchRole === "cashier" 
                        ? "Default is 'cashier123'" 
                        : "Default is 'stock123'"
                  }
                  value={switchPassword}
                  onChange={(e) => setSwitchPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-black text-black rounded-none text-xs font-bold focus:outline-none font-mono"
                  autoFocus
                />
              </div>

              {switchError && (
                <div className="p-2.5 bg-red-50 border-2 border-[#D63031] text-[#D63031] text-[10px] font-mono font-bold uppercase leading-normal">
                  ⚠️ {switchError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSwitchModalOpen(false)}
                  className="flex-1 py-2 bg-white hover:bg-zinc-100 border-2 border-black text-black text-xs font-black uppercase transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-black hover:bg-zinc-800 text-[#FFC300] text-xs font-black uppercase transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  Authorize Switch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
        {currentRole === "inventory_manager" ? (
          <div className="bg-[#0055A5] text-white border-2 border-black p-3 rounded-none mb-3 text-left shadow-[3px_3px_0px_0px_#000000]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-[#FFC300] font-bold uppercase tracking-wider font-mono">STOCKROOM STATION</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black animate-pulse"></span>
            </div>
            <p className="text-[11px] font-mono font-bold leading-normal text-white">
              Secured Warehouse Channels Active
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
