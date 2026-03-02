import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction, requireAdminPage } from "@/lib/auth/admin";
import { SubmitButton } from "@/components/admin/submit-button";

async function cancelReservation(formData: FormData) {
  "use server";

  try {
    const { supabase, session } = await requireAdminAction();
    const reservationId = String(formData.get("reservation_id") ?? "").trim();

    if (!reservationId) {
      throw new Error("reservation_id is required");
    }

    const { error } = await supabase
      .from("reservations")
      .update({
        status: "cancelled",
        override_flag: false,
        override_reason: null,
        overridden_by_user_id: null,
      })
      .eq("id", reservationId)
      .eq("location_id", "main")
      .neq("status", "cancelled");

    if (error) {
      throw new Error(error.message);
    }

    await supabase.from("activity_log").insert({
      location_id: "main",
      actor_user_id: session.user.id,
      entity_type: "reservation",
      entity_id: reservationId,
      action: "cancelled",
      metadata: {},
    });

    revalidatePath("/admin/reservations");
    revalidatePath("/admin");
    redirect("/admin/reservations?success=Reservation%20cancelled");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel reservation";
    redirect(`/admin/reservations?error=${encodeURIComponent(message)}`);
  }
}

async function updateReservationNotes(formData: FormData) {
  "use server";

  try {
    const { supabase, session } = await requireAdminAction();
    const reservationId = String(formData.get("reservation_id") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (!reservationId) {
      throw new Error("reservation_id is required");
    }

    const { error } = await supabase
      .from("reservations")
      .update({ notes: notes || null })
      .eq("id", reservationId)
      .eq("location_id", "main");

    if (error) {
      throw new Error(error.message);
    }

    await supabase.from("activity_log").insert({
      location_id: "main",
      actor_user_id: session.user.id,
      entity_type: "reservation",
      entity_id: reservationId,
      action: "notes_updated",
      metadata: { notes: notes || null },
    });

    revalidatePath("/admin/reservations");
    redirect("/admin/reservations?success=Notes%20saved");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save notes";
    redirect(`/admin/reservations?error=${encodeURIComponent(message)}`);
  }
}

type SearchParams = Promise<{
  q?: string;
  status?: string;
  success?: string;
  error?: string;
}>;

export default async function AdminReservationsPage(props: {
  searchParams: SearchParams;
}) {
  const { supabase } = await requireAdminPage();
  const searchParams = await props.searchParams;

  const q = (searchParams.q ?? "").trim();
  const status = (searchParams.status ?? "").trim();
  const successMessage = (searchParams.success ?? "").trim();
  const errorMessage = (searchParams.error ?? "").trim();
  const statusFilter =
    status === "pending" || status === "confirmed" || status === "cancelled"
      ? status
      : "";

  let query = supabase
    .from("reservations")
    .select(
      "id,status,customer_name,customer_email,customer_phone,start_time,end_time,notes,created_at"
    )
    .eq("location_id", "main")
    .order("start_time", { ascending: false })
    .limit(100);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  if (q) {
    query = query.or(
      [
        `customer_name.ilike.%${q}%`,
        `customer_email.ilike.%${q}%`,
        `customer_phone.ilike.%${q}%`,
      ].join(",")
    );
  }

  const { data: reservations } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Reservations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Search reservation records and handle cancellations.
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
        <form className="grid gap-3 sm:grid-cols-4" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name, email, or phone"
            className="rounded-md border px-3 py-2 text-sm sm:col-span-2"
          />
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="cancelled">cancelled</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Filter
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-lg font-semibold text-foreground">Latest Reservations</h3>
        </div>
        <div className="divide-y">
          {(reservations ?? []).map((reservation) => (
            <div key={reservation.id} className="space-y-3 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{reservation.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(reservation.start_time).toLocaleString()} to{" "}
                    {new Date(reservation.end_time).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reservation.customer_email ?? "-"} • {reservation.customer_phone ?? "-"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    reservation.status === "cancelled"
                      ? "bg-muted text-muted-foreground"
                      : reservation.status === "pending"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {reservation.status}
                </span>
              </div>

              <div className="flex flex-wrap items-start gap-3">
                <form action={updateReservationNotes} className="flex min-w-[320px] flex-1 gap-2">
                  <input type="hidden" name="reservation_id" value={reservation.id} />
                  <input
                    name="notes"
                    defaultValue={reservation.notes ?? ""}
                    placeholder="Internal notes"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                  <SubmitButton
                    label="Save Notes"
                    pendingLabel="Saving..."
                    className="rounded-md border px-3 py-2 text-xs font-medium disabled:opacity-60"
                  />
                </form>

                {reservation.status !== "cancelled" && (
                  <form action={cancelReservation}>
                    <input type="hidden" name="reservation_id" value={reservation.id} />
                    <SubmitButton
                      label="Cancel"
                      pendingLabel="Cancelling..."
                      className="rounded-md border border-red-300 px-3 py-2 text-xs font-medium text-red-700 disabled:opacity-60"
                    />
                  </form>
                )}
              </div>
            </div>
          ))}
          {(reservations ?? []).length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground">No reservations found.</div>
          )}
        </div>
      </section>
    </div>
  );
}

