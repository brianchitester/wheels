import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/staff";

type SearchParams = Promise<{ success?: string; error?: string }>;

export default async function PosHomePage(props: { searchParams: SearchParams }) {
  const { supabase } = await requireStaffPage();
  const searchParams = await props.searchParams;
  const successMessage = (searchParams.success ?? "").trim();
  const errorMessage = (searchParams.error ?? "").trim();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [{ data: reservations }, { data: rentals }] = await Promise.all([
    supabase
      .from("reservations")
      .select("id,customer_name,start_time,end_time,status")
      .eq("location_id", "main")
      .in("status", ["pending", "confirmed"])
      .gte("start_time", startOfToday.toISOString())
      .lt("start_time", endOfToday.toISOString())
      .order("start_time", { ascending: true })
      .limit(50),
    supabase
      .from("rentals")
      .select("id,customer_name,start_time,end_time,status")
      .eq("location_id", "main")
      .eq("status", "active")
      .order("end_time", { ascending: true })
      .limit(50),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/pos/new"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          New Walk-In Rental
        </Link>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-white">
          <div className="border-b px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-900">Today&apos;s Reservations</h2>
          </div>
          <div className="divide-y">
            {(reservations ?? []).map((reservation) => (
              <div key={reservation.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">{reservation.customer_name}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(reservation.start_time).toLocaleTimeString()} -{" "}
                    {new Date(reservation.end_time).toLocaleTimeString()}
                  </p>
                </div>
                <Link
                  href={`/pos/reservations/${reservation.id}`}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium"
                >
                  Pickup
                </Link>
              </div>
            ))}
            {(reservations ?? []).length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-500">No reservations today.</div>
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-white">
          <div className="border-b px-4 py-3">
            <h2 className="text-lg font-semibold text-gray-900">Active Rentals</h2>
          </div>
          <div className="divide-y">
            {(rentals ?? []).map((rental) => (
              <div key={rental.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">{rental.customer_name}</p>
                  <p className="text-sm text-gray-600">
                    Due {new Date(rental.end_time).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/pos/rentals/${rental.id}`}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium"
                >
                  Return
                </Link>
              </div>
            ))}
            {(rentals ?? []).length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-500">No active rentals.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

