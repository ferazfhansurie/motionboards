import { NextRequest, NextResponse } from "next/server";
import { logEvent, saveWaMessage, setConsent, upsertWaContact, validMetaSignature, workspaceForWhatsAppPhone } from "@/lib/tickloop";

interface WaMessage { id?: string; from?: string; to?: string; timestamp?: string; type?: string; text?: { body?: string }; [key: string]: unknown }
interface WaContactUpdate { phone_number?: string; wa_id?: string; profile?: { name?: string }; full_name?: string; first_name?: string }
interface WaHistoryThread { messages?: WaMessage[] }
interface WaHistoryItem { threads?: WaHistoryThread[]; messages?: WaMessage[] }
interface WhatsAppChangeValue {
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  messages?: WaMessage[];
  smb_message_echoes?: WaMessage[];
  smb_app_state_sync?: WaContactUpdate[];
  history?: WaHistoryItem[];
}
interface WhatsAppPayload {
  entry?: Array<{ changes?: Array<{ field?: string; value?: WhatsAppChangeValue }> }>;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams; if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WEBHOOK_VERIFY_TOKEN) return new NextResponse(p.get("hub.challenge") || "", { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

// Coexistence puts the business's own number on both from/to depending on
// direction; pick whichever side of the message isn't the business number
// as "the contact" so both inbound and app-echoed outbound messages thread
// onto the same customer.
function contactPhone(message: WaMessage, businessPhoneDigits: string | undefined) {
  const from = message.from?.replace(/\D/g, ""); const to = message.to?.replace(/\D/g, "");
  if (businessPhoneDigits) {
    if (from && from !== businessPhoneDigits) return from;
    if (to && to !== businessPhoneDigits) return to;
  }
  return from || to || "";
}
function bodyOf(message: WaMessage) {
  return message.text?.body ?? undefined;
}
function sentAtOf(message: WaMessage) {
  const ts = Number(message.timestamp); return Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : undefined;
}

export async function POST(req: NextRequest) {
  const raw = await req.text(); if (!validMetaSignature(raw, req.headers.get("x-hub-signature-256"))) return new NextResponse("Invalid signature", { status: 401 });
  const payload = JSON.parse(raw) as WhatsAppPayload;
  for (const entry of payload.entry || []) for (const change of entry.changes || []) {
    const value = change.value; if (!value) continue;
    const phoneNumberId = value.metadata?.phone_number_id;
    const businessPhoneDigits = value.metadata?.display_phone_number?.replace(/\D/g, "");
    const workspaceId = phoneNumberId ? await workspaceForWhatsAppPhone(phoneNumberId) : undefined;
    const field = change.field || "messages";

    if (field === "messages") {
      for (const message of value.messages || []) {
        await logEvent("whatsapp", `message.${message.type || "unknown"}`, payload, message.id, workspaceId);
        if (!workspaceId) continue;
        const phone = contactPhone(message, businessPhoneDigits); if (!phone) continue;
        await upsertWaContact(workspaceId, phone);
        await saveWaMessage(workspaceId, { phone, direction: "inbound", source: "cloud_api", waMessageId: message.id, messageType: message.type, body: bodyOf(message), sentAt: sentAtOf(message), raw: message });
        if (message.type === "text" && message.text?.body?.trim().toUpperCase() === "STOP") await setConsent(workspaceId, phone, "opted_out", "whatsapp_stop");
      }
      continue;
    }

    // Coexistence-only fields below — a staff reply from the phone's WhatsApp
    // Business app, a one-time history backfill, and contact-list updates.
    if (field === "smb_message_echoes") {
      for (const message of value.smb_message_echoes || []) {
        await logEvent("whatsapp", "message_echo", payload, message.id, workspaceId);
        if (!workspaceId) continue;
        const phone = contactPhone(message, businessPhoneDigits); if (!phone) continue;
        await upsertWaContact(workspaceId, phone);
        await saveWaMessage(workspaceId, { phone, direction: "outbound", source: "business_app", waMessageId: message.id, messageType: message.type, body: bodyOf(message), sentAt: sentAtOf(message), raw: message });
      }
      continue;
    }

    if (field === "history") {
      for (const item of value.history || []) {
        const messages = item.messages || item.threads?.flatMap((thread) => thread.messages || []) || [];
        for (const message of messages) {
          await logEvent("whatsapp", "history.message", payload, message.id, workspaceId);
          if (!workspaceId) continue;
          const phone = contactPhone(message, businessPhoneDigits); if (!phone) continue;
          const fromDigits = message.from?.replace(/\D/g, "");
          const direction = businessPhoneDigits && fromDigits === businessPhoneDigits ? "outbound" : "inbound";
          await upsertWaContact(workspaceId, phone);
          await saveWaMessage(workspaceId, { phone, direction, source: "history", waMessageId: message.id, messageType: message.type, body: bodyOf(message), sentAt: sentAtOf(message), raw: message });
        }
      }
      continue;
    }

    if (field === "smb_app_state_sync") {
      for (const update of value.smb_app_state_sync || []) {
        await logEvent("whatsapp", "state_sync", payload, undefined, workspaceId);
        if (!workspaceId) continue;
        const phone = (update.wa_id || update.phone_number)?.replace(/\D/g, ""); if (!phone) continue;
        const name = update.profile?.name || update.full_name || update.first_name || null;
        await upsertWaContact(workspaceId, phone, name);
      }
      continue;
    }

    // account_update, message_template_status_update, etc. — logged for
    // visibility, no structured handling needed yet.
    await logEvent("whatsapp", field, payload, undefined, workspaceId);
  }
  return NextResponse.json({ received: true });
}
