import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { models } from "@/lib/models";

// GET /api/models — return the public model catalog.
//
// Intended for non-browser clients (MCP servers, automations) that need to
// discover what generation models are available without scraping the
// settings UI. We only return display-safe fields; pricing details are
// already public per-model.
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  return NextResponse.json({
    models: models.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      provider: m.provider,
      creditCost: m.creditCost,
      inputs: m.inputs.map((i) => ({
        name: i.name,
        type: i.type,
        required: i.required,
        description: i.description,
      })),
    })),
  });
}
