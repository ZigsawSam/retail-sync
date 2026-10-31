"use client";

import React, { useEffect, useState } from "react";
import { getSupabaseClient } from "../../../lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const verifyRecoverySession = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (active) setError("Password recovery is not configured.");
        return;
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError || !data.session) {
        setError("This password link is invalid or has expired. Request a new password reset email.");
      } else {
        setReady(true);
      }
    };
    verifyRecoverySession();
    return () => { active = false; };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Password updated. Redirecting to sign in...");
      await supabase.auth.signOut();
      window.setTimeout(() => router.replace("/"), 1200);
    } catch (updateError: any) {
      setError(updateError?.message || "Unable to update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FAF8F5] p-6 text-black">
      <section className="w-full max-w-md bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000000]">
        <h1 className="text-xl font-black uppercase mb-2">Set your password</h1>
        <p className="text-xs text-zinc-600 mb-6">Choose a private password for your Retail Sync account.</p>
        {error && <p role="alert" className="mb-4 p-3 bg-red-50 border-2 border-red-600 text-red-700 text-xs font-bold">{error}</p>}
        {message && <p role="status" className="mb-4 p-3 bg-emerald-50 border-2 border-emerald-600 text-emerald-700 text-xs font-bold">{message}</p>}
        {ready && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase mb-1">New password</label>
              <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full border-2 border-black p-3 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">Confirm password</label>
              <input type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full border-2 border-black p-3 text-sm" />
            </div>
            <button type="submit" disabled={saving} className="w-full bg-black text-white p-3 text-xs font-black uppercase disabled:opacity-50">
              {saving ? "Saving..." : "Update password"}
            </button>
          </form>
        )}
        {!ready && !error && <p className="text-xs text-zinc-500">Verifying secure link...</p>}
        {error && <button onClick={() => router.replace("/")} className="mt-4 text-xs font-black underline uppercase">Return to sign in</button>}
      </section>
    </main>
  );
}
