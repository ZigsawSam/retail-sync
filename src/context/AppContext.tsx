"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import type {
  Product,
  Customer,
  CommissionAgent,
  Staff,
  StaffLogin,
  Sale,
  Expense,
  StoreSettings,
  Cheque,
  ElectronicTx,
  ERPRole,
} from "../types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============================================
// CUSTOM STAFF LOGIN (NOT Supabase Auth)
// Staff log in by querying staff_logins table directly.
// Only the owner uses Supabase Auth.
// ============================================
export interface StaffSession {
  staffLoginId: string;
  name: string;
  role: "cashier" | "inventory_manager";
}

interface AppContextType {
  // Auth
  currentUser: any;
  staffSession: StaffSession | null;
  isLoading: boolean;
  authLoading: boolean;
  currentRole: ERPRole;
  operatorRole: ERPRole;
  cashInHand: number;
  currency: string;
  supabaseError: any;
  setSupabaseError: (error: any) => void;
  handleRoleChange: (role: ERPRole) => void;

  // Data
  products: Product[];
  customers: Customer[];
  commissionAgents: CommissionAgent[];
  staff: Staff[];
  staffLogins: StaffLogin[];
  sales: Sale[];
  expenses: Expense[];
  settings: StoreSettings;
  cheques: Cheque[];
  electronicTxs: ElectronicTx[];

  // Computed
  lowStockProducts: Product[];
  overstockProducts: Product[];

