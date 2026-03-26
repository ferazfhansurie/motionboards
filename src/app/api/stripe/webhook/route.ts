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

    const metadata = session.metadata || {};
    const creditAmount = parseInt(metadata.credits || "0", 10);

    if (!creditAmount) {
      console.error("Missing credits in checkout session:", session.id);
      return NextResponse.json({ error: "Missing credits metadata" }, { status: 400 });
    }

    // Top-up flow: authenticated user adding credits
    if (metadata.type === "topup") {
      const { userId, email } = metadata;
      if (!userId || !email) {
        console.error("Missing topup metadata in session:", session.id);
        return NextResponse.json({ error: "Missing topup metadata" }, { status: 400 });
      }
      await addCredits(userId, creditAmount);
      console.log(`Topup: added ${creditAmount} credits to user ${email}`);
    } else {
      // Signup flow: new user registration
      const { name, email, password } = metadata;

      if (!name || !email || !password) {
        console.error("Missing signup metadata in checkout session:", session.id);
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      const sql = getSql();
      const existing = await sql`SELECT id FROM mb_users WHERE LOWER(email) = LOWER(${email})`;

      if (existing.length > 0) {
        await addCredits(existing[0].id as string, creditAmount);
        console.log(`Added ${creditAmount} credits to existing user ${email}`);
      } else {
        const user = await createUser(name, email, password);
        if (user) {
          await addCredits(user.id, creditAmount);
          console.log(`Created user ${email} with ${creditAmount} credits`);
        } else {
          console.error(`Failed to create user ${email}`);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
