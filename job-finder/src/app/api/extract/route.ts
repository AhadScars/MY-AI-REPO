import { NextResponse } from "next/server";
import { extractFromText } from "@/lib/extract";

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: string };
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Paste a resume or a short brief first." }, { status: 400 });
    }
    return NextResponse.json({ extracted: extractFromText(text.slice(0, 20_000)) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read that text" },
      { status: 500 },
    );
  }
}
