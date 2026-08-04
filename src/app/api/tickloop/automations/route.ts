import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { neon } from "@neondatabase/serverless";
import { requireUser } from "@/lib/auth";
import { ensureTickLoopSchema, workspaceForUser } from "@/lib/tickloop";

const sql = (strings: TemplateStringsArray, ...values: unknown[]) => neon(process.env.DATABASE_URL!)(strings, ...values) as Promise<Record<string, unknown>[]>;
export async function GET(req: NextRequest) { const user = await requireUser(req); if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 }); const ws = await workspaceForUser(user.id, `${user.name}'s workspace`); await ensureTickLoopSchema(); return NextResponse.json({ automations: await sql`SELECT * FROM tl_automations WHERE workspace_id = ${ws.id as string} ORDER BY created_at DESC` }); }
export async function POST(req: NextRequest) { const user = await requireUser(req); if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 }); const { name, trigger, templateName, enabled = false, config = {} } = await req.json(); if (!name || !trigger) return NextResponse.json({ error: "Name and trigger required." }, { status: 400 }); const ws = await workspaceForUser(user.id, `${user.name}'s workspace`); await ensureTickLoopSchema(); const id = `auto_${randomBytes(10).toString("hex")}`; const rows = await sql`INSERT INTO tl_automations (id, workspace_id, name, trigger, template_name, enabled, config) VALUES (${id}, ${ws.id as string}, ${name}, ${trigger}, ${templateName || null}, ${Boolean(enabled)}, ${JSON.stringify(config)}::jsonb) RETURNING *`; return NextResponse.json({ automation: rows[0] }, { status: 201 }); }
