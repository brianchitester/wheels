import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction, requireAdminPage } from "@/lib/auth/admin";
import { SubmitButton } from "@/components/admin/submit-button";

async function createVehicle(formData: FormData) {
  "use server";

  try {
    const { supabase, session } = await requireAdminAction();
    const assetTag = String(formData.get("asset_tag") ?? "").trim();
    const vehicleTypeId = String(formData.get("vehicle_type_id") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (!assetTag || !vehicleTypeId) {
      throw new Error("asset_tag and vehicle_type_id are required");
    }

    const { data: insertedVehicle, error } = await supabase
      .from("vehicles")
      .insert({
        location_id: "main",
        asset_tag: assetTag,
        vehicle_type_id: vehicleTypeId,
        status: "available",
        notes: notes || null,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (insertedVehicle) {
      await supabase.from("activity_log").insert({
        location_id: "main",
        actor_user_id: session.user.id,
        entity_type: "vehicle",
        entity_id: insertedVehicle.id,
        action: "created",
        metadata: { asset_tag: assetTag },
      });
    }

    revalidatePath("/admin/vehicles");
    revalidatePath("/admin");
    redirect("/admin/vehicles?success=Vehicle%20added");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add vehicle";
    redirect(`/admin/vehicles?error=${encodeURIComponent(message)}`);
  }
}

async function toggleVehicleStatus(formData: FormData) {
  "use server";

  try {
    const { supabase, session } = await requireAdminAction();
    const vehicleId = String(formData.get("vehicle_id") ?? "").trim();
    const currentStatus = String(formData.get("current_status") ?? "").trim();

    if (
      !vehicleId ||
      (currentStatus !== "available" && currentStatus !== "maintenance")
    ) {
      throw new Error("Invalid vehicle payload");
    }

    const nextStatus = currentStatus === "maintenance" ? "available" : "maintenance";
    const { error } = await supabase
      .from("vehicles")
      .update({ status: nextStatus })
      .eq("id", vehicleId)
      .eq("location_id", "main");

    if (error) {
      throw new Error(error.message);
    }

    await supabase.from("activity_log").insert({
      location_id: "main",
      actor_user_id: session.user.id,
      entity_type: "vehicle",
      entity_id: vehicleId,
      action: "status_changed",
      metadata: { from: currentStatus, to: nextStatus },
    });

    revalidatePath("/admin/vehicles");
    redirect("/admin/vehicles?success=Vehicle%20status%20updated");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update vehicle status";
    redirect(`/admin/vehicles?error=${encodeURIComponent(message)}`);
  }
}

async function updateVehicleNotes(formData: FormData) {
  "use server";

  try {
    const { supabase, session } = await requireAdminAction();
    const vehicleId = String(formData.get("vehicle_id") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (!vehicleId) {
      throw new Error("vehicle_id is required");
    }

    const { error } = await supabase
      .from("vehicles")
      .update({ notes: notes || null })
      .eq("id", vehicleId)
      .eq("location_id", "main");

    if (error) {
      throw new Error(error.message);
    }

    await supabase.from("activity_log").insert({
      location_id: "main",
      actor_user_id: session.user.id,
      entity_type: "vehicle",
      entity_id: vehicleId,
      action: "notes_updated",
      metadata: { notes: notes || null },
    });

    revalidatePath("/admin/vehicles");
    redirect("/admin/vehicles?success=Vehicle%20notes%20saved");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save notes";
    redirect(`/admin/vehicles?error=${encodeURIComponent(message)}`);
  }
}

type SearchParams = Promise<{ success?: string; error?: string }>;

export default async function AdminVehiclesPage(props: {
  searchParams: SearchParams;
}) {
  const { supabase } = await requireAdminPage();
  const searchParams = await props.searchParams;
  const successMessage = (searchParams.success ?? "").trim();
  const errorMessage = (searchParams.error ?? "").trim();

  const [{ data: vehicleTypes }, { data: vehicles }] = await Promise.all([
    supabase
      .from("vehicle_types")
      .select("id,name,category")
      .eq("location_id", "main")
      .eq("active", true)
      .order("name"),
    supabase
      .from("vehicles")
      .select("id,asset_tag,status,notes,vehicle_type_id")
      .eq("location_id", "main")
      .order("asset_tag"),
  ]);

  const vehicleTypeById = new Map(
    (vehicleTypes ?? []).map((vt) => [
      vt.id,
      { name: vt.name, category: vt.category },
    ])
  );

  const typedVehicles = (vehicles ?? []) as Array<{
    id: string;
    asset_tag: string;
    status: "available" | "maintenance";
    notes: string | null;
    vehicle_type_id: string;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Vehicles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add and maintain fleet inventory for location <code>main</code>.
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
        <h3 className="text-lg font-semibold text-foreground">Add Vehicle</h3>
        <form action={createVehicle} className="mt-4 grid gap-3 sm:grid-cols-4">
          <input
            name="asset_tag"
            placeholder="Asset Tag (e.g. RB-104)"
            className="rounded-md border px-3 py-2 text-sm"
            required
          />
          <select
            name="vehicle_type_id"
            className="rounded-md border px-3 py-2 text-sm"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select type
            </option>
            {(vehicleTypes ?? []).map((vt) => (
              <option key={vt.id} value={vt.id}>
                {vt.name}
              </option>
            ))}
          </select>
          <input
            name="notes"
            placeholder="Notes (optional)"
            className="rounded-md border px-3 py-2 text-sm sm:col-span-2"
          />
          <SubmitButton
            label="Add Vehicle"
            pendingLabel="Adding..."
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-4 sm:w-fit"
          />
        </form>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-lg font-semibold text-foreground">Fleet</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-background text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Asset Tag</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Notes</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {typedVehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-t">
                  <td className="px-4 py-2 font-medium text-foreground">{vehicle.asset_tag}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {vehicleTypeById.get(vehicle.vehicle_type_id)?.name ?? "Unknown"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        vehicle.status === "maintenance"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {vehicle.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    <form action={updateVehicleNotes} className="flex gap-2">
                      <input type="hidden" name="vehicle_id" value={vehicle.id} />
                      <input
                        name="notes"
                        defaultValue={vehicle.notes ?? ""}
                        placeholder="No notes"
                        className="w-full rounded-md border px-2 py-1 text-sm"
                      />
                      <SubmitButton
                        label="Save"
                        pendingLabel="Saving..."
                        className="rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-60"
                      />
                    </form>
                  </td>
                  <td className="px-4 py-2">
                    <form action={toggleVehicleStatus}>
                      <input type="hidden" name="vehicle_id" value={vehicle.id} />
                      <input type="hidden" name="current_status" value={vehicle.status} />
                      <SubmitButton
                        label={
                          vehicle.status === "maintenance"
                            ? "Mark Available"
                            : "Mark Maintenance"
                        }
                        pendingLabel="Updating..."
                        className="rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-60"
                      />
                    </form>
                  </td>
                </tr>
              ))}
              {typedVehicles.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-muted-foreground" colSpan={5}>
                    No vehicles yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

