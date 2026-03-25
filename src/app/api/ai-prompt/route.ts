import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserFromToken } from "@/lib/db";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are MotionBoards AI — an expert cinematography prompt engineer. You help users create detailed, production-quality prompts for AI video and image generation models like Veo 3, Sora 2, Kling 3.0, Wan 2.1, FLUX, Nano Banana, and others.

Your expertise covers:
- Camera movements: dolly, crane, steadicam, orbit, whip pan, tilt, boom, tracking, push-in, pull-out
- Shot types: extreme close-up, close-up, medium, wide, establishing, POV, bird's eye, dutch angle
- Lighting: golden hour, blue hour, rim light, chiaroscuro, neon, silhouette, volumetric, high-key, low-key
- Film styles: cinematic, documentary, music video, commercial, film noir, anime, retro VHS, sci-fi
- Color grading: warm tones, cool tones, teal & orange, desaturated, neon noir, pastel
- Technical specs: lens references (24mm, 35mm, 50mm, 85mm), aperture, frame rates, resolution
- Effects: slow motion, timelapse, speed ramp, bullet time, match cut, morph transitions

When generating prompts:
1. Be specific about camera movement, speed, and direction
2. Include lens and aperture references for depth of field
3. Describe lighting setup and mood
4. Mention color palette and grade
5. Add atmosphere details (fog, rain, dust, particles)
6. Keep prompts 2-4 sentences for video models, 1-2 for image models
7. If the user mentions a specific AI model, tailor the prompt style for that model

Always respond with the prompt ready to copy-paste. If the user gives a vague idea, expand it into a cinematic masterpiece. You can suggest multiple variations.

Respond concisely. No fluff. Just great prompts.`;

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages required" }, { status: 400 });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.slice(-10), // Keep last 10 messages for context
      ],
      max_tokens: 1000,
      temperature: 0.8,
    });

    const reply = response.choices[0]?.message?.content || "Could not generate a prompt. Try again.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("AI prompt error:", error);
    const msg = error instanceof Error ? error.message : "AI prompt generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
