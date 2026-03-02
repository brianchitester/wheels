import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const availabilityItemSchema = z.object({
  vehicle_type_id: z.string().uuid(),
  pricing_rule_id: z.string().uuid(),
  quantity: z.number().int().min(1),
});

const availabilityRequestSchema = z.object({
  location_id: z.string().default("main"),
  start_time: z.string().datetime(),
  items: z.array(availabilityItemSchema).min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = availabilityRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid availability request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { location_id, start_time, items } = parsed.data;
    const supabase = getSupabaseAdmin();
    const start = new Date(start_time);

    const results: Array<{
      vehicle_type_id: string;
      pricing_rule_id: string;
      quantity: number;
      available: boolean;
      available_count: number;
      total_count: number;
      blocked_count: number;
      end_time: string;
    }> = [];

    for (const item of items) {
      const { data: rule, error: ruleError } = await supabase
        .from("pricing_rules")
        .select("id,duration_unit,duration_value")
        .eq("id", item.pricing_rule_id)
        .eq("vehicle_type_id", item.vehicle_type_id)
        .eq("location_id", location_id)
        .eq("active", true)
        .single();

      if (ruleError || !rule) {
        return NextResponse.json(
          { error: "Invalid or inactive pricing rule selection" },
          { status: 400 }
        );
      }

      const durationMs =
        rule.duration_unit === "hour"
          ? rule.duration_value * 60 * 60 * 1000
          : rule.duration_unit === "day"
            ? rule.duration_value * 24 * 60 * 60 * 1000
            : rule.duration_value * 7 * 24 * 60 * 60 * 1000;

      const end = new Date(start.getTime() + durationMs);

      const { data: checkRows, error: checkError } = await supabase.rpc(
        "check_availability",
        {
          p_location_id: location_id,
          p_vehicle_type_id: item.vehicle_type_id,
          p_start_time: start.toISOString(),
          p_end_time: end.toISOString(),
          p_quantity: item.quantity,
        }
      );

      if (checkError || !checkRows || checkRows.length === 0) {
        return NextResponse.json(
          { error: "Failed to evaluate availability" },
          { status: 400 }
        );
      }

      const check = checkRows[0];
      results.push({
        vehicle_type_id: item.vehicle_type_id,
        pricing_rule_id: item.pricing_rule_id,
        quantity: item.quantity,
        available: check.is_available,
        available_count: check.available_count,
        total_count: check.total_count,
        blocked_count: check.blocked_count,
        end_time: end.toISOString(),
      });
    }

    return NextResponse.json({
      ok: results.every((r) => r.available),
      results,
    });
  } catch {
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

