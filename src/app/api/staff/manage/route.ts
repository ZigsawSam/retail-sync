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
    const { data: identity, error: identityError } = await caller.auth.getUser(token);
    if (identityError || !identity.user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    const ownerId = identity.user.id;

    const { data: staffIdentity, error: staffIdentityError } = await admin.from("staff_logins")
      .select("id").eq("auth_user_id", ownerId).eq("is_active", true).is("terminated_at", null).maybeSingle();
    if (staffIdentityError) throw staffIdentityError;
    if (staffIdentity) return NextResponse.json({ error: "Only the shop owner can manage staff records." }, { status: 403 });

    const { data: ownerSettings, error: ownerError } = await admin.from("settings")
      .select("id").eq("id", ownerId).maybeSingle();
    if (ownerError) throw ownerError;
    if (!ownerSettings) return NextResponse.json({ error: "Owner shop record was not found." }, { status: 403 });

    const body = await request.json();
    const staffId = typeof body.staffId === "string" ? body.staffId.trim() : "";
    const action = body.action;
    if (!staffId || !["archive", "restore", "delete"].includes(action)) {
      return NextResponse.json({ error: "Provide a staff member and a valid action." }, { status: 400 });
    }

    const { data: staff, error: staffError } = await admin.from("staff")
      .select('id,name,attendance,archived_at').eq("id", staffId).eq("userId", ownerId).maybeSingle();
    if (staffError) throw staffError;
    if (!staff) return NextResponse.json({ error: "Staff member was not found in this shop." }, { status: 404 });

    if (action === "delete") {
      if (!staff.archived_at) return NextResponse.json({ error: "Archive the employee before permanent deletion." }, { status: 409 });
      const attendance = staff.attendance && typeof staff.attendance === "object" ? staff.attendance : {};
      if (Object.keys(attendance).length > 0) return NextResponse.json({ error: "Permanent deletion is blocked because attendance history exists. Keep this employee archived to preserve payroll records." }, { status: 409 });
      const { data: loginRows, error: loginError } = await admin.from("staff_logins")
        .select("id").eq("user_id", ownerId).eq("staff_id", staffId).limit(1);
      if (loginError) throw loginError;
      if (loginRows?.length) return NextResponse.json({ error: "Permanent deletion is blocked because current or historical terminal-access records are linked. Keep this employee archived to preserve the audit trail." }, { status: 409 });
      const { data: salaryRows, error: salaryError } = await admin.from("expenses")
        .select("id").eq("userId", ownerId).eq("category", "Staff Salary").ilike("description", `%${staff.name}%`).limit(1);
      if (salaryError) throw salaryError;
      if (salaryRows?.length) return NextResponse.json({ error: "Permanent deletion is blocked because salary-payment records refer to this employee. Keep the employee archived to preserve payroll history." }, { status: 409 });
      const { error: deleteError } = await admin.from("staff").delete().eq("id", staffId).eq("userId", ownerId);
      if (deleteError) throw deleteError;
      return NextResponse.json({ success: true, message: "Employee record permanently deleted." });
    }

    if (action === "archive") {
      const { data: terminatedRows, error: loginError } = await admin.from("staff_logins")
        .update({ is_active: false, terminated_at: new Date().toISOString() })
        .eq("user_id", ownerId).eq("staff_id", staffId).eq("is_active", true).select("id");
      if (loginError) throw loginError;
      const { error: archiveError } = await admin.from("staff").update({ archived_at: new Date().toISOString() })
        .eq("id", staffId).eq("userId", ownerId);
      if (archiveError) {
        if (terminatedRows?.length) {
          const { error: rollbackError } = await admin.from("staff_logins")
            .update({ is_active: true, terminated_at: null })
            .in("id", terminatedRows.map((row: any) => row.id)).eq("user_id", ownerId);
          if (rollbackError) console.error("Staff archive rollback failed:", rollbackError);
        }
        throw archiveError;
      }
      return NextResponse.json({ success: true, message: "Employee archived and active terminal access terminated." });
    }

    const { error: restoreError } = await admin.from("staff").update({ archived_at: null })
      .eq("id", staffId).eq("userId", ownerId);
    if (restoreError) throw restoreError;
    return NextResponse.json({ success: true, message: "Employee restored to the active staff list. Invite terminal access separately if required." });
  } catch (error: any) {
    console.error("Staff record action failed:", error);
    return NextResponse.json({ error: error?.message || "Unable to update staff record." }, { status: 400 });
  }
}
