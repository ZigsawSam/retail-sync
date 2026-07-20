"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { Product, Customer, Staff, Sale, Expense, StoreSettings, Cheque, ElectronicTx, ERPRole, StaffLogin } from "../types";
import { isSupabaseConfigured, getSupabaseClient, transferMockDataToSupabase, parseSupabaseError, UserFriendlyError } from "../lib/supabase";
import { getAppMode } from "@/lib/app-mode";

interface AppUser {
  uid: string;
  email: string | null;
}

interface AppContextType {
  currentUser: AppUser | null;
  authLoading: boolean;
  currentRole: ERPRole;
  handleRoleChange: (role: ERPRole) => void;
  operatorRole: ERPRole;
  handleSwitchOperator: (role: ERPRole, password?: string, email?: string) => Promise<{ success: boolean; message: string }>;
  settings: StoreSettings;
  products: Product[];
  customers: Customer[];
  staff: Staff[];
  sales: Sale[];
  expenses: Expense[];
  electronicTxs: ElectronicTx[];
  cheques: Cheque[];
  actualDrawerCash: number | null;
  currency: string;
  cashInHand: number;
  totalSalesAllTime: number;
  totalExpensesAllTime: number;
  showInvoiceForm: boolean;
  setShowInvoiceForm: (val: boolean) => void;

  useSupabaseActive: boolean;
  setUseSupabaseActive: (active: boolean) => void;
  refreshDataFromSupabase: () => Promise<void>;

  supabaseError: UserFriendlyError | null;
  setSupabaseError: (err: UserFriendlyError | null) => void;

