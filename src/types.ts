export type ERPRole = "admin" | "cashier" | "inventory_manager";

export interface Product {
  id: string;
  name: string;
  category: string;
  purchasePrice: number; // Cost Price
  sellingPrice: number; // MRP
  quantity: number; // Current Stock
  barcode: string; // SKU / Barcode
  lowStockLimit: number;
  overstockLimit: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  points: number;
  tier: "Bronze" | "Silver" | "Gold";
  totalSpent: number;
}

export interface CommissionAgent {
  name: string;
  phone: string;
  totalEarnings: number;
}

export interface Staff {
  id: string;
  name: string;
  phone: string;
  role: string;
  paymentType: "Monthly fixed" | "Daily wage" | "Hourly";
  rate: number; // monthly fixed salary, daily rate, or hourly rate
  attendance: Record<string, { present: boolean; hoursWorked?: number; wageEarned?: number }>;
}

// Staff login record (lives in DB, has history)
// Links to the Staff table via staff_id
export interface StaffLogin {
  id: string;
  userId: string; // shop owner (Supabase auth user)
  staffId: string; // links to Staff.id
  authUserId?: string | null; // individual Supabase Auth identity
  name: string;
  role: "cashier" | "inventory_manager";
  email: string | null;
  password?: string | null; // legacy field; new Auth accounts never store a password here
  isActive: boolean;
  createdAt: string;
  terminatedAt: string | null;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number; // Selling Price at checkout
  commissionPercent: number; // specific to this item
}

export interface Sale {
  id: string;
  customerName: string;
  customerPhone: string;
  items: SaleItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
  commissionAgent?: {
    name: string;
    phone: string;
    commissionPercent: number;
    commissionAmount: number;
    notified: boolean;
  };
  timestamp: string;
  clearanceStatus?: "Pending" | "Cleared";
  discountAmount?: number;
  processedBy?: string; // staff_login.id
  processedByName?: string; // denormalized for display
}

export interface Expense {
  id: string;
  category: "Staff Salary" | "Agent Commission" | "Inventory Purchase" | "Rent" | "Utilities" | "Other" | "Drawer Cash Addition" | "Drawer Cash Withdrawal";
  amount: number;
  description: string;
  timestamp: string;
  paymentMethod?: string;
  loggedBy?: string; // staff_login.id
  loggedByName?: string; // denormalized for display
}

export interface StaffAccount {
  username: string;
  email?: string;
  password?: string;
  isActive: boolean;
}

export interface StoreSettings {
  shopName: string;
  taxRate: number; // e.g., 5 for 5%
  currency: string; // e.g., "$" or "Rs"
  startingBalance: number; // Yesterday's closing balance
  quickAddProductIds?: string[];
  theme?: "enterprise" | "bauhaus" | "glassmorphism" | "neumorphism" | "neo-brutalism" | "kitsch" | "dark" | "material";
  staffAccounts?: {
    cashier?: StaffAccount;
    inventory?: StaffAccount;
  };
  ownerPassword?: string;
}

export interface Cheque {
  id: string;
  chequeNumber: string;
  customerName: string;
  amount: number;
  bank?: string;
  timestamp: string;
}

export interface ElectronicTx {
  id: string;
  type: "upi_pay" | "upi_recv" | "card_pay" | "card_recv";
  amount: number;
  description: string;
  timestamp: string;
}
