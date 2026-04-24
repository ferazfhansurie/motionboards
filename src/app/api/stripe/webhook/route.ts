import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  createUser,
  addCredits,
  activateSubscription,
  renewSubscriptionBySubscriptionId,
  deactivateSubscriptionBySubscriptionId,
} from "@/lib/db";
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

    if (session.payment_status !== "paid" && session.mode !== "subscription") {
      console.log("Payment not completed:", session.id);
      return NextResponse.json({ received: true });
    }

    const metadata = session.metadata || {};

    // ── Subscription SIGNUP flow: new user, first payment succeeded ───────
    // Metadata carries signupName / signupEmail / signupPassword. Create the
    // user (if they don't already exist), then activate the subscription on
    // that freshly-minted userId.
    if (metadata.type === "subscription-signup") {
      const subscriptionId = (session.subscription as string) || "";
      const { signupName, signupEmail, signupPassword } = metadata;
      if (!signupName || !signupEmail || !signupPassword || !subscriptionId) {
        console.error("Missing subscription-signup metadata:", session.id);
        return NextResponse.json({ error: "Missing subscription-signup metadata" }, { status: 400 });
      }
      const sql = getSql();
      const existing = await sql`SELECT id FROM mb_users WHERE LOWER(email) = LOWER(${signupEmail})`;
      let userId: string;
      if (existing.length > 0) {
        userId = existing[0].id as string;
      } else {
        const u = await createUser(signupName, signupEmail, signupPassword);
        if (!u) {
          console.error(`Failed to create user during subscription signup: ${signupEmail}`);
          return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
        }
        userId = u.id;
      }
      await activateSubscription(userId, subscriptionId);
      console.log(`Subscription signup: user=${userId} sub=${subscriptionId}`);
      return NextResponse.json({ received: true });
    }

    // ── Subscription flow (existing user): first month charged ────────────
    if (session.mode === "subscription" || metadata.type === "subscription") {
      const userId = metadata.userId;
      const subscriptionId = (session.subscription as string) || "";
      if (!userId || !subscriptionId) {
        console.error("Missing subscription metadata in session:", session.id, { userId, subscriptionId });
        return NextResponse.json({ error: "Missing subscription metadata" }, { status: 400 });
      }
      await activateSubscription(userId, subscriptionId);
      console.log(`Subscription activated: user=${userId} sub=${subscriptionId}`);
      return NextResponse.json({ received: true });
    }

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

  // ── Subscription renewal: each month's invoice ──────────────────────────
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    // Skip the invoice that bills the initial subscription — activateSubscription
    // already handled that one via checkout.session.completed. Renewals are
    // flagged "subscription_cycle" (or similar non-"subscription_create").
    if (invoice.billing_reason === "subscription_create") {
      return NextResponse.json({ received: true });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscriptionId = (invoice as any).subscription as string | undefined;
    if (!subscriptionId) return NextResponse.json({ received: true });
    const ok = await renewSubscriptionBySubscriptionId(subscriptionId);
    if (ok) {
      console.log(`Subscription renewed: sub=${subscriptionId}`);
    } else {
      console.warn(`Renewal for unknown subscription id: ${subscriptionId}`);
    }
  }

  // ── Subscription cancelled or expired ─────────────────────────────────
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const ok = await deactivateSubscriptionBySubscriptionId(sub.id);
    if (ok) console.log(`Subscription deactivated: sub=${sub.id}`);
  }

  return NextResponse.json({ received: true });
}
