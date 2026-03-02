type SearchParams = Promise<{ id?: string }>;

export default async function ReserveSuccessPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const reservationId = (searchParams.id ?? "").trim();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="rounded-lg border bg-card p-8">
          <h1 className="text-3xl font-bold text-foreground">Reservation Confirmed</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your reservation has been created successfully.
          </p>
          <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground">
            Confirmation ID: {reservationId || "Unavailable"}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Please save this ID for pickup and support inquiries.
          </p>
          <a
            href="/reserve"
            className="mt-6 inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Make Another Reservation
          </a>
        </div>
      </main>
    </div>
  );
}


