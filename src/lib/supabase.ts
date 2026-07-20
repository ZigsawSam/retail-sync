import { createClient } from "@supabase/supabase-js";
import { Product, Customer, Staff, Sale, Expense, StoreSettings, ElectronicTx, Cheque } from "../types";

// Safe, lazy initialization of Supabase Client to prevent crashes on startup if env keys are missing
const getSupabaseConfig = () => {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  };
};

export const isSupabaseConfigured = (): boolean => {
  const { url, anonKey } = getSupabaseConfig();
  return !!(url && anonKey);
};

const globalForSupabase = globalThis as unknown as {
  supabase: any;
  lastUrl: string;
  lastKey: string;
};

export const getSupabaseClient = (): any => {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    return null;
  }
  if (globalForSupabase.supabase && url === globalForSupabase.lastUrl && anonKey === globalForSupabase.lastKey) {
    return globalForSupabase.supabase;
  }
  globalForSupabase.lastUrl = url;
  globalForSupabase.lastKey = anonKey;
  globalForSupabase.supabase = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  });
  return globalForSupabase.supabase;
};

// Database schema SQL query for users to run in their Supabase SQL editor
export const SUPABASE_SQL_SCHEMA = `-- SQL Script to set up tables in Supabase
-- Run this in your Supabase SQL Editor

-- 1. Settings Table
CREATE TABLE IF NOT EXISTS "settings" (
  "id" text PRIMARY KEY,
  "shopName" text NOT NULL,
  "taxRate" numeric DEFAULT 5,
  "startingBalance" numeric DEFAULT 12500,
  "currency" text DEFAULT '$',
  "theme" text DEFAULT 'bauhaus',
  "userId" text,
  "quickAddProductIds" jsonb DEFAULT '[]'::jsonb,
  "staffAccounts" jsonb DEFAULT '{}'::jsonb,
  "ownerPassword" text
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS "products" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "name" text NOT NULL,
  "category" text,
  "purchasePrice" numeric,
  "sellingPrice" numeric,
  "quantity" numeric DEFAULT 0,
  "barcode" text,
  "lowStockLimit" numeric,
  "overstockLimit" numeric
);

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS "customers" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "email" text,
  "points" numeric DEFAULT 0,
  "tier" text DEFAULT 'Bronze',
  "totalSpent" numeric DEFAULT 0
);

-- 4. Staff Table
CREATE TABLE IF NOT EXISTS "staff" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "role" text,
  "paymentType" text,
  "rate" numeric DEFAULT 0,
  "attendance" jsonb DEFAULT '{}'::jsonb
);

-- 5. Sales Table
CREATE TABLE IF NOT EXISTS "sales" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "customerName" text,
  "customerPhone" text,
  "items" jsonb DEFAULT '[]'::jsonb,
  "subtotal" numeric DEFAULT 0,
  "taxRate" numeric DEFAULT 5,
  "taxAmount" numeric DEFAULT 0,
  "totalAmount" numeric DEFAULT 0,
  "paymentMethod" text,
  "commissionAgent" jsonb,
  "clearanceStatus" text DEFAULT 'Pending',
  "discountAmount" numeric DEFAULT 0,
  "timestamp" text NOT NULL
);

-- 6. Expenses Table
CREATE TABLE IF NOT EXISTS "expenses" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "category" text,
  "amount" numeric DEFAULT 0,
  "description" text,
  "paymentMethod" text DEFAULT 'Cash',
  "timestamp" text NOT NULL
);

-- 7. Electronic Transactions Table
CREATE TABLE IF NOT EXISTS "electronicTxs" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "referenceNo" text,
  "amount" numeric DEFAULT 0,
  "paymentMethod" text,
  "timestamp" text NOT NULL
);

-- 8. Cheques Table
CREATE TABLE IF NOT EXISTS "cheques" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "chequeNumber" text,
  "bankName" text,
  "amount" numeric DEFAULT 0,
  "dueDate" text,
  "status" text,
  "timestamp" text NOT NULL
);

-- 9. Actual Drawer Cash Table
CREATE TABLE IF NOT EXISTS "actualDrawerCash" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "date" text NOT NULL,
  "amount" numeric DEFAULT 0
);

-- 10. Ensure columns exist on existing tables (Migrations)
ALTER TABLE IF EXISTS "settings" ADD COLUMN IF NOT EXISTS "theme" text DEFAULT 'bauhaus';
ALTER TABLE IF EXISTS "settings" ADD COLUMN IF NOT EXISTS "quickAddProductIds" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS "settings" ADD COLUMN IF NOT EXISTS "staffAccounts" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS "settings" ADD COLUMN IF NOT EXISTS "ownerPassword" text;
ALTER TABLE IF EXISTS "expenses" ADD COLUMN IF NOT EXISTS "paymentMethod" text DEFAULT 'Cash';
ALTER TABLE IF EXISTS "sales" ADD COLUMN IF NOT EXISTS "clearanceStatus" text DEFAULT 'Pending';
ALTER TABLE IF EXISTS "sales" ADD COLUMN IF NOT EXISTS "discountAmount" numeric DEFAULT 0;

-- 11. Enable Row Level Security (RLS) on all tables and create secure policies for the authenticated operator
ALTER TABLE IF EXISTS "settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "electronicTxs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "cheques" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "actualDrawerCash" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent errors during schema re-runs
DROP POLICY IF EXISTS "Allow individual user select settings" ON "settings";
DROP POLICY IF EXISTS "Allow individual user insert settings" ON "settings";
DROP POLICY IF EXISTS "Allow individual user update settings" ON "settings";
DROP POLICY IF EXISTS "Allow individual user delete settings" ON "settings";

DROP POLICY IF EXISTS "Allow individual user select products" ON "products";
DROP POLICY IF EXISTS "Allow individual user insert products" ON "products";
DROP POLICY IF EXISTS "Allow individual user update products" ON "products";
DROP POLICY IF EXISTS "Allow individual user delete products" ON "products";

DROP POLICY IF EXISTS "Allow individual user select customers" ON "customers";
DROP POLICY IF EXISTS "Allow individual user insert customers" ON "customers";
DROP POLICY IF EXISTS "Allow individual user update customers" ON "customers";
DROP POLICY IF EXISTS "Allow individual user delete customers" ON "customers";

DROP POLICY IF EXISTS "Allow individual user select staff" ON "staff";
DROP POLICY IF EXISTS "Allow individual user insert staff" ON "staff";
DROP POLICY IF EXISTS "Allow individual user update staff" ON "staff";
DROP POLICY IF EXISTS "Allow individual user delete staff" ON "staff";

DROP POLICY IF EXISTS "Allow individual user select sales" ON "sales";
DROP POLICY IF EXISTS "Allow individual user insert sales" ON "sales";
DROP POLICY IF EXISTS "Allow individual user update sales" ON "sales";
DROP POLICY IF EXISTS "Allow individual user delete sales" ON "sales";

DROP POLICY IF EXISTS "Allow individual user select expenses" ON "expenses";
DROP POLICY IF EXISTS "Allow individual user insert expenses" ON "expenses";
DROP POLICY IF EXISTS "Allow individual user update expenses" ON "expenses";
DROP POLICY IF EXISTS "Allow individual user delete expenses" ON "expenses";

DROP POLICY IF EXISTS "Allow individual user select electronicTxs" ON "electronicTxs";
DROP POLICY IF EXISTS "Allow individual user insert electronicTxs" ON "electronicTxs";
DROP POLICY IF EXISTS "Allow individual user update electronicTxs" ON "electronicTxs";
DROP POLICY IF EXISTS "Allow individual user delete electronicTxs" ON "electronicTxs";

DROP POLICY IF EXISTS "Allow individual user select cheques" ON "cheques";
DROP POLICY IF EXISTS "Allow individual user insert cheques" ON "cheques";
DROP POLICY IF EXISTS "Allow individual user update cheques" ON "cheques";
DROP POLICY IF EXISTS "Allow individual user delete cheques" ON "cheques";

DROP POLICY IF EXISTS "Allow individual user select actualDrawerCash" ON "actualDrawerCash";
DROP POLICY IF EXISTS "Allow individual user insert actualDrawerCash" ON "actualDrawerCash";
DROP POLICY IF EXISTS "Allow individual user update actualDrawerCash" ON "actualDrawerCash";
DROP POLICY IF EXISTS "Allow individual user delete actualDrawerCash" ON "actualDrawerCash";

-- Create CRUD policies matching user id (auth.uid()::text) for settings
CREATE POLICY "Allow individual user select settings" ON "settings" FOR SELECT TO authenticated USING (auth.uid()::text = id OR auth.uid()::text = "userId");
CREATE POLICY "Allow individual user insert settings" ON "settings" FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = id OR auth.uid()::text = "userId");
CREATE POLICY "Allow individual user update settings" ON "settings" FOR UPDATE TO authenticated USING (auth.uid()::text = id OR auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = id OR auth.uid()::text = "userId");
CREATE POLICY "Allow individual user delete settings" ON "settings" FOR DELETE TO authenticated USING (auth.uid()::text = id OR auth.uid()::text = "userId");

-- Create CRUD policies matching user id for products
CREATE POLICY "Allow individual user select products" ON "products" FOR SELECT TO authenticated USING (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user insert products" ON "products" FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user update products" ON "products" FOR UPDATE TO authenticated USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user delete products" ON "products" FOR DELETE TO authenticated USING (auth.uid()::text = "userId");

-- Create CRUD policies matching user id for customers
CREATE POLICY "Allow individual user select customers" ON "customers" FOR SELECT TO authenticated USING (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user insert customers" ON "customers" FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user update customers" ON "customers" FOR UPDATE TO authenticated USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user delete customers" ON "customers" FOR DELETE TO authenticated USING (auth.uid()::text = "userId");

-- Create CRUD policies matching user id for staff
CREATE POLICY "Allow individual user select staff" ON "staff" FOR SELECT TO authenticated USING (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user insert staff" ON "staff" FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user update staff" ON "staff" FOR UPDATE TO authenticated USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user delete staff" ON "staff" FOR DELETE TO authenticated USING (auth.uid()::text = "userId");

-- Create CRUD policies matching user id for sales
CREATE POLICY "Allow individual user select sales" ON "sales" FOR SELECT TO authenticated USING (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user insert sales" ON "sales" FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user update sales" ON "sales" FOR UPDATE TO authenticated USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user delete sales" ON "sales" FOR DELETE TO authenticated USING (auth.uid()::text = "userId");

-- Create CRUD policies matching user id for expenses
CREATE POLICY "Allow individual user select expenses" ON "expenses" FOR SELECT TO authenticated USING (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user insert expenses" ON "expenses" FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user update expenses" ON "expenses" FOR UPDATE TO authenticated USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user delete expenses" ON "expenses" FOR DELETE TO authenticated USING (auth.uid()::text = "userId");

-- Create CRUD policies matching user id for electronicTxs
CREATE POLICY "Allow individual user select electronicTxs" ON "electronicTxs" FOR SELECT TO authenticated USING (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user insert electronicTxs" ON "electronicTxs" FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user update electronicTxs" ON "electronicTxs" FOR UPDATE TO authenticated USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user delete electronicTxs" ON "electronicTxs" FOR DELETE TO authenticated USING (auth.uid()::text = "userId");

-- Create CRUD policies matching user id for cheques
CREATE POLICY "Allow individual user select cheques" ON "cheques" FOR SELECT TO authenticated USING (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user insert cheques" ON "cheques" FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user update cheques" ON "cheques" FOR UPDATE TO authenticated USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user delete cheques" ON "cheques" FOR DELETE TO authenticated USING (auth.uid()::text = "userId");

-- Create CRUD policies matching user id for actualDrawerCash
CREATE POLICY "Allow individual user select actualDrawerCash" ON "actualDrawerCash" FOR SELECT TO authenticated USING (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user insert actualDrawerCash" ON "actualDrawerCash" FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user update actualDrawerCash" ON "actualDrawerCash" FOR UPDATE TO authenticated USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Allow individual user delete actualDrawerCash" ON "actualDrawerCash" FOR DELETE TO authenticated USING (auth.uid()::text = "userId");

-- Create secure RPC function to authenticate staff (bypassing RLS securely via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION verify_staff_login(p_email text, p_password text)
RETURNS jsonb
SECURITY DEFINER
AS $$
DECLARE
  r_setting record;
  v_staff jsonb;
  v_cashier jsonb;
  v_inventory jsonb;
BEGIN
  FOR r_setting IN SELECT * FROM settings LOOP
    v_staff := r_setting."staffAccounts";
    IF v_staff IS NOT NULL THEN
      v_cashier := v_staff->'cashier';
      v_inventory := v_staff->'inventory';
      
      IF v_cashier IS NOT NULL AND (v_cashier->>'isActive')::boolean = true AND lower(v_cashier->>'email') = lower(p_email) AND v_cashier->>'password' = p_password THEN
        RETURN jsonb_build_object(
          'success', true,
          'role', 'cashier',
          'displayName', v_cashier->>'username',
          'ownerUid', r_setting.id
        );
      ELSIF v_inventory IS NOT NULL AND (v_inventory->>'isActive')::boolean = true AND lower(v_inventory->>'email') = lower(p_email) AND v_inventory->>'password' = p_password THEN
        RETURN jsonb_build_object(
          'success', true,
          'role', 'inventory_manager',
          'displayName', v_inventory->>'username',
          'ownerUid', r_setting.id
        );
      END IF;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object('success', false);
END;
$$ LANGUAGE plpgsql;`;

