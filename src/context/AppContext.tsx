"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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
  currencyCode: string;
  setCurrency: (currency: string) => void;
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
  actualDrawerCash: number | null;
  showInvoiceForm: boolean;
  setShowInvoiceForm: (value: boolean) => void;

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
  handleUpdateProductStock: (id: string, quantity: number) => Promise<void>;
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
  handleArchiveStaff: (id: string) => Promise<void>;
  handleRestoreStaff: (id: string) => Promise<void>;
  handleMarkAttendance: (staffId: string, date: string, present: boolean, hoursWorked?: number) => Promise<void>;

  handleAddSale: (sale: Omit<Sale, "id" | "processedBy" | "processedByName">) => Promise<void>;
  handleUpdateSale: (id: string, updates: Partial<Sale>) => Promise<void>;
  handleDeleteSale: (id: string) => Promise<void>;

  handleAddExpense: (expense: Omit<Expense, "id" | "timestamp" | "loggedBy" | "loggedByName">) => Promise<void>;
  handleUpdateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  handleDeleteExpense: (id: string) => Promise<void>;

  handleUpdateSettings: (updates: Partial<StoreSettings>) => Promise<void>;
  refreshData: () => Promise<void>;
  handleResetDatabase: () => Promise<void>;

  handleAddCheque: (cheque: Omit<Cheque, "id" | "timestamp">) => Promise<void>;
  handleUpdateCheque: (id: string, updates: Partial<Cheque>) => Promise<void>;
  handleDeleteCheque: (id: string) => Promise<void>;

  handleAddElectronicTx: (tx: Omit<ElectronicTx, "id" | "timestamp">) => Promise<void>;
  handleUpdateElectronicTx: (id: string, updates: Partial<ElectronicTx>) => Promise<void>;
  handleDeleteElectronicTx: (id: string) => Promise<void>;
  handleUpdateActualDrawerCash: (amount: number | null) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [tenantOwnerId, setTenantOwnerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<ERPRole>("admin");
  const [supabaseError, setSupabaseError] = useState<any>(null);
  const [currencyOverride, setCurrencyOverride] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("retail_sync_display_currency");
      if (saved && /^[A-Z]{3}$/.test(saved)) setCurrencyOverride(saved);
    } catch { /* Storage may be unavailable; use the shop default. */ }
  }, []);

  const setCurrency = useCallback((nextCurrency: string) => {
    if (!/^[A-Z]{3}$/.test(nextCurrency)) return;
    setCurrencyOverride(nextCurrency);
    try { window.localStorage.setItem("retail_sync_display_currency", nextCurrency); } catch { /* Keep in-memory selection. */ }
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [commissionAgents, setCommissionAgents] = useState<CommissionAgent[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffLogins, setStaffLogins] = useState<StaffLogin[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accountPayments, setAccountPayments] = useState<any[]>([]);
  const [staffExpensesTotal, setStaffExpensesTotal] = useState(0);
  const [settings, setSettings] = useState<StoreSettings>({
    shopName: "My Shop",
    taxRate: 5,
    currency: "Rs",
    startingBalance: 0,
  });
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [electronicTxs, setElectronicTxs] = useState<ElectronicTx[]>([]);
  const [actualDrawerCash, setActualDrawerCash] = useState<number | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const lastAuthUserIdRef = useRef<string | null>(null);

  // Auth initialization: always release the startup screen when there is no
  // session or when Supabase cannot restore one. Authenticated identities stay
  // in the loading state until the tenant/role resolution effect completes.
  useEffect(() => {
    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      // Token refreshes happen when a background tab becomes active. They do
      // not represent a new login and must not reset the entire app to loading.
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;

      const user = session?.user ?? null;
      if (user) {
        const isDifferentIdentity = lastAuthUserIdRef.current !== user.id;
        lastAuthUserIdRef.current = user.id;
        // Supabase may emit SIGNED_IN again when a tab regains focus or
        // synchronizes auth storage. Only a genuinely different identity
        // should put the application back into its startup state.
        if (isDifferentIdentity) {
          setCurrentUser(user);
          if (event === "SIGNED_IN") setIsLoading(true);
        }
      } else {
        lastAuthUserIdRef.current = null;
        setCurrentUser(null);
        setStaffSession(null);
        setTenantOwnerId(null);
        setIsLoading(false);
      }
    });

    const restoreSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        const user = data.session?.user ?? null;
        lastAuthUserIdRef.current = user?.id ?? null;
        setCurrentUser(user);
        if (!user) {
          setStaffSession(null);
          setTenantOwnerId(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Unable to restore Supabase session:", error);
        if (!active) return;
        setCurrentUser(null);
        setStaffSession(null);
        setTenantOwnerId(null);
        setSupabaseError(error);
        setIsLoading(false);
      }
    };

    void restoreSession();
    return () => {
      active = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Resolve a staff Auth identity to its shop tenant using database-owned helpers.
  // Never trust a role or owner ID from localStorage/sessionStorage.
  useEffect(() => {
    let cancelled = false;
    const resolveIdentity = async () => {
      if (!currentUser) {
        setTenantOwnerId(null);
        setStaffSession(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      // Clear prior tenant data before resolving the next authenticated identity.
      setProducts([]);
      setCustomers([]);
      setCommissionAgents([]);
      setStaff([]);
      setStaffLogins([]);
      setSales([]);
      setExpenses([]);
      setAccountPayments([]);
      setCheques([]);
      setElectronicTxs([]);
      setActualDrawerCash(null);
      setStaffExpensesTotal(0);
      setSettings({ shopName: "My Shop", taxRate: 5, currency: "Rs", startingBalance: 0 });
      try {
        const [{ data: ownerData, error: ownerError }, { data: roleData, error: roleError }] = await Promise.all([
          supabase.rpc("current_staff_owner_id"),
          supabase.rpc("current_staff_role"),
        ]);
        if (ownerError || roleError) throw ownerError || roleError;
        const role = typeof roleData === "string" ? roleData : null;
        const ownerId = typeof ownerData === "string" ? ownerData : null;

        if (role && ownerId && ["cashier", "inventory_manager"].includes(role)) {
          const { data: login, error: loginError } = await supabase
            .from("staff_logins")
            .select("id,name,role")
            .eq("auth_user_id", currentUser.id)
            .eq("is_active", true)
            .is("terminated_at", null)
            .maybeSingle();
          if (loginError) throw loginError;
          if (!login) throw new Error("This staff account is inactive or not assigned to a shop.");
          if (!cancelled) {
            setTenantOwnerId(ownerId);
            setStaffSession({ staffLoginId: login.id, name: login.name, role: login.role });
            setSelectedRole(login.role);
          }
        } else {
          // A null staff mapping is not proof of owner status. Confirm an owner
          // settings row exists before granting the owner UI/session context.
          const { data: ownerSettings, error: settingsError } = await supabase
            .from("settings").select("id").eq("id", currentUser.id).maybeSingle();
          if (settingsError) throw settingsError;
          if (!ownerSettings) {
            // Email-confirmed registrations have no active session during signup,
            // so initialize their shop profile on their first authenticated login.
            const metadata = currentUser.user_metadata || {};
            if (!metadata.shop_name || !metadata.shop_category || !metadata.shop_subcategory) {
              throw new Error("This account is not an active shop owner or staff member.");
            }
            const { error: initializeError } = await supabase.from("settings").upsert({
              id: currentUser.id,
              userId: currentUser.id,
              shopName: metadata.shop_name,
              shop_category: metadata.shop_category,
              shop_subcategory: metadata.shop_subcategory,
              product_categories: [],
              expense_categories: [],
              taxRate: 5,
              startingBalance: 0,
              currency: "Rs.",
              quickAddProductIds: [],
            });
            if (initializeError) throw initializeError;
          }
          if (!cancelled) {
            setTenantOwnerId(currentUser.id);
            setStaffSession(null);
            setSelectedRole("admin");
          }
        }
      } catch (error: any) {
        console.error("Unable to resolve authenticated operator:", error);
        if (!cancelled) {
          setTenantOwnerId(null);
          setStaffSession(null);
          setSelectedRole("cashier");
          setSupabaseError(error);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    resolveIdentity();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Fetch only rows the authenticated identity is authorized to see via RLS.
  const fetchAllData = useCallback(async () => {
    if (!currentUser || !tenantOwnerId) return;
    const userId = tenantOwnerId;

    let productsData: any[] | null = null;
    let productsError: any = null;
    if (staffSession) {
      const { data, error } = await supabase.rpc("staff_list_products");
      productsData = (data || []) as any[];
      productsError = error;
    } else {
      const { data, error } = await supabase.from("products").select("*").eq("userId", userId);
      productsData = data;
      productsError = error;
    }
    if (productsError) setSupabaseError(productsError);
    setProducts(productsData || []);

    const { data: customersData, error: customersError } = await supabase
      .from("customers").select("*").eq("userId", userId);
    if (customersError) setSupabaseError(customersError);
    setCustomers(customersData || []);

    // Commission agents are outside the deployed staff permission matrix.
    // Do not query this unverified legacy table from a staff identity.
    if (!staffSession) {
      const { data: agentsData } = await supabase.from("commission_agents").select("*").eq("user_id", userId);
      setCommissionAgents(agentsData || []);
    } else {
      setCommissionAgents([]);
    }

    const { data: staffData } = await supabase.from("staff").select("*").eq("userId", userId);
    setStaff(staffData || []);

    const { data: loginsData, error: loginsError } = await supabase
      .from("staff_logins").select("id,user_id,staff_id,auth_user_id,name,role,email,is_active,created_at,terminated_at").eq("user_id", userId).order("created_at", { ascending: false });
    if (loginsError) setSupabaseError(loginsError);
    setStaffLogins((loginsData || []).map((l: any) => ({
        id: l.id,
        userId: l.user_id,
        staffId: l.staff_id,
        authUserId: l.auth_user_id,
        name: l.name,
        role: l.role,
        email: l.email,
        isActive: l.is_active,
        createdAt: l.created_at,
        terminatedAt: l.terminated_at,
    })));

    const { data: salesData, error: salesError } = await supabase
      .from("sales").select("*").eq("userId", userId).order("timestamp", { ascending: false });
    if (salesError) setSupabaseError(salesError);
    setSales(salesData || []);

    // Staff receive a narrowly scoped shop summary, never direct settings or expense rows.
    if (staffSession) {
      const [{ data: shopContext, error: shopContextError }, { data: categoryContext, error: categoryContextError }] = await Promise.all([
        supabase.rpc("staff_get_shop_context"),
        supabase.rpc("staff_get_shop_categories"),
      ]);
      if (shopContextError) setSupabaseError(shopContextError);
      if (categoryContextError) setSupabaseError(categoryContextError);
      if (categoryContext) {
        setSettings((prev) => ({
          ...prev,
          shopCategory: categoryContext.shopCategory || "",
          shopSubcategory: categoryContext.shopSubcategory || "",
          productCategories: categoryContext.productCategories || [],
          expenseCategories: categoryContext.expenseCategories || [],
        }));
      }
      if (shopContext) {
        setSettings((prev) => ({
          ...prev,
          shopName: shopContext.shopName || "My Shop",
          startingBalance: Number(shopContext.startingBalance || 0),
          currency: shopContext.currency || "INR",
        }));
        setStaffExpensesTotal(Number(shopContext.expensesTotal || 0));
      }
    } else {
      setStaffExpensesTotal(0);
    }

    // Financial data rows remain owner-only.
    if (!staffSession) {
      const [{ data: expensesData }, { data: accountPaymentData, error: accountPaymentError }] = await Promise.all([
        supabase.from("expenses").select("*").eq("userId", userId).order("timestamp", { ascending: false }),
        supabase.from("account_payments").select("*").eq("userId", userId).order("timestamp", { ascending: false }),
      ]);
      setExpenses(expensesData || []);
      if (accountPaymentError && accountPaymentError.code !== "42P01") setSupabaseError(accountPaymentError);
      setAccountPayments(accountPaymentData || []);

      const { data: settingsData } = await supabase.from("settings").select("*").eq("id", userId).maybeSingle();
      if (settingsData) {
        setSettings({
          shopName: settingsData.shopName || "My Shop",
          shopCategory: settingsData.shop_category || settingsData.shopCategory || "",
          shopSubcategory: settingsData.shop_subcategory || settingsData.shopSubcategory || "",
          productCategories: settingsData.product_categories || settingsData.productCategories || [],
          expenseCategories: settingsData.expense_categories || settingsData.expenseCategories || [],
          taxRate: settingsData.taxRate ?? 5,
          currency: settingsData.currency || "Rs",
          startingBalance: settingsData.startingBalance ?? 0,
          quickAddProductIds: settingsData.quickAddProductIds || [],
          theme: settingsData.theme || "enterprise",
          staffAccounts: settingsData.staffAccounts || {},
          ownerPassword: settingsData.ownerPassword,
        });
      }

      const { data: chequesData } = await supabase.from("cheques").select("*").eq("userId", userId);
      setCheques(chequesData || []);

      const { data: electronicData } = await supabase.from("electronicTxs").select("*").eq("userId", userId);
      setElectronicTxs(electronicData || []);
    } else {
      setExpenses([]);
      setAccountPayments([]);
      setCheques([]);
      setElectronicTxs([]);
    }
  }, [currentUser, tenantOwnerId, staffSession]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleLogin = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setTenantOwnerId(null);
    setStaffSession(null);
    setSelectedRole("admin");
  };

  // Legacy callback retained for component compatibility; credentials are no longer checked here.
  const handleStaffLogin = async (_email: string, _password: string) => {
    throw new Error("Staff must sign in using their individual Supabase Auth invitation.");
  };

  const handleStaffLogout = () => {
    void handleLogout();
  };

  const handleSwitchOperator = async (role: ERPRole) => {
    if (role === "admin" && staffSession) {
      return { success: false, message: "Staff accounts cannot switch into the owner role." };
    }
    if (staffSession && role !== staffSession.role) {
      return { success: false, message: "Your account is not authorized for that role." };
    }
    if (!staffSession && role !== "admin") {
      return { success: false, message: "Use the staff member's own Auth account to enter a staff role." };
    }
    setSelectedRole(role);
    return { success: true, message: role === "admin" ? "Owner controls active." : "Staff role active." };
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
    if (!currentUser || staffSession) throw new Error("Only the shop owner can create products.");
    const { data, error } = await supabase
      .from("products")
      .insert([{ ...product, userId: tenantOwnerId }])
      .select()
      .single();
    if (error) throw error;
    setProducts((prev) => [...prev, data]);
  };

  const handleUpdateProduct = async (id: string, updates: Partial<Product>) => {
    if (!currentUser || staffSession) throw new Error("Only the shop owner can edit product details.");
    const { error } = await supabase.from("products").update(updates).eq("id", id);
    if (error) throw error;
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleUpdateProductStock = async (id: string, quantity: number) => {
    if (!currentUser) throw new Error("Not authenticated");
    if (staffSession && staffSession.role !== "inventory_manager") throw new Error("Only inventory managers can update stock.");
    if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Stock quantity must be a non-negative number.");

    if (staffSession) {
      // Staff cannot SELECT the products base table. Use the narrowly scoped
      // RPC, which verifies the active role and tenant inside the database.
      const { data, error } = await supabase.rpc("staff_update_product_stock", {
        p_product_id: id,
        p_quantity: quantity,
      });
      if (error) throw error;
      if (data !== true) throw new Error("Product was not found in this shop or stock was not updated.");
      setProducts((prev) => prev.map((product) => product.id === id ? { ...product, quantity } : product));
      return;
    }

    await handleUpdateProduct(id, { quantity });
  };

  const handleDeleteProduct = async (id: string) => {
    if (!currentUser || staffSession) throw new Error("Only the shop owner can delete products.");
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddCustomer = async (customer: Omit<Customer, "id" | "points" | "tier" | "totalSpent">) => {
    if (staffSession && staffSession.role !== "cashier") throw new Error("Only cashiers can create customers.");
    if (!currentUser) throw new Error("Not authenticated");
    const newCustomer = { ...customer, points: 0, tier: "Bronze" as const, totalSpent: 0, userId: tenantOwnerId };
    const { data, error } = await supabase.from("customers").insert([newCustomer]).select().single();
    if (error) throw error;
    setCustomers((prev) => [...prev, data]);
  };

  const handleUpdateCustomer = async (id: string, updates: Partial<Customer>) => {
    if (!currentUser || staffSession) throw new Error("Only the shop owner can update customers.");
    const { error } = await supabase.from("customers").update(updates).eq("id", id);
    if (error) throw error;
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!currentUser || staffSession) throw new Error("Only the shop owner can delete customers.");
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddCommissionAgent = async (agent: Omit<CommissionAgent, "totalEarnings">) => {
    if (staffSession) throw new Error("Staff accounts cannot manage commission agents.");
    if (!currentUser) throw new Error("Not authenticated");
    const newAgent = { ...agent, totalEarnings: 0, user_id: tenantOwnerId };
    const { data, error } = await supabase.from("commission_agents").insert([newAgent]).select().single();
    if (error) throw error;
    setCommissionAgents((prev) => [...prev, data]);
  };

  const handleUpdateCommissionAgent = async (phone: string, updates: Partial<CommissionAgent>) => {
    if (staffSession) throw new Error("Staff accounts cannot manage commission agents.");
    const { error } = await supabase.from("commission_agents").update(updates).eq("phone", phone);
    if (error) throw error;
    setCommissionAgents((prev) => prev.map((a) => (a.phone === phone ? { ...a, ...updates } : a)));
  };

  const handleDeleteCommissionAgent = async (phone: string) => {
    if (staffSession) throw new Error("Staff accounts cannot manage commission agents.");
    const { error } = await supabase.from("commission_agents").delete().eq("phone", phone);
    if (error) throw error;
    setCommissionAgents((prev) => prev.filter((a) => a.phone !== phone));
  };

  const handleAddStaff = async (staffMember: Omit<Staff, "id" | "attendance">) => {
    if (staffSession) throw new Error("Staff accounts cannot manage staff records.");
    if (!currentUser) throw new Error("Not authenticated");
    const newStaff = { ...staffMember, attendance: {}, userId: tenantOwnerId };
    const { data, error } = await supabase.from("staff").insert([newStaff]).select().single();
    if (error) throw error;
    setStaff((prev) => [...prev, data]);
  };

  const handleUpdateStaff = async (id: string, updates: Partial<Staff>) => {
    if (staffSession) throw new Error("Staff accounts cannot manage staff records.");
    const { error } = await supabase.from("staff").update(updates).eq("id", id);
    if (error) throw error;
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const manageStaffRecord = async (id: string, action: "archive" | "restore" | "delete") => {
    if (staffSession || !currentUser) throw new Error("Only the shop owner can manage staff records.");
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) throw new Error("Your owner session has expired. Please sign in again.");
    const response = await fetch("/api/staff/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
      body: JSON.stringify({ staffId: id, action }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to update staff record.");
    if (action === "delete") setStaff((prev) => prev.filter((s) => s.id !== id));
    else if (action === "archive") setStaff((prev) => prev.map((s: any) => s.id === id ? { ...s, archived_at: new Date().toISOString() } : s));
    else setStaff((prev) => prev.map((s: any) => s.id === id ? { ...s, archived_at: null } : s));
  };

  const handleArchiveStaff = (id: string) => manageStaffRecord(id, "archive");
  const handleRestoreStaff = (id: string) => manageStaffRecord(id, "restore");
  const handleDeleteStaff = (id: string) => manageStaffRecord(id, "delete");

  const handleMarkAttendance = async (staffId: string, date: string, present: boolean, hoursWorked?: number) => {
    if (staffSession) throw new Error("Staff accounts cannot manage attendance.");
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

  const handleAddSale = async (sale: Omit<Sale, "id" | "processedBy" | "processedByName">) => {
    if (!currentUser || !tenantOwnerId) throw new Error("Not authenticated");
    if (staffSession && staffSession.role !== "cashier") throw new Error("Only cashiers can create sales.");
    if (!sale.items?.length) throw new Error("A sale must contain at least one item.");

    const audit = getAuditFields();
    const salePayload = {
      ...sale,
      userId: tenantOwnerId,
      timestamp: sale.timestamp || new Date().toISOString(),
      clearanceStatus: sale.paymentMethod === "Cash" ? "Cleared" : (sale.clearanceStatus || "Pending"),
      processed_by: audit.processed_by || null,
      processed_by_name: audit.processed_by_name || null,
    };

    // The database function inserts the invoice and deducts all item quantities
    // in one transaction. Any missing/insufficient stock aborts the whole sale.
    const { data, error } = await supabase.rpc("create_sale_and_deduct_stock", {
      p_sale: salePayload,
    });
    if (error) throw error;
    if (!data) throw new Error("The sale could not be confirmed by the database.");

    setSales((prev) => [data as Sale, ...prev]);
    setProducts((prev) => prev.map((product) => {
      const soldQuantity = sale.items
        .filter((item) => item.productId === product.id)
        .reduce((total, item) => total + Number(item.quantity || 0), 0);
      return soldQuantity > 0 ? { ...product, quantity: product.quantity - soldQuantity } : product;
    }));
  };

  const handleUpdateSale = async (id: string, updates: Partial<Sale>) => {
    if (!currentUser || staffSession) throw new Error("Only the shop owner can update sales.");
    const { error } = await supabase.from("sales").update(updates).eq("id", id);
    if (error) throw error;
    setSales((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleDeleteSale = async (id: string) => {
    if (!currentUser || staffSession) throw new Error("Only the shop owner can delete sales.");
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) throw error;
    setSales((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddExpense = async (expense: Omit<Expense, "id" | "timestamp" | "loggedBy" | "loggedByName">) => {
    if (!currentUser || staffSession) throw new Error("Staff accounts cannot create expenses.");

    const audit = getAuditFields();
    const newExpense = {
      ...expense,
      userId: tenantOwnerId,
      timestamp: new Date().toISOString(),
      logged_by: audit.logged_by || null,
      logged_by_name: audit.logged_by_name || null,
    };

    const { data, error } = await supabase.from("expenses").insert([newExpense]).select().single();
    if (error) throw error;
    setExpenses((prev) => [data, ...prev]);
  };

  const handleUpdateExpense = async (id: string, updates: Partial<Expense>) => {
    if (!currentUser || staffSession) throw new Error("Staff accounts cannot update expenses.");
    const { error } = await supabase.from("expenses").update(updates).eq("id", id);
    if (error) throw error;
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const handleDeleteExpense = async (id: string) => {
    if (!currentUser || staffSession) throw new Error("Staff accounts cannot delete expenses.");
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleUpdateSettings = async (updates: Partial<StoreSettings>) => {
    if (!currentUser || staffSession) throw new Error("Only the shop owner can change store settings.");

    const dbUpdates: any = {};
    if (updates.shopName !== undefined) dbUpdates.shopName = updates.shopName;
    if (updates.shopCategory !== undefined) dbUpdates.shop_category = updates.shopCategory;
    if (updates.shopSubcategory !== undefined) dbUpdates.shop_subcategory = updates.shopSubcategory;
    if (updates.productCategories !== undefined) dbUpdates.product_categories = updates.productCategories;
    if (updates.expenseCategories !== undefined) dbUpdates.expense_categories = updates.expenseCategories;
    if (updates.taxRate !== undefined) dbUpdates.taxRate = updates.taxRate;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
    if (updates.startingBalance !== undefined) dbUpdates.startingBalance = updates.startingBalance;
    if (updates.quickAddProductIds !== undefined) dbUpdates.quickAddProductIds = updates.quickAddProductIds;
    if (updates.theme !== undefined) dbUpdates.theme = updates.theme;
    if (updates.staffAccounts !== undefined) dbUpdates.staffAccounts = updates.staffAccounts;
    if (updates.ownerPassword !== undefined) dbUpdates.ownerPassword = updates.ownerPassword;

    const { error } = await supabase.from("settings").update(dbUpdates).eq("id", tenantOwnerId);
    if (error) throw error;
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const handleResetDatabase = async () => {
    if (!currentUser || staffSession) throw new Error("Only the shop owner can reset store data.");
    if (!tenantOwnerId) throw new Error("The shop owner account could not be identified.");

    // Delete dependent financial and operational records before their parent records.
    // commission_agents is a legacy/optional table and is not present in every deployment.
    const ownerTables = [
      "account_payments",
      "purchases",
      "sales",
      "expenses",
      "cheques",
      "electronicTxs",
      "staff_logins",
      "staff",
      "customers",
      "suppliers",
      "products",
    ];

    for (const table of ownerTables) {
      const { error } = await supabase.from(table).delete().eq(
        table === "staff_logins" ? "user_id" : "userId",
        tenantOwnerId
      );
      if (error) throw new Error(`Unable to reset ${table}: ${error.message}`);
    }

    const { error: agentsError } = await supabase.from("commission_agents").delete().eq("user_id", tenantOwnerId);
    if (agentsError && agentsError.code !== "PGRST205" && agentsError.code !== "42P01") {
      throw new Error(`Unable to reset commission agents: ${agentsError.message}`);
    }

    setProducts([]);
    setCustomers([]);
    setCommissionAgents([]);
    setStaff([]);
    setStaffLogins([]);
    setSales([]);
    setExpenses([]);
    setAccountPayments([]);
    setCheques([]);
    setElectronicTxs([]);
  };

  const handleAddCheque = async (cheque: Omit<Cheque, "id" | "timestamp">) => {
    if (!currentUser || staffSession) throw new Error("Staff accounts cannot manage cheques.");
    const newCheque = { ...cheque, userId: tenantOwnerId, timestamp: new Date().toISOString() };
    const { data, error } = await supabase.from("cheques").insert([newCheque]).select().single();
    if (error) throw error;
    setCheques((prev) => [...prev, data]);
  };

  const handleUpdateCheque = async (id: string, updates: Partial<Cheque>) => {
    if (!currentUser || staffSession) throw new Error("Staff accounts cannot manage cheques.");
    const { error } = await supabase.from("cheques").update(updates).eq("id", id);
    if (error) throw error;
    setCheques((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleDeleteCheque = async (id: string) => {
    if (!currentUser || staffSession) throw new Error("Staff accounts cannot manage cheques.");
    const { error } = await supabase.from("cheques").delete().eq("id", id);
    if (error) throw error;
    setCheques((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddElectronicTx = async (tx: Omit<ElectronicTx, "id" | "timestamp">) => {
    if (!currentUser || staffSession) throw new Error("Staff accounts cannot manage financial transactions.");
    const newTx = { ...tx, userId: tenantOwnerId, timestamp: new Date().toISOString() };
    const { data, error } = await supabase.from("electronicTxs").insert([newTx]).select().single();
    if (error) throw error;
    setElectronicTxs((prev) => [...prev, data]);
  };

  const handleUpdateElectronicTx = async (id: string, updates: Partial<ElectronicTx>) => {
    if (!currentUser || staffSession) throw new Error("Staff accounts cannot manage financial transactions.");
    const { error } = await supabase.from("electronicTxs").update(updates).eq("id", id);
    if (error) throw error;
    setElectronicTxs((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const handleDeleteElectronicTx = async (id: string) => {
    if (!currentUser || staffSession) throw new Error("Staff accounts cannot manage financial transactions.");
    const { error } = await supabase.from("electronicTxs").delete().eq("id", id);
    if (error) throw error;
    setElectronicTxs((prev) => prev.filter((t) => t.id !== id));
  };

  const currentRole: ERPRole = staffSession?.role ?? selectedRole;
  const operatorRole: ERPRole = staffSession?.role ?? selectedRole;
  const handleRoleChange = (role: ERPRole) => {
    if (!staffSession) setSelectedRole(role);
  };
  const cashInHand = staffSession
    ? Number(settings.startingBalance || 0) + sales.filter((sale) => (sale.paymentMethod === "Cash" || sale.paymentMethod === "Store Credit")).reduce((total, sale) => total + Number(sale.paidAmount ?? sale.totalAmount ?? 0), 0) - staffExpensesTotal
    : Number(settings.startingBalance || 0)
      + sales.filter((sale) => (sale.paymentMethod === "Cash" || sale.paymentMethod === "Store Credit")).reduce((total, sale) => total + Number(sale.paidAmount ?? sale.totalAmount ?? 0), 0)
      + accountPayments.filter((payment) => payment.party_type === "customer" && payment.direction === "received" && payment.payment_method === "Cash").reduce((total, payment) => total + Number(payment.amount || 0), 0)
      - expenses.filter((expense) => !expense.paymentMethod || expense.paymentMethod === "Cash").reduce((total, expense) => total + Number(expense.amount || 0), 0)
      - accountPayments.filter((payment) => payment.party_type === "supplier" && payment.direction === "paid" && payment.payment_method === "Cash").reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const currencyCode = currencyOverride || (settings.currency && /^[A-Z]{3}$/.test(settings.currency) ? settings.currency : "INR");
  const currency = (() => {
    try { return new Intl.NumberFormat("en", { style: "currency", currency: currencyCode }).formatToParts(0).find((part) => part.type === "currency")?.value || currencyCode; }
    catch { return currencyCode; }
  })();

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
        currencyCode,
        setCurrency,
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
        actualDrawerCash,
        showInvoiceForm,
        setShowInvoiceForm,
        lowStockProducts,
        overstockProducts,
        handleLogin,
        handleLogout,
        handleStaffLogin,
        handleStaffLogout,
        handleSwitchOperator,
        handleAddProduct,
        handleUpdateProduct,
        handleUpdateProductStock,
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
        handleArchiveStaff,
        handleRestoreStaff,
        handleMarkAttendance,
        handleAddSale,
        handleUpdateSale,
        handleDeleteSale,
        handleAddExpense,
        handleUpdateExpense,
        handleDeleteExpense,
        handleUpdateSettings,
        refreshData: fetchAllData,
        handleResetDatabase,
        handleAddCheque,
        handleUpdateCheque,
        handleDeleteCheque,
        handleUpdateActualDrawerCash: async (amount: number | null) => { if (staffSession) throw new Error("Staff accounts cannot access drawer cash."); setActualDrawerCash(amount); },
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
