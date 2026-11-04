"use client";

import React, { useState, useMemo } from "react";
import { 
  ShoppingCart, 
  Search, 
  Coins, 
  CheckCircle, 
  Award,
  Clock,
  Sparkles,
  Plus,
  Minus,
  Receipt,
  DollarSign,
  TrendingUp,
  TrendingDown,
  BookOpen
} from "lucide-react";
import { Product, Sale, Customer, StoreSettings, Expense } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { SHOP_TODAY_STR, getShopLocalISOString, isToday } from "../lib/dateUtils";

interface CashierDashboardProps {
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  settings: StoreSettings;
  setActiveTab: (tab: string) => void;
  onUpdateActualDrawerCash: (amount: number | null) => void;
  actualDrawerCash: number | null;
  currency: string;
  expenses?: Expense[];
  onAddExpense?: (expense: Expense) => void;
}

export default function CashierDashboard({
  sales,
  products,
  customers,
  settings,
  setActiveTab,
  onUpdateActualDrawerCash,
  actualDrawerCash,
  currency,
  expenses = [],
  onAddExpense
}: CashierDashboardProps) {
  const TODAY_STR = SHOP_TODAY_STR;

  // Search Loyalty Customer
  const [custSearch, setCustSearch] = useState("");
  const [cashierDrawerInput, setCashierDrawerInput] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [discloseReceipts, setDiscloseReceipts] = useState(false);
  const [discloseExpenses, setDiscloseExpenses] = useState(false);

  // Expense & Drawer Cash States
  const [consoleTab, setConsoleTab] = useState<"expense" | "drawer">("expense");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("Other");
  const [expDesc, setExpDesc] = useState("");
  const [expPaymentMethod, setExpPaymentMethod] = useState("Cash");

  const [drawerAction, setDrawerAction] = useState<"add" | "withdraw">("add");
  const [drawerAmount, setDrawerAmount] = useState("");
  const [drawerReason, setDrawerReason] = useState("");

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // 1. Get sales that are processed today
  const todaySales = useMemo(() => {
    return sales.filter(s => isToday(s.timestamp));
  }, [sales]);

  // 2. Personal sales and ticket size
  const mySalesTotal = useMemo(() => {
    return todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
  }, [todaySales]);

  const mySalesCount = todaySales.length;
  
  const averageTicket = useMemo(() => {
    return mySalesCount > 0 ? mySalesTotal / mySalesCount : 0;
  }, [mySalesTotal, mySalesCount]);

  // 3. Get expenses that are processed today
  const todayExpenses = useMemo(() => {
    return expenses.filter(e => isToday(e.timestamp));
  }, [expenses]);

  // Today's expenses by payment method
  const todayCashExpenses = useMemo(() => {
    return todayExpenses
      .filter(e => (e.paymentMethod === "Cash" || !e.paymentMethod) && e.category !== "Drawer Cash Addition" && e.category !== "Drawer Cash Withdrawal")
      .reduce((sum, e) => sum + e.amount, 0);
  }, [todayExpenses]);

  const todayUpiExpenses = useMemo(() => {
    return todayExpenses
      .filter(e => e.paymentMethod === "UPI")
      .reduce((sum, e) => sum + e.amount, 0);
  }, [todayExpenses]);

  const todayChequeExpenses = useMemo(() => {
    return todayExpenses
      .filter(e => e.paymentMethod === "Cheque")
      .reduce((sum, e) => sum + e.amount, 0);
  }, [todayExpenses]);

  const todayCardExpenses = useMemo(() => {
    return todayExpenses
      .filter(e => e.paymentMethod === "Card" || e.paymentMethod === "Credit/Debit Card")
      .reduce((sum, e) => sum + e.amount, 0);
  }, [todayExpenses]);

  // 4. Expected cash in drawer calculations
  const cashSalesToday = useMemo(() => {
    return todaySales
      .filter(s => s.paymentMethod === "Cash")
      .reduce((sum, s) => sum + s.totalAmount, 0);
  }, [todaySales]);

  const cashExpensesToday = useMemo(() => {
    return todayCashExpenses;
  }, [todayCashExpenses]);

  const drawerAdditionsToday = useMemo(() => {
    return todayExpenses
      .filter(e => e.category === "Drawer Cash Addition")
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
  }, [todayExpenses]);

  const drawerWithdrawalsToday = useMemo(() => {
    return todayExpenses
      .filter(e => e.category === "Drawer Cash Withdrawal")
      .reduce((sum, e) => sum + e.amount, 0);
  }, [todayExpenses]);

  const expectedDrawerCash = useMemo(() => {
    return settings.startingBalance + cashSalesToday + drawerAdditionsToday - drawerWithdrawalsToday - cashExpensesToday;
  }, [settings.startingBalance, cashSalesToday, drawerAdditionsToday, drawerWithdrawalsToday, cashExpensesToday]);

  // 5. Customer loyalty lookup
  const searchedCustomer = useMemo(() => {
    if (!custSearch.trim()) return null;
    return customers.find(c => 
      c.phone.includes(custSearch) || 
      c.name.toLowerCase().includes(custSearch.toLowerCase())
    );
  }, [custSearch, customers]);

  const handleUpdateDrawer = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(cashierDrawerInput);
    if (isNaN(val) || val < 0) {
      triggerToast("Please enter a valid cash amount");
      return;
    }
    onUpdateActualDrawerCash(val);
    triggerToast("Drawer Cash Counted successfully!");
    setCashierDrawerInput("");
  };

  const handleCashierExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0) {
      triggerToast("Please enter a valid expense amount");
      return;
    }
    if (!onAddExpense) {
      triggerToast("Expense logger not loaded yet.");
      return;
    }

    const newExpense: Expense = {
      id: "exp-" + Date.now(),
      category: expCategory as any,
      amount: amt,
      description: expDesc || `${expCategory} logged by cashier`,
      timestamp: getShopLocalISOString(),
      paymentMethod: expPaymentMethod
    };

    onAddExpense(newExpense);
    triggerToast(`Logged ${currency}${amt.toLocaleString()} expense under ${expCategory} successfully!`);
    
    setExpAmount("");
    setExpDesc("");
    setExpCategory("Other");
    setExpPaymentMethod("Cash");
  };

  const handleCashierDrawerAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(drawerAmount);
    if (isNaN(amt) || amt <= 0) {
      triggerToast("Please enter a valid amount");
      return;
    }
    if (!onAddExpense) {
      triggerToast("Expense logger not loaded yet.");
      return;
    }

    if (drawerAction === "add") {
      const newAdjustment: Expense = {
        id: "exp-add-" + Date.now(),
        category: "Drawer Cash Addition" as any,
        amount: -amt, // negative expense amount adds to cash-in-hand
        description: drawerReason || "Drawer float addition",
        timestamp: getShopLocalISOString(),
        paymentMethod: "Cash"
      };
      onAddExpense(newAdjustment);
      triggerToast(`Added ${currency}${amt.toLocaleString()} float to cash drawer successfully!`);
    } else {
      const newAdjustment: Expense = {
        id: "exp-sub-" + Date.now(),
        category: "Drawer Cash Withdrawal" as any,
        amount: amt, // positive expense amount subtracts from cash-in-hand
        description: drawerReason || "Drawer cash withdrawal/drop",
        timestamp: getShopLocalISOString(),
        paymentMethod: "Cash"
      };
      onAddExpense(newAdjustment);
      triggerToast(`Withdrew ${currency}${amt.toLocaleString()} from cash drawer successfully!`);
    }

    setDrawerAmount("");
    setDrawerReason("");
  };

  const drawerDiscrepancy = actualDrawerCash !== null ? actualDrawerCash - expectedDrawerCash : null;

  return (
    <div className="w-full min-h-full bg-[#FAF9F6] p-4 md:p-8 text-black font-sans">
      
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 bg-white border-3 border-black text-black px-5 py-3 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 flex items-center gap-2.5 font-mono text-xs font-black"
          >
            <CheckCircle className="w-4 h-4 text-[#D63031]" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b-4 border-black pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#FFC300] border-2 border-black text-[10px] font-black uppercase tracking-wider mb-2 font-mono">
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Station: Main Cash Counter</span>
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-black">Sales Associate Dashboard</h2>
          <p className="text-xs text-zinc-600 font-mono mt-1 uppercase tracking-widest font-bold">Shift Active • Station: POS-01 • Have an amazing day assisting our guests!</p>
        </div>

        <div>
          <button 
            onClick={() => setActiveTab("sales")}
            className="flex items-center gap-3 px-6 py-3.5 bg-[#D63031] text-white border-3 border-black rounded-none text-sm font-black tracking-wider hover:bg-[#E54849] transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 cursor-pointer"
          >
            <ShoppingCart className="w-5 h-5 text-white animate-pulse" />
            <span>OPEN POS COUNTER / SALES CHECKOUT</span>
          </button>
        </div>
      </div>

      {/* Cashier Specific KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Sales */}
        <div className="bg-[#FFC300] p-5 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[9px] text-zinc-700 font-black uppercase font-mono tracking-wider">MY SHIFT SALES</p>
          <p className="text-2xl font-black font-mono mt-2">{currency}{mySalesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <div className="text-[10px] text-zinc-700 font-bold mt-2 font-mono uppercase">
            From cash, card, & digital transactions
          </div>
        </div>

        {/* Total Invoices */}
        <div className="bg-white p-5 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[9px] text-zinc-500 font-black uppercase font-mono tracking-wider">BILLS COMPLETED</p>
          <p className="text-2xl font-black font-mono mt-2">{mySalesCount} Receipts</p>
          <div className="text-[10px] text-zinc-500 font-bold mt-2 font-mono uppercase">
            Active speed: {mySalesCount > 0 ? "Fast" : "Idle"}
          </div>
        </div>

        {/* Avg Invoice Size */}
        <div className="bg-white p-5 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[9px] text-zinc-500 font-black uppercase font-mono tracking-wider">AVERAGE BASKET SIZE</p>
          <p className="text-2xl font-black font-mono mt-2">{currency}{averageTicket.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          <div className="text-[10px] text-zinc-500 font-bold mt-2 font-mono uppercase">
            Sales per customer visit
          </div>
        </div>

        {/* Drawer Float Reconciliation */}
        <div className="bg-[#0055A5] p-5 rounded-none border-3 border-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-[9px] text-[#FFC300] font-black uppercase font-mono tracking-wider">EXPECTED CASH FLOAT</p>
          <p className="text-2xl font-black font-mono mt-2">{currency}{expectedDrawerCash.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          <div className="text-[9px] text-white/90 mt-2 font-mono uppercase flex justify-between">
            <span>Float: {currency}{settings.startingBalance}</span>
            <span>Sales: {currency}{cashSalesToday}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Loyalty Customer Finder & Shift Reconciliation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Loyalty and Records */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* LOYALTY CARD CHECKER */}
          <div className="bg-white p-6 rounded-none border-3 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-2 border-black pb-3 mb-4">
              <h3 className="text-lg font-black uppercase text-black flex items-center gap-2">
                <Award className="w-5 h-5 text-[#0055A5]" />
                <span>Loyalty Club Search & Point Lookup</span>
              </h3>
              <p className="text-xs text-zinc-600 font-bold font-mono">
                Verify customer tiers, loyalty points, and redeemable balances during transaction checkout.
              </p>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 w-4.5 h-4.5 text-zinc-500" />
              <input 
                type="text"
                placeholder="Enter customer phone number or name..."
                value={custSearch}
                onChange={(e) => setCustSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-black rounded-none text-xs font-mono font-bold focus:outline-none"
              />
            </div>

            {searchedCustomer ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-[#FFC300]/10 border-2 border-black rounded-none flex flex-col sm:flex-row items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm uppercase">{searchedCustomer.name}</span>
                    <span className={`text-[8px] px-2 py-0.5 border border-black font-mono font-bold uppercase ${
                      searchedCustomer.tier === "Gold" ? "bg-[#FFC300] text-black" : searchedCustomer.tier === "Silver" ? "bg-zinc-200 text-black" : "bg-orange-100 text-black"
                    }`}>
                      {searchedCustomer.tier} Tier
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 font-mono font-semibold mt-1">Phone: {searchedCustomer.phone}</p>
                </div>

                <div className="text-right flex items-center gap-4">
                  <div className="p-2 bg-white border border-black text-center min-w-[100px]">
                    <span className="block text-[8px] font-bold font-mono text-zinc-500 uppercase">LOYALTY POINTS</span>
                    <span className="font-black font-mono text-base text-[#0055A5]">{searchedCustomer.points} pts</span>
                  </div>
                  
                  <div className="p-2 bg-white border border-black text-center min-w-[100px]">
                    <span className="block text-[8px] font-bold font-mono text-zinc-500 uppercase">TOTAL SPENT</span>
                    <span className="font-black font-mono text-base text-emerald-700">{currency}{searchedCustomer.totalSpent.toLocaleString()}</span>
                  </div>
                </div>
              </motion.div>
            ) : custSearch ? (
              <p className="text-xs text-zinc-500 font-mono font-bold py-2">No matching loyalty members found for "{custSearch}"</p>
            ) : (
              <div className="p-4 bg-zinc-50 border border-dashed border-zinc-400 text-center text-xs font-mono text-zinc-500 font-bold">
                Enter phone number (e.g. "98765") to see customer points, discount codes, and rewards.
              </div>
            )}
          </div>

          {/* MY RECENT RECEIPTS LOG */}
          <div className="bg-white p-6 rounded-none border-3 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-2 border-black pb-3 mb-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black uppercase text-black flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#D63031]" />
                  <span>My Completed Receipts Logs</span>
                </h3>
                <p className="text-xs text-zinc-600 font-bold font-mono">
                  Receipt logs submitted during this active cashier shift.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDiscloseReceipts(!discloseReceipts)}
                className="px-3 py-1.5 bg-black text-[#FFC300] hover:bg-zinc-800 text-[9px] font-black uppercase tracking-wider font-mono border-2 border-black cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                {discloseReceipts ? "Hide Receipts" : "Show Receipts"}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {!discloseReceipts ? (
                <motion.div
                  key="receipts-summary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-6 text-center bg-zinc-50 border border-dashed border-zinc-400 font-mono text-xs text-zinc-600 font-bold space-y-2.5"
                >
                  <p>
                    Today, you completed <strong className="text-black font-black font-sans text-sm">{todaySales.length} checkouts</strong>, averaging <strong className="text-[#0055A5]">{currency}{averageTicket.toFixed(2)}</strong> per ticket.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDiscloseReceipts(true)}
                    className="px-4 py-2 bg-[#FFC300] text-black border-2 border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer font-sans"
                  >
                    🔍 Disclose Individual Receipt Details
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="receipts-list"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-x-auto max-h-[300px] overflow-y-auto bg-white"
                >
                  {todaySales.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-xs font-mono font-bold">
                      No receipts recorded during this shift. Start checkout to create invoices.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b-2 border-black bg-zinc-100 text-[10px] font-black uppercase text-zinc-600">
                          <th className="py-2.5 px-3">Invoice ID</th>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3">Method</th>
                          <th className="py-2.5 px-3 text-right">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todaySales.map((sale) => (
                          <tr key={sale.id} className="border-b border-zinc-200 hover:bg-zinc-50">
                            <td className="py-2.5 px-3 font-black text-black">#{sale.id.slice(-6).toUpperCase()}</td>
                            <td className="py-2.5 px-3">{sale.customerName}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-1.5 py-0.5 border border-black text-[9px] font-black uppercase ${
                                sale.paymentMethod === "Cash" ? "bg-[#FFC300] text-black" : 
                                sale.paymentMethod === "UPI" ? "bg-[#0055A5] text-white" : "bg-zinc-200 text-black"
                              }`}>
                                {sale.paymentMethod}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-black">
                              {currency}{sale.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* Right Column: Shift Drawer Reconciliation & Station Info */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* SHIFT CLOSE / REGISTER DRAWER COUNTER */}
          <div className="bg-white p-6 rounded-none border-3 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
            <div className="border-b-2 border-black pb-3 mb-4">
              <h3 className="text-lg font-black uppercase text-black flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-600" />
                <span>Drawer Cash Reconciliator</span>
              </h3>
              <p className="text-xs text-zinc-600 font-bold font-mono">
                Log physical paper cash counted in the physical register drawer to reconcile shift sales.
              </p>
            </div>

            <form onSubmit={handleUpdateDrawer} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-2">
                  PHYSICAL CASH COUNTED ({currency})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 font-mono font-black text-zinc-500 text-xs">{currency}</span>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    placeholder="Enter total cash counted..."
                    value={cashierDrawerInput}
                    onChange={(e) => setCashierDrawerInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 bg-white border-2 border-black rounded-none text-xs font-mono font-bold focus:outline-none"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-black hover:bg-zinc-800 text-white border-2 border-black rounded-none text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                SUBMIT CASH AUDIT COUNT
              </button>
            </form>

            {/* Reconciliation State Output */}
            {actualDrawerCash !== null && (
              <div className="mt-5 p-4 border-2 border-black bg-zinc-50 font-mono text-xs space-y-2.5">
                <p className="font-black uppercase text-black border-b border-zinc-300 pb-1 flex justify-between">
                  <span>AUDIT REPORT:</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 border border-emerald-400">LOGGED</span>
                </p>
                
                <div className="flex justify-between">
                  <span className="text-zinc-600 font-semibold">Expected Cash in Drawer:</span>
                  <span className="font-black text-black">{currency}{expectedDrawerCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-zinc-600 font-semibold">Physical Cash Submitted:</span>
                  <span className="font-black text-black">{currency}{actualDrawerCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="border-t border-dashed border-zinc-400 pt-2 flex justify-between items-center">
                  <span className="font-black text-black uppercase">Drawer Variance:</span>
                  <span className={`font-black text-sm px-2 py-0.5 border border-black ${
                    drawerDiscrepancy === 0 ? "bg-emerald-100 text-emerald-800 border-emerald-500" :
                    drawerDiscrepancy! > 0 ? "bg-amber-100 text-amber-800 border-amber-500" : "bg-red-100 text-red-800 border-red-500"
                  }`}>
                    {drawerDiscrepancy === 0 ? "Perfect Match" : 
                     drawerDiscrepancy! > 0 ? `+${currency}${drawerDiscrepancy?.toFixed(2)} Surplus` : 
                     `-${currency}${Math.abs(drawerDiscrepancy || 0).toFixed(2)} Deficit`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* STATION POLICIES */}
          <div className="bg-[#0055A5]/5 p-5 border-2 border-[#0055A5] font-mono text-xs text-[#0055A5]">
            <p className="font-black uppercase tracking-wider text-black flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-4 h-4 text-[#D63031]" />
              <span>CASHIER GUIDELINES</span>
            </p>
            <ul className="list-disc pl-4 space-y-1 text-zinc-700 leading-relaxed font-bold text-[11px]">
              <li>Never edit prices or allow customer checkouts below the listed retail price.</li>
              <li>Perform cash register counts on active float at shift start and shift close.</li>
              <li>Commission entries can only be credited to registered agents on eligible products.</li>
              <li>Consult store owner or Administrator to refund items or clear ledger discrepancies.</li>
            </ul>
          </div>

        </div>

      </div>

      {/* ======================================================== */}
      {/* CASH BOOK SECTION & DAILY TRANSACTIONS */}
      {/* ======================================================== */}
      <div className="bg-white p-6 rounded-none border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mt-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-4 mb-5 gap-3">
          <div>
            <h3 className="text-xl font-black uppercase text-[#D63031] flex items-center gap-2 animate-fade-in">
              <BookOpen className="w-5 h-5 text-[#D63031]" />
              <span>Cash Book & Daily Expense Tracker</span>
            </h3>
            <p className="text-xs text-zinc-600 font-bold font-mono">
              Record daily store expenses logged with different payment methods (Cash, UPI, Cheque, Card). Manage petty cash and operational overheads.
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] font-mono text-white bg-black px-2.5 py-1 rounded-none border border-black uppercase font-black">
              DAILY CASHBOOK LEDGER
            </span>
          </div>
        </div>

        {/* Categories summaries row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-[#FFC300]/10 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-wider font-mono font-bold">CASH EXPENSES</p>
            <p className="text-lg font-black font-mono text-black mt-1">
              {currency}{todayCashExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-zinc-500 font-bold font-mono mt-0.5">Physical store petty cash spent</p>
          </div>

          <div className="p-4 bg-[#0055A5]/10 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] text-[#0055A5] font-black uppercase tracking-wider font-mono">UPI EXPENSES</p>
            <p className="text-lg font-black font-mono text-black mt-1">
              {currency}{todayUpiExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-zinc-500 font-bold font-mono mt-0.5">Digital mobile transfers out</p>
          </div>

          <div className="p-4 bg-indigo-500/10 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] text-indigo-600 font-black uppercase tracking-wider font-mono">CHEQUE EXPENSES</p>
            <p className="text-lg font-black font-mono text-black mt-1">
              {currency}{todayChequeExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-zinc-500 font-bold font-mono mt-0.5">Cheques issued today</p>
          </div>

          <div className="p-4 bg-[#059669]/10 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] text-[#059669] font-black uppercase tracking-wider font-mono">CARD EXPENSES</p>
            <p className="text-lg font-black font-mono text-black mt-1">
              {currency}{todayCardExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-zinc-500 font-bold font-mono mt-0.5">Corporate card swipes logged</p>
          </div>
        </div>

        {/* Form and list grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Quick Add Expense / Drawer Form */}
          <div className="lg:col-span-5 bg-[#FAF8F5] p-5 border-2 border-black flex flex-col justify-between">
            <div>
              {/* Console Tabs */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setConsoleTab("expense")}
                  className={`py-1.5 text-[10px] font-black border-2 border-black rounded-none uppercase transition-all cursor-pointer ${
                    consoleTab === "expense"
                      ? "bg-[#D63031] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5"
                      : "bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" /> Log Store Expense
                </button>
                <button
                  type="button"
                  onClick={() => setConsoleTab("drawer")}
                  className={`py-1.5 text-[10px] font-black border-2 border-black rounded-none uppercase transition-all cursor-pointer ${
                    consoleTab === "drawer"
                      ? "bg-[#FFC300] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5"
                      : "bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <Coins className="w-3.5 h-3.5 inline mr-1" /> Drawer Cash In/Out
                </button>
              </div>

              {consoleTab === "expense" ? (
                <form onSubmit={handleCashierExpenseSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[9px] text-black font-black uppercase tracking-wider mb-1 font-mono">Category</label>
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      className="w-full text-xs p-2 bg-white border-2 border-black text-black rounded-none font-bold font-mono focus:outline-none"
                    >
                      <option value="Staff Salary">Staff Salary</option>
                      <option value="Agent Commission">Agent Commission</option>
                      <option value="Inventory Purchase">Inventory Purchase</option>
                      <option value="Rent">Rent</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Other">Other Overhead / Expenses</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] text-black font-black uppercase tracking-wider mb-1 font-mono">Amount ({currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 1500"
                        value={expAmount}
                        onChange={(e) => setExpAmount(e.target.value)}
                        className="w-full text-xs p-2 bg-white border-2 border-black text-black rounded-none font-mono font-bold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-black font-black uppercase tracking-wider mb-1 font-mono">Payment Mode</label>
                      <select
                        value={expPaymentMethod}
                        onChange={(e) => setExpPaymentMethod(e.target.value)}
                        className="w-full text-xs p-2 bg-white border-2 border-black text-black rounded-none font-bold font-mono focus:outline-none"
                      >
                        <option value="Cash">Cash Mode</option>
                        <option value="UPI">UPI Transfer</option>
                        <option value="Cheque">Cheque Issued</option>
                        <option value="Card">Card Swipe</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] text-black font-black uppercase tracking-wider mb-1 font-mono">Expense Description</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Office tea & snacks, internet bill..."
                      value={expDesc}
                      onChange={(e) => setExpDesc(e.target.value)}
                      className="w-full text-xs p-2 bg-white border-2 border-black text-black rounded-none font-bold focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-[#D63031] hover:bg-[#b82729] text-white text-xs font-black border-2 border-black rounded-none transition-all flex items-center justify-center gap-1 shadow-[3px_3px_0px_0px_#000] cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-white" /> SAVE EXPENSE
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCashierDrawerAdjustSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-black font-mono mb-1">
                      Adjustment Direction
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDrawerAction("add")}
                        className={`py-1.5 text-[10px] font-mono font-black border-2 border-black rounded-none uppercase transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          drawerAction === "add"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5"
                            : "bg-white text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Cash In (+ Float)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrawerAction("withdraw")}
                        className={`py-1.5 text-[10px] font-mono font-black border-2 border-black rounded-none uppercase transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          drawerAction === "withdraw"
                            ? "bg-red-100 text-red-800 border-red-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -translate-y-0.5"
                            : "bg-white text-zinc-600 hover:bg-zinc-50"
                        }`}
                      >
                        <Minus className="w-3.5 h-3.5 text-red-600" />
                        <span>Cash Out (Drop)</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] text-black font-black uppercase tracking-wider mb-1 font-mono">Amount ({currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={drawerAmount}
                        onChange={(e) => setDrawerAmount(e.target.value)}
                        className="w-full text-xs p-2 bg-white border-2 border-black text-black rounded-none font-mono font-bold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-black font-black uppercase tracking-wider mb-1 font-mono">Payment Mode</label>
                      <input
                        type="text"
                        disabled
                        value="Cash Only"
                        className="w-full text-xs p-2 bg-zinc-100 border-2 border-black text-zinc-500 rounded-none font-mono font-bold focus:outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] text-black font-black uppercase tracking-wider mb-1 font-mono font-bold">Reason / Note</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Added safe float, Drop to manager..."
                      value={drawerReason}
                      onChange={(e) => setDrawerReason(e.target.value)}
                      className="w-full text-xs p-2 bg-white border-2 border-black text-black rounded-none font-bold focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-black hover:bg-zinc-800 text-white border-2 border-black rounded-none text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  >
                    Submit Drawer Adjustment
                  </button>
                </form>
              )}
            </div>

            <div className="text-[9px] text-zinc-500 font-mono mt-4 pt-3 border-t border-black/10 flex justify-between font-bold">
              <span>LEDGER COMPLIANCE</span>
              <span>{TODAY_STR}</span>
            </div>
          </div>

          {/* Right Column: List of Today's logged expenses */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div className="border-2 border-black rounded-none bg-[#FAF8F5] overflow-hidden flex-1 flex flex-col">
              <div className="p-3 bg-black text-white text-[10px] font-black tracking-wider uppercase font-mono flex items-center justify-between">
                <span>TODAY'S EXPENSES ({todayExpenses.length})</span>
                <button
                  type="button"
                  onClick={() => setDiscloseExpenses(!discloseExpenses)}
                  className="px-3 py-1 bg-white text-black text-[9px] font-black uppercase tracking-wider font-mono border border-black cursor-pointer hover:bg-[#D63031] hover:text-white transition-all"
                >
                  {discloseExpenses ? "Hide Log" : "Disclose Log"}
                </button>
              </div>

              <AnimatePresence mode="wait">
                {!discloseExpenses ? (
                  <motion.div
                    key="summary-exp"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="p-8 text-center bg-white space-y-4 flex-1 flex flex-col items-center justify-center min-h-[200px]"
                  >
                    <p className="text-xs text-zinc-600 font-medium max-w-sm leading-relaxed font-sans">
                      Operational costs, salaries, and commissions are accounted for in the daily ledger. Click below to view the detailed debit logs.
                    </p>
                    <button
                      type="button"
                      onClick={() => setDiscloseExpenses(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#D63031] text-white border-2 border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer font-mono"
                    >
                      📕 View Detailed Debit Log
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="detail-exp"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex-1 max-h-[280px] overflow-y-auto divide-y divide-black/20 bg-white"
                  >
                    {todayExpenses.length === 0 ? (
                      <div className="p-12 text-center text-zinc-400 italic font-mono text-xs">
                        No store expenses logged today yet. Use the quick logger on the left to record overheads.
                      </div>
                    ) : (
                      [...todayExpenses]
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .map((exp) => {
                          const isAddition = exp.category === "Drawer Cash Addition" || exp.amount < 0;
                          const isWithdrawal = exp.category === "Drawer Cash Withdrawal";
                          
                          let categoryLabel: string = exp.category;
                          let amountSign = "";
                          let amountColor = "text-black";
                          let amountVal = exp.amount;

                          if (isAddition) {
                            if (exp.category === "Drawer Cash Addition") {
                              categoryLabel = "Cash In (Float)";
                            }
                            amountSign = "+";
                            amountColor = "text-emerald-700 font-bold";
                            amountVal = Math.abs(exp.amount);
                          } else if (isWithdrawal) {
                            categoryLabel = "Cash Out (Drop)";
                            amountSign = "-";
                            amountColor = "text-[#D63031] font-bold";
                            amountVal = Math.abs(exp.amount);
                          } else {
                            amountSign = "-";
                            amountColor = "text-[#D63031] font-bold";
                          }

                          let formattedTime = "";
                          try {
                            formattedTime = new Date(exp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          } catch {
                            formattedTime = exp.timestamp.slice(11, 16);
                          }

                          return (
                            <div key={exp.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#F5F2EB]/30 transition-colors">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-block px-1.5 py-0.5 text-[8px] font-black border uppercase font-mono ${
                                    isAddition ? "bg-emerald-100 text-emerald-800 border-emerald-500" :
                                    isWithdrawal ? "bg-red-100 text-red-800 border-red-500" :
                                    "bg-zinc-100 text-zinc-700 border-black"
                                  }`}>
                                    {categoryLabel}
                                  </span>
                                  <span className="text-[9px] text-zinc-400 font-mono">
                                    {formattedTime}
                                  </span>
                                </div>
                                <p className="text-xs font-black text-black truncate mt-1">{exp.description}</p>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className={`px-2 py-0.5 text-[8px] font-mono font-black border border-black uppercase ${
                                  exp.paymentMethod === "Cash" || !exp.paymentMethod ? "bg-[#FFC300] text-black" :
                                  exp.paymentMethod === "UPI" ? "bg-[#0055A5] text-white" :
                                  exp.paymentMethod === "Cheque" ? "bg-indigo-600 text-white" :
                                  "bg-emerald-600 text-white"
                                }`}>
                                  {exp.paymentMethod || "Cash"}
                                </span>
                                
                                <span className={`font-mono font-black text-xs ${amountColor}`}>
                                  {amountSign}{currency}{amountVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