  // Actions
  handleLogin: (email: string, password: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  handleStaffLogin: (email: string, password: string) => Promise<void>;
  handleStaffLogout: () => void;
  handleSwitchOperator: (role: ERPRole, password?: string, email?: string) => Promise<{ success: boolean; message: string }>;

  handleAddProduct: (product: Omit<Product, "id">) => Promise<void>;
  handleUpdateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  handleDeleteProduct: (id: string) => Promise<void>;

  handleAddCustomer: (customer: Omit<Customer, "id" | "points" | "tier" | "totalSpent">) => Promise<void>;
  handleUpdateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  handleDeleteCustomer: (id: string) => Promise<void>;

  handleAddCommissionAgent: (agent: Omit<CommissionAgent, "totalEarnings">) => Promise<void>;
  handleUpdateCommissionAgent: (phone: string, updates: Partial<CommissionAgent>) => Promise<void>;
  handleDeleteCommissionAgent: (phone: string) => Promise<void>;

  handleAddStaff: (staff: Omit<Staff, "id" | "attendance">) => Promise<void>;
  handleUpdateStaff: (id: string, updates: Partial<Staff>) => Promise<void>;
  handleDeleteStaff: (id: string) => Promise<void>;
  handleMarkAttendance: (staffId: string, date: string, present: boolean, hoursWorked?: number) => Promise<void>;

  handleAddSale: (sale: Omit<Sale, "id" | "timestamp" | "processedBy" | "processedByName">) => Promise<void>;
  handleUpdateSale: (id: string, updates: Partial<Sale>) => Promise<void>;
  handleDeleteSale: (id: string) => Promise<void>;

  handleAddExpense: (expense: Omit<Expense, "id" | "timestamp" | "loggedBy" | "loggedByName">) => Promise<void>;
  handleUpdateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  handleDeleteExpense: (id: string) => Promise<void>;

  handleUpdateSettings: (updates: Partial<StoreSettings>) => Promise<void>;
  handleResetDatabase: () => Promise<void>;

  handleAddCheque: (cheque: Omit<Cheque, "id" | "timestamp">) => Promise<void>;
  handleUpdateCheque: (id: string, updates: Partial<Cheque>) => Promise<void>;
  handleDeleteCheque: (id: string) => Promise<void>;

  handleAddElectronicTx: (tx: Omit<ElectronicTx, "id" | "timestamp">) => Promise<void>;
  handleUpdateElectronicTx: (id: string, updates: Partial<ElectronicTx>) => Promise<void>;
  handleDeleteElectronicTx: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<ERPRole>("admin");
  const [supabaseError, setSupabaseError] = useState<any>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [commissionAgents, setCommissionAgents] = useState<CommissionAgent[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffLogins, setStaffLogins] = useState<StaffLogin[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({
    shopName: "My Shop",
    taxRate: 5,
    currency: "Rs",
    startingBalance: 0,
  });
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [electronicTxs, setElectronicTxs] = useState<ElectronicTx[]>([]);

  // Load staff session from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem("staffSession");
    if (saved) {
      try {
        setStaffSession(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // Persist staff session
  useEffect(() => {
    if (staffSession) {
      sessionStorage.setItem("staffSession", JSON.stringify(staffSession));
    } else {
      sessionStorage.removeItem("staffSession");
    }
  }, [staffSession]);

  // Auth listener
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ?? null);
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Fetch all data when user is authenticated
  const fetchAllData = useCallback(async () => {
    if (!currentUser) return;

    const userId = currentUser.id;

    // Products
    const { data: productsData } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", userId);
    if (productsData) setProducts(productsData);

    // Customers
    const { data: customersData } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", userId);
    if (customersData) setCustomers(customersData);

    // Commission agents
    const { data: agentsData } = await supabase
      .from("commission_agents")
      .select("*")
      .eq("user_id", userId);
    if (agentsData) setCommissionAgents(agentsData);

    // Staff
    const { data: staffData } = await supabase
      .from("staff")
      .select("*")
      .eq("user_id", userId);
    if (staffData) setStaff(staffData);

    // Staff logins
    const { data: loginsData } = await supabase
      .from("staff_logins")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (loginsData) {
      setStaffLogins(
        loginsData.map((l: any) => ({
          id: l.id,
          userId: l.user_id,
          staffId: l.staff_id,
          name: l.name,
          role: l.role,
          email: l.email,
          password: l.password,
          isActive: l.is_active,
          createdAt: l.created_at,
          terminatedAt: l.terminated_at,
        }))
      );
    }

    // Sales
    const { data: salesData } = await supabase
      .from("sales")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false });
    if (salesData) setSales(salesData);

    // Expenses
    const { data: expensesData } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false });
    if (expensesData) setExpenses(expensesData);

    // Settings
    const { data: settingsData } = await supabase
      .from("settings")
      .select("*")
      .eq("id", userId)
      .single();
    if (settingsData) {
      setSettings({
        shopName: settingsData.shop_name || "My Shop",
        taxRate: settingsData.tax_rate || 5,
        currency: settingsData.currency || "Rs",
        startingBalance: settingsData.starting_balance || 0,
        quickAddProductIds: settingsData.quick_add_product_ids || [],
        theme: settingsData.theme || "enterprise",
        staffAccounts: settingsData.staffAccounts || {},
        ownerPassword: settingsData.owner_password,
      });
    }

    // Cheques
    const { data: chequesData } = await supabase
      .from("cheques")
      .select("*")
      .eq("user_id", userId);
    if (chequesData) setCheques(chequesData);

    // Electronic transactions
    const { data: electronicData } = await supabase
      .from("electronic_transactions")
      .select("*")
      .eq("user_id", userId);
    if (electronicData) setElectronicTxs(electronicData);
  }, [currentUser]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ============================================
  // AUTH FUNCTIONS
  // ============================================

  const handleLogin = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setStaffSession(null);
    sessionStorage.removeItem("staffSession");
  };

  // CUSTOM STAFF LOGIN — queries staff_logins table directly
  // Does NOT use Supabase Auth (staff are not auth.users)
  const handleStaffLogin = async (email: string, password: string) => {
    if (!currentUser) throw new Error("Owner not logged in");

    const { data, error } = await supabase
      .from("staff_logins")
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("email", email)
      .eq("password", password)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      throw new Error("Invalid staff credentials");
    }

    const session: StaffSession = {
      staffLoginId: data.id,
      name: data.name,
      role: data.role,
    };

