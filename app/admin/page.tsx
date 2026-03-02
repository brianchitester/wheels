import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/admin";

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdminPage();

  const [{ count: vehicleCount }, { count: pricingCount }, { count: upcomingCount }] =
    await Promise.all([
      supabase
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("location_id", "main"),
      supabase
        .from("pricing_rules")
        .select("id", { count: "exact", head: true })
        .eq("location_id", "main")
        .eq("active", true),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("location_id", "main")
        .in("status", ["pending", "confirmed"])
        .gte("start_time", new Date().toISOString()),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Operations Overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage inventory, pricing, and reservation operations from here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Vehicles</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{vehicleCount ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Active Pricing Rules</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{pricingCount ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Upcoming Reservations</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{upcomingCount ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/vehicles"
          className="rounded-lg border bg-card p-4 transition hover:shadow-sm"
        >
          <h3 className="font-semibold text-foreground">Manage Vehicles</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add vehicles and update maintenance status.
          </p>
        </Link>
        <Link
          href="/admin/pricing"
          className="rounded-lg border bg-card p-4 transition hover:shadow-sm"
        >
          <h3 className="font-semibold text-foreground">Manage Pricing</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure duration tiers, prices, and deposits.
          </p>
        </Link>
        <Link
          href="/admin/reservations"
          className="rounded-lg border bg-card p-4 transition hover:shadow-sm"
        >
          <h3 className="font-semibold text-foreground">Manage Reservations</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Search, review, and cancel reservation records.
          </p>
        </Link>
      </div>
    </div>
  );
}


