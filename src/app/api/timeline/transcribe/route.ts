import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const maxDuration = 120;

// Timestamped transcription for the timeline_transcribe_clip agent tool —
// lets Claude find "the part where they say X" without the user describing
// it. Whisper accepts mp4/mov audio tracks directly, no extraction needed.
// Not charged against credits — small, ancillary calls in support of an
// editing decision, not a generation.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const settings = getSettings();
    if (!settings.openaiApiKey) {
      return NextResponse.json({ error: "Transcription isn't configured on this server." }, { status: 500 });
    }

    const mediaRes = await fetch(url);
    if (!mediaRes.ok) {
      return NextResponse.json({ error: `Couldn't fetch the clip (${mediaRes.status})` }, { status: 400 });
    }
    const bytes = Buffer.from(await mediaRes.arrayBuffer());
    // Whisper caps input at 25 MB.
    if (bytes.byteLength > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Clip is too large to transcribe (25 MB Whisper cap). Trim it first." }, { status: 400 });
    }
    const mime = mediaRes.headers.get("content-type") || "video/mp4";
    const ext = /mp4/i.test(mime) ? "mp4"
      : /quicktime|mov/i.test(mime) ? "mov"
      : /webm/i.test(mime) ? "webm"
      : /wav/i.test(mime) ? "wav"
      : /m4a|aac/i.test(mime) ? "m4a"
      : /mpeg|mp3/i.test(mime) ? "mp3"
      : "mp4";
    const mediaFile = new File([new Uint8Array(bytes)], `clip.${ext}`, { type: mime });

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: settings.openaiApiKey });

    const transcription = await openai.audio.transcriptions.create({
      file: mediaFile,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    const segments = (transcription.segments || []).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    }));

    return NextResponse.json({ text: (transcription.text || "").trim(), segments });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
