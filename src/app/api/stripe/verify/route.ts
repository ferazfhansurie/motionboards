import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createUser, addCredits } from "@/lib/db";
import { neon } from "@neondatabase/serverless";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ success: false, error: "No session ID" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ success: false, error: "Payment not completed" }, { status: 402 });
    }

    const { name, email, password, credits } = session.metadata || {};
    if (!name || !email || !password || !credits) {
      return NextResponse.json({ success: false, error: "Invalid session data" }, { status: 400 });
    }

    const creditAmount = parseInt(credits, 10);
    const sql = getSql();

    // Check if user already exists (webhook may have already created them)
    const existing = await sql`SELECT id FROM mb_users WHERE LOWER(email) = LOWER(${email})`;

    if (existing.length > 0) {
      // User exists — check if credits were already added by webhook
      const user = await sql`SELECT credits FROM mb_users WHERE id = ${existing[0].id}`;
      if ((user[0]?.credits as number) > 0) {
        return NextResponse.json({ success: true }); // Already processed
      }
      await addCredits(existing[0].id as string, creditAmount);
    } else {
      // Create user (webhook hasn't fired yet)
      const user = await createUser(name, email, password);
      if (user) {
        await addCredits(user.id, creditAmount);
      } else {
        return NextResponse.json({ success: false, error: "Failed to create account" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify error:", error);
    const msg = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
