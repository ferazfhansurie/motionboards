import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserFromToken, MONTHLY_SUBSCRIPTION_PRICE_SEN, MONTHLY_SUBSCRIPTION_CREDITS } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

// POST /api/stripe/subscribe
// Creates a Stripe Checkout session in subscription mode for the signed-in
// user. On success the webhook picks up checkout.session.completed with
// session.mode === "subscription" and credits the first month.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const origin = req.headers.get("origin") || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "fpx"],
      mode: "subscription",
      currency: "myr",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "myr",
            product_data: {
              name: "MotionBoards Monthly",
              description: `${MONTHLY_SUBSCRIPTION_CREDITS / 100} credits refreshed every month for AI video & image generation`,
            },
            unit_amount: MONTHLY_SUBSCRIPTION_PRICE_SEN,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      // Checkout-session metadata only fires on the initial checkout.session.completed event.
      metadata: {
        type: "subscription",
        userId: user.id,
        email: user.email,
      },
      // subscription_data.metadata is carried on every subsequent invoice so
      // we can map invoice.payment_succeeded → user without extra lookups.
      subscription_data: {
        metadata: {
          userId: user.id,
          email: user.email,
        },
      },
      success_url: `${origin}/?subscribe=success`,
      cancel_url: `${origin}/?subscribe=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe subscribe error:", error);
    const msg = error instanceof Error ? error.message : "Checkout failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
