import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaffAction, requireStaffPage } from "@/lib/auth/staff";
import { ReservationPickupFlow } from "@/components/pos/reservation-pickup-flow";

const payloadSchema = z.object({
  reservation_id: z.string().uuid(),
  override_flag: z.boolean(),
  override_reason: z.string().optional(),
  line_assignments: z.array(
    z.object({
      vehicle_type_id: z.string().uuid(),
      assigned_vehicle_ids: z.array(z.string().uuid()),
    })
  ),
});

async function convertReservation(formData: FormData) {
  "use server";

  try {
    const { supabase } = await requireStaffAction();
    const raw = String(formData.get("payload_json") ?? "");
    const parsed = payloadSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new Error("Invalid pickup payload");
    }

    const payload = parsed.data;
    if (payload.override_flag && !payload.override_reason?.trim()) {
      throw new Error("Override reason is required");
    }

    const allAssignedVehicleIds: string[] = [];
    const seen = new Set<string>();
    for (const line of payload.line_assignments) {
      for (const vehicleId of line.assigned_vehicle_ids) {
        if (seen.has(vehicleId)) {
          throw new Error("Duplicate vehicle assignment detected");
        }
        seen.add(vehicleId);
        allAssignedVehicleIds.push(vehicleId);
      }
    }

    const { data: rentalId, error } = await supabase.rpc("convert_reservation_to_rental", {
      p_reservation_id: payload.reservation_id,
      p_assigned_vehicle_ids: allAssignedVehicleIds,
      p_override_flag: payload.override_flag,
      p_override_reason: payload.override_flag ? payload.override_reason?.trim() : null,
    });

    if (error || !rentalId) {
      throw new Error(error?.message ?? "Failed to convert reservation");
    }

    revalidatePath("/pos");
    revalidatePath(`/pos/reservations/${payload.reservation_id}`);
    redirect(`/pos/rentals/${rentalId}?success=Rental%20started%20from%20reservation`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to convert reservation";
    redirect(`/pos?error=${encodeURIComponent(message)}`);
  }
}

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string; success?: string }>;

export default async function PosReservationDetailPage(props: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { supabase } = await requireStaffPage();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const errorMessage = (searchParams.error ?? "").trim();
  const successMessage = (searchParams.success ?? "").trim();

  const { data: reservation } = await supabase
    .from("reservations")
    .select("id,customer_name,customer_phone,customer_email,start_time,end_time,status")
    .eq("id", id)
    .eq("location_id", "main")
    .single();

  if (!reservation) {
    redirect("/pos?error=Reservation%20not%20found");
  }

  const { data: reservationItems } = await supabase
    .from("reservation_items")
    .select(
      "vehicle_type_id,quantity,pricing_rule_id,pricing_rules(duration_unit,duration_value),vehicle_types(name)"
    )
    .eq("reservation_id", reservation.id);

  const groupedByType = new Map<
    string,
    { vehicle_type_id: string; vehicle_type_name: string; quantity: number; duration_label: string }
  >();
  for (const item of reservationItems ?? []) {
    const key = item.vehicle_type_id;
    const durationUnit = item.pricing_rules?.duration_unit ?? "day";
    const durationValue = item.pricing_rules?.duration_value ?? 1;
    const durationLabel = `${durationValue} ${durationUnit}${durationValue > 1 ? "s" : ""}`;
    const current = groupedByType.get(key);
    if (!current) {
      groupedByType.set(key, {
        vehicle_type_id: key,
        vehicle_type_name: item.vehicle_types?.name ?? "Vehicle",
        quantity: item.quantity,
        duration_label: durationLabel,
      });
    } else {
      current.quantity += item.quantity;
      if (current.duration_label !== durationLabel) {
        current.duration_label = "mixed durations";
      }
    }
  }

  const lineItems = Array.from(groupedByType.values());
  const vehicleTypeIds = lineItems.map((line) => line.vehicle_type_id);

  const [{ data: vehicles }, { data: activeRentals }, { data: depositPayments }] =
    await Promise.all([
    vehicleTypeIds.length
      ? supabase
          .from("vehicles")
          .select("id,asset_tag,vehicle_type_id,status")
          .in("vehicle_type_id", vehicleTypeIds)
          .eq("location_id", "main")
          .neq("status", "maintenance")
          .order("asset_tag")
      : Promise.resolve({ data: [] }),
    supabase.from("rentals").select("id").eq("location_id", "main").eq("status", "active"),
    supabase
      .from("payments")
      .select("id,amount_cents,status,method,created_at")
      .eq("reservation_id", reservation.id)
      .eq("type", "deposit")
      .order("created_at", { ascending: false }),
  ]);

  const activeRentalIds = (activeRentals ?? []).map((r) => r.id);
  let rentedVehicleIds = new Set<string>();
  if (activeRentalIds.length > 0) {
    const { data: rentalAssets } = await supabase
      .from("rental_assets")
      .select("vehicle_id")
      .in("rental_id", activeRentalIds);
    rentedVehicleIds = new Set((rentalAssets ?? []).map((row) => row.vehicle_id));
  }

  const uiVehicles = (vehicles ?? []).map((vehicle) => ({
    id: vehicle.id,
    asset_tag: vehicle.asset_tag,
    vehicle_type_id: vehicle.vehicle_type_id,
    available: !rentedVehicleIds.has(vehicle.id),
  }));

  const latestDepositPayment = (depositPayments ?? [])[0];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4">
        <h2 className="text-xl font-bold text-gray-900">Reservation Pickup</h2>
        <p className="mt-1 text-sm text-gray-600">
          {reservation.customer_name} • {new Date(reservation.start_time).toLocaleString()}
        </p>
        <p className="text-sm text-gray-600">
          {reservation.customer_email ?? "-"} • {reservation.customer_phone ?? "-"}
        </p>
        <p className="text-sm text-gray-600">Status: {reservation.status}</p>
        <p className="text-sm text-gray-600">
          Deposit:{" "}
          {latestDepositPayment && latestDepositPayment.status === "succeeded"
            ? `Paid $${(latestDepositPayment.amount_cents / 100).toFixed(2)}`
            : "Unpaid"}
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

      <section className="rounded-lg border bg-white p-4">
        <h3 className="font-semibold text-gray-900">Deposit Payments</h3>
        <div className="mt-3 space-y-2 text-sm">
          {(depositPayments ?? []).map((payment) => (
            <div key={payment.id} className="flex justify-between rounded-md border px-3 py-2">
              <span>
                {payment.method} • {payment.status}
              </span>
              <span>${(payment.amount_cents / 100).toFixed(2)}</span>
            </div>
          ))}
          {(depositPayments ?? []).length === 0 && (
            <p className="text-gray-500">No deposit payments recorded.</p>
          )}
        </div>
      </section>

      <ReservationPickupFlow
        reservationId={reservation.id}
        lineItems={lineItems}
        vehicles={uiVehicles}
        action={convertReservation}
      />
    </div>
  );
}