  handleAddProduct: (newProd: Product) => Promise<void>;
  handleUpdateProductStock: (productId: string, newStock: number) => Promise<void>;
  handleDeleteProduct: (productId: string) => Promise<void>;
  handleAddCustomer: (newCust: Customer) => Promise<void>;
  handleOnboardStaff: (newStaff: Staff) => Promise<void>;
  handleLogAttendance: (staffId: string, date: string, present: boolean, hoursWorked?: number, wageEarned?: number) => Promise<void>;
  handleAddSale: (newSale: Sale) => Promise<void>;
  handleUpdateSale: (updatedSale: Sale) => Promise<void>;
  handleAddExpense: (newExpense: Expense) => Promise<void>;
  handleDeleteExpense: (id: string) => Promise<void>;
  handleUpdateSettings: (newSettings: StoreSettings) => Promise<void>;
  handleUpdateActualDrawerCash: (amount: number | null) => Promise<void>;
  handleAddElectronicTx: (tx: ElectronicTx) => Promise<void>;
  handleDeleteElectronicTx: (id: string) => Promise<void>;
  handleAddCheque: (ch: Cheque) => Promise<void>;
  handleDeleteCheque: (id: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  handleResetDatabase: (options?: { cleanSlate?: boolean; shopName?: string; startingBalance?: number; currency?: string; taxRate?: number }) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [supabaseError, setSupabaseError] = useState<UserFriendlyError | null>(null);

  // --- ERP ROLE-BASED ACCESS CONTROL STATES ---
  const [operatorRole, setOperatorRole] = useState<ERPRole>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("retail_sync_operator_role");
      if (saved === "admin" || saved === "cashier" || saved === "inventory_manager") {
        return saved as ERPRole;
      }
    }
    return "admin";
  });

  const [currentRole, setCurrentRole] = useState<ERPRole>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("retail_sync_erp_role");
      if (saved === "admin" || saved === "cashier" || saved === "inventory_manager") {
        return saved as ERPRole;
      }
    }
    return "admin";
  });

  useEffect(() => {
    if (operatorRole !== "admin" && currentRole !== operatorRole) {
      setCurrentRole(operatorRole);
    }
  }, [operatorRole, currentRole]);

  const handleRoleChange = (role: ERPRole) => {
    if (operatorRole !== "admin") return;
    setCurrentRole(role);
    if (typeof window !== "undefined") {
      localStorage.setItem("retail_sync_erp_role", role);
    }
  };

  // FIXED: handleSwitchOperator now queries staff_logins table instead of settings.staffAccounts
  const handleSwitchOperator = async (
    role: ERPRole,
    password?: string,
    email?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!currentUser) {
      return { success: false, message: "No owner session found." };
    }

    // Admin login still uses settings.ownerPassword
    if (role === "admin") {
      const adminPass = settings.ownerPassword || "admin";
      if (password !== adminPass) {
        return { success: false, message: "Invalid Owner / Admin access password!" };
      }
      setOperatorRole("admin");
      setCurrentRole("admin");
      localStorage.setItem("retail_sync_operator_role", "admin");
      localStorage.setItem("retail_sync_erp_role", "admin");
      return { success: true, message: "Switched to ADMIN mode." };
    }

    // Cashier / Stockist: query staff_logins table, NOT settings
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, message: "Supabase not connected." };
    }

    const { data: staffRecs, error } = await supabase
      .from("staff_logins")
      .select("*")
      .eq("user_id", currentUser.uid)
      .eq("role", role)
      .eq("is_active", true);

    if (error) {
      return { success: false, message: "Database error fetching staff record." };
    }

    if (!staffRecs || staffRecs.length === 0) {
      return {
        success: false,
        message: `No active ${role === "inventory_manager" ? "Stock Manager" : "Cashier"} found. Onboard them first in Settings.`,
      };
    }

    const staffRec = staffRecs[0] as StaffLogin;

    if (email && staffRec.email && email.trim().toLowerCase() !== staffRec.email.trim().toLowerCase()) {
      return { success: false, message: "Invalid login email / username!" };
    }

    if (password !== staffRec.password) {
      return { success: false, message: "Invalid password!" };
    }

    // SUCCESS: store staff session with DB reference
    setOperatorRole(role);
    setCurrentRole(role);

    const staffSession = {
      ownerUid: currentUser.uid,
      role: role,
      email: staffRec.email,
      staffLoginId: staffRec.id,
      staffName: staffRec.name,
    };

    sessionStorage.setItem("retail_sync_staff_session", JSON.stringify(staffSession));
    localStorage.setItem("retail_sync_operator_role", role);
    localStorage.setItem("retail_sync_erp_role", role);

    return {
      success: true,
      message: `Authenticated as ${staffRec.name} (${role === "inventory_manager" ? "Stock Manager" : "Cashier"}).`,
    };
  };

  // --- PERSISTENT DATABASE STATES ---
  const [settings, setSettings] = useState<StoreSettings>({
    shopName: "Loading Outlet...",
    taxRate: 5,
    currency: "Rs.",
    startingBalance: 12500,
    theme: "bauhaus",
    ownerPassword: "admin",
    staffAccounts: {
      cashier: { username: "Cashier Desk", password: "cashier123", isActive: true },
      inventory: { username: "Inventory Manager", password: "stock123", isActive: true }
    }
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [electronicTxs, setElectronicTxs] = useState<ElectronicTx[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [actualDrawerCash, setActualDrawerCash] = useState<number | null>(null);

  const [useSupabaseActive, setUseSupabaseActiveState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("use_supabase") === "true" || isSupabaseConfigured();
    }
    return false;
  });

  const setUseSupabaseActive = (active: boolean) => {
    setUseSupabaseActiveState(active);
    if (typeof window !== "undefined") {
      localStorage.setItem("use_supabase", active ? "true" : "false");
    }
  };

  const fetchSupabaseData = async (uid: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      setSupabaseError(null);

      // 1. Settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("settings")
        .select("*")
        .eq("id", uid)
        .maybeSingle();

      if (settingsError) {
        console.error("Failed to fetch settings:", settingsError);
        const parsed = parseSupabaseError(settingsError);
        setSupabaseError(parsed);
      }

      if (settingsData) {
        let loadedSettings = { ...settingsData } as StoreSettings;
        if (typeof window !== "undefined") {
          const fallback = localStorage.getItem("retail_sync_fallback_settings_" + uid);
          if (fallback) {
            try {
              const parsedFallback = JSON.parse(fallback);
              loadedSettings = {
                ...parsedFallback,
                ...loadedSettings,
                staffAccounts: loadedSettings.staffAccounts || parsedFallback.staffAccounts,
                ownerPassword: loadedSettings.ownerPassword || parsedFallback.ownerPassword
              };
            } catch (err) {
              console.error("Failed to parse fallback settings", err);
            }
          }
        }
        setSettings(loadedSettings);
      } else {
        console.log("No settings found for new user/shop. Seeding full mock data...");
        try {
          const res = await transferMockDataToSupabase(uid);
          if (!res.success) {
            if (res.errorDetails) {
              setSupabaseError(res.errorDetails);
            }
            throw new Error(res.message);
          }
          const { data: newSettingsData, error: newSettingsError } = await supabase
            .from("settings")
            .select("*")
            .eq("id", uid)
            .maybeSingle();

          if (newSettingsError) throw newSettingsError;

          if (newSettingsData) {
            setSettings(newSettingsData as StoreSettings);
          } else {
            throw new Error("Could not fetch newly upserted settings");
          }
        } catch (seedErr: any) {
          console.error("Full seeding failed, falling back to basic settings:", seedErr);
          const parsed = parseSupabaseError(seedErr);
          setSupabaseError(parsed);

          const defaultSettings = {
            id: uid,
            shopName: "Urban Mart",
            taxRate: 5,
            startingBalance: 12500,
            currency: "$",
            userId: uid,
            quickAddProductIds: []
          };
          try {
            const { error: upsertErr } = await supabase.from("settings").upsert(defaultSettings);
            if (upsertErr) throw upsertErr;
            setSettings(defaultSettings as StoreSettings);
          } catch (fallbackErr: any) {
            console.error("Fallback settings upsert failed:", fallbackErr);
            const parsedFallback = parseSupabaseError(fallbackErr);
            setSupabaseError(parsedFallback);
            setSettings(defaultSettings as StoreSettings);
          }
        }
      }

      async function runQuery<T>(queryPromise: PromiseLike<{ data: T | null, error: any }>, callback: (data: T) => void, tableName: string) {
        const { data, error } = await queryPromise;
        if (error) {
          console.error(`Error querying ${tableName}:`, error);
          const parsed = parseSupabaseError(error);
          if (parsed.type === "rls_violation") {
            setSupabaseError(parsed);
          }
        } else if (data) {
          callback(data);
        }
      }

      await runQuery(supabase.from("products").select("*").eq("userId", uid), setProducts as any, "products");
      await runQuery(supabase.from("customers").select("*").eq("userId", uid), setCustomers as any, "customers");
      await runQuery(supabase.from("staff").select("*").eq("userId", uid), setStaff as any, "staff");
      await runQuery(supabase.from("sales").select("*").eq("userId", uid), setSales as any, "sales");
      await runQuery(supabase.from("expenses").select("*").eq("userId", uid), setExpenses as any, "expenses");
      await runQuery(supabase.from("electronicTxs").select("*").eq("userId", uid), setElectronicTxs as any, "electronicTxs");
      await runQuery(supabase.from("cheques").select("*").eq("userId", uid), setCheques as any, "cheques");

      const { data: drawerData, error: drawerErr } = await supabase
        .from("actualDrawerCash")
        .select("*")
        .eq("userId", uid)
        .eq("date", "2026-07-14");

      if (drawerErr) {
        const parsed = parseSupabaseError(drawerErr);
        if (parsed.type === "rls_violation") setSupabaseError(parsed);
      } else if (drawerData && drawerData.length > 0) {
        setActualDrawerCash(drawerData[0].amount);
      } else {
        setActualDrawerCash(null);
      }
    } catch (err: any) {
      console.error("Failed to load Supabase records:", err);
      const parsed = parseSupabaseError(err);
      setSupabaseError(parsed);
    }
  };

  const refreshDataFromSupabase = async () => {
    if (currentUser) {
      await fetchSupabaseData(currentUser.uid);
    }
  };

  // --- AUTH MONITOR ---
  useEffect(() => {
    const supabase = getSupabaseClient();

    const staffSessionStr =
      typeof window !== "undefined"
        ? sessionStorage.getItem("retail_sync_staff_session")
        : null;

    if (staffSessionStr) {
      try {
        const staffSession = JSON.parse(staffSessionStr);
        if (staffSession?.ownerUid && staffSession?.role) {
          setCurrentUser({ uid: staffSession.ownerUid, email: staffSession.email ?? null });
          setOperatorRole(staffSession.role);
          setCurrentRole(staffSession.role);
          setAuthLoading(false);
          return;
        }
      } catch (e) {
        console.error("Failed to parse staff session, clearing it:", e);
        sessionStorage.removeItem("retail_sync_staff_session");
      }
    }

    const savedLocalUser =
      typeof window !== "undefined"
        ? localStorage.getItem("retail_sync_local_user")
        : null;

    if (savedLocalUser && JSON.parse(savedLocalUser).uid === "local-demo") {
      setCurrentUser(JSON.parse(savedLocalUser));
      setAuthLoading(false);
      return;
    }

    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    const mode = getAppMode();

    if (mode === "offline" && savedLocalUser) {
      setCurrentUser(JSON.parse(savedLocalUser));
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser({
          uid: session.user.id,
          email: session.user.email ?? null,
        });
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setCurrentUser({
          uid: session.user.id,
          email: session.user.email ?? null,
        });
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- REAL-TIME DATA SYNC PIPELINES ---
  useEffect(() => {
    if (!currentUser) return;

    const uid = currentUser.uid;

    if (uid === "local-demo") {
      const storedSettings = localStorage.getItem("retail_sync_settings");
      const storedProducts = localStorage.getItem("retail_sync_products");
      const storedCustomers = localStorage.getItem("retail_sync_customers");
      const storedStaff = localStorage.getItem("retail_sync_staff");
      const storedSales = localStorage.getItem("retail_sync_sales");
      const storedExpenses = localStorage.getItem("retail_sync_expenses");
      const storedElectronic = localStorage.getItem("retail_sync_electronicTxs");
      const storedCheques = localStorage.getItem("retail_sync_cheques");
      const storedDrawer = localStorage.getItem("retail_sync_drawer_2026-07-14");

      setSettings(storedSettings ? JSON.parse(storedSettings) : {
        shopName: "Urban Mart (Offline Sandbox)",
        taxRate: 5,
        currency: "$",
        startingBalance: 0,
        quickAddProductIds: [],
        theme: "bauhaus"
      });
      setProducts(storedProducts ? JSON.parse(storedProducts) : []);
      setCustomers(storedCustomers ? JSON.parse(storedCustomers) : []);
      setStaff(storedStaff ? JSON.parse(storedStaff) : []);
      setSales(storedSales ? JSON.parse(storedSales) : []);
      setExpenses(storedExpenses ? JSON.parse(storedExpenses) : []);
      setElectronicTxs(storedElectronic ? JSON.parse(storedElectronic) : []);
      setCheques(storedCheques ? JSON.parse(storedCheques) : []);
      setActualDrawerCash(storedDrawer ? JSON.parse(storedDrawer) : null);
      return;
    }

    fetchSupabaseData(uid);
  }, [currentUser?.uid]);

  // Auto persist to LocalStorage when in local-demo mode
  useEffect(() => {
    if (currentUser?.uid === "local-demo") {
      localStorage.setItem("retail_sync_settings", JSON.stringify(settings));
    }
  }, [settings, currentUser]);

  useEffect(() => {
    if (currentUser?.uid === "local-demo") {
      localStorage.setItem("retail_sync_products", JSON.stringify(products));
    }
  }, [products, currentUser]);

  useEffect(() => {
    if (currentUser?.uid === "local-demo") {
      localStorage.setItem("retail_sync_customers", JSON.stringify(customers));
    }
  }, [customers, currentUser]);

  useEffect(() => {
    if (currentUser?.uid === "local-demo") {
      localStorage.setItem("retail_sync_staff", JSON.stringify(staff));
    }
  }, [staff, currentUser]);

  useEffect(() => {
    if (currentUser?.uid === "local-demo") {
      localStorage.setItem("retail_sync_sales", JSON.stringify(sales));
    }
  }, [sales, currentUser]);

  useEffect(() => {
    if (currentUser?.uid === "local-demo") {
      localStorage.setItem("retail_sync_expenses", JSON.stringify(expenses));
    }
  }, [expenses, currentUser]);

  useEffect(() => {
    if (currentUser?.uid === "local-demo") {
      localStorage.setItem("retail_sync_electronicTxs", JSON.stringify(electronicTxs));
    }
  }, [electronicTxs, currentUser]);

  useEffect(() => {
    if (currentUser?.uid === "local-demo") {
      localStorage.setItem("retail_sync_cheques", JSON.stringify(cheques));
    }
  }, [cheques, currentUser]);

  useEffect(() => {
    if (currentUser?.uid === "local-demo") {
      localStorage.setItem("retail_sync_drawer_2026-07-14", JSON.stringify(actualDrawerCash));
    }
  }, [actualDrawerCash, currentUser]);

  // --- HANDLERS ---
  const handleAddProduct = async (newProd: Product) => {
    if (!currentUser) return;

    const exists = products.some(p => p.barcode === newProd.barcode);
    if (exists) {
      setProducts(prev => prev.map(p => p.barcode === newProd.barcode ? { ...p, quantity: p.quantity + newProd.quantity } : p));
    } else {
      setProducts(prev => [...prev, newProd]);
    }

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          if (exists) {
            const matching = products.find(p => p.barcode === newProd.barcode)!;
            await supabase.from("products").upsert({
              ...matching,
              quantity: matching.quantity + newProd.quantity,
              userId: currentUser.uid
            });
          } else {
            await supabase.from("products").upsert({
              ...newProd,
              userId: currentUser.uid
            });
          }
        } catch (e) {
          console.error("Supabase Error products insert:", e);
        }
      }
    }
  };

  const handleUpdateProductStock = async (productId: string, newStock: number) => {
    if (!currentUser) return;
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, quantity: newStock } : p));

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from("products").update({ quantity: newStock }).eq("id", productId);
        } catch (e) {
          console.error("Supabase Error product stock update:", e);
        }
      }
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!currentUser) return;
    setProducts(prev => prev.filter(p => p.id !== productId));

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from("products").delete().eq("id", productId);
        } catch (e) {
          console.error("Supabase Error products delete:", e);
        }
      }
    }
  };

  const handleAddCustomer = async (newCust: Customer) => {
    if (!currentUser) return;
    const exists = customers.some(c => c.phone === newCust.phone);
    if (exists) return;
    setCustomers(prev => [...prev, newCust]);

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from("customers").upsert({
            ...newCust,
            userId: currentUser.uid
          });
        } catch (e) {
          console.error("Supabase Error customers insert:", e);
        }
      }
    }
  };

  const handleOnboardStaff = async (newStaff: Staff) => {
    if (!currentUser) return;
    setStaff(prev => [...prev, newStaff]);

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from("staff").upsert({
            ...newStaff,
            userId: currentUser.uid
          });
        } catch (e) {
          console.error("Supabase Error staff insert:", e);
        }
      }
    }
  };

  const handleLogAttendance = async (
    staffId: string,
    date: string,
    present: boolean,
    hoursWorked?: number,
    wageEarned?: number
  ) => {
    if (!currentUser) return;
    setStaff(prev => prev.map(s => {
      if (s.id !== staffId) return s;
      return {
        ...s,
        attendance: {
          ...s.attendance,
          [date]: { present, hoursWorked: hoursWorked || null, wageEarned: wageEarned || 0 }
        }
      };
    }));

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const member = staff.find(s => s.id === staffId);
          if (member) {
            const updatedAttendance = {
              ...member.attendance,
              [date]: { present, hoursWorked: hoursWorked || null, wageEarned: wageEarned || 0 }
            };
            await supabase.from("staff").update({ attendance: updatedAttendance }).eq("id", staffId);
          }
        } catch (e) {
          console.error("Supabase Error attendance update:", e);
        }
      }
    }
  };

  // FIXED: handleAddSale now logs which staff processed the sale
  const handleAddSale = async (newSale: Sale) => {
    if (!currentUser) return;

    // Get current staff info from session
    const staffSessionStr = sessionStorage.getItem("retail_sync_staff_session");
    let staffInfo = { id: null as string | null, name: null as string | null };

    if (staffSessionStr) {
      try {
        const s = JSON.parse(staffSessionStr);
        staffInfo = { id: s.staffLoginId || null, name: s.staffName || null };
      } catch (e) { /* ignore */ }
    }

    // Attach staff info to the sale
    const saleWithStaff: Sale = {
      ...newSale,
      processedBy: staffInfo.id || undefined,
      processedByName: staffInfo.name || undefined,
    };

    setSales(prev => [...prev, saleWithStaff]);
    setProducts(prev => prev.map(p => {
      const item = newSale.items.find(it => it.productId === p.id);
      if (item) return { ...p, quantity: Math.max(0, p.quantity - item.quantity) };
      return p;
    }));

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const payload = {
            ...saleWithStaff,
            userId: currentUser.uid,
          };
          await supabase.from("sales").upsert(payload);

          for (const item of newSale.items) {
            const p = products.find(prod => prod.id === item.productId);
            if (p) {
              await supabase.from("products").update({
                quantity: Math.max(0, p.quantity - item.quantity)
              }).eq("id", p.id);
            }
          }
        } catch (e) {
          console.error("Supabase Error sales insert:", e);
        }
      }
    }
  };

  const handleUpdateSale = async (updatedSale: Sale) => {
    if (!currentUser) return;
    setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const payload = {
            ...updatedSale,
            userId: currentUser.uid
          };
          let result = await supabase.from("sales").upsert(payload);
          if (result.error) {
            console.warn("Initial sale update failed. Retrying without discountAmount:", result.error);
            const { discountAmount, ...withoutDiscount } = payload;
            result = await supabase.from("sales").upsert(withoutDiscount);
            if (result.error) {
              console.warn("Retrying without clearanceStatus:", result.error);
              const { clearanceStatus, ...withoutClearance } = payload;
              result = await supabase.from("sales").upsert(withoutClearance);
              if (result.error) {
                console.warn("Retrying without both:", result.error);
                const { clearanceStatus: c, discountAmount: d, ...sanitized } = payload;
                result = await supabase.from("sales").upsert(sanitized);
                if (result.error) {
                  console.error("All sale update attempts failed:", result.error);
                }
              }
            }
          }
        } catch (e) {
          console.error("Supabase Error sale update:", e);
        }
      }
    }
  };

  // FIXED: handleAddExpense now logs which staff logged the expense
  const handleAddExpense = async (newExpense: Expense) => {
    if (!currentUser) return;

    // Get current staff info from session
    const staffSessionStr = sessionStorage.getItem("retail_sync_staff_session");
    let staffInfo = { id: null as string | null, name: null as string | null };

    if (staffSessionStr) {
      try {
        const s = JSON.parse(staffSessionStr);
        staffInfo = { id: s.staffLoginId || null, name: s.staffName || null };
      } catch (e) { /* ignore */ }
    }

    const expenseWithStaff: Expense = {
      ...newExpense,
      loggedBy: staffInfo.id || undefined,
      loggedByName: staffInfo.name || undefined,
    };

    setExpenses(prev => [...prev, expenseWithStaff]);

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const payload = {
            ...expenseWithStaff,
            userId: currentUser.uid,
          };
          const { error } = await supabase.from("expenses").upsert(payload);
          if (error) {
            console.warn("Initial expense upsert failed:", error);
            const { paymentMethod, ...sanitized } = payload;
            const { error: retryError } = await supabase.from("expenses").upsert(sanitized);
            if (retryError) {
              console.error("Sanitized expense upsert retry failed:", retryError);
            }
          }
        } catch (e) {
          console.error("Supabase Error expense insert:", e);
        }
      }
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!currentUser) return;
    setExpenses(prev => prev.filter(e => e.id !== id));

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from("expenses").delete().eq("id", id);
        } catch (e) {
          console.error("Supabase Error expense delete:", e);
        }
      }
    }
  };

  const handleUpdateSettings = async (newSettings: StoreSettings) => {
    if (!currentUser) return;
    setSettings(newSettings);

    if (typeof window !== "undefined") {
      localStorage.setItem("retail_sync_fallback_settings_" + currentUser.uid, JSON.stringify(newSettings));
    }

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const payload = {
            ...newSettings,
            id: currentUser.uid,
            userId: currentUser.uid
          };
          const { error } = await supabase.from("settings").upsert(payload);
          if (error) {
            console.warn("Initial settings upsert failed. Retrying with sanitized payload.", error);
            const sanitizedPayload = { ...payload };
            delete (sanitizedPayload as any).theme;
            delete (sanitizedPayload as any).staffAccounts;
            delete (sanitizedPayload as any).ownerPassword;
            delete (sanitizedPayload as any).quickAddProductIds;

            const { error: retryError } = await supabase.from("settings").upsert(sanitizedPayload);
            if (retryError) {
              console.error("Sanitized retry failed:", retryError);
            }
          }
        } catch (e) {
          console.error("Supabase Error settings upsert:", e);
        }
      }
    }
  };

  const handleUpdateActualDrawerCash = async (amount: number | null) => {
    if (!currentUser) return;
    setActualDrawerCash(amount);

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          if (amount === null) {
            await supabase.from("actualDrawerCash").delete().eq("userId", currentUser.uid).eq("date", "2026-07-14");
          } else {
            await supabase.from("actualDrawerCash").upsert({
              id: `${currentUser.uid}_drawer-2026-07-14`,
              date: "2026-07-14",
              amount: amount,
              userId: currentUser.uid
            });
          }
        } catch (e) {
          console.error("Supabase Error drawer cash update:", e);
        }
      }
    }
  };

  const handleAddElectronicTx = async (tx: ElectronicTx) => {
    if (!currentUser) return;
    setElectronicTxs(prev => [...prev, tx]);

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from("electronicTxs").upsert({
            ...tx,
            userId: currentUser.uid
          });
        } catch (e) {
          console.error("Supabase Error electronic tx insert:", e);
        }
      }
    }
  };

  const handleDeleteElectronicTx = async (id: string) => {
    if (!currentUser) return;
    setElectronicTxs(prev => prev.filter(t => t.id !== id));

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from("electronicTxs").delete().eq("id", id);
        } catch (e) {
          console.error("Supabase Error electronic tx delete:", e);
        }
      }
    }
  };

  const handleAddCheque = async (ch: Cheque) => {
    if (!currentUser) return;
    setCheques(prev => [...prev, ch]);

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from("cheques").upsert({
            ...ch,
            userId: currentUser.uid
          });
        } catch (e) {
          console.error("Supabase Error cheque insert:", e);
        }
      }
    }
  };

  const handleDeleteCheque = async (id: string) => {
    if (!currentUser) return;
    setCheques(prev => prev.filter(c => c.id !== id));

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from("cheques").delete().eq("id", id);
        } catch (e) {
          console.error("Supabase Error cheque delete:", e);
        }
      }
    }
  };

  const handleLogout = async () => {
    try {
      const supabase = getSupabaseClient();

      if (supabase) {
        await supabase.auth.signOut();
      }

      if (typeof window !== "undefined") {
        localStorage.removeItem("retail_sync_local_user");
        localStorage.removeItem("retail_sync_operator_role");
        localStorage.removeItem("retail_sync_erp_role");
        sessionStorage.removeItem("retail_sync_staff_session");
      }

      setCurrentUser(null);
      setOperatorRole("admin");
      setCurrentRole("admin");

      setProducts([]);
      setCustomers([]);
      setStaff([]);
      setSales([]);
      setExpenses([]);
      setElectronicTxs([]);
      setCheques([]);
      setActualDrawerCash(null);

    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleResetDatabase = async (options?: { cleanSlate?: boolean; shopName?: string; startingBalance?: number; currency?: string; taxRate?: number }) => {
    if (!currentUser) return;

    const isCleanSlate = options?.cleanSlate ?? false;
    const targetShopName = options?.shopName ?? "Urban Mart";
    const targetStartingBalance = options?.startingBalance ?? 12500;
    const targetCurrency = options?.currency ?? "$";
    const targetTaxRate = options?.taxRate ?? 5;

    if (isCleanSlate) {
      setProducts([]);
      setCustomers([]);
      setStaff([]);
      setSales([]);
      setExpenses([]);
      setElectronicTxs([]);
      setCheques([]);
      setActualDrawerCash(null);
      setSettings({
        shopName: targetShopName,
        taxRate: targetTaxRate,
        currency: targetCurrency,
        startingBalance: targetStartingBalance,
        quickAddProductIds: []
      });
    } else {
      setProducts([]);
      setCustomers([]);
      setStaff([]);
      setSales([]);
      setExpenses([]);
      setElectronicTxs([]);
      setCheques([]);
      setActualDrawerCash(null);
      setSettings({
        shopName: "Urban Mart",
        taxRate: 5,
        currency: "$",
        startingBalance: 0,
        quickAddProductIds: []
      });
    }

    if (currentUser.uid !== "local-demo") {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const tables = ["products", "customers", "staff", "sales", "expenses", "electronicTxs", "cheques", "actualDrawerCash"];
          for (const table of tables) {
            await supabase.from(table).delete().eq("userId", currentUser.uid);
          }

          if (isCleanSlate) {
            await supabase.from("settings").upsert({
              id: currentUser.uid,
              shopName: targetShopName,
              taxRate: targetTaxRate,
              startingBalance: targetStartingBalance,
              currency: targetCurrency,
              userId: currentUser.uid,
              quickAddProductIds: []
            });
          } else {
            await supabase.from("settings").upsert({
              id: currentUser.uid,
              shopName: "Urban Mart",
              taxRate: 5,
              startingBalance: 0,
              currency: "$",
              userId: currentUser.uid,
              quickAddProductIds: []
            });
            await transferMockDataToSupabase(currentUser.uid);
          }
        } catch (e) {
          console.error("Supabase Error reset database:", e);
        }
      }
    }
  };

  const resetStoreState = () => {
    setProducts([]);
    setCustomers([]);
    setStaff([]);
    setSales([]);
    setExpenses([]);
    setElectronicTxs([]);
    setCheques([]);
    setActualDrawerCash(null);

    setSettings({
      shopName: "Loading Outlet...",
      taxRate: 5,
      currency: "Rs.",
      startingBalance: 12500,
      theme: "bauhaus",
      ownerPassword: "admin",
      staffAccounts: {
        cashier: {
          username: "Cashier Desk",
          password: "cashier123",
          isActive: true,
        },
        inventory: {
          username: "Inventory Manager",
          password: "stock123",
          isActive: true,
        },
      },
    });
  };

  const currency = settings.currency;

  const totalSalesAllTime = useMemo(() => {
    return sales.reduce((acc, s) => acc + s.totalAmount, 0);
  }, [sales]);

  const totalExpensesAllTime = useMemo(() => {
    return expenses.reduce((acc, e) => acc + e.amount, 0);
  }, [expenses]);

  const cashInHand = useMemo(() => {
    return settings.startingBalance + totalSalesAllTime - totalExpensesAllTime;
  }, [settings.startingBalance, totalSalesAllTime, totalExpensesAllTime]);

  const value = {
    currentUser,
    authLoading,
    currentRole,
    handleRoleChange,
    operatorRole,
    handleSwitchOperator,
    settings,
    products,
    customers,
    staff,
    sales,
    expenses,
    electronicTxs,
    cheques,
    actualDrawerCash,
    currency,
    cashInHand,
    totalSalesAllTime,
    totalExpensesAllTime,
    showInvoiceForm,
    setShowInvoiceForm,
    useSupabaseActive,
    setUseSupabaseActive,
    refreshDataFromSupabase,
    supabaseError,
    setSupabaseError,
    handleAddProduct,
    handleUpdateProductStock,
    handleDeleteProduct,
    handleAddCustomer,
    handleOnboardStaff,
    handleLogAttendance,
    handleAddSale,
    handleUpdateSale,
    handleAddExpense,
    handleDeleteExpense,
    handleUpdateSettings,
    handleUpdateActualDrawerCash,
    handleAddElectronicTx,
    handleDeleteElectronicTx,
    handleAddCheque,
    handleDeleteCheque,
    handleLogout,
    handleResetDatabase
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

const defaultContextValue: AppContextType = {
  currentUser: null,
  authLoading: true,
  currentRole: "admin",
  handleRoleChange: () => {},
  operatorRole: "admin",
  handleSwitchOperator: async () => ({ success: false, message: "Not implemented" }),
  settings: {
    shopName: "Urban Mart",
    taxRate: 5,
    currency: "$",
    startingBalance: 12500,
    theme: "bauhaus",
  },
  products: [],
  customers: [],
  staff: [],
  sales: [],
  expenses: [],
  electronicTxs: [],
  cheques: [],
  actualDrawerCash: null,
  currency: "$",
  cashInHand: 12500,
  totalSalesAllTime: 0,
  totalExpensesAllTime: 0,
  showInvoiceForm: false,
  setShowInvoiceForm: () => {},

  useSupabaseActive: false,
  setUseSupabaseActive: () => {},
  refreshDataFromSupabase: async () => {},

  supabaseError: null,
  setSupabaseError: () => {},

  handleAddProduct: async () => {},
  handleUpdateProductStock: async () => {},
  handleDeleteProduct: async () => {},
  handleAddCustomer: async () => {},
  handleOnboardStaff: async () => {},
  handleLogAttendance: async () => {},
  handleAddSale: async () => {},
  handleUpdateSale: async () => {},
  handleAddExpense: async () => {},
  handleDeleteExpense: async () => {},
  handleUpdateSettings: async () => {},
  handleUpdateActualDrawerCash: async () => {},
  handleAddElectronicTx: async () => {},
  handleDeleteElectronicTx: async () => {},
  handleAddCheque: async () => {},
  handleDeleteCheque: async () => {},
  handleLogout: async () => {},
  handleResetDatabase: async () => {},
};

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    return defaultContextValue;
  }
  return context;
}
