import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserFromToken } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });

const MIN_AMOUNT = 1000; // RM10 in cents

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

    const { amount } = await req.json();
    const amountCents = Math.round(Number(amount) * 100);

    if (!amountCents || amountCents < MIN_AMOUNT) {
      return NextResponse.json({ error: "Minimum top-up is RM10" }, { status: 400 });
    }

    if (amountCents > 100000) {
      return NextResponse.json({ error: "Maximum top-up is RM1,000" }, { status: 400 });
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const amountRM = (amountCents / 100).toFixed(2);

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
              name: `MotionBoards Top Up — RM${amountRM}`,
              description: `RM${amountRM} balance for AI video & image generation`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "topup",
        userId: user.id,
        email: user.email,
        credits: amountCents.toString(),
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
