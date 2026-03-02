import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ReserveFlow } from "@/components/reserve/reserve-flow";

type VehicleTypeWithRules = {
  id: string;
  name: string;
  category: "bike" | "car";
  pricing_rules: Array<{
    id: string;
    duration_unit: "hour" | "day" | "week";
    duration_value: number;
    price_cents: number;
    deposit_cents: number;
  }>;
};

export default async function ReservePage() {
  const supabase = getSupabaseAdmin();

  const [{ data: vehicleTypes }, { data: pricingRules }] = await Promise.all([
    supabase
      .from("vehicle_types")
      .select("id,name,category")
      .eq("location_id", "main")
      .eq("active", true)
      .order("name"),
    supabase
      .from("pricing_rules")
      .select("id,vehicle_type_id,duration_unit,duration_value,price_cents,deposit_cents")
      .eq("location_id", "main")
      .eq("active", true)
      .order("duration_value"),
  ]);

  const rulesByType = new Map<
    string,
    Array<{
      id: string;
      duration_unit: "hour" | "day" | "week";
      duration_value: number;
      price_cents: number;
      deposit_cents: number;
    }>
  >();

  for (const rule of pricingRules ?? []) {
    const list = rulesByType.get(rule.vehicle_type_id) ?? [];
    list.push({
      id: rule.id,
      duration_unit: rule.duration_unit,
      duration_value: rule.duration_value,
      price_cents: rule.price_cents,
      deposit_cents: rule.deposit_cents,
    });
    rulesByType.set(rule.vehicle_type_id, list);
  }

  const reserveTypes: VehicleTypeWithRules[] = (vehicleTypes ?? []).map((vehicleType) => ({
    id: vehicleType.id,
    name: vehicleType.name,
    category: vehicleType.category,
    pricing_rules: rulesByType.get(vehicleType.id) ?? [],
  }));

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Reserve Your Rental</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select vehicle type, duration, quantity, and pickup time.
          </p>
        </div>
        <ReserveFlow vehicleTypes={reserveTypes} />
      </main>
    </div>
  );
}


