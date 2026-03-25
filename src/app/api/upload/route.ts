import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken, getSettings } from "@/lib/db";
import { fal } from "@fal-ai/client";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const settings = getSettings();
    if (!settings.falApiKey) {
      return NextResponse.json({ error: "fal.ai API key not configured" }, { status: 500 });
    }

    fal.config({ credentials: settings.falApiKey });

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const url = await fal.storage.upload(file);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    const msg = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
