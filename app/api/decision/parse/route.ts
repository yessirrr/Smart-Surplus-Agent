import { NextResponse } from "next/server";
import { parseDecisionIntent } from "@/lib/narrative/skills/intent-parser";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { input: string };

    if (!body.input || typeof body.input !== "string") {
      return NextResponse.json(
        { error: "input string is required" },
        { status: 400 }
      );
    }

    const intent = await parseDecisionIntent(body.input.trim());
    return NextResponse.json(intent);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse decision intent" },
      { status: 500 }
    );
  }
}