    setStaffSession(session);
  };

  const handleStaffLogout = () => {
    setStaffSession(null);
    sessionStorage.removeItem("staffSession");
  };

  // Switch operator role (for owner)
  const handleSwitchOperator = async (role: ERPRole, password?: string, email?: string) => {
    try {
      if (role === "admin") {
        setStaffSession(null);
        setSelectedRole("admin");
        sessionStorage.removeItem("staffSession");
        return { success: true, message: "Admin controls unlocked." };
      }

      if (!currentUser) return { success: false, message: "Owner session is unavailable. Sign in again." };
      if (!email?.trim() || !password) return { success: false, message: "Enter the staff email and password." };

      const { data, error } = await supabase
        .from("staff_logins")
        .select("id,name,role")
        .eq("user_id", currentUser.id)
        .eq("email", email.trim().toLowerCase())
        .eq("password", password)
        .eq("role", role)
        .eq("is_active", true)
        .single();

      if (error || !data) return { success: false, message: "Invalid staff credentials or inactive account." };
      setStaffSession({ staffLoginId: data.id, name: data.name, role: data.role });
      return { success: true, message: "Operator session changed." };
    } catch (error: any) {
      return { success: false, message: error?.message || "Unable to switch operator." };
    }
  };

  // ============================================
  // DATA MUTATION FUNCTIONS
  // ============================================

  const getAuditFields = () => {
    if (staffSession) {
      return {
        processed_by: staffSession.staffLoginId,
        processed_by_name: staffSession.name,
        logged_by: staffSession.staffLoginId,
        logged_by_name: staffSession.name,
      };
    }
    return {};
  };

  const handleAddProduct = async (product: Omit<Product, "id">) => {
    if (!currentUser) throw new Error("Not authenticated");
    const { data, error } = await supabase
      .from("products")
      .insert([{ ...product, user_id: currentUser.id }])
      .select()
      .single();
    if (error) throw error;
    setProducts((prev) => [...prev, data]);
  };

  const handleUpdateProduct = async (id: string, updates: Partial<Product>) => {
    const { error } = await supabase.from("products").update(updates).eq("id", id);
    if (error) throw error;
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleDeleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddCustomer = async (customer: Omit<Customer, "id" | "points" | "tier" | "totalSpent">) => {
    if (!currentUser) throw new Error("Not authenticated");
    const newCustomer = { ...customer, points: 0, tier: "Bronze" as const, totalSpent: 0, user_id: currentUser.id };
    const { data, error } = await supabase.from("customers").insert([newCustomer]).select().single();
    if (error) throw error;
    setCustomers((prev) => [...prev, data]);
  };

  const handleUpdateCustomer = async (id: string, updates: Partial<Customer>) => {
    const { error } = await supabase.from("customers").update(updates).eq("id", id);
    if (error) throw error;
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleDeleteCustomer = async (id: string) => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddCommissionAgent = async (agent: Omit<CommissionAgent, "totalEarnings">) => {
    if (!currentUser) throw new Error("Not authenticated");
    const newAgent = { ...agent, totalEarnings: 0, user_id: currentUser.id };
    const { data, error } = await supabase.from("commission_agents").insert([newAgent]).select().single();
    if (error) throw error;
    setCommissionAgents((prev) => [...prev, data]);
  };

  const handleUpdateCommissionAgent = async (phone: string, updates: Partial<CommissionAgent>) => {
    const { error } = await supabase.from("commission_agents").update(updates).eq("phone", phone);
    if (error) throw error;
    setCommissionAgents((prev) => prev.map((a) => (a.phone === phone ? { ...a, ...updates } : a)));
  };

  const handleDeleteCommissionAgent = async (phone: string) => {
    const { error } = await supabase.from("commission_agents").delete().eq("phone", phone);
    if (error) throw error;
    setCommissionAgents((prev) => prev.filter((a) => a.phone !== phone));
  };

  const handleAddStaff = async (staffMember: Omit<Staff, "id" | "attendance">) => {
    if (!currentUser) throw new Error("Not authenticated");
    const newStaff = { ...staffMember, attendance: {}, user_id: currentUser.id };
    const { data, error } = await supabase.from("staff").insert([newStaff]).select().single();
    if (error) throw error;
    setStaff((prev) => [...prev, data]);
  };

  const handleUpdateStaff = async (id: string, updates: Partial<Staff>) => {
    const { error } = await supabase.from("staff").update(updates).eq("id", id);
    if (error) throw error;
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleDeleteStaff = async (id: string) => {
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) throw error;
    setStaff((prev) => prev.filter((s) => s.id !== id));
  };

  const handleMarkAttendance = async (staffId: string, date: string, present: boolean, hoursWorked?: number) => {
    const staffMember = staff.find((s) => s.id === staffId);
    if (!staffMember) return;

    const rate = staffMember.rate;
    let wageEarned: number | undefined;

    if (present) {
      if (staffMember.paymentType === "Daily wage") {
        wageEarned = rate;
      } else if (staffMember.paymentType === "Hourly" && hoursWorked) {
        wageEarned = rate * hoursWorked;
      }
    }

    const attendance = {
      ...staffMember.attendance,
      [date]: { present, hoursWorked, wageEarned },
    };

    const { error } = await supabase.from("staff").update({ attendance }).eq("id", staffId);
    if (error) throw error;
    setStaff((prev) => prev.map((s) => (s.id === staffId ? { ...s, attendance } : s)));
  };

  const handleAddSale = async (sale: Omit<Sale, "id" | "timestamp" | "processedBy" | "processedByName">) => {
    if (!currentUser) throw new Error("Not authenticated");

    const audit = getAuditFields();
    const newSale = {
      ...sale,
      user_id: currentUser.id,
      timestamp: new Date().toISOString(),
      processed_by: audit.processed_by || null,
      processed_by_name: audit.processed_by_name || null,
    };

    const { data, error } = await supabase.from("sales").insert([newSale]).select().single();
    if (error) throw error;
    setSales((prev) => [data, ...prev]);
  };

  const handleUpdateSale = async (id: string, updates: Partial<Sale>) => {
    const { error } = await supabase.from("sales").update(updates).eq("id", id);
    if (error) throw error;
    setSales((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleDeleteSale = async (id: string) => {
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) throw error;
    setSales((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddExpense = async (expense: Omit<Expense, "id" | "timestamp" | "loggedBy" | "loggedByName">) => {
    if (!currentUser) throw new Error("Not authenticated");

    const audit = getAuditFields();
    const newExpense = {
      ...expense,
      user_id: currentUser.id,
      timestamp: new Date().toISOString(),
      logged_by: audit.logged_by || null,
      logged_by_name: audit.logged_by_name || null,
    };

    const { data, error } = await supabase.from("expenses").insert([newExpense]).select().single();
    if (error) throw error;
    setExpenses((prev) => [data, ...prev]);
  };

  const handleUpdateExpense = async (id: string, updates: Partial<Expense>) => {
    const { error } = await supabase.from("expenses").update(updates).eq("id", id);
    if (error) throw error;
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const handleDeleteExpense = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleUpdateSettings = async (updates: Partial<StoreSettings>) => {
    if (!currentUser) throw new Error("Not authenticated");

    const dbUpdates: any = {};
    if (updates.shopName !== undefined) dbUpdates.shop_name = updates.shopName;
    if (updates.taxRate !== undefined) dbUpdates.tax_rate = updates.taxRate;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.startingBalance !== undefined) dbUpdates.starting_balance = updates.startingBalance;
    if (updates.quickAddProductIds !== undefined) dbUpdates.quick_add_product_ids = updates.quickAddProductIds;
    if (updates.theme !== undefined) dbUpdates.theme = updates.theme;
    if (updates.staffAccounts !== undefined) dbUpdates.staffAccounts = updates.staffAccounts;
    if (updates.ownerPassword !== undefined) dbUpdates.owner_password = updates.ownerPassword;

    const { error } = await supabase.from("settings").update(dbUpdates).eq("id", currentUser.id);
    if (error) throw error;
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const handleResetDatabase = async () => {
    if (!currentUser) throw new Error("Not authenticated");
    const tables = ["products", "customers", "commission_agents", "staff", "staff_logins", "sales", "expenses", "cheques", "electronic_transactions"];
    for (const table of tables) {
      await supabase.from(table).delete().eq("user_id", currentUser.id);
    }
    setProducts([]);
    setCustomers([]);
    setCommissionAgents([]);
    setStaff([]);
    setStaffLogins([]);
    setSales([]);
    setExpenses([]);
    setCheques([]);
    setElectronicTxs([]);
  };

  const handleAddCheque = async (cheque: Omit<Cheque, "id" | "timestamp">) => {
    if (!currentUser) throw new Error("Not authenticated");
    const newCheque = { ...cheque, user_id: currentUser.id, timestamp: new Date().toISOString() };
    const { data, error } = await supabase.from("cheques").insert([newCheque]).select().single();
    if (error) throw error;
    setCheques((prev) => [...prev, data]);
  };

  const handleUpdateCheque = async (id: string, updates: Partial<Cheque>) => {
    const { error } = await supabase.from("cheques").update(updates).eq("id", id);
    if (error) throw error;
    setCheques((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleDeleteCheque = async (id: string) => {
    const { error } = await supabase.from("cheques").delete().eq("id", id);
    if (error) throw error;
    setCheques((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddElectronicTx = async (tx: Omit<ElectronicTx, "id" | "timestamp">) => {
    if (!currentUser) throw new Error("Not authenticated");
    const newTx = { ...tx, user_id: currentUser.id, timestamp: new Date().toISOString() };
    const { data, error } = await supabase.from("electronic_transactions").insert([newTx]).select().single();
    if (error) throw error;
    setElectronicTxs((prev) => [...prev, data]);
  };

  const handleUpdateElectronicTx = async (id: string, updates: Partial<ElectronicTx>) => {
    const { error } = await supabase.from("electronic_transactions").update(updates).eq("id", id);
    if (error) throw error;
    setElectronicTxs((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const handleDeleteElectronicTx = async (id: string) => {
    const { error } = await supabase.from("electronic_transactions").delete().eq("id", id);
    if (error) throw error;
    setElectronicTxs((prev) => prev.filter((t) => t.id !== id));
  };

  const currentRole: ERPRole = staffSession?.role ?? selectedRole;
  const operatorRole: ERPRole = staffSession?.role ?? selectedRole;
  const handleRoleChange = (role: ERPRole) => {
    if (!staffSession) setSelectedRole(role);
  };
  const cashInHand = Number(settings.startingBalance || 0);
  const currency = settings.currency || "Rs";

  const lowStockProducts = products.filter((p) => p.quantity <= p.lowStockLimit);
  const overstockProducts = products.filter((p) => p.quantity >= p.overstockLimit);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        staffSession,
        isLoading,
        authLoading: isLoading,
        currentRole,
        operatorRole,
        cashInHand,
        currency,
        supabaseError,
        setSupabaseError,
        handleRoleChange,
        products,
        customers,
        commissionAgents,
        staff,
        staffLogins,
        sales,
        expenses,
        settings,
        cheques,
        electronicTxs,
        lowStockProducts,
        overstockProducts,
        handleLogin,
        handleLogout,
        handleStaffLogin,
        handleStaffLogout,
        handleSwitchOperator,
        handleAddProduct,
        handleUpdateProduct,
        handleDeleteProduct,
        handleAddCustomer,
        handleUpdateCustomer,
        handleDeleteCustomer,
        handleAddCommissionAgent,
        handleUpdateCommissionAgent,
        handleDeleteCommissionAgent,
        handleAddStaff,
        handleUpdateStaff,
        handleDeleteStaff,
        handleMarkAttendance,
        handleAddSale,
        handleUpdateSale,
        handleDeleteSale,
        handleAddExpense,
        handleUpdateExpense,
        handleDeleteExpense,
        handleUpdateSettings,
        handleResetDatabase,
        handleAddCheque,
        handleUpdateCheque,
        handleDeleteCheque,
        handleAddElectronicTx,
        handleUpdateElectronicTx,
        handleDeleteElectronicTx,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
