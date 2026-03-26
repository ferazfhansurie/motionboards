import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserFromToken } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

const PLANS: Record<string, { price: number; credits: number; label: string }> = {
  starter: { price: 1000, credits: 1000, label: "Starter — RM10" },
  creator: { price: 5000, credits: 5000, label: "Creator — RM50" },
  pro: { price: 10000, credits: 10000, label: "Pro — RM100" },
  studio: { price: 25000, credits: 25000, label: "Studio — RM250" },
};

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { plan } = await req.json();
    const planInfo = PLANS[plan];
    if (!planInfo) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "fpx"],
      mode: "payment",
      currency: "myr",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "myr",
            product_data: {
              name: `MotionBoards ${planInfo.label}`,
              description: `${planInfo.credits / 100} credits for AI video & image generation`,
            },
            unit_amount: planInfo.price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "topup",
        userId: user.id,
        email: user.email,
        credits: planInfo.credits.toString(),
      },
      success_url: `${origin}/?topup=success`,
      cancel_url: `${origin}/?topup=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe topup error:", error);
    const msg = error instanceof Error ? error.message : "Checkout failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
