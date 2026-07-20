import { NextResponse } from "next/server";
import { smsLog } from "@/lib/sms-store";

export async function GET() {
  return NextResponse.json({
    smsLog,
  });
}