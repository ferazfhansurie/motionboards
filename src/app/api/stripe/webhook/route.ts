import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createUser, addCredits } from "@/lib/db";
import { neon } from "@neondatabase/serverless";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

function getSql() {
  return neon(process.env.DATABASE_URL!);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      // No webhook secret configured — parse directly (dev mode)
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      console.log("Payment not completed:", session.id);
      return NextResponse.json({ received: true });
    }

    const { name, email, password, credits } = session.metadata || {};

    if (!name || !email || !password || !credits) {
      console.error("Missing metadata in checkout session:", session.id);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const creditAmount = parseInt(credits, 10);

    // Check if user already exists
    const sql = getSql();
    const existing = await sql`SELECT id FROM mb_users WHERE LOWER(email) = LOWER(${email})`;

    if (existing.length > 0) {
      // User exists — just add credits (topup case)
      await addCredits(existing[0].id as string, creditAmount);
      console.log(`Added ${creditAmount} credits to existing user ${email}`);
    } else {
      // Create new user with credits
      const user = await createUser(name, email, password);
      if (user) {
        await addCredits(user.id, creditAmount);
        console.log(`Created user ${email} with ${creditAmount} credits`);
      } else {
        console.error(`Failed to create user ${email}`);
      }
    }
  }

  return NextResponse.json({ received: true });
}
