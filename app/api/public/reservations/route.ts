import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const reservationItemSchema = z.object({
  vehicle_type_id: z.string().uuid(),
  pricing_rule_id: z.string().uuid(),
  quantity: z.number().int().min(1),
});

const reservationRequestSchema = z.object({
  location_id: z.string().default("main"),
  start_time: z.string().datetime(),
  customer_name: z.string().min(1),
  customer_email: z.string().email().optional().or(z.literal("")),
  customer_phone: z.string().optional(),
  notes: z.string().optional(),
  delivery_required: z.boolean().default(false),
  delivery_time: z.string().datetime().optional(),
  delivery_address: z.string().optional(),
  items: z.array(reservationItemSchema).min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = reservationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid reservation request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    if (
      payload.delivery_required &&
      (!payload.delivery_time || !payload.delivery_address?.trim())
    ) {
      return NextResponse.json(
        { error: "Delivery address and delivery time are required for delivery" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const rpcPayload = {
      ...payload,
      customer_email: payload.customer_email || null,
      customer_phone: payload.customer_phone || null,
      notes: payload.notes || null,
      delivery_address: payload.delivery_address || null,
      delivery_time: payload.delivery_time || null,
      override_flag: false,
      override_reason: null,
    };

    const { data: reservationId, error } = await supabase.rpc("create_reservation", {
      p_payload: rpcPayload,
    });

    if (error || !reservationId) {
      const message = error?.message ?? "Failed to create reservation";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .select("id,status,start_time,end_time")
      .eq("id", reservationId)
      .single();

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: "Reservation created but failed to load details" },
        { status: 500 }
      );
    }

    return NextResponse.json({ reservation });
  } catch {
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