export interface UserFriendlyError {
  originalMessage: string;
  friendlyMessage: string;
  type: "invalid_credentials" | "email_not_confirmed" | "rls_violation" | "missing_column" | "user_already_registered" | "unknown";
  troubleshootingSteps: string[];
}

export const parseSupabaseError = (error: any): UserFriendlyError => {
  const message = error?.message || (typeof error === "string" ? error : "An unexpected error occurred");
  
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes("user already registered") || lowerMessage.includes("user already exists") || lowerMessage.includes("email already in use") || lowerMessage.includes("already registered")) {
    return {
      originalMessage: message,
      friendlyMessage: "This email address is already registered.",
      type: "user_already_registered",
      troubleshootingSteps: [
        "Go to the 'Sign In' tab above and log in using this email address and your password.",
        "If you forgot your password, you can reset it via your Supabase console or register with a different email address.",
        "If you just want to test or demo the app, click 'Enter Offline Sandbox Mode' below to bypass registration entirely!"
      ]
    };
  }

  if (message.includes("Invalid login credentials") || message.includes("invalid_credentials") || message.includes("Invalid credentials")) {
    return {
      originalMessage: message,
      friendlyMessage: "Invalid email address or security password.",
      type: "invalid_credentials",
      troubleshootingSteps: [
        "Double-check your email spelling and password, then try again.",
        "If you are a new operator, please use the 'Register Shop' tab to create your credentials first.",
        "Make sure you aren't trying to log in under 'Sign In' before completing registration."
      ]
    };
  }
  
  if (message.includes("Email not confirmed") || message.includes("Email confirmation") || message.includes("email_not_confirmed") || message.includes("confirm your email")) {
    return {
      originalMessage: message,
      friendlyMessage: "Email address not verified yet.",
      type: "email_not_confirmed",
      troubleshootingSteps: [
        "Check your email inbox (and spam/junk folder) for the verification link.",
        "Click the link inside the verification email, then try logging in again.",
        "Use the 'Resend Confirmation Email' button to receive a fresh verification link.",
        "Alternatively, you can disable mandatory email confirmation in your Supabase project under Authentication -> Providers -> Email -> Confirm email."
      ]
    };
  }

  if (message.includes("violates row-level security policy") || message.includes("row-level security") || message.includes("security policy") || message.includes("RLS")) {
    return {
      originalMessage: message,
      friendlyMessage: "Database Access Restricted (Row-Level Security Policy Violation).",
      type: "rls_violation",
      troubleshootingSteps: [
        "Row-Level Security (RLS) is currently enabled on your Supabase tables, blocking direct database writes.",
        "To resolve this, go to your Supabase Dashboard -> SQL Editor, paste the following SQL, and click Run:",
        "ALTER TABLE settings DISABLE ROW LEVEL SECURITY;\nALTER TABLE products DISABLE ROW LEVEL SECURITY;\nALTER TABLE customers DISABLE ROW LEVEL SECURITY;\nALTER TABLE staff DISABLE ROW LEVEL SECURITY;\nALTER TABLE sales DISABLE ROW LEVEL SECURITY;\nALTER TABLE expenses DISABLE ROW LEVEL SECURITY;\nALTER TABLE \"electronicTxs\" DISABLE ROW LEVEL SECURITY;\nALTER TABLE cheques DISABLE ROW LEVEL SECURITY;\nALTER TABLE \"actualDrawerCash\" DISABLE ROW LEVEL SECURITY;",
        "If you prefer to keep RLS active, you must create permissive Policies allowing authenticated/anonymous insert and select operations."
      ]
    };
  }

  if (message.includes("column") || message.includes("schema cache") || message.includes("theme")) {
    return {
      originalMessage: message,
      friendlyMessage: "Database Schema Mismatch (Missing Theme Column).",
      type: "missing_column",
      troubleshootingSteps: [
        "Your Supabase table schema is missing the 'theme' column.",
        "To update it, go to your Supabase Dashboard -> SQL Editor and run:",
        "ALTER TABLE settings ADD COLUMN IF NOT EXISTS \"theme\" text DEFAULT 'bauhaus';"
      ]
    };
  }

  return {
    originalMessage: message,
    friendlyMessage: message,
    type: "unknown",
    troubleshootingSteps: [
      "Verify your Supabase URL and Anon Key configuration in Settings.",
      "Check your internet connection and network connectivity.",
      "Check the browser developer console for detailed API logs."
    ]
  };
};

