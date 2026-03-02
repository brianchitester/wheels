type SearchParams = Promise<{ id?: string }>;

export default async function ReserveCancelPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const reservationId = (searchParams.id ?? "").trim();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="rounded-lg border bg-card p-8">
          <h1 className="text-3xl font-bold text-foreground">Payment Cancelled</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your reservation has been saved, but deposit payment was not completed.
          </p>
          {reservationId && (
            <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground">
              Reservation ID: {reservationId}
            </p>
          )}
          <a
            href="/reserve"
            className="mt-6 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Return to Reservations
          </a>
        </div>
      </main>
    </div>
  );
}


