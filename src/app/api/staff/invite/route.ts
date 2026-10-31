import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function clients(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) throw new Error("Supabase server configuration is incomplete.");
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) throw new Error("Missing authenticated owner session.");
  const caller = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { caller, admin, token };
}

export async function POST(request: NextRequest) {
  let createdAuthUserId: string | null = null;
  try {
    const { caller, admin } = clients(request);
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "A valid owner session is required." }, { status: 401 });
    }
    const ownerId = authData.user.id;
    const body = await request.json();
    const staffId = typeof body.staffId === "string" ? body.staffId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body.role;
    if (!staffId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !["cashier", "inventory_manager"].includes(role)) {
      return NextResponse.json({ error: "Provide a valid staff member, email address, and role." }, { status: 400 });
    }

    const { data: staff, error: staffError } = await admin
      .from("staff")
      .select('id,name,"userId"')
      .eq("id", staffId)
      .eq("userId", ownerId)
      .maybeSingle();
    if (staffError) throw staffError;
    if (!staff) return NextResponse.json({ error: "Staff member does not belong to this shop." }, { status: 404 });

    const { data: existing } = await admin
      .from("staff_logins")
      .select("id")
      .eq("user_id", ownerId)
      .eq("staff_id", staffId)
      .eq("is_active", true)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: "This staff member already has active terminal access." }, { status: 409 });

    const redirectTo = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { display_name: staff.name },
    });
    if (inviteError) throw inviteError;
    if (!invited.user) throw new Error("Supabase did not return the invited user.");
    createdAuthUserId = invited.user.id;

    const { error: insertError } = await admin.from("staff_logins").insert({
      user_id: ownerId,
      staff_id: staffId,
      auth_user_id: createdAuthUserId,
      name: staff.name,
      role,
      email,
      password: null,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(createdAuthUserId);
      createdAuthUserId = null;
      throw insertError;
    }

    return NextResponse.json({ success: true, message: `Invitation sent to ${email}.` });
  } catch (error: any) {
    console.error("Staff invitation failed:", error);
    return NextResponse.json(
      { error: error?.message || "Unable to invite staff member." },
      { status: error?.message?.includes("authenticated owner") ? 401 : 400 }
    );
  }
}
