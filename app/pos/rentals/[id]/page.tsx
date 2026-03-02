import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaffAction, requireStaffPage } from "@/lib/auth/staff";
import { SubmitButton } from "@/components/admin/submit-button";

async function returnRental(formData: FormData) {
  "use server";

  try {
    const { supabase, session } = await requireStaffAction();
    const rentalId = String(formData.get("rental_id") ?? "").trim();
    const returnNotes = String(formData.get("return_notes") ?? "").trim();

    if (!rentalId) {
      throw new Error("rental_id is required");
    }

    const { error } = await supabase.rpc("return_rental", {
      p_rental_id: rentalId,
      p_actual_return_time: new Date().toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }

    if (returnNotes) {
      await supabase.from("activity_log").insert({
        location_id: "main",
        actor_user_id: session.user.id,
        entity_type: "rental",
        entity_id: rentalId,
        action: "return_notes",
        metadata: { notes: returnNotes },
      });
    }

    revalidatePath("/pos");
    revalidatePath(`/pos/rentals/${rentalId}`);
    redirect("/pos?success=Rental%20returned");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to return rental";
    redirect(`/pos?error=${encodeURIComponent(message)}`);
  }
}

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string; success?: string }>;

export default async function PosRentalDetailPage(props: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { supabase } = await requireStaffPage();
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const errorMessage = (searchParams.error ?? "").trim();
  const successMessage = (searchParams.success ?? "").trim();

  const [{ data: rental }, { data: rentalItems }, { data: rentalAssets }, { data: payments }] =
    await Promise.all([
      supabase
        .from("rentals")
        .select(
          "id,customer_name,customer_phone,customer_email,start_time,end_time,status,actual_return_time,created_at"
        )
        .eq("id", id)
        .eq("location_id", "main")
        .single(),
      supabase
        .from("rental_items")
        .select("id,quantity,unit_price_cents,vehicle_type_id,pricing_rule_id")
        .eq("rental_id", id),
      supabase
        .from("rental_assets")
        .select("id,vehicle_id")
        .eq("rental_id", id),
      supabase
        .from("payments")
        .select("id,method,amount_cents,status,created_at")
        .eq("rental_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!rental) {
    redirect("/pos?error=Rental%20not%20found");
  }

  const vehicleTypeIds = Array.from(
    new Set((rentalItems ?? []).map((item) => item.vehicle_type_id))
  );
  const pricingRuleIds = Array.from(
    new Set((rentalItems ?? []).map((item) => item.pricing_rule_id))
  );
  const assetVehicleIds = Array.from(
    new Set((rentalAssets ?? []).map((asset) => asset.vehicle_id))
  );

  const [{ data: vehicleTypes }, { data: pricingRules }, { data: vehicles }] =
    await Promise.all([
      vehicleTypeIds.length
        ? supabase.from("vehicle_types").select("id,name").in("id", vehicleTypeIds)
        : Promise.resolve({ data: [] }),
      pricingRuleIds.length
        ? supabase
            .from("pricing_rules")
            .select("id,duration_unit,duration_value")
            .in("id", pricingRuleIds)
        : Promise.resolve({ data: [] }),
      assetVehicleIds.length
        ? supabase.from("vehicles").select("id,asset_tag").in("id", assetVehicleIds)
        : Promise.resolve({ data: [] }),
    ]);

  const vehicleTypeById = new Map((vehicleTypes ?? []).map((vt) => [vt.id, vt]));
  const pricingRuleById = new Map((pricingRules ?? []).map((pr) => [pr.id, pr]));
  const vehicleById = new Map((vehicles ?? []).map((v) => [v.id, v]));

  const totalAmount = (rentalItems ?? []).reduce(
    (sum, item) => sum + item.quantity * item.unit_price_cents,
    0
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-xl font-bold text-foreground">Rental Detail</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {rental.customer_name} • Status: {rental.status}
        </p>
        <p className="text-sm text-muted-foreground">
          {new Date(rental.start_time).toLocaleString()} to{" "}
          {new Date(rental.end_time).toLocaleString()}
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

      <section className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold text-foreground">Items</h3>
        <div className="mt-3 space-y-2 text-sm">
          {(rentalItems ?? []).map((item) => (
            <div key={item.id} className="flex justify-between rounded-md border px-3 py-2">
              <div>
                <p className="font-medium">
                  {vehicleTypeById.get(item.vehicle_type_id)?.name ?? "Vehicle"}
                </p>
                <p className="text-muted-foreground">
                  {pricingRuleById.get(item.pricing_rule_id)?.duration_value ?? 1}{" "}
                  {pricingRuleById.get(item.pricing_rule_id)?.duration_unit ?? "day"} x{" "}
                  {item.quantity}
                </p>
              </div>
              <p className="font-medium">${((item.quantity * item.unit_price_cents) / 100).toFixed(2)}</p>
            </div>
          ))}
          <p className="font-medium text-foreground">Total: ${(totalAmount / 100).toFixed(2)}</p>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold text-foreground">Assigned Vehicles</h3>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {(rentalAssets ?? []).map((asset) => (
            <span key={asset.id} className="rounded-md border px-2 py-1">
              {vehicleById.get(asset.vehicle_id)?.asset_tag ?? asset.vehicle_id}
            </span>
          ))}
          {(rentalAssets ?? []).length === 0 && <p className="text-muted-foreground">No assigned assets.</p>}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold text-foreground">Payments</h3>
        <div className="mt-3 space-y-2 text-sm">
          {(payments ?? []).map((payment) => (
            <div key={payment.id} className="flex justify-between rounded-md border px-3 py-2">
              <span>
                {payment.method} • {payment.status}
              </span>
              <span>${(payment.amount_cents / 100).toFixed(2)}</span>
            </div>
          ))}
          {(payments ?? []).length === 0 && <p className="text-muted-foreground">No payments recorded.</p>}
        </div>
      </section>

      {rental.status === "active" ? (
        <form action={returnRental} className="rounded-lg border bg-card p-4">
          <input type="hidden" name="rental_id" value={rental.id} />
          <label className="mb-1 block text-sm font-medium text-muted-foreground">Return notes</label>
          <textarea
            name="return_notes"
            rows={3}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Optional notes for damage/late return"
          />
          <div className="mt-3">
            <SubmitButton
              label="Mark Returned"
              pendingLabel="Returning..."
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            />
          </div>
        </form>
      ) : (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Returned at {rental.actual_return_time ? new Date(rental.actual_return_time).toLocaleString() : "unknown"}
        </div>
      )}
    </div>
  );
}
