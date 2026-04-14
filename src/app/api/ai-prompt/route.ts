import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getUserFromToken } from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are ADletic AI — Prompt Helper. You are an expert cinematography prompt engineer that helps users create detailed, production-quality prompts for AI video and image generation models like Veo 3, Sora 2, Kling 3.0, Wan 2.1, FLUX, Nano Banana, and others.

When the user attaches images, study them carefully. Reference what you see — subjects, composition, lighting, color palette, camera angle, setting, clothing, expressions — and incorporate those specifics into the prompt you craft.

CRITICAL STYLE RULE — HYPER REALISM:
ALL prompts you generate MUST achieve a hyper-realistic, photorealistic look. NEVER produce prompts that look like CGI, 3D renders, animation, or artificial imagery. Every prompt must feel like it was captured by a real camera in the real world. Always include these realism anchors:
- Real camera/lens references (shot on Sony A7S III, Canon C70, RED Komodo, iPhone 16 Pro, etc.)
- Natural skin texture, pores, micro-expressions, imperfect details
- Real-world lighting (natural sunlight, practical lights, ambient bounce light)
- Film grain, sensor noise, subtle lens imperfections, chromatic aberration
- Natural motion blur, handheld micro-shake, focus breathing
- Environmental authenticity: real locations, weather, atmospheric haze, dust
- Human imperfections: stray hairs, wrinkled clothes, sweat, asymmetric features
- Avoid words like "ethereal", "magical", "dreamy", "fantasy" unless specifically requested
- Use phrases like: "indistinguishable from real footage", "captured on camera", "photojournalistic realism", "raw ungraded look", "natural available light"

Your expertise covers:
- Camera movements: dolly, crane, steadicam, orbit, whip pan, tilt, boom, tracking, push-in, pull-out
- Shot types: extreme close-up, close-up, medium, wide, establishing, POV, bird's eye, dutch angle
- Lighting: golden hour, blue hour, rim light, chiaroscuro, neon, silhouette, volumetric, high-key, low-key
- Film styles: cinematic, documentary, music video, commercial, film noir, retro VHS, sci-fi
- Color grading: warm tones, cool tones, teal & orange, desaturated, neon noir, pastel
- Technical specs: lens references (24mm, 35mm, 50mm, 85mm), aperture, frame rates, resolution
- Effects: slow motion, timelapse, speed ramp, bullet time, match cut, morph transitions
- Hyper-realism techniques: skin detail, fabric texture, environmental grit, practical lighting, real-world imperfections

When generating prompts:
1. Be specific about camera movement, speed, and direction
2. Include real camera body and lens references for authenticity
3. Describe natural, real-world lighting setup and mood
4. Mention color palette and grade — favor naturalistic grades
5. Add atmosphere details (fog, rain, dust, particles, humidity)
6. Keep prompts 2-4 sentences for video models, 1-2 for image models
7. If the user mentions a specific AI model, tailor the prompt style for that model
8. ALWAYS ensure the output looks like real camera footage — never CGI or rendered
9. Include micro-details: skin pores, fabric weave, dust particles, lens flares from real light sources
10. Reference real-world camera behavior: auto-exposure adjustments, rack focus, rolling shutter

Always respond with the prompt ready to copy-paste. If the user gives a vague idea, expand it into a hyper-realistic cinematic masterpiece that looks indistinguishable from real footage.

Respond concisely. No fluff. Just great prompts.`;

// Convert the OpenAI-shaped messages the client sends into Anthropic's format.
// Client sends:
//   { role: "user" | "assistant", content: string }
//   { role: "user", content: [ { type: "text", text }, { type: "image_url", image_url: { url } } ] }
//
// Anthropic expects:
//   { role: "user" | "assistant", content: string }
//   { role: "user", content: [ { type: "text", text }, { type: "image", source: {...} } ] }
//
// For image_url parts that are data: URLs (our client sends base64 data URLs),
// we convert to Anthropic's base64 image source shape. For http(s) URLs we use
// the url source variant.
type ClientPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type AnthropicMessage = {
  role: "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | {
            type: "image";
            source:
              | { type: "base64"; media_type: string; data: string }
              | { type: "url"; url: string };
          }
      >;
};

function convertMessage(m: { role: "user" | "assistant"; content: string | ClientPart[] }): AnthropicMessage {
  if (typeof m.content === "string") return { role: m.role, content: m.content };
  const parts: AnthropicMessage["content"] extends Array<infer U> ? U[] : never = [] as never;
  const out: AnthropicMessage["content"] = [];
  for (const p of m.content) {
    if (p.type === "text") {
      out.push({ type: "text", text: p.text });
    } else if (p.type === "image_url") {
      const url = p.image_url.url;
      // Data URL: data:<media_type>;base64,<data>
      const match = url.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        out.push({
          type: "image",
          source: { type: "base64", media_type: match[1], data: match[2] },
        });
      } else {
        out.push({ type: "image", source: { type: "url", url } });
      }
    }
  }
  // Silence unused variable warning (kept for type-narrowing hygiene)
  void parts;
  return { role: m.role, content: out };
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    // Keep last 10 messages for context (same as before)
    const converted = (messages.slice(-10) as Array<{ role: "user" | "assistant"; content: string | ClientPart[] }>).map(convertMessage);

    const response = await anthropic.messages.create({
      // Claude Sonnet 4.5 — balanced multimodal model (3× Haiku price, noticeably smarter)
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      temperature: 0.8,
      system: SYSTEM_PROMPT,
      messages: converted as Parameters<typeof anthropic.messages.create>[0]["messages"],
    });

    // Concatenate text blocks from the response
    const reply = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n") || "Could not generate a prompt. Try again.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("AI prompt error:", error);
    const msg = error instanceof Error ? error.message : "AI prompt generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
