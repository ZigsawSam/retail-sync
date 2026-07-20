import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    const { systemPrompt, userPrompt } = await request.json();

    if (!ai) {
      return NextResponse.json({
        text: `[FALLBACK RESPONSE: Please add your GEMINI_API_KEY in Environment Variables]

Based on the analysis of your request:

1. Maintain active stock optimization rules.
2. Customer loyalty incentives are recommended.
3. High-performing agents should receive higher commissions.

Instructions:
"${userPrompt.substring(0, 100)}..."`
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    return NextResponse.json({
      text: response.text,
    });

  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        error: error.message ?? "Failed to generate AI response",
      },
      {
        status: 500,
      }
    );
  }
}