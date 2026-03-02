import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction, requireAdminPage } from "@/lib/auth/admin";
import { SubmitButton } from "@/components/admin/submit-button";

async function createPricingRule(formData: FormData) {
  "use server";

  try {
    const { supabase, session } = await requireAdminAction();
    const vehicleTypeId = String(formData.get("vehicle_type_id") ?? "").trim();
    const durationUnit = String(formData.get("duration_unit") ?? "").trim();
    const durationValue = Number(formData.get("duration_value") ?? 0);
    const priceCents = Number(formData.get("price_cents") ?? 0);
    const depositCents = Number(formData.get("deposit_cents") ?? 0);
    const seasonKey = String(formData.get("season_key") ?? "").trim();

    if (!vehicleTypeId) {
      throw new Error("vehicle_type_id is required");
    }

    if (!["hour", "day", "week"].includes(durationUnit)) {
      throw new Error("duration_unit must be hour/day/week");
    }

    if (!Number.isInteger(durationValue) || durationValue < 1) {
      throw new Error("duration_value must be >= 1");
    }

    if (!Number.isInteger(priceCents) || priceCents < 0) {
      throw new Error("price_cents must be >= 0");
    }

    if (!Number.isInteger(depositCents) || depositCents < 0) {
      throw new Error("deposit_cents must be >= 0");
    }

    const { data: insertedRule, error } = await supabase
      .from("pricing_rules")
      .insert({
        location_id: "main",
        vehicle_type_id: vehicleTypeId,
        duration_unit: durationUnit as "hour" | "day" | "week",
        duration_value: durationValue,
        price_cents: priceCents,
        deposit_cents: depositCents,
        season_key: seasonKey || null,
        active: true,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (insertedRule) {
      await supabase.from("activity_log").insert({
        location_id: "main",
        actor_user_id: session.user.id,
        entity_type: "pricing_rule",
        entity_id: insertedRule.id,
        action: "created",
        metadata: {
          duration_unit: durationUnit,
          duration_value: durationValue,
          price_cents: priceCents,
          deposit_cents: depositCents,
        },
      });
    }

    revalidatePath("/admin/pricing");
    revalidatePath("/admin");
    redirect("/admin/pricing?success=Pricing%20rule%20added");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add pricing rule";
    redirect(`/admin/pricing?error=${encodeURIComponent(message)}`);
  }
}

async function togglePricingRule(formData: FormData) {
  "use server";

  try {
    const { supabase, session } = await requireAdminAction();
    const pricingRuleId = String(formData.get("pricing_rule_id") ?? "").trim();
    const currentActive = String(formData.get("current_active") ?? "").trim();

    if (!pricingRuleId || !["true", "false"].includes(currentActive)) {
      throw new Error("Invalid pricing rule payload");
    }

    const { error } = await supabase
      .from("pricing_rules")
      .update({ active: currentActive === "false" })
      .eq("id", pricingRuleId)
      .eq("location_id", "main");

    if (error) {
      throw new Error(error.message);
    }

    await supabase.from("activity_log").insert({
      location_id: "main",
      actor_user_id: session.user.id,
      entity_type: "pricing_rule",
      entity_id: pricingRuleId,
      action: "status_changed",
      metadata: { active: currentActive === "false" },
    });

    revalidatePath("/admin/pricing");
    revalidatePath("/admin");
    redirect("/admin/pricing?success=Pricing%20rule%20updated");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update pricing rule";
    redirect(`/admin/pricing?error=${encodeURIComponent(message)}`);
  }
}

type SearchParams = Promise<{ success?: string; error?: string }>;

export default async function AdminPricingPage(props: {
  searchParams: SearchParams;
}) {
  const { supabase } = await requireAdminPage();
  const searchParams = await props.searchParams;
  const successMessage = (searchParams.success ?? "").trim();
  const errorMessage = (searchParams.error ?? "").trim();

  const [{ data: vehicleTypes }, { data: pricingRules }] = await Promise.all([
    supabase
      .from("vehicle_types")
      .select("id,name,category")
      .eq("location_id", "main")
      .order("name"),
    supabase
      .from("pricing_rules")
      .select("id,duration_unit,duration_value,price_cents,deposit_cents,active,season_key,vehicle_types(name,category)")
      .eq("location_id", "main")
      .order("created_at", { ascending: false }),
  ]);

  const typedPricingRules = (pricingRules ?? []) as Array<{
    id: string;
    duration_unit: "hour" | "day" | "week";
    duration_value: number;
    price_cents: number;
    deposit_cents: number;
    active: boolean;
    season_key: string | null;
    vehicle_types:
      | {
          name: string;
          category: "bike" | "car";
        }
      | null;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Pricing Rules</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure duration tiers and deposit requirements per vehicle type.
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
        <h3 className="text-lg font-semibold text-gray-900">Add Pricing Rule</h3>
        <form action={createPricingRule} className="mt-4 grid gap-3 sm:grid-cols-6">
          <select name="vehicle_type_id" className="rounded-md border px-3 py-2 text-sm" required>
            <option value="">Vehicle Type</option>
            {(vehicleTypes ?? []).map((vt) => (
              <option key={vt.id} value={vt.id}>
                {vt.name}
              </option>
            ))}
          </select>
          <select
            name="duration_unit"
            defaultValue="hour"
            className="rounded-md border px-3 py-2 text-sm"
            required
          >
            <option value="hour">Hour</option>
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
          <input
            name="duration_value"
            type="number"
            min={1}
            defaultValue={1}
            className="rounded-md border px-3 py-2 text-sm"
            required
          />
          <input
            name="price_cents"
            type="number"
            min={0}
            placeholder="Price (cents)"
            className="rounded-md border px-3 py-2 text-sm"
            required
          />
          <input
            name="deposit_cents"
            type="number"
            min={0}
            defaultValue={0}
            placeholder="Deposit (cents)"
            className="rounded-md border px-3 py-2 text-sm"
            required
          />
          <input
            name="season_key"
            placeholder="Season key (optional)"
            className="rounded-md border px-3 py-2 text-sm"
          />
          <SubmitButton
            label="Add Rule"
            pendingLabel="Adding..."
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-6 sm:w-fit"
          />
        </form>
      </section>

      <section className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h3 className="text-lg font-semibold text-gray-900">Rules</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Deposit</th>
                <th className="px-4 py-2">Season</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {typedPricingRules.map((rule) => (
                <tr key={rule.id} className="border-t">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {rule.vehicle_types?.name ?? "Unknown"}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {rule.duration_value} {rule.duration_unit}
                    {rule.duration_value > 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    ${(rule.price_cents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    ${(rule.deposit_cents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{rule.season_key ?? "-"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        rule.active ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {rule.active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <form action={togglePricingRule}>
                      <input type="hidden" name="pricing_rule_id" value={rule.id} />
                      <input
                        type="hidden"
                        name="current_active"
                        value={rule.active ? "true" : "false"}
                      />
                      <SubmitButton
                        label={rule.active ? "Deactivate" : "Activate"}
                        pendingLabel="Updating..."
                        className="rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-60"
                      />
                    </form>
                  </td>
                </tr>
              ))}
              {typedPricingRules.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={7}>
                    No pricing rules yet.
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