export const resendConfirmationEmail = async (email: string): Promise<{ success: boolean; message: string }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, message: "Supabase client is not configured." };
  }
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim()
    });
    if (error) throw error;
    return { success: true, message: "A fresh confirmation link has been sent! Please check your email inbox and spam folder." };
  } catch (error: any) {
    console.error("Failed to resend email:", error);
    const parsed = parseSupabaseError(error);
    return { success: false, message: parsed.friendlyMessage };
  }
};

// Transfer Mock Data to Supabase
export const transferMockDataToSupabase = async (userId: string): Promise<{ success: boolean; message: string; errorDetails?: UserFriendlyError }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, message: "Database connection is unavailable. Please contact the administrator." };
  }

  try {
    // 1. Seed settings (check if settings already exist to preserve custom registered shop name/currency)
    const { data: existingSettings } = await supabase
      .from("settings")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const settingsObj = {
      id: userId,
      shopName: existingSettings?.shopName || "Urban Mart",
      taxRate: existingSettings && existingSettings.taxRate !== undefined ? Number(existingSettings.taxRate) : 5,
      startingBalance: existingSettings && existingSettings.startingBalance !== undefined ? Number(existingSettings.startingBalance) : 12500,
      currency: existingSettings?.currency || "$",
      theme: existingSettings?.theme || "bauhaus",
      userId: userId,
      quickAddProductIds: existingSettings?.quickAddProductIds || []
    };
    
    let { error: settingsError } = await supabase
      .from("settings")
      .upsert(settingsObj);
    
    if (settingsError && (settingsError.message.includes("theme") || settingsError.message.includes("column"))) {
      console.warn("Theme column not found in settings table. Retrying upsert without theme key.");
      const { theme, ...settingsWithoutTheme } = settingsObj;
      const { error: retryError } = await supabase
        .from("settings")
        .upsert(settingsWithoutTheme);
      settingsError = retryError;
    }
    
    if (settingsError) {
      const parsed = parseSupabaseError(settingsError);
      return { 
        success: false, 
        message: `Settings Upsert Failed: ${parsed.friendlyMessage}`,
        errorDetails: parsed
      };
    }

    return { success: true, message: "Successfully initialized database settings in Supabase!" };
  } catch (error: any) {
    console.error("Migration transfer error:", error);
    const parsed = parseSupabaseError(error);
    return { success: false, message: parsed.friendlyMessage, errorDetails: parsed };
  }
};
