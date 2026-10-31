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

    // A staff Auth identity cannot invoke owner provisioning endpoints.
    const { data: staffIdentity, error: staffIdentityError } = await admin.from("staff_logins")
      .select("id").eq("auth_user_id", ownerId).eq("is_active", true).is("terminated_at", null).maybeSingle();
    if (staffIdentityError) throw staffIdentityError;
    if (staffIdentity) return NextResponse.json({ error: "Only the shop owner can manage staff access." }, { status: 403 });

    const { data: ownerSettings, error: ownerError } = await admin.from("settings")
      .select("id").eq("id", ownerId).maybeSingle();
    if (ownerError) throw ownerError;
    if (!ownerSettings) return NextResponse.json({ error: "Owner shop record was not found." }, { status: 403 });

    const body = await request.json();
    const staffId = typeof body.staffId === "string" ? body.staffId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body.role;
    if (!staffId || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !["cashier", "inventory_manager"].includes(role)) {
      return NextResponse.json({ error: "Provide a staff member, valid email address, and supported role." }, { status: 400 });
    }

    const { data: staff, error: staffError } = await admin.from("staff")
      .select('id,name,"userId"').eq("id", staffId).eq("userId", ownerId).maybeSingle();
    if (staffError) throw staffError;
    if (!staff) return NextResponse.json({ error: "Staff member does not belong to this shop." }, { status: 404 });

    const { data: existing, error: existingError } = await admin.from("staff_logins")
      .select("id").eq("user_id", ownerId).eq("staff_id", staffId).eq("is_active", true).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return NextResponse.json({ error: "This staff member already has active terminal access." }, { status: 409 });

    const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${(process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\\/$/, "")}/auth/reset-password`,
      data: { display_name: staff.name },
    });
    if (inviteError) throw inviteError;
    if (!invitation.user) throw new Error("Supabase did not return the invited user.");

    const { error: insertError } = await admin.from("staff_logins").insert({
      user_id: ownerId, staff_id: staffId, auth_user_id: invitation.user.id,
      name: staff.name, role, email, password: null, is_active: true,
      created_at: new Date().toISOString(),
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(invitation.user.id);
      throw insertError;
    }
    return NextResponse.json({ success: true, message: `Invitation sent to ${email}.` });
  } catch (error: any) {
    console.error("Staff invitation failed:", error);
    return NextResponse.json({ error: error?.message || "Unable to invite staff." }, { status: 400 });
  }
}
