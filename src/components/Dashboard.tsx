import React, { useState, useMemo } from "react";
import { 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  UserCheck, 
  Coins, 
  ShoppingBag,
  Bell,
  ArrowRight,
  Users,
  Plus,
  Trash2,
  FileText,
  CreditCard,
  Check,
  Smartphone,
  CheckCircle,
  Clock,
  ChevronRight,
  PlusCircle,
  Search,
  ShoppingCart,
  Percent,
  Layers,
  CheckCircle2,
  BookOpen
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from "recharts";
import { Product, Sale, Expense, Staff, StoreSettings, Cheque, ElectronicTx, Customer, ERPRole } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { isToday, getShopLocalISOString, SHOP_TODAY_STR } from "../lib/dateUtils";
import CashierDashboard from "./CashierDashboard";
import InventoryDashboard from "./InventoryDashboard";

interface DashboardProps {
  products: Product[];
  sales: Sale[];
  expenses: Expense[];
  staff: Staff[];
  settings: StoreSettings;
  setActiveTab: (tab: string) => void;
  onUpdateSettings: (settings: StoreSettings) => void;
  electronicTxs: ElectronicTx[];
  onAddElectronicTx: (tx: ElectronicTx) => void;
  onDeleteElectronicTx: (id: string) => void;
  cheques: Cheque[];
  onAddCheque: (ch: Cheque) => void;
  onDeleteCheque: (id: string) => void;
  actualDrawerCash: number | null;
  onUpdateActualDrawerCash: (amount: number | null) => void;
  onAddSale: (sale: Sale) => void;
  onUpdateSale: (sale: Sale) => void;
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  showInvoiceForm?: boolean;
  setShowInvoiceForm?: (val: boolean) => void;
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  currentRole?: ERPRole;
  onAddProduct: (prod: Product) => void;
  onUpdateProductStock: (id: string, qty: number) => void;
}

export default function Dashboard({ 
  products, 
  sales, 
  expenses, 
  staff, 
  settings, 
  setActiveTab,
  onUpdateSettings,
  electronicTxs,
  onAddElectronicTx,
  onDeleteElectronicTx,
  cheques,
  onAddCheque,
  onDeleteCheque,
  actualDrawerCash,
  onUpdateActualDrawerCash,
  onAddSale,
  onUpdateSale,
  customers,
  onAddCustomer,
  showInvoiceForm,
  setShowInvoiceForm,
  onAddExpense,
  onDeleteExpense,
  currentRole = "admin",
  onAddProduct,
  onUpdateProductStock
}: DashboardProps) {
  // --- ROLE ROUTER FOR DENSE SPECIALIZATION ---
  if (currentRole === "cashier") {
    return (
      <CashierDashboard 
        sales={sales}
        products={products}
        customers={customers}
        settings={settings}
        setActiveTab={setActiveTab}
        onUpdateActualDrawerCash={onUpdateActualDrawerCash}
        actualDrawerCash={actualDrawerCash}
        currency={settings.currency}
        expenses={expenses}
        onAddExpense={onAddExpense}
      />
    );
  }

  if (currentRole === "inventory_manager") {
    return (
      <InventoryDashboard 
        products={products}
        expenses={expenses}
        settings={settings}
        setActiveTab={setActiveTab}
        onAddProduct={onAddProduct}
        onUpdateProductStock={onUpdateProductStock}
        onAddExpense={onAddExpense}
        currency={settings.currency}
      />
    );
  }

  // Today's date from environment metadata: 2026-07-14
  const TODAY_STR = SHOP_TODAY_STR;

  // --- LOCAL UI STATES ---
  const [showSalesForm, setShowSalesForm] = useState(false);
  const [showDrawerModal, setShowDrawerModal] = useState(false);
  const [showAllTransactionsModal, setShowAllTransactionsModal] = useState(false);
  const [currencyToggle, setCurrencyToggle] = useState(settings.currency);

  // Progressive disclosure states for detailed tables
  const [discloseTransactions, setDiscloseTransactions] = useState(false);
  const [discloseExpenses, setDiscloseExpenses] = useState(false);

  // Quick Expense Form States
  const [expCategory, setExpCategory] = useState<"Staff Salary" | "Agent Commission" | "Inventory Purchase" | "Rent" | "Utilities" | "Other">("Other");
  const [expAmount, setExpAmount] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expPaymentMethod, setExpPaymentMethod] = useState("Cash");

  // Drawer Cash Prompt Form States
  const [promptDrawerCash, setPromptDrawerCash] = useState("");

  // Embedded Sales Form States
  const [isTaxEnabled, setIsTaxEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [salesCart, setSalesCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [selectedCustPhone, setSelectedCustPhone] = useState("");
  const [selectedCustName, setSelectedCustName] = useState("");
  const [salesPaymentMethod, setSalesPaymentMethod] = useState("Cash");
  const [salesChequeNum, setSalesChequeNum] = useState("");
  const [salesChequeBank, setSalesChequeBank] = useState("");

  // Electronic Manual Triggers Forms States
  const [activeLedgerTab, setActiveLedgerTab] = useState<"upi" | "card" | "cheque">("upi");
  const [upiAmount, setUpiAmount] = useState("");
  const [upiDesc, setUpiDesc] = useState("");
  const [upiFlowType, setUpiFlowType] = useState<"pay" | "recv">("recv");

  const [cardAmount, setCardAmount] = useState("");
  const [cardDesc, setCardDesc] = useState("");
  const [cardFlowType, setCardFlowType] = useState<"pay" | "recv">("recv");

  const [manualChequeNum, setManualChequeNum] = useState("");
  const [manualChequeCust, setManualChequeCust] = useState("");
  const [manualChequeAmt, setManualChequeAmt] = useState("");
  const [manualChequeBank, setManualChequeBank] = useState("");

  // Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleQuickAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expAmount);
    if (!amt || amt <= 0) return;

    const newExp: Expense = {
      id: "exp-" + Date.now(),
      category: expCategory,
      amount: amt,
      description: expDesc || `${expCategory} expense`,
      timestamp: getShopLocalISOString(),
      paymentMethod: expPaymentMethod
    };

    onAddExpense(newExp);
    triggerToast(`Expense of ${currencyToggle}${amt.toLocaleString()} recorded in Cash Book successfully!`);

    // Reset fields
    setExpAmount("");
    setExpDesc("");
    setExpCategory("Other");
    setExpPaymentMethod("Cash");
  };

  // --- COMPUTE TODAY'S GENERAL STATS ---
  const todaySales = useMemo(() => {
    return sales.filter(s => isToday(s.timestamp));
  }, [sales]);

  const sortedTodaySalesDesc = useMemo(() => {
    return [...todaySales].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [todaySales]);

  const todaySalesTotal = useMemo(() => {
    return todaySales.reduce((acc, s) => acc + s.totalAmount, 0);
  }, [todaySales]);

  const todayExpenses = useMemo(() => {
    return expenses.filter(e => isToday(e.timestamp));
  }, [expenses]);

  const todayExpensesTotal = useMemo(() => {
    return todayExpenses.reduce((acc, e) => acc + e.amount, 0);
  }, [todayExpenses]);

  // Today's expenses by payment method
  const todayCashExpenses = useMemo(() => {
    return todayExpenses
      .filter(e => (e.paymentMethod === "Cash" || !e.paymentMethod) && e.category !== "Drawer Cash Addition" && e.category !== "Drawer Cash Withdrawal")
      .reduce((sum, e) => sum + e.amount, 0);
  }, [todayExpenses]);

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

  // Today's Profit Margin
  const todayProfit = useMemo(() => {
    let profit = 0;
    todaySales.forEach(sale => {
      sale.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const costPrice = prod ? prod.purchasePrice : 0;
        const margin = (item.price - costPrice) * item.quantity;
        const comm = sale.commissionAgent ? (item.price * item.quantity * (item.commissionPercent / 100)) : 0;
        profit += (margin - comm);
      });
    });
    return profit;
  }, [todaySales, products]);

  // --- CASH DRAWER LEDGER CALCULATIONS ---
  const cashSalesToday = useMemo(() => {
    return todaySales
      .filter(s => s.paymentMethod === "Cash" && s.clearanceStatus === "Cleared")
      .reduce((sum, s) => sum + s.totalAmount, 0);
  }, [todaySales]);

  // Raw transaction payment method totals directly from sales bills (regardless of clearance status)
  const rawCashSalesToday = useMemo(() => {
    return todaySales
      .filter(s => s.paymentMethod === "Cash")
      .reduce((sum, s) => sum + s.totalAmount, 0);
  }, [todaySales]);

  const rawUpiSalesToday = useMemo(() => {
    return todaySales
      .filter(s => s.paymentMethod === "UPI")
      .reduce((sum, s) => sum + s.totalAmount, 0);
  }, [todaySales]);

  const rawChequeSalesToday = useMemo(() => {
    return todaySales
      .filter(s => s.paymentMethod === "Cheque")
      .reduce((sum, s) => sum + s.totalAmount, 0);
  }, [todaySales]);

  const rawCardSalesToday = useMemo(() => {
    return todaySales
      .filter(s => s.paymentMethod === "Card" || s.paymentMethod === "Credit/Debit Card")
      .reduce((sum, s) => sum + s.totalAmount, 0);
  }, [todaySales]);

  const cashExpensesLogged = useMemo(() => {
    // Only count actual cash expenses (excluding additions/withdrawals from this subtotal)
    return todayCashExpenses;
  }, [todayCashExpenses]);

  const calculatedClosingCash = useMemo(() => {
    return settings.startingBalance + cashSalesToday + drawerAdditionsToday - drawerWithdrawalsToday - cashExpensesLogged;
  }, [settings.startingBalance, cashSalesToday, drawerAdditionsToday, drawerWithdrawalsToday, cashExpensesLogged]);

  // --- UPI & CARD & CHEQUE SUMMARIES ---
  const upiReceivedTotal = useMemo(() => {
    const fromSales = todaySales
      .filter(s => s.paymentMethod === "UPI" && s.clearanceStatus === "Cleared")
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const fromManual = electronicTxs
      .filter(t => t.type === "upi_recv" && isToday(t.timestamp))
      .reduce((sum, t) => sum + t.amount, 0);
    return fromSales + fromManual;
  }, [todaySales, electronicTxs]);

  const upiPaymentsTotal = useMemo(() => {
    const fromManual = electronicTxs
      .filter(t => t.type === "upi_pay" && isToday(t.timestamp))
      .reduce((sum, t) => sum + t.amount, 0);
    return fromManual;
  }, [electronicTxs]);

  const cardReceivedTotal = useMemo(() => {
    const fromSales = todaySales
      .filter(s => (s.paymentMethod === "Card" || s.paymentMethod === "Credit/Debit Card") && s.clearanceStatus === "Cleared")
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const fromManual = electronicTxs
      .filter(t => t.type === "card_recv" && isToday(t.timestamp))
      .reduce((sum, t) => sum + t.amount, 0);
    return fromSales + fromManual;
  }, [todaySales, electronicTxs]);

  const cardPaymentsTotal = useMemo(() => {
    const fromManual = electronicTxs
      .filter(t => t.type === "card_pay" && isToday(t.timestamp))
      .reduce((sum, t) => sum + t.amount, 0);
    return fromManual;
  }, [electronicTxs]);

  const chequeReceivedTotal = useMemo(() => {
    const fromSales = todaySales
      .filter(s => s.paymentMethod === "Cheque" && s.clearanceStatus === "Cleared")
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const fromManualCheques = cheques
      .filter(c => isToday(c.timestamp))
      .reduce((sum, c) => sum + c.amount, 0);
    return fromSales + fromManualCheques;
  }, [todaySales, cheques]);

  const combinedUpiTxs = useMemo(() => {
    const fromSales = sales
      .filter(s => s.paymentMethod === "UPI" && isToday(s.timestamp))
      .map(s => ({
        id: s.id,
        type: "upi_recv" as const,
        amount: s.totalAmount,
        description: `Invoice Sale #${s.id.slice(-6)} - ${s.customerName}`,
        timestamp: s.timestamp,
        isAutomated: true
      }));

    const fromManual = electronicTxs
      .filter(t => t.type.startsWith("upi") && isToday(t.timestamp))
      .map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        timestamp: t.timestamp,
        isAutomated: false
      }));

    return [...fromSales, ...fromManual].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [sales, electronicTxs]);

  const combinedCardTxs = useMemo(() => {
    const fromSales = sales
      .filter(s => s.paymentMethod === "Card" && isToday(s.timestamp))
      .map(s => ({
        id: s.id,
        type: "card_recv" as const,
        amount: s.totalAmount,
        description: `Invoice Sale #${s.id.slice(-6)} - ${s.customerName}`,
        timestamp: s.timestamp,
        isAutomated: true
      }));

    const fromManual = electronicTxs
      .filter(t => t.type.startsWith("card") && isToday(t.timestamp))
      .map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        timestamp: t.timestamp,
        isAutomated: false
      }));

    return [...fromSales, ...fromManual].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [sales, electronicTxs]);

  // Global Cash In Hand (Opening Balance + Total Sales - Total Expenses)
  const totalSalesAllTime = useMemo(() => {
    return sales.reduce((acc, s) => acc + s.totalAmount, 0);
  }, [sales]);

  const totalExpensesAllTime = useMemo(() => {
    return expenses.reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  const cashInHand = useMemo(() => {
    return settings.startingBalance + totalSalesAllTime - totalExpensesAllTime;
  }, [settings.startingBalance, totalSalesAllTime, totalExpensesAllTime]);

  // Pending Payments
  const totalStaffWagesEarned = useMemo(() => {
    let total = 0;
    staff.forEach(member => {
      Object.entries(member.attendance).forEach(([date, record]) => {
        if (record.present && record.wageEarned) {
          total += record.wageEarned;
        }
      });
    });
    return total;
  }, [staff]);

  const totalStaffWagesPaid = useMemo(() => {
    return expenses
      .filter(e => e.category === "Staff Salary")
      .reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  const pendingStaffPayment = Math.max(0, totalStaffWagesEarned - totalStaffWagesPaid);

  const totalAgentCommissionsEarned = useMemo(() => {
    return sales
      .filter(s => s.commissionAgent)
      .reduce((acc, s) => acc + (s.commissionAgent?.commissionAmount || 0), 0);
  }, [sales]);

  const totalAgentCommissionsPaid = useMemo(() => {
    return expenses
      .filter(e => e.category === "Agent Commission")
      .reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  const pendingAgentPayment = Math.max(0, totalAgentCommissionsEarned - totalAgentCommissionsPaid);
  const pendingPaymentsTotal = pendingStaffPayment + pendingAgentPayment;

  // Inventory Alerts
  const inventoryAlerts = useMemo(() => {
    const lowStock: Product[] = [];
    const overstocked: Product[] = [];
    products.forEach(p => {
      if (p.quantity <= p.lowStockLimit) {
        lowStock.push(p);
      } else if (p.quantity >= p.overstockLimit) {
        overstocked.push(p);
      }
    });
    return { lowStock, overstocked };
  }, [products]);

  // Top Commission Agents
  const topAgents = useMemo(() => {
    const agentsMap: Record<string, { name: string; phone: string; salesReferred: number; commission: number }> = {};
    sales.forEach(s => {
      if (s.commissionAgent) {
        const name = s.commissionAgent.name;
        if (!agentsMap[name]) {
          agentsMap[name] = {
            name,
            phone: s.commissionAgent.phone,
            salesReferred: 0,
            commission: 0
          };
        }
        agentsMap[name].salesReferred += s.subtotal;
        agentsMap[name].commission += s.commissionAgent.commissionAmount;
      }
    });
    return Object.values(agentsMap).sort((a, b) => b.salesReferred - a.salesReferred).slice(0, 5);
  }, [sales]);

  // Monthly revenue chart
  const monthlyRevenueData = useMemo(() => {
    const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
    const baseTrends: Record<string, { revenue: number; profit: number }> = {
      "Feb": { revenue: 8400, profit: 3100 },
      "Mar": { revenue: 9900, profit: 3800 },
      "Apr": { revenue: 11200, profit: 4600 },
      "May": { revenue: 10500, profit: 4100 },
      "Jun": { revenue: 13100, profit: 5400 },
      "Jul": { revenue: 0, profit: 0 }
    };

    let julRevenue = 0;
    let julProfit = 0;
    sales.forEach(sale => {
      if (sale.timestamp.includes("2026-07")) {
        julRevenue += sale.totalAmount;
        sale.items.forEach(item => {
          const p = products.find(prod => prod.id === item.productId);
          const cost = p ? p.purchasePrice : 0;
          const comm = sale.commissionAgent ? (item.price * item.quantity * (item.commissionPercent / 100)) : 0;
          julProfit += ((item.price - cost) * item.quantity - comm);
        });
      }
    });

    baseTrends["Jul"].revenue = Math.round(julRevenue);
    baseTrends["Jul"].profit = Math.round(julProfit);

    return months.map(m => ({
      name: m,
      Revenue: baseTrends[m].revenue,
      Profit: baseTrends[m].profit
    }));
  }, [sales, products]);

  const currency = settings.currency;

  // --- EMBEDDED SALES FORM HELPERS ---
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.barcode.includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, products]);

  const salesSubtotal = useMemo(() => {
    return salesCart.reduce((sum, item) => sum + (item.product.sellingPrice * item.quantity), 0);
  }, [salesCart]);

  const salesTax = useMemo(() => {
    if (!isTaxEnabled) return 0;
    return Math.round(salesSubtotal * (settings.taxRate / 100) * 100) / 100;
  }, [isTaxEnabled, salesSubtotal, settings.taxRate]);

  const salesTotal = useMemo(() => {
    return salesSubtotal + salesTax;
  }, [salesSubtotal, salesTax]);

  const handleAddToCart = (prod: Product) => {
    if (prod.quantity <= 0) return;
    const existing = salesCart.find(i => i.product.id === prod.id);
    if (existing) {
      if (existing.quantity >= prod.quantity) {
        triggerToast(`Insufficient stock for ${prod.name}`);
        return;
      }
      setSalesCart(salesCart.map(i => i.product.id === prod.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setSalesCart([...salesCart, { product: prod, quantity: 1 }]);
    }
    setSearchQuery("");
  };

  const handleUpdateCartQty = (prodId: string, delta: number) => {
    const item = salesCart.find(i => i.product.id === prodId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setSalesCart(salesCart.filter(i => i.product.id !== prodId));
    } else {
      if (delta > 0 && newQty > item.product.quantity) {
        triggerToast(`Insufficient stock for ${item.product.name}`);
        return;
      }
      setSalesCart(salesCart.map(i => i.product.id === prodId ? { ...i, quantity: newQty } : i));
    }
  };

  const handleFinalizeSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (salesCart.length === 0) {
      triggerToast("Your cart is empty!");
      return;
    }

    const saleId = "TX-" + (1000 + sales.length + 1);
    const resolvedCustName = selectedCustName.trim() || "Walking Customer";
    const resolvedCustPhone = selectedCustPhone.trim() || "N/A";

    // Create the Sale record
    const newSale: Sale = {
      id: saleId,
      customerName: resolvedCustName,
      customerPhone: resolvedCustPhone,
      items: salesCart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.sellingPrice,
        commissionPercent: 0
      })),
      subtotal: salesSubtotal,
      taxRate: isTaxEnabled ? settings.taxRate : 0,
      taxAmount: salesTax,
      totalAmount: salesTotal,
      paymentMethod: salesPaymentMethod,
      timestamp: getShopLocalISOString()
    };

    onAddSale(newSale);

    // Auto onboard customer if phone number is provided
    if (resolvedCustPhone !== "N/A") {
      const exists = customers.some(c => c.phone === resolvedCustPhone);
      if (!exists) {
        onAddCustomer({
          id: "cust-" + Date.now(),
          name: resolvedCustName,
          phone: resolvedCustPhone,
          points: Math.floor(salesTotal / 10),
          tier: "Bronze",
          totalSpent: salesTotal
        });
      }
    }

    // If cheque is selected, save to Cheques section
    if (salesPaymentMethod === "Cheque") {
      const chequeNo = salesChequeNum.trim() || "CHQ-" + Math.floor(100000 + Math.random() * 900000);
      onAddCheque({
        id: "chq-" + Date.now(),
        chequeNumber: chequeNo,
        customerName: resolvedCustName,
        amount: salesTotal,
        bank: salesChequeBank.trim() || "General Bank",
        timestamp: getShopLocalISOString()
      });
      triggerToast(`Sale and Cheque ${chequeNo} registered successfully!`);
    } else {
      triggerToast(`Invoice ${saleId} generated successfully!`);
    }

    // Clean up forms
    setSalesCart([]);
    setSelectedCustName("");
    setSelectedCustPhone("");
    setSalesPaymentMethod("Cash");
    setSalesChequeNum("");
    setSalesChequeBank("");
    setShowSalesForm(false);
  };

  // --- DIGITAL TRANSACTION SETTLEMENT HANDLER ---
  const handleClearTransaction = async (sale: Sale) => {
    const updated = {
      ...sale,
      clearanceStatus: "Cleared" as const
    };
    onUpdateSale(updated);

    // Trigger toast based on payment method
    let msg = "";
    if (sale.paymentMethod === "Cash") {
      msg = `Cash transaction of ${currencyToggle}${sale.totalAmount.toLocaleString()} added to cash drawer ledger.`;
    } else if (sale.paymentMethod === "UPI") {
      msg = `UPI transaction of ${currencyToggle}${sale.totalAmount.toLocaleString()} marked as payment received.`;
    } else if (sale.paymentMethod === "Cheque") {
      msg = `Cheque of ${currencyToggle}${sale.totalAmount.toLocaleString()} marked as deposited in bank.`;
    } else {
      msg = `Transaction of ${currencyToggle}${sale.totalAmount.toLocaleString()} marked as cleared/settled.`;
    }
    triggerToast(msg);
  };

  // --- DRAWER CASH SUBMIT HANDLER ---
  const handleSaveDrawerCash = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(promptDrawerCash);
    if (isNaN(val)) {
      triggerToast("Please enter a valid numeric value!");
      return;
    }
    onUpdateActualDrawerCash(val);
    triggerToast(`Drawer cash updated to ${currency}${val.toLocaleString()}`);
    setShowDrawerModal(false);
  };

  const handleFetchClosingCash = () => {
    setPromptDrawerCash(calculatedClosingCash.toString());
    triggerToast("Calculated closing cash fetched!");
  };

  // --- ELECTRONIC TX SUBMIT HANDLERS ---
  const handleAddUpiTx = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(upiAmount);
    if (isNaN(amt) || amt <= 0) {
      triggerToast("Enter a valid positive UPI amount.");
      return;
    }
    onAddElectronicTx({
      id: "upi-" + Date.now(),
      type: upiFlowType === "pay" ? "upi_pay" : "upi_recv",
      amount: amt,
      description: upiDesc.trim() || (upiFlowType === "pay" ? "UPI payment out" : "UPI payment received"),
      timestamp: getShopLocalISOString()
    });
    setUpiAmount("");
    setUpiDesc("");
    triggerToast(`UPI transaction logged successfully.`);
  };

  const handleAddCardTx = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(cardAmount);
    if (isNaN(amt) || amt <= 0) {
      triggerToast("Enter a valid positive card amount.");
      return;
    }
    onAddElectronicTx({
      id: "card-" + Date.now(),
      type: cardFlowType === "pay" ? "card_pay" : "card_recv",
      amount: amt,
      description: cardDesc.trim() || (cardFlowType === "pay" ? "Card payment out" : "Card payment received"),
      timestamp: getShopLocalISOString()
    });
    setCardAmount("");
    setCardDesc("");
    triggerToast(`Card transaction logged successfully.`);
  };

  const handleAddChequeManual = (e: React.FormEvent) => {
    e.preventDefault();
    const chqNo = manualChequeNum.trim();
    const cust = manualChequeCust.trim();
    const amt = parseFloat(manualChequeAmt);
    if (!chqNo) {
      triggerToast("Cheque number is required!");
      return;
    }
    if (!cust) {
      triggerToast("Customer name is required!");
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      triggerToast("Enter a valid positive cheque amount.");
      return;
    }

    onAddCheque({
      id: "chq-man-" + Date.now(),
      chequeNumber: chqNo,
      customerName: cust,
      amount: amt,
      bank: manualChequeBank.trim() || "General Bank",
      timestamp: getShopLocalISOString()
    });

    setManualChequeNum("");
    setManualChequeCust("");
    setManualChequeAmt("");
    setManualChequeBank("");
    triggerToast(`Cheque ${chqNo} recorded manually.`);
  };

  // --- CURRENCY TOGGLE ACTIONS ---
  const handleCurrencyToggle = (newCurr: string) => {
    setCurrencyToggle(newCurr);
    onUpdateSettings({ ...settings, currency: newCurr });
    triggerToast(`Currency switched to ${newCurr === "Rs." ? "Indian Currency (Rs.)" : "USD ($)"}`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-8 text-black select-none font-sans">
      
      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 bg-white border-3 border-black text-black px-5 py-3 rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 flex items-center gap-2.5 font-mono text-xs font-black"
          >
            <CheckCircle className="w-4 h-4 text-[#D63031]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* Header with Currency Toggle & Buttons */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8 border-b-4 border-black pb-6">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight text-black">Store Overview</h2>
          <p className="text-xs text-black font-mono mt-1 uppercase tracking-widest font-bold">Live analytics • Shop date: {TODAY_STR}</p>
        </div>
 
        {/* Dynamic Controls Zone */}
        <div className="flex flex-wrap items-center gap-4">
          
          {/* INDIAN CURRENCY VS USD TOGGLE */}
          <div className="flex items-center bg-white border-2 border-black rounded-none p-1 shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] uppercase font-mono font-black text-black px-2">Currency:</span>
            <button 
              onClick={() => handleCurrencyToggle("Rs.")}
              className={`px-3 py-1 rounded-none text-xs font-black font-mono transition-all cursor-pointer ${
                currencyToggle === "Rs." || currencyToggle === "₹" ? "bg-[#0055A5] text-white border border-black" : "text-black hover:bg-zinc-100"
              }`}
            >
              INR (Rs.)
            </button>
            <button 
              onClick={() => handleCurrencyToggle("$")}
              className={`px-3 py-1 rounded-none text-xs font-black font-mono transition-all cursor-pointer ${
                currencyToggle === "$" ? "bg-[#0055A5] text-white border border-black" : "text-black hover:bg-zinc-100"
              }`}
            >
              USD ($)
            </button>
          </div>
 
          <div className="flex items-center gap-2">
            {/* Generate Invoice button */}
            <button 
              onClick={() => {
                setActiveTab("sales");
                if (setShowInvoiceForm) {
                  setShowInvoiceForm(true);
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#FFC300] border-2 border-black hover:bg-[#FFE066] text-black rounded-none text-xs font-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:-translate-y-0.5"
            >
              <ShoppingBag className="w-4 h-4 text-black" />
              <span>GENERATE INVOICE</span>
            </button>
 
            {/* Add Drawer Cash Button (Replacing New Sale Bill) */}
            <button 
              onClick={() => {
                setShowDrawerModal(true);
                setPromptDrawerCash(calculatedClosingCash.toString());
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#D63031] hover:bg-[#E54849] text-white border-2 border-black rounded-none text-xs font-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:-translate-y-0.5"
            >
              <Coins className="w-4.5 h-4.5 text-white" />
              <span>ADD DRAWER CASH</span>
            </button>
          </div>
 
        </div>
      </div>
 
      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Cash In Hand Card (Bauhaus Blue) */}
        <motion.div 
          whileHover={{ y: -2, x: -1 }}
          className="bg-[#0055A5] p-6 rounded-none border-3 border-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden"
        >
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-2 translate-y-2">
            <Coins className="w-32 h-32 text-white" />
          </div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <p className="text-[10px] text-[#FFC300] font-black uppercase tracking-wider font-mono">CASH IN HAND</p>
            <div className="p-1.5 bg-white text-black rounded-none border-2 border-black">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono tracking-tight relative z-10">{currencyToggle}{cashInHand.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] text-white/90 font-mono font-bold relative z-10">
            <span>START: {currencyToggle}{settings.startingBalance.toLocaleString()}</span>
          </div>
        </motion.div>
 
        {/* Today's Sales (Bauhaus Yellow) */}
        <motion.div 
          whileHover={{ y: -2, x: -1 }}
          className="bg-[#FFC300] p-6 rounded-none border-3 border-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] text-black font-black uppercase tracking-wider font-mono">TODAY'S SALES</p>
            <div className="p-1.5 bg-white text-black rounded-none border-2 border-black">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono tracking-tight text-black">{currencyToggle}{todaySalesTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] text-[#D63031] font-mono font-black uppercase">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{todaySales.length} bills processed</span>
          </div>
        </motion.div>
 
        {/* Today's Profit (Bauhaus White) */}
        <motion.div 
          whileHover={{ y: -2, x: -1 }}
          className="bg-white p-6 rounded-none border-3 border-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-wider font-mono">TODAY'S PROFIT</p>
            <div className="p-1.5 bg-[#FFC300] text-black rounded-none border-2 border-black">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono tracking-tight text-black">{currencyToggle}{todayProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          <div className="flex items-center gap-1.5 mt-4 text-[10px] text-zinc-500 font-mono font-bold uppercase">
            <span>Margin: {todaySalesTotal > 0 ? Math.round((todayProfit / todaySalesTotal) * 100) : 0}% of sales</span>
          </div>
        </motion.div>
 
        {/* Pending Payments (Bauhaus Red) */}
        <motion.div 
          whileHover={{ y: -2, x: -1 }}
          className="bg-[#D63031] p-6 rounded-none border-3 border-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] text-[#FFC300] font-black uppercase tracking-wider font-mono">PENDING PAYMENTS</p>
            <div className="p-1.5 bg-white text-black rounded-none border-2 border-black">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono tracking-tight text-white">{currencyToggle}{pendingPaymentsTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          <div className="flex justify-between items-center mt-4 text-[9px] font-mono font-bold text-white/95">
            <span>STAFF: {currencyToggle}{pendingStaffPayment.toFixed(0)}</span>
            <span>AGENTS: {currencyToggle}{pendingAgentPayment.toFixed(0)}</span>
          </div>
        </motion.div>
      </div>

      {/* ======================================================== */}
      {/* DIGITAL TRANSACTIONS SECTION (DAILY CLEARANCE CENTER) */}
      {/* ======================================================== */}
      <div className="bg-white p-6 rounded-none border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-4 mb-5 gap-3">
          <div>
            <h3 className="text-xl font-black uppercase text-black flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#0055A5]" />
              <span>Digital Transactions Section & Settlements</span>
            </h3>
            <p className="text-xs text-zinc-600 font-bold font-mono">
              Daily sales invoice payments categorized by method. Clear transactions to update drawers and ledgers.
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] font-mono text-white bg-black px-2.5 py-1 rounded-none border border-black uppercase font-black">
              DAILY RECONCILIATION
            </span>
          </div>
        </div>

        {/* Categories summaries row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-[#FFC300]/10 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-wider font-mono">CASH INVOICES</p>
            <p className="text-lg font-black font-mono text-black mt-1">
              {currencyToggle}{rawCashSalesToday.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-zinc-500 font-bold font-mono mt-0.5">Cleared: {currencyToggle}{cashSalesToday.toLocaleString()}</p>
          </div>

          <div className="p-4 bg-[#0055A5]/10 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] text-[#0055A5] font-black uppercase tracking-wider font-mono">UPI INVOICES</p>
            <p className="text-lg font-black font-mono text-black mt-1">
              {currencyToggle}{rawUpiSalesToday.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-zinc-500 font-bold font-mono mt-0.5">Cleared: {currencyToggle}{upiReceivedTotal.toLocaleString()}</p>
          </div>

          <div className="p-4 bg-indigo-550/10 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] text-[#4f46e5] font-black uppercase tracking-wider font-mono">CHEQUE INVOICES</p>
            <p className="text-lg font-black font-mono text-black mt-1">
              {currencyToggle}{rawChequeSalesToday.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-zinc-500 font-bold font-mono mt-0.5">Cleared: {currencyToggle}{chequeReceivedTotal.toLocaleString()}</p>
          </div>

          <div className="p-4 bg-emerald-550/10 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] text-[#059669] font-black uppercase tracking-wider font-mono">CARD INVOICES</p>
            <p className="text-lg font-black font-mono text-black mt-1">
              {currencyToggle}{rawCardSalesToday.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-zinc-500 font-bold font-mono mt-0.5">Cleared: {currencyToggle}{cardReceivedTotal.toLocaleString()}</p>
          </div>
        </div>

        {/* Transactions Table/List */}
        <div className="border-2 border-black rounded-none bg-[#FAF8F5] overflow-hidden">
          <div className="p-3 bg-black text-white text-[10px] font-black tracking-wider uppercase font-mono flex items-center justify-between">
            <span>TODAY'S INVOICE TRANSACTIONS ({todaySales.length})</span>
            <button
              type="button"
              onClick={() => setDiscloseTransactions(!discloseTransactions)}
              className="px-3 py-1 bg-white text-black text-[9px] font-black uppercase tracking-wider font-mono border border-black cursor-pointer hover:bg-[#FFC300] transition-all"
            >
              {discloseTransactions ? "Hide Audit Log" : "Disclose Audit Log"}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {!discloseTransactions ? (
              <motion.div
                key="summary-tx"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="p-8 text-center bg-white space-y-4"
              >
                <p className="text-xs text-zinc-600 font-medium max-w-lg mx-auto leading-relaxed">
                  Today's transactions are securely recorded and ready for audit. For a clean, distraction-free view, individual ledgers and digital clearance actions are tucked away.
                </p>
                <button
                  type="button"
                  onClick={() => setDiscloseTransactions(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFC300] text-black border-2 border-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer font-mono"
                >
                  🔍 View Full Transaction Audit Log
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="detail-tx"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="max-h-80 overflow-y-auto divide-y divide-black/20 bg-white"
              >
                {todaySales.length === 0 ? (
                  <div className="p-8 text-center text-zinc-400 italic font-mono text-xs">
                    No invoices generated today yet. Add a sales bill from the Sales panel to see transactions here.
                  </div>
                ) : (
                  sortedTodaySalesDesc.slice(0, 4).map((sale) => {
                    const isCleared = sale.clearanceStatus === "Cleared";
                    return (
                      <div key={sale.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white hover:bg-[#F5F2EB]/50 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-[#0055A5]">{sale.id}</span>
                            <span className="text-[9px] text-zinc-500 font-bold font-mono">
                              {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs font-black text-black">Customer: {sale.customerName}</p>
                          <p className="text-[10px] text-zinc-600 font-bold">
                            Items: {sale.items.map(i => `${i.name} (x${i.quantity})`).join(", ")}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 justify-between sm:justify-end">
                          {/* Method badge */}
                          <span className={`px-2 py-0.5 text-[9px] font-mono font-black border-2 border-black uppercase ${
                            sale.paymentMethod === "Cash" ? "bg-[#FFC300] text-black" :
                            sale.paymentMethod === "UPI" ? "bg-[#0055A5] text-white" :
                            sale.paymentMethod === "Cheque" ? "bg-indigo-600 text-white" :
                            sale.paymentMethod === "Card" || sale.paymentMethod === "Credit/Debit Card" ? "bg-emerald-600 text-white" :
                            "bg-zinc-200 text-zinc-800"
                          }`}>
                            {sale.paymentMethod}
                          </span>

                          {/* Transaction Amount */}
                          <span className="text-sm font-black font-mono text-black w-24 text-right">
                            {currencyToggle}{sale.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>

                          {/* Action Button / Success Status */}
                          <div className="w-44 text-right shrink-0">
                            {isCleared ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E6F4EA] border-2 border-[#137333] text-[#137333] text-[10px] font-black font-mono uppercase tracking-wider">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#137333]" />
                                {sale.paymentMethod === "Cash" ? "Added To Drawer" :
                                 sale.paymentMethod === "UPI" ? "Payment Received" :
                                 sale.paymentMethod === "Cheque" ? "Deposited In Bank" :
                                 "Swipe Settled"}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleClearTransaction(sale)}
                                className={`w-full px-3 py-1.5 border-2 border-black rounded-none text-[10px] font-black tracking-wider uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-all hover:translate-y-0.5 hover:shadow-[1px_1px_0px_0px_#000] flex items-center justify-center gap-1 ${
                                  sale.paymentMethod === "Cash" ? "bg-[#FFC300] hover:bg-[#FFE066] text-black" :
                                  sale.paymentMethod === "UPI" ? "bg-[#0055A5] hover:bg-[#1a73e8] text-white" :
                                  sale.paymentMethod === "Cheque" ? "bg-indigo-600 hover:bg-indigo-700 text-white" :
                                  "bg-zinc-800 hover:bg-zinc-900 text-white"
                                }`}
                              >
                                <span>
                                  {sale.paymentMethod === "Cash" ? "Add To Drawer" :
                                   sale.paymentMethod === "UPI" ? "Payment Received" :
                                   sale.paymentMethod === "Cheque" ? "Deposited In Bank" :
                                   "Settle Swipe"}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {/* More transactions button footer */}
                {todaySales.length > 4 && (
                  <div className="p-3 bg-zinc-100 border-t-2 border-black flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAllTransactionsModal(true)}
                      className="px-4 py-2 bg-black text-white hover:bg-zinc-900 text-[10px] font-black uppercase tracking-wider font-mono border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:translate-y-0.5 hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all"
                    >
                      More transaction ({todaySales.length - 4} remaining) →
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ======================================================== */}
      {/* CASH BOOK SECTION & DAILY TRANSACTIONS */}
      {/* ======================================================== */}
      <div className="bg-white p-6 rounded-none border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-4 mb-5 gap-3">
          <div>
            <h3 className="text-xl font-black uppercase text-[#D63031] flex items-center gap-2">
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
              {currencyToggle}{todayCashExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-zinc-500 font-bold font-mono mt-0.5">Physical store petty cash spent</p>
          </div>

          <div className="p-4 bg-[#0055A5]/10 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] text-[#0055A5] font-black uppercase tracking-wider font-mono">UPI EXPENSES</p>
            <p className="text-lg font-black font-mono text-black mt-1">
              {currencyToggle}{todayUpiExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-zinc-500 font-bold font-mono mt-0.5">Digital mobile transfers out</p>
          </div>

          <div className="p-4 bg-indigo-500/10 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] text-indigo-600 font-black uppercase tracking-wider font-mono">CHEQUE EXPENSES</p>
            <p className="text-lg font-black font-mono text-black mt-1">
              {currencyToggle}{todayChequeExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-zinc-500 font-bold font-mono mt-0.5">Cheques issued today</p>
          </div>

          <div className="p-4 bg-[#059669]/10 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] text-[#059669] font-black uppercase tracking-wider font-mono">CARD EXPENSES</p>
            <p className="text-lg font-black font-mono text-black mt-1">
              {currencyToggle}{todayCardExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-zinc-500 font-bold font-mono mt-0.5">Corporate card swipes logged</p>
          </div>
        </div>

        {/* Form and list grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Quick Add Expense Form */}
          <div className="lg:col-span-5 bg-[#FAF8F5] p-5 border-2 border-black flex flex-col justify-between">
            <div>
              <p className="text-xs font-black uppercase text-[#D63031] border-b border-black/20 pb-2 mb-4 font-mono flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Log Store Expense
              </p>
              
              <form onSubmit={handleQuickAddExpense} className="space-y-4">
                <div>
                  <label className="block text-[9px] text-black font-black uppercase tracking-wider mb-1 font-mono">Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as any)}
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
                    <label className="block text-[9px] text-black font-black uppercase tracking-wider mb-1 font-mono">Amount</label>
                    <input
                      type="number"
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
            </div>

            <div className="text-[9px] text-zinc-500 font-mono mt-4 pt-3 border-t border-black/10 flex justify-between font-bold">
              <span>LEDGER COMPLIANCE</span>
              <span>2026-07-14</span>
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
                    <p className="text-xs text-zinc-600 font-medium max-w-sm leading-relaxed">
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
                            amountVal = exp.amount;
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
                                {/* Method Badge */}
                                <span className={`px-2 py-0.5 text-[8px] font-mono font-black border border-black uppercase ${
                                  exp.paymentMethod === "Cash" || !exp.paymentMethod ? "bg-[#FFC300] text-black" :
                                  exp.paymentMethod === "UPI" ? "bg-[#0055A5] text-white" :
                                  exp.paymentMethod === "Cheque" ? "bg-indigo-600 text-white" :
                                  "bg-emerald-600 text-white"
                                }`}>
                                  {exp.paymentMethod || "Cash"}
                                </span>

                                <span className={`font-mono text-xs font-black w-20 text-right ${amountColor}`}>
                                  {amountSign}{currencyToggle}{amountVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteExpense(exp.id);
                                    triggerToast(`Expense deleted from ledger.`);
                                  }}
                                  className="p-1 text-zinc-400 hover:text-[#D63031] hover:bg-[#FCE8E6] rounded border border-transparent cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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

      {/* Main Graph & Agent Table Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Revenue Trend Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-none border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
            <div>
              <h3 className="text-xl font-black uppercase text-black">Revenue & Net Profit</h3>
              <p className="text-xs text-zinc-600 font-bold font-mono">Comparative monthly breakdown of sales and margins</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-black font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border border-black bg-[#0055A5]" />
                <span className="text-black">REVENUE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border border-black bg-[#D63031]" />
                <span className="text-black font-black">NET PROFIT</span>
              </div>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0055A5" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#0055A5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D63031" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#D63031" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke="#000" strokeOpacity={0.15} vertical={false} />
                <XAxis dataKey="name" stroke="#000000" fontSize={11} tickLine={true} axisLine={true} className="font-mono font-bold" />
                <YAxis stroke="#000000" fontSize={11} tickLine={true} axisLine={true} className="font-mono font-bold" />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#FFFFFF", border: "2px solid #000000", borderRadius: "0px", color: "#000000", boxShadow: "4px 4px 0px 0px #000" }} 
                  labelClassName="font-black text-xs font-mono"
                />
                <Area type="monotone" dataKey="Revenue" stroke="#0055A5" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
                <Area type="monotone" dataKey="Profit" stroke="#D63031" strokeWidth={3} fillOpacity={1} fill="url(#colorProf)" name="Profit" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Commission Agents */}
        <div className="bg-white p-6 rounded-none border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col">
          <div className="mb-4">
            <h3 className="text-xl font-black uppercase text-black">Top Sales Agents</h3>
            <p className="text-xs text-zinc-600 font-bold">Highest gross sales referrals generated</p>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3.5">
            {topAgents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-400">
                <Users className="w-10 h-10 stroke-1 mb-2 text-zinc-300" />
                <p className="text-sm font-bold font-mono">No referral logs recorded</p>
                <p className="text-xs font-bold font-mono text-zinc-400">Add an agent when compiling invoice sales.</p>
              </div>
            ) : (
              topAgents.map((agent, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-[#F5F2EB] border-2 border-black rounded-none hover:-translate-y-0.5 transition-all shadow-[2px_2px_0px_0px_#000]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-none bg-[#0055A5] text-white flex items-center justify-center font-black text-sm border-2 border-black">
                      {agent.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-black text-black">{agent.name}</p>
                      <p className="text-xs text-zinc-600 font-bold font-mono">{agent.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-black font-mono">{currencyToggle}{agent.salesReferred.toLocaleString()}</p>
                    <p className="text-[10px] text-[#D63031] font-black font-mono mt-0.5">COMM: {currencyToggle}{agent.commission.toFixed(0)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Low-Stock and Overstock Alerts Section */}
      <div className="bg-white p-6 rounded-none border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-4 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#D63031] animate-pulse" />
            <h3 className="text-xl font-black uppercase text-black">Inventory Alerts</h3>
          </div>
          <button 
            onClick={() => setActiveTab("operations")}
            className="text-xs font-black text-black hover:underline flex items-center gap-1 group font-mono cursor-pointer"
          >
            <span>MANAGE STOCK</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Low Stock Alerts */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-wider text-[#D63031] font-mono mb-3 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#D63031] border border-black inline-block" />
              CRITICAL LOW STOCK ({inventoryAlerts.lowStock.length})
            </h4>
            {inventoryAlerts.lowStock.length === 0 ? (
              <p className="text-xs text-zinc-600 font-bold italic p-3 bg-[#F5F2EB] border-2 border-black rounded-none font-mono">All supply levels are optimized. No alerts.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {inventoryAlerts.lowStock.map((prod) => (
                  <div key={prod.id} className="flex items-center justify-between p-3 bg-[#FCE8E6] border-2 border-black rounded-none">
                    <div>
                      <p className="text-sm font-black text-black">{prod.name}</p>
                      <p className="text-[10px] text-zinc-600 font-bold font-mono">CATEGORY: {prod.category} | SKU: {prod.barcode}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-none text-xs font-black bg-white text-[#D63031] border-2 border-black font-mono">
                        {prod.quantity} Left
                      </span>
                      <p className="text-[9px] text-[#D63031] font-mono mt-1 font-bold">Limit: ≤ {prod.lowStockLimit}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overstock Alerts */}
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-wider text-[#0055A5] font-mono mb-3 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#0055A5] border border-black inline-block" />
              OVERSTOCK WARNINGS ({inventoryAlerts.overstocked.length})
            </h4>
            {inventoryAlerts.overstocked.length === 0 ? (
              <p className="text-xs text-zinc-600 font-bold italic p-3 bg-[#F5F2EB] border-2 border-black rounded-none font-mono">No overstocked warehouses detected.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {inventoryAlerts.overstocked.map((prod) => (
                  <div key={prod.id} className="flex items-center justify-between p-3 bg-[#E8F0FE] border-2 border-black rounded-none">
                    <div>
                      <p className="text-sm font-black text-black">{prod.name}</p>
                      <p className="text-[10px] text-zinc-600 font-bold font-mono">CATEGORY: {prod.category} | SKU: {prod.barcode}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-none text-xs font-black bg-white text-[#0055A5] border-2 border-black font-mono">
                        {prod.quantity} Units
                      </span>
                      <p className="text-[9px] text-blue-900 font-mono mt-1 font-bold">Limit: ≥ {prod.overstockLimit}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DRAWER CASH MODAL PROMPT */}
      <AnimatePresence>
        {showDrawerModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md p-6 rounded-none border-3 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4"
            >
              <div className="flex justify-between items-center border-b-2 border-black pb-3">
                <h3 className="font-black text-black uppercase text-base">Record Cash Drawer Balance</h3>
                <button 
                  onClick={() => setShowDrawerModal(false)}
                  className="text-black hover:text-red-600 font-black text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveDrawerCash} className="space-y-4">
                <div className="p-4 bg-[#F5F2EB] rounded-none border-2 border-black space-y-2 text-xs">
                  <div className="flex justify-between text-black font-bold">
                    <span>System calculated:</span>
                    <span className="font-black text-black font-mono">{currencyToggle}{calculatedClosingCash.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 font-sans leading-normal font-bold">
                    This balance is derived from starting balance cash plus cash sales today, minus cash expenses. Click below to pull instantly.
                  </p>
                  <button 
                    type="button"
                    onClick={handleFetchClosingCash}
                    className="w-full mt-2 py-1.5 bg-[#FFC300] hover:bg-[#FFE066] text-black rounded-none font-mono font-black text-[11px] border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    ⚡ FETCH CALCULATED CLOSING CASH
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">ENTER DRAWER CASH COUNT ({currencyToggle})</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    placeholder="e.g. 12637.60"
                    value={promptDrawerCash}
                    onChange={(e) => setPromptDrawerCash(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-black rounded-none text-black font-mono text-sm font-bold focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowDrawerModal(false)}
                    className="px-4 py-2 bg-white hover:bg-zinc-100 text-black border-2 border-black rounded-none text-xs font-black cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-5 py-2 bg-[#D63031] hover:bg-[#E54849] text-white border-2 border-black rounded-none text-xs font-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    SAVE DRAWER COUNT
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showAllTransactionsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl p-6 rounded-none border-3 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4 flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center border-b-2 border-black pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-black text-black uppercase text-lg">All Invoice Transactions Today ({todaySales.length})</h3>
                </div>
                <button 
                  onClick={() => setShowAllTransactionsModal(false)}
                  className="text-black hover:text-red-600 font-black text-sm cursor-pointer"
                >
                  ✕ CLOSE
                </button>
              </div>

              <p className="text-xs text-zinc-600 font-bold font-mono shrink-0">
                Complete log of digital ledger invoices generated today. Clear outstanding cash/UPI/cheque entries directly from this ledger.
              </p>

              <div className="flex-1 overflow-y-auto border-2 border-black rounded-none bg-[#FAF8F5]">
                <div className="p-2.5 bg-black text-white text-[10px] font-black tracking-wider uppercase font-mono grid grid-cols-12 gap-2 sticky top-0 z-10">
                  <span className="col-span-2">INV ID / TIME</span>
                  <span className="col-span-3">CUSTOMER</span>
                  <span className="col-span-3">ITEMS</span>
                  <span className="col-span-1.5 text-right">METHOD & AMT</span>
                  <span className="col-span-2.5 text-right">ACTION STATUS</span>
                </div>

                <div className="divide-y divide-black/20">
                  {sortedTodaySalesDesc.map((sale) => {
                    const isCleared = sale.clearanceStatus === "Cleared";
                    return (
                      <div key={sale.id} className="p-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-white hover:bg-[#F5F2EB]/50 transition-colors">
                        <div className="col-span-2 space-y-0.5">
                          <span className="font-mono text-xs font-black text-[#0055A5] block">{sale.id}</span>
                          <span className="text-[9px] text-zinc-500 font-bold font-mono block">
                            {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="col-span-3">
                          <p className="text-xs font-black text-black">Customer: {sale.customerName}</p>
                          <p className="text-[9px] text-zinc-400 font-mono">ID: {sale.id.slice(0, 8)}...</p>
                        </div>
                        <div className="col-span-3">
                          <p className="text-[10px] text-zinc-600 font-bold font-sans line-clamp-2 leading-tight">
                            {sale.items.map(i => `${i.name} (x${i.quantity})`).join(", ")}
                          </p>
                        </div>
                        <div className="col-span-1.5 text-right flex md:flex-col items-end justify-between md:justify-center gap-2">
                          <span className={`px-1.5 py-0.5 text-[8px] font-mono font-black border border-black uppercase ${
                            sale.paymentMethod === "Cash" ? "bg-[#FFC300] text-black" :
                            sale.paymentMethod === "UPI" ? "bg-[#0055A5] text-white" :
                            sale.paymentMethod === "Cheque" ? "bg-indigo-600 text-white" :
                            sale.paymentMethod === "Card" || sale.paymentMethod === "Credit/Debit Card" ? "bg-emerald-600 text-white" :
                            "bg-zinc-200 text-zinc-800"
                          }`}>
                            {sale.paymentMethod}
                          </span>
                          <span className="font-mono text-xs font-black text-black">
                            {currencyToggle}{sale.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="col-span-2.5 text-right">
                          {isCleared ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#E6F4EA] border border-[#137333] text-[#137333] text-[9px] font-black font-mono uppercase tracking-wider">
                              <CheckCircle2 className="w-3 h-3 text-[#137333]" />
                              {sale.paymentMethod === "Cash" ? "In Drawer" :
                               sale.paymentMethod === "UPI" ? "Received" :
                               sale.paymentMethod === "Cheque" ? "Deposited" :
                               "Settled"}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleClearTransaction(sale)}
                              className={`w-full px-2 py-1 border border-black rounded-none text-[9px] font-black tracking-wider uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-all hover:translate-y-0.5 hover:shadow-[1px_1px_0px_0px_#000] flex items-center justify-center gap-1 ${
                                sale.paymentMethod === "Cash" ? "bg-[#FFC300] hover:bg-[#FFE066] text-black" :
                                sale.paymentMethod === "UPI" ? "bg-[#0055A5] hover:bg-[#1a73e8] text-white" :
                                sale.paymentMethod === "Cheque" ? "bg-indigo-600 hover:bg-indigo-700 text-white" :
                                "bg-zinc-800 hover:bg-zinc-900 text-white"
                              }`}
                            >
                              <span>
                                {sale.paymentMethod === "Cash" ? "Add To Drawer" :
                                 sale.paymentMethod === "UPI" ? "Recv Payment" :
                                 sale.paymentMethod === "Cheque" ? "Deposit Bank" :
                                 "Settle Swipe"}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAllTransactionsModal(false)}
                  className="px-6 py-2 bg-black hover:bg-zinc-900 text-white border-2 border-black rounded-none text-xs font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                  DONE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
