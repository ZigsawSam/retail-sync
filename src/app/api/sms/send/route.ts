import { NextRequest, NextResponse } from "next/server";
import { smsLog } from "@/lib/sms-store";

export async function POST(request: NextRequest) {
  try {
    const { agentName, agentPhone, amount, shopName } =
      await request.json();

    if (typeof agentName !== "string" || typeof agentPhone !== "string" || typeof shopName !== "string") {
      return NextResponse.json({ success: false, error: "Invalid notification preview details." }, { status: 400 });
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return NextResponse.json({ success: false, error: "Commission amount must be a non-negative number." }, { status: 400 });
    }

    const message = `Dear ${agentName}, you have a commission of ₹${numericAmount.toFixed(2)} from ${shopName}. This is a preview; no SMS has been sent.`;

    const sms = {
      id: crypto.randomUUID(),
      agentName,
      agentPhone,
      message,
      timestamp: new Date().toISOString(),
      status: "Preview only — not sent",
    };

    smsLog.push(sms);

    return NextResponse.json({
      success: true,
      sms,
    });

  } catch (error: any) {

    console.error("SMS Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message ?? "Failed to send SMS",
      },
      {
        status: 500,
      }
    );
  }
}