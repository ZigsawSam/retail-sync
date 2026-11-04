import React, { useState } from "react";
import { 
  Lock, 
  Mail, 
  Sparkles, 
  Briefcase, 
  CheckCircle,
  HelpCircle,
  Store
} from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured, transferMockDataToSupabase, parseSupabaseError, resendConfirmationEmail } from "../lib/supabase";
import { setAppMode } from "@/lib/app-mode";

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopCategory, setShopCategory] = useState("");
  const [shopSubcategory, setShopSubcategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfigHelp, setShowConfigHelp] = useState(false);

  // Security Email Verification states
  const [verificationSuccessMessage, setVerificationSuccessMessage] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const handleResendConfirmation = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setResendingEmail(true);
    setError(null);
    setResendStatus(null);
    try {
      const res = await resendConfirmationEmail(email);
      if (res.success) {
        setResendStatus(res.message);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      console.error("Resend confirmation failed:", err);
      const parsed = parseSupabaseError(err);
      setError(parsed.friendlyMessage);
    } finally {
      setResendingEmail(false);
    }
  };

  const handleLocalBypass = () => {
    setAppMode("offline");

    const localUser = {
        uid: "local-demo",
        email: "sandbox@retailsync.local",
        displayName: "Demo Operator",
    };

    localStorage.setItem(
        "retail_sync_local_user",
        JSON.stringify(localUser)
    );

    // Clear any leftover staff session/role so the offline bypass always
    // starts as a clean Admin session, not whatever role was last active.
    sessionStorage.removeItem("retail_sync_staff_session");
    localStorage.removeItem("retail_sync_operator_role");
    localStorage.removeItem("retail_sync_erp_role");

    onAuthSuccess();

    window.location.reload();
};

  // Helper to seed standard initial demo data for a newly registered user/shop
  const seedNewShopData = async (uid: string, nameOfShop: string, businessCategory: string, businessSubcategory: string) => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const defaultSettings = {
        id: uid,
        shopName: nameOfShop,
        shop_category: businessCategory,
        shop_subcategory: businessSubcategory,
        product_categories: [],
        expense_categories: [],
        taxRate: 5,
        startingBalance: 12500,
        currency: "Rs.",
        userId: uid,
        quickAddProductIds: []
      };
      
      const { error: upsertErr } = await supabase.from("settings").upsert(defaultSettings);
      if (upsertErr) {
        console.warn("Default settings upsert failed (possibly due to RLS). Seed will try to recover.", upsertErr);
      }
      
      const res = await transferMockDataToSupabase(uid);
      if (!res.success) {
        console.error("Failed to seed initial demo data in Supabase:", res.message);
        if (res.errorDetails) {
          setError(`Shop registered, but DB Seeding failed: ${res.errorDetails.friendlyMessage}`);
        }
      } else {
        console.log("Successfully seeded database collections for user in Supabase:", uid);
      }
    } catch (e: any) {
      console.error("Failed to seed initial demo data for new tenant in Supabase:", e);
      const parsed = parseSupabaseError(e);
      setError(`Database Seeding Exception: ${parsed.friendlyMessage}`);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setVerificationSuccessMessage(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file (locally) or your Vercel project's Environment Variables (in production), then restart/redeploy. You can still use 'Enter Offline Sandbox Mode' below to explore the app without a database.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // Try to find a matching staff account in localStorage settings (offline sandbox or cached online stores)
        let foundStaffMatch = false;
        let matchedOwnerUid = "";
        let matchedRole: any = "cashier";
        let matchedDisplayName = "";

        // A. Check offline sandbox settings
        const sandboxSettingsStr = typeof window !== "undefined" ? localStorage.getItem("retail_sync_settings") : null;
        if (sandboxSettingsStr) {
          try {
            const sandboxSettings = JSON.parse(sandboxSettingsStr);
            const staff = sandboxSettings.staffAccounts;
            if (staff) {
              if (staff.cashier && staff.cashier.isActive && staff.cashier.email?.toLowerCase() === email.toLowerCase() && staff.cashier.password === password) {
                foundStaffMatch = true;
                matchedOwnerUid = "local-demo";
                matchedRole = "cashier";
                matchedDisplayName = staff.cashier.username;
              } else if (staff.inventory && staff.inventory.isActive && staff.inventory.email?.toLowerCase() === email.toLowerCase() && staff.inventory.password === password) {
                foundStaffMatch = true;
                matchedOwnerUid = "local-demo";
                matchedRole = "inventory_manager";
                matchedDisplayName = staff.inventory.username;
              }
            }
          } catch (e) {
            console.error("Failed to parse sandbox settings for staff check", e);
          }
        }

        // B. Check cached online stores in localStorage
        if (!foundStaffMatch && typeof window !== "undefined") {
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith("retail_sync_fallback_settings_")) {
                const ownerUid = key.replace("retail_sync_fallback_settings_", "");
                const settingsStr = localStorage.getItem(key);
                if (settingsStr) {
                  const settingsObj = JSON.parse(settingsStr);
                  const staff = settingsObj.staffAccounts;
                  if (staff) {
                    if (staff.cashier && staff.cashier.isActive && staff.cashier.email?.toLowerCase() === email.toLowerCase() && staff.cashier.password === password) {
                      foundStaffMatch = true;
                      matchedOwnerUid = ownerUid;
                      matchedRole = "cashier";
                      matchedDisplayName = staff.cashier.username;
                      break;
                    } else if (staff.inventory && staff.inventory.isActive && staff.inventory.email?.toLowerCase() === email.toLowerCase() && staff.inventory.password === password) {
                      foundStaffMatch = true;
                      matchedOwnerUid = ownerUid;
                      matchedRole = "inventory_manager";
                      matchedDisplayName = staff.inventory.username;
                      break;
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error("Failed to parse cached online settings for staff check", e);
          }
        }

        // C. Try to query Supabase using the secure verify_staff_login RPC
if (!foundStaffMatch && supabase) {
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc("verify_staff_login", {
      p_email: email,
      p_password: password
    });

    // Check if rpcRes is not null and the success property is true
    if (!rpcErr && rpcRes && rpcRes.success === true) {
      foundStaffMatch = true;
      matchedOwnerUid = rpcRes.ownerUid;
      matchedRole = rpcRes.role;
      matchedDisplayName = rpcRes.displayName;
      
      console.log("Staff match found via RPC:", matchedDisplayName);
    } else if (rpcErr) {
      console.warn("verify_staff_login RPC query returned error, falling back:", rpcErr);
    }
  } catch (e) {
    console.warn("verify_staff_login RPC failed, trying settings query fallback:", e);
  }
}

        // D. Fallback: Try to query settings directly if RPC isn't deployed or returned no match (in case they are on a new browser/device and RLS is disabled)
        if (!foundStaffMatch && supabase) {
          try {
            const { data: allSettings } = await supabase
              .from("settings")
              .select("*");
            
            if (allSettings && allSettings.length > 0) {
              const match = allSettings.find((row: any) => {
                const staff = row.staffAccounts;
                if (!staff) return false;
                const cashierMatch = staff.cashier && staff.cashier.isActive && staff.cashier.email?.toLowerCase() === email.toLowerCase() && staff.cashier.password === password;
                const inventoryMatch = staff.inventory && staff.inventory.isActive && staff.inventory.email?.toLowerCase() === email.toLowerCase() && staff.inventory.password === password;
                return cashierMatch || inventoryMatch;
              });

              if (match) {
                const staff = match.staffAccounts;
                const isCashier = staff.cashier && staff.cashier.email?.toLowerCase() === email.toLowerCase();
                foundStaffMatch = true;
                matchedOwnerUid = match.id;
                matchedRole = isCashier ? "cashier" : "inventory_manager";
                matchedDisplayName = isCashier ? staff.cashier.username : staff.inventory.username;
              }
            }
          } catch (e) {
            console.warn("Supabase online settings fallback query failed (possibly RLS enabled):", e);
          }
        }

        if (foundStaffMatch) {

    sessionStorage.setItem(
        "retail_sync_staff_session",
        JSON.stringify({
            ownerUid: matchedOwnerUid,
            role: matchedRole,
            displayName: matchedDisplayName,
            email
        })
    );

    localStorage.setItem(
        "retail_sync_operator_role",
        matchedRole
    );

    localStorage.setItem(
        "retail_sync_erp_role",
        matchedRole
    );

    // Force a full reload (like the offline/admin bypass does) so AppContext's
    // one-time auth-monitor effect re-runs and picks up the new staff session
    // from sessionStorage/localStorage. A soft router.push() here left staff
    // stuck back on the login screen because currentUser was never populated.
    window.location.href = "/dashboard";

    return;
}

        // D. Fall back to standard owner Supabase login if no staff account match is found
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { data: { shop_name: shopName.trim(), shop_category: shopCategory, shop_subcategory: shopSubcategory.trim() } }
        });
        setAppMode("online");

localStorage.removeItem("retail_sync_local_user");
        if (err) throw err;

        // Clear any leftover staff session/role from a previous cashier or
        // stockist login on this browser, so the real owner isn't locked
        // into that role.
        sessionStorage.removeItem("retail_sync_staff_session");
        localStorage.removeItem("retail_sync_operator_role");
        localStorage.removeItem("retail_sync_erp_role");

        window.location.href = "/dashboard";
      } else {
        if (!shopName.trim()) {
          setError("Please specify a Shop/Retail Outlet Name.");
          setLoading(false);
          return;
        }
        if (!shopCategory) {
          setError("Please select your shop category.");
          setLoading(false);
          return;
        }
        if (!shopSubcategory.trim()) {
          setError("Please enter your shop subcategory.");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          setLoading(false);
          return;
        }

        // Direct standard real Supabase signup
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password
        });
        setAppMode("online");

localStorage.removeItem("retail_sync_local_user");
        if (err) throw err;

        if (!data?.session) {
          // Email confirmation is enabled in Supabase!
          setVerificationSuccessMessage("Shop registered successfully! Since email confirmation is enabled on your Supabase project, a real confirmation link has been sent to your inbox. Please verify your address, then log in under the 'Sign In' tab.");
          setIsLogin(true);
          setLoading(false);
          return;
        }

        // Email confirmation is disabled, user has an active session
        if (data?.user) {
          // Seed customized demo ledger data securely
          await seedNewShopData(data.user.id, shopName.trim(), shopCategory, shopSubcategory.trim());
        }

        setVerificationSuccessMessage("Successfully registered and shop initialized!");
        setTimeout(() => {
          onAuthSuccess();
        }, 1500);
      }
    } catch (err: any) {
      console.error("Authentication action failed:", err);
      const parsed = parseSupabaseError(err);
      setError(parsed.originalMessage); // Keep original message in the state so error render check works, or set raw string
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file (locally) or your Vercel project's Environment Variables (in production), then restart/redeploy. You can still use 'Enter Offline Sandbox Mode' below to explore the app without a database.");
      setLoading(false);
      return;
    }
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (err) throw err;
    } catch (err: any) {
      console.error("Google authentication action failed:", err);
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#FAF8F5] text-black flex flex-col items-center justify-center p-4 font-sans select-none">
      {/* Visual Identity Logo Header */}
      <div className="mb-6 text-center select-none animate-fadeIn">
        <div className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-black text-[#FAF8F5] border-3 border-black text-xl font-black tracking-tight uppercase shadow-[4px_4px_0px_0px_#D63031]">
          <Store className="w-6 h-6 text-[#FFC300]" />
          <span>RETAIL SYNC PRO</span>
        </div>
        <p className="text-[10px] text-zinc-600 font-mono font-black uppercase mt-2 tracking-widest">Bauhaus-Designed Multi-Shop Ledger Engine</p>
      </div>

      <div className="w-full max-w-md bg-white border-3 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden animate-fadeIn">
        {/* Top Accent Strip */}
        <div className="h-3 bg-gradient-to-r from-[#D63031] via-[#FFC300] to-[#0055A5] border-b-2 border-black" />

        {/* Tab Headers */}
        <div className="flex border-b-3 border-black">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(null); }}
            className={`flex-1 py-4 text-center text-xs font-black uppercase tracking-wider transition-colors border-r-2 border-black cursor-pointer ${
              isLogin ? "bg-[#FFC300] text-black" : "bg-white hover:bg-zinc-50 text-zinc-600"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(null); }}
            className={`flex-1 py-4 text-center text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
              !isLogin ? "bg-[#0055A5] text-white" : "bg-white hover:bg-zinc-50 text-zinc-600"
            }`}
          >
            Register Shop
          </button>
        </div>

        <div className="p-6 space-y-5">
          {verificationSuccessMessage && (
            <div className="p-4 bg-[#E6F4EA] border-2 border-black rounded-none text-xs font-mono font-bold text-[#137333] shadow-[4px_4px_0px_0px_#137333] flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle className="w-5 h-5 text-[#137333] shrink-0 mt-0.5" />
              <div>
                <p className="font-black uppercase text-black">Verification Successful</p>
                <p className="leading-relaxed mt-0.5">{verificationSuccessMessage}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 border-2 border-black rounded-none text-xs font-mono font-bold bg-[#FCE8E6] text-[#D63031] shadow-[4px_4px_0px_0px_rgba(214,48,49,0.15)] animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <span className="text-base shrink-0">⚠️</span>
                <div>
                  <p className="font-black text-[#D63031] uppercase mb-1">Authorization Notice</p>
                  <div className="leading-relaxed text-zinc-700">
                    {error.includes("Invalid login credentials") ? (
                      <>
                        <span className="font-black text-black text-xs uppercase block mb-1">Invalid login credentials</span>
                        Your email or password did not match our records.
                        <br /><br />
                        <span className="text-black font-black">Troubleshooting Tips:</span>
                        <ul className="list-disc pl-4 mt-1 space-y-1 text-[11px]">
                          <li>If you are a new operator, select the <strong className="text-[#0055A5] uppercase">Register Shop</strong> tab above to create your secure credentials.</li>
                          <li>If email verification is enabled on your Supabase dashboard, check your inbox to confirm your address before logging in.</li>
                          <li>Want to try the app instantly? Click the <strong className="text-amber-600 uppercase">Enter Offline Sandbox Mode</strong> button below to bypass login and play right away!</li>
                        </ul>
                      </>
                    ) : parseSupabaseError(error).type === "user_already_registered" ? (
                      <>
                        <span className="font-black text-black text-xs uppercase block mb-1">Account Already Exists</span>
                        This email address is already registered in your Supabase project database.
                        <br /><br />
                        <span className="text-black font-black">Troubleshooting Tips:</span>
                        <ul className="list-disc pl-4 mt-1 space-y-1 text-[11px]">
                          <li className="list-none -ml-4 mb-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsLogin(true);
                                setError(null);
                              }}
                              className="w-full text-center py-1.5 px-3 bg-[#FFC300] hover:bg-amber-400 text-black border-2 border-black text-[10px] font-black uppercase tracking-wider transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                            >
                              🔑 Switch to Sign In Tab
                            </button>
                          </li>
                          <li>Go to the "Sign In" tab above and enter your existing password to log in.</li>
                          <li>If you've forgotten your password, you can reset it via your Supabase Console, or use a different email address to register.</li>
                          <li>If you just want to test things out, click "Enter Offline Sandbox Mode" below to proceed instantly!</li>
                        </ul>
                      </>
                    ) : error.includes("Email not confirmed") || error.includes("Email confirmation") ? (
                      <>
                        <span className="font-black text-black text-xs uppercase block mb-1">Email Confirmation Required</span>
                        Your email address has not been verified yet. Supabase requires you to confirm your email before you can log in.
                        <br /><br />
                        {resendStatus && (
                          <div className="mb-3 p-2.5 bg-[#E6F4EA] border-2 border-black text-black text-[11px] font-mono leading-relaxed font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            {resendStatus}
                          </div>
                        )}
                        <span className="text-black font-black">Troubleshooting Tips:</span>
                        <ul className="list-disc pl-4 mt-1 space-y-1 text-[11px]">
                          <li className="list-none -ml-4 mb-2">
                            <button
                              type="button"
                              disabled={resendingEmail}
                              onClick={handleResendConfirmation}
                              className="w-full text-center py-1.5 px-3 bg-[#FFC300] hover:bg-amber-400 text-black border-2 border-black text-[10px] font-black uppercase tracking-wider transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 cursor-pointer"
                            >
                              {resendingEmail ? "Resending confirmation email..." : "✉️ Resend Confirmation Email"}
                            </button>
                          </li>
                          <li>Check your email inbox (and spam/junk folder) for a confirmation link sent from your Supabase project.</li>
                          <li>Click the link in that email to authorize your account, then try signing in here again.</li>
                          <li>Want to bypass this entirely? You can disable "Confirm Email" in your <strong className="text-black">Supabase Dashboard → Authentication → Providers → Email</strong> settings.</li>
                          <li>Or, click the <strong className="text-amber-600 uppercase">Enter Offline Sandbox Mode</strong> button below to use the application instantly offline!</li>
                        </ul>
                      </>
                    ) : (
                      <>
                        <span className="font-black text-black text-xs uppercase block mb-1">Notice</span>
                        <p className="mb-2 text-zinc-900 font-bold">{parseSupabaseError(error).friendlyMessage}</p>
                        
                        <span className="text-black font-black uppercase text-[10px] tracking-wider block mt-3">Troubleshooting Steps:</span>
                        <ul className="list-disc pl-4 mt-1.5 space-y-1 text-[11px] text-zinc-700">
                          {parseSupabaseError(error).troubleshootingSteps.map((step, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {step.includes("ALTER TABLE") ? (
                                <div className="mt-1 mb-1.5">
                                  <span className="text-[10px] font-bold text-black uppercase block mb-0.5">Run this query in Supabase SQL Editor:</span>
                                  <code className="block bg-zinc-100 p-2 border-2 border-black text-[10px] text-black font-mono overflow-x-auto whitespace-pre select-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">
                                    {step}
                                  </code>
                                </div>
                              ) : (
                                step
                              )}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {!isLogin && (
              <div className="animate-fadeIn">
                <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Registered Retail Outlet Name</label>
                <div className="relative">
                  <Store className="absolute left-3 top-3 w-4.5 h-4.5 text-black" />
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="e.g. Urban Threads Boutique"
                    className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none placeholder-zinc-500"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Shop Category</label>
                <select required value={shopCategory} onChange={e=>{setShopCategory(e.target.value);setShopSubcategory("");}} className="w-full border-2 border-black bg-white px-3 py-2.5 text-sm font-bold">
                  <option value="">Select business type</option>
                  {["Grocery & Convenience","Fashion & Apparel","Electronics","Pharmacy & Healthcare","Hardware & Building Supplies","Home & Furniture","Beauty & Personal Care","Restaurant & Food Service","Stationery & Books","General Retail","Other"].map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Shop Subcategory</label>
                <input required value={shopSubcategory} onChange={e=>setShopSubcategory(e.target.value)} placeholder="e.g. Supermarket, Kirana, Mobile Store" className="w-full border-2 border-black px-3 py-2.5 text-sm font-bold" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Operator Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4.5 h-4.5 text-black" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@store.com"
                  className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none placeholder-zinc-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Security Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4.5 h-4.5 text-black" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none placeholder-zinc-500"
                />
              </div>
            </div>

            {!isLogin && (
              <div className="animate-fadeIn">
                <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4.5 h-4.5 text-black" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none placeholder-zinc-500"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-black text-[#FAF8F5] hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:border-zinc-300 border-2 border-black text-xs font-black uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? "Authenticating Operator..." : isLogin ? "Secure Operator Login" : "Register Shop & Initialize Ledger"}
            </button>
          </form>

          {/* Separator */}
          <div className="relative flex items-center py-2 shrink-0">
            <div className="flex-grow border-t-2 border-dashed border-black"></div>
            <span className="flex-shrink mx-4 text-[9px] font-mono font-black uppercase text-zinc-500">OR CONNECT WITH</span>
            <div className="flex-grow border-t-2 border-dashed border-black"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full py-3 bg-white text-black hover:bg-zinc-50 disabled:opacity-50 border-2 border-black text-xs font-black uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_#0055A5] flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Operator Google Portal</span>
          </button>

          <button
            type="button"
            onClick={handleLocalBypass}
            className="w-full py-3 bg-[#FFC300] text-black hover:bg-[#e6af00] border-2 border-black text-xs font-black uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            <Sparkles className="w-4 h-4 text-[#D63031]" />
            <span>Enter Offline Sandbox Mode</span>
          </button>

          {/* Configuration / Auth Troubleshooter */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowConfigHelp(!showConfigHelp)}
              className="text-[10px] font-mono font-black uppercase text-zinc-600 hover:underline flex items-center gap-1.5 mx-auto cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Operator Auth Troubleshooter</span>
            </button>

            {showConfigHelp && (
              <div className="mt-3 p-4 bg-[#F5F2EB] border-2 border-black rounded-none text-[11px] text-zinc-700 space-y-2 leading-relaxed animate-fadeIn font-mono font-bold">
                <p className="text-black font-black text-xs uppercase border-b border-black pb-1 mb-2">How to Enable Providers:</p>
                <p>1. Open your <strong className="text-black">Supabase Dashboard</strong> for your project.</p>
                <p>2. Navigate to <strong className="text-black">Authentication → Providers</strong>.</p>
                <p>3. Ensure <strong className="text-[#0055A5]">Email</strong> (and optionally <strong className="text-[#0055A5]">Google</strong>) providers are enabled.</p>
                <p className="text-[10px] text-zinc-500 italic pt-1">Note: Retail Sync Pro utilizes completely isolated multi-tenant workspaces. No shop operator can access another store's inventory, sales record, ledger details, or staff sheets.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
