import { NextRequest, NextResponse } from "next/server";
import { smsLog } from "@/lib/sms-store";

export async function POST(request: NextRequest) {
  try {
    const { agentName, agentPhone, amount, shopName } =
      await request.json();

    const message = `Dear ${agentName}, you have been credited with a commission of ₹${amount} from ${shopName}. Thank you for your partnership!`;

    const sms = {
      id: crypto.randomUUID(),
      agentName,
      agentPhone,
      message,
      timestamp: new Date().toISOString(),
      status: "Sent Successfully",
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