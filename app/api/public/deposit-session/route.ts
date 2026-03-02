import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe/server";

const requestSchema = z.object({
  reservation_id: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const stripe = getStripeServer();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!siteUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL is not configured" },
        { status: 500 }
      );
    }

    const reservationId = parsed.data.reservation_id;

    const [{ data: reservation }, { data: reservationItems }, { data: existingSucceededPayment }] =
      await Promise.all([
        supabase
          .from("reservations")
          .select("id,status,customer_name,customer_email")
          .eq("id", reservationId)
          .eq("location_id", "main")
          .single(),
        supabase
          .from("reservation_items")
          .select("quantity,deposit_cents")
          .eq("reservation_id", reservationId),
        supabase
          .from("payments")
          .select("id")
          .eq("reservation_id", reservationId)
          .eq("type", "deposit")
          .eq("status", "succeeded")
          .maybeSingle(),
      ]);

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (existingSucceededPayment) {
      return NextResponse.json({
        requires_payment: false,
        message: "Deposit already paid",
      });
    }

    const depositTotal = (reservationItems ?? []).reduce(
      (sum, item) => sum + item.quantity * item.deposit_cents,
      0
    );

    if (depositTotal <= 0) {
      return NextResponse.json({
        requires_payment: false,
        message: "No deposit required",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: reservation.customer_email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: depositTotal,
            product_data: {
              name: `Reservation Deposit`,
              description: `Reservation ${reservation.id} for ${reservation.customer_name}`,
            },
          },
        },
      ],
      success_url: `${siteUrl}/reserve/success?id=${reservation.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/reserve/cancel?id=${reservation.id}`,
      metadata: {
        reservation_id: reservation.id,
      },
    });

    await supabase.from("payments").insert({
      location_id: "main",
      reservation_id: reservation.id,
      type: "deposit",
      method: "stripe",
      amount_cents: depositTotal,
      status: "initiated",
      stripe_checkout_session_id: session.id,
      created_by_user_id: null,
    });

    return NextResponse.json({
      requires_payment: true,
      checkout_url: session.url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

