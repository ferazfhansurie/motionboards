import { NextRequest, NextResponse } from "next/server";
import { logEvent, setConsent, validMetaSignature, workspaceForWhatsAppPhone } from "@/lib/tickloop";

interface WhatsAppPayload {
  entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string }; messages?: Array<{ id?: string; from?: string; type?: string; text?: { body?: string } }> } }> }>;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams; if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WEBHOOK_VERIFY_TOKEN) return new NextResponse(p.get("hub.challenge") || "", { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}
export async function POST(req: NextRequest) {
  const raw = await req.text(); if (!validMetaSignature(raw, req.headers.get("x-hub-signature-256"))) return new NextResponse("Invalid signature", { status: 401 });
  const payload = JSON.parse(raw) as WhatsAppPayload;
  for (const entry of payload.entry || []) for (const change of entry.changes || []) {
    const workspaceId = change.value?.metadata?.phone_number_id ? await workspaceForWhatsAppPhone(change.value.metadata.phone_number_id) : undefined;
    for (const message of change.value?.messages || []) {
      await logEvent("whatsapp", `message.${message.type || "unknown"}`, payload, message.id, workspaceId);
      if (workspaceId && message.from && message.type === "text" && message.text?.body?.trim().toUpperCase() === "STOP") await setConsent(workspaceId, message.from, "opted_out", "whatsapp_stop");
    }
  }
  return NextResponse.json({ received: true });
}
