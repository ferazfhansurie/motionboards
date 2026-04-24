import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserFromToken, MONTHLY_SUBSCRIPTION_PRICE_SEN, MONTHLY_SUBSCRIPTION_CREDITS } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

// POST /api/stripe/subscribe
// Creates a Stripe Checkout session in subscription mode. Two callers:
//   1. Existing signed-in user from the Profile panel — no body needed.
//   2. Signup flow for a brand-new user — body carries { name, email,
//      password } which the webhook consumes to create the user on
//      successful payment.
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const signupName = typeof body.name === "string" ? body.name.trim() : "";
    const signupEmail = typeof body.email === "string" ? body.email.trim() : "";
    const signupPassword = typeof body.password === "string" ? body.password : "";
    const isSignup = !!(signupName && signupEmail && signupPassword);

    // Path 1 — existing user (session cookie present).
    const token = req.cookies.get("session")?.value;
    if (token && !isSignup) {
      const user = await getUserFromToken(token);
      if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
        metadata: { type: "subscription", userId: user.id, email: user.email },
        subscription_data: { metadata: { userId: user.id, email: user.email } },
        success_url: `${origin}/?subscribe=success`,
        cancel_url: `${origin}/?subscribe=cancelled`,
      });
      return NextResponse.json({ url: session.url });
    }

    // Path 2 — signup flow: user doesn't exist yet. Webhook creates them on
    // payment success. Password flows through Stripe metadata, the webhook
    // hashes + stores immediately, so it doesn't sit in the Stripe dashboard
    // any longer than the initial checkout event.
    if (!isSignup) {
      return NextResponse.json({ error: "Sign in first, or include name/email/password." }, { status: 400 });
    }
    if (signupPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "fpx"],
      mode: "subscription",
      currency: "myr",
      customer_email: signupEmail,
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
      metadata: {
        type: "subscription-signup",
        signupName,
        signupEmail: signupEmail.toLowerCase(),
        signupPassword,
      },
      subscription_data: {
        metadata: {
          signupEmail: signupEmail.toLowerCase(),
        },
      },
      success_url: `${origin}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/signup?cancelled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe subscribe error:", error);
    const msg = error instanceof Error ? error.message : "Checkout failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
