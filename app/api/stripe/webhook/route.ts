import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET environment variable" },
      { status: 500 }
    );
  }

  try {
    const stripe = getStripeServer();
    const supabase = getSupabaseAdmin();
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
    }

    const rawBody = await request.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    const { data: existingEvent } = await supabase
      .from("stripe_events_processed")
      .select("id")
      .eq("id", event.id)
      .maybeSingle();

    if (existingEvent) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const reservationId = session.metadata?.reservation_id;
      const amountTotal = session.amount_total ?? 0;

      if (!reservationId) {
        return NextResponse.json(
          { error: "checkout.session.completed missing reservation_id metadata" },
          { status: 400 }
        );
      }

      const { data: initiatedPayment } = await supabase
        .from("payments")
        .select("id")
        .eq("stripe_checkout_session_id", session.id)
        .eq("type", "deposit")
        .maybeSingle();

      if (initiatedPayment) {
        await supabase
          .from("payments")
          .update({
            status: "succeeded",
            amount_cents: amountTotal,
            stripe_payment_intent_id:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : null,
          })
          .eq("id", initiatedPayment.id);
      } else {
        await supabase.from("payments").insert({
          location_id: "main",
          reservation_id: reservationId,
          type: "deposit",
          method: "stripe",
          amount_cents: amountTotal,
          status: "succeeded",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
          created_by_user_id: null,
        });
      }

      await supabase
        .from("reservations")
        .update({ status: "confirmed" })
        .eq("id", reservationId)
        .eq("location_id", "main")
        .eq("status", "pending");

      await supabase.from("activity_log").insert({
        location_id: "main",
        actor_user_id: null,
        entity_type: "reservation",
        entity_id: reservationId,
        action: "deposit_paid",
        metadata: {
          stripe_event_id: event.id,
          stripe_checkout_session_id: session.id,
          amount_cents: amountTotal,
        },
      });
    }

    await supabase.from("stripe_events_processed").insert({ id: event.id });
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

