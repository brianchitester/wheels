import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaffAction, requireStaffPage } from "@/lib/auth/staff";
import { PosNewFlow } from "@/components/pos/pos-new-flow";

const lineItemSchema = z.object({
  vehicle_type_id: z.string().uuid(),
  pricing_rule_id: z.string().uuid(),
  quantity: z.number().int().min(1),
  assigned_vehicle_ids: z.array(z.string().uuid()),
});

const payloadSchema = z.object({
  customer_name: z.string().min(1),
  customer_phone: z.string().optional(),
  customer_email: z.string().optional(),
  notes: z.string().optional(),
  payment_method: z.enum(["cash", "stripe", "none"]),
  amount_cents: z.number().int().min(0),
  override_flag: z.boolean(),
  override_reason: z.string().optional(),
  line_items: z.array(lineItemSchema).min(1),
});

type RpcAvailabilityRow = {
  is_available: boolean;
  available_count: number;
};

function addDuration(start: Date, unit: "hour" | "day" | "week", value: number) {
  const ms =
    unit === "hour"
      ? value * 60 * 60 * 1000
      : unit === "day"
        ? value * 24 * 60 * 60 * 1000
        : value * 7 * 24 * 60 * 60 * 1000;
  return new Date(start.getTime() + ms);
}

async function createWalkInRental(formData: FormData) {
  "use server";

  try {
    const { supabase, session } = await requireStaffAction();
    const raw = String(formData.get("payload_json") ?? "");
    const payloadParsed = payloadSchema.safeParse(JSON.parse(raw));

    if (!payloadParsed.success) {
      throw new Error("Invalid walk-in payload");
    }

    const payload = payloadParsed.data;
    if (payload.override_flag && !payload.override_reason?.trim()) {
      throw new Error("Override reason is required when override is enabled");
    }

    const startTime = new Date();
    let maxEndTime = new Date(startTime);
    const usedVehicleIds = new Set<string>();

    const pricingRuleIds = payload.line_items.map((line) => line.pricing_rule_id);
    const { data: pricingRules, error: rulesError } = await supabase
      .from("pricing_rules")
      .select("id,vehicle_type_id,duration_unit,duration_value,price_cents")
      .in("id", pricingRuleIds)
      .eq("location_id", "main")
      .eq("active", true);

    if (rulesError || !pricingRules || pricingRules.length !== pricingRuleIds.length) {
      throw new Error("Invalid pricing rule selection");
    }

    const pricingById = new Map(pricingRules.map((rule) => [rule.id, rule]));
    const allAssignedIds = payload.line_items.flatMap((line) => line.assigned_vehicle_ids);

    if (!payload.override_flag) {
      for (const line of payload.line_items) {
        if (line.assigned_vehicle_ids.length !== line.quantity) {
          throw new Error("Assigned vehicles must match quantity unless override is enabled");
        }
      }
    }

    for (const line of payload.line_items) {
      for (const vehicleId of line.assigned_vehicle_ids) {
        if (usedVehicleIds.has(vehicleId)) {
          throw new Error("Vehicle assignments cannot contain duplicates");
        }
        usedVehicleIds.add(vehicleId);
      }
    }

    if (allAssignedIds.length > 0) {
      const { data: assignedVehicles, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("id,vehicle_type_id,status,location_id")
        .in("id", allAssignedIds);

      if (vehiclesError || !assignedVehicles || assignedVehicles.length !== allAssignedIds.length) {
        throw new Error("One or more assigned vehicles are invalid");
      }

      const assignedById = new Map(assignedVehicles.map((v) => [v.id, v]));
      for (const line of payload.line_items) {
        const rule = pricingById.get(line.pricing_rule_id);
        if (!rule) throw new Error("Missing pricing rule");

        for (const vehicleId of line.assigned_vehicle_ids) {
          const vehicle = assignedById.get(vehicleId);
          if (!vehicle || vehicle.location_id !== "main") {
            throw new Error("Assigned vehicle is not in main location");
          }
          if (vehicle.status === "maintenance") {
            throw new Error("Cannot assign maintenance vehicles");
          }
          if (!payload.override_flag && vehicle.vehicle_type_id !== line.vehicle_type_id) {
            throw new Error("Assigned vehicle type does not match line item");
          }
        }

        const endTime = addDuration(
          startTime,
          rule.duration_unit,
          Number(rule.duration_value)
        );
        if (endTime > maxEndTime) maxEndTime = endTime;

        const { data: availabilityRows, error: availabilityError } = await supabase.rpc(
          "check_availability",
          {
            p_location_id: "main",
            p_vehicle_type_id: line.vehicle_type_id,
            p_start_time: startTime.toISOString(),
            p_end_time: endTime.toISOString(),
            p_quantity: line.quantity,
          }
        );

        if (!payload.override_flag) {
          const check = (availabilityRows as RpcAvailabilityRow[] | null)?.[0];
          if (availabilityError || !check || !check.is_available) {
            throw new Error("Insufficient availability for selected line item");
          }
        }
      }
    }

    const { data: rental, error: rentalError } = await supabase
      .from("rentals")
      .insert({
        location_id: "main",
        status: "active",
        customer_name: payload.customer_name.trim(),
        customer_phone: payload.customer_phone?.trim() || null,
        customer_email: payload.customer_email?.trim() || null,
        start_time: startTime.toISOString(),
        end_time: maxEndTime.toISOString(),
        created_by_user_id: session.user.id,
        override_flag: payload.override_flag,
        override_reason: payload.override_flag ? payload.override_reason?.trim() : null,
      })
      .select("id")
      .single();

    if (rentalError || !rental) {
      throw new Error(rentalError?.message ?? "Failed to create rental");
    }

    const rentalItems = payload.line_items.map((line) => {
      const rule = pricingById.get(line.pricing_rule_id);
      if (!rule) throw new Error("Missing pricing rule");
      return {
        rental_id: rental.id,
        vehicle_type_id: line.vehicle_type_id,
        pricing_rule_id: line.pricing_rule_id,
        quantity: line.quantity,
        unit_price_cents: rule.price_cents,
      };
    });

    const { error: rentalItemsError } = await supabase.from("rental_items").insert(rentalItems);
    if (rentalItemsError) {
      throw new Error(rentalItemsError.message);
    }

    if (allAssignedIds.length > 0) {
      const { error: assetsError } = await supabase.from("rental_assets").insert(
        allAssignedIds.map((vehicleId) => ({
          rental_id: rental.id,
          vehicle_id: vehicleId,
        }))
      );
      if (assetsError) {
        throw new Error(assetsError.message);
      }
    }

    if (payload.payment_method !== "none" && payload.amount_cents > 0) {
      const { error: paymentError } = await supabase.from("payments").insert({
        location_id: "main",
        rental_id: rental.id,
        type: "full",
        method: payload.payment_method,
        amount_cents: payload.amount_cents,
        status: "succeeded",
        created_by_user_id: session.user.id,
      });
      if (paymentError) {
        throw new Error(paymentError.message);
      }
    }

    await supabase.from("activity_log").insert({
      location_id: "main",
      actor_user_id: session.user.id,
      entity_type: "rental",
      entity_id: rental.id,
      action: payload.override_flag ? "started_with_override" : "started",
      metadata: {
        source: "walk_in",
        line_item_count: payload.line_items.length,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/pos/new");
    redirect(`/pos/rentals/${rental.id}?success=Rental%20started`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start rental";
    redirect(`/pos/new?error=${encodeURIComponent(message)}`);
  }
}

type SearchParams = Promise<{ error?: string; success?: string }>;

export default async function PosNewPage(props: { searchParams: SearchParams }) {
  const { supabase } = await requireStaffPage();
  const searchParams = await props.searchParams;
  const errorMessage = (searchParams.error ?? "").trim();
  const successMessage = (searchParams.success ?? "").trim();

  const [{ data: vehicleTypes }, { data: pricingRules }, { data: vehicles }, { data: activeRentals }] =
    await Promise.all([
      supabase
        .from("vehicle_types")
        .select("id,name")
        .eq("location_id", "main")
        .eq("active", true)
        .order("name"),
      supabase
        .from("pricing_rules")
        .select("id,vehicle_type_id,duration_unit,duration_value,price_cents")
        .eq("location_id", "main")
        .eq("active", true),
      supabase
        .from("vehicles")
        .select("id,asset_tag,vehicle_type_id,status")
        .eq("location_id", "main")
        .neq("status", "maintenance")
        .order("asset_tag"),
      supabase.from("rentals").select("id").eq("location_id", "main").eq("status", "active"),
    ]);

  const activeRentalIds = (activeRentals ?? []).map((r) => r.id);
  let rentedVehicleIdSet = new Set<string>();
  if (activeRentalIds.length > 0) {
    const { data: rentalAssets } = await supabase
      .from("rental_assets")
      .select("vehicle_id")
      .in("rental_id", activeRentalIds);
    rentedVehicleIdSet = new Set((rentalAssets ?? []).map((row) => row.vehicle_id));
  }

  const uiVehicles = (vehicles ?? []).map((vehicle) => ({
    id: vehicle.id,
    asset_tag: vehicle.asset_tag,
    vehicle_type_id: vehicle.vehicle_type_id,
    available: !rentedVehicleIdSet.has(vehicle.id),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">New Walk-In Rental</h2>
        <p className="mt-1 text-sm text-gray-600">
          Build line items, assign assets, and start an active rental.
        </p>
      </div>

      {successMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <PosNewFlow
        vehicleTypes={(vehicleTypes ?? []).map((t) => ({ id: t.id, name: t.name }))}
        pricingRules={(pricingRules ?? []).map((r) => ({
          id: r.id,
          vehicle_type_id: r.vehicle_type_id,
          duration_unit: r.duration_unit,
          duration_value: r.duration_value,
          price_cents: r.price_cents,
        }))}
        vehicles={uiVehicles}
        action={createWalkInRental}
      />
    </div>
  );
}

