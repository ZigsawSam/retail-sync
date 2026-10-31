import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const header = request.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!url || !anonKey || !serviceKey) return NextResponse.json({ error: "Server Supabase configuration is incomplete." }, { status: 500 });
    if (!token) return NextResponse.json({ error: "Owner authentication is required." }, { status: 401 });

    const caller = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: identity, error: identityError } = await caller.auth.getUser();
    if (identityError || !identity.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    const ownerId = identity.user.id;

    const { data: staffIdentity, error: staffIdentityError } = await admin.from("staff_logins")
      .select("id").eq("auth_user_id", ownerId).eq("is_active", true).is("terminated_at", null).maybeSingle();
    if (staffIdentityError) throw staffIdentityError;
    if (staffIdentity) return NextResponse.json({ error: "Only the shop owner can terminate staff access." }, { status: 403 });

    const { data: ownerSettings, error: ownerError } = await admin.from("settings")
      .select("id").eq("id", ownerId).maybeSingle();
    if (ownerError) throw ownerError;
    if (!ownerSettings) return NextResponse.json({ error: "Owner shop record was not found." }, { status: 403 });

    const body = await request.json();
    const loginId = typeof body.loginId === "string" ? body.loginId.trim() : "";
    if (!loginId) return NextResponse.json({ error: "A staff login ID is required." }, { status: 400 });

    const { data: login, error: lookupError } = await admin.from("staff_logins")
      .select("id").eq("id", loginId).eq("user_id", ownerId).eq("is_active", true).maybeSingle();
    if (lookupError) throw lookupError;
    if (!login) return NextResponse.json({ error: "Active staff login not found for this shop." }, { status: 404 });

    const { error: updateError } = await admin.from("staff_logins")
      .update({ is_active: false, terminated_at: new Date().toISOString() })
      .eq("id", login.id).eq("user_id", ownerId);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, message: "Staff access deactivated." });
  } catch (error: any) {
    console.error("Staff termination failed:", error);
    return NextResponse.json({ error: error?.message || "Unable to terminate staff access." }, { status: 400 });
  }
}
