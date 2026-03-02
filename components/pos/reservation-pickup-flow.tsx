"use client";

import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/admin/submit-button";

type LineItem = {
  vehicle_type_id: string;
  vehicle_type_name: string;
  pricing_rule_id: string;
  duration_label: string;
  quantity: number;
};

type Vehicle = {
  id: string;
  asset_tag: string;
  vehicle_type_id: string;
  available: boolean;
};

type PickupPayload = {
  reservation_id: string;
  override_flag: boolean;
  override_reason: string;
  line_assignments: Array<{
    vehicle_type_id: string;
    assigned_vehicle_ids: string[];
  }>;
};

export function ReservationPickupFlow({
  reservationId,
  lineItems,
  vehicles,
  action,
}: {
  reservationId: string;
  lineItems: LineItem[];
  vehicles: Vehicle[];
  action: (formData: FormData) => void;
}) {
  const [assignments, setAssignments] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const line of lineItems) {
      init[line.vehicle_type_id] = [];
    }
    return init;
  });
  const [overrideFlag, setOverrideFlag] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [showUnavailableVehicles, setShowUnavailableVehicles] = useState(false);

  const vehiclesByType = useMemo(() => {
    const map = new Map<string, Vehicle[]>();
    for (const vehicle of vehicles) {
      const list = map.get(vehicle.vehicle_type_id) ?? [];
      list.push(vehicle);
      map.set(vehicle.vehicle_type_id, list);
    }
    return map;
  }, [vehicles]);

  const payload: PickupPayload = {
    reservation_id: reservationId,
    override_flag: overrideFlag,
    override_reason: overrideReason,
    line_assignments: lineItems.map((line) => ({
      vehicle_type_id: line.vehicle_type_id,
      assigned_vehicle_ids: assignments[line.vehicle_type_id] ?? [],
    })),
  };

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="payload_json" value={JSON.stringify(payload)} />

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Assign Vehicles</h2>
        <label className="mt-2 inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={showUnavailableVehicles}
            onChange={(event) => setShowUnavailableVehicles(event.target.checked)}
          />
          Show unavailable vehicles
        </label>
        <div className="mt-4 space-y-4">
          {lineItems.map((line) => {
            const options = vehiclesByType.get(line.vehicle_type_id) ?? [];
            const selected = assignments[line.vehicle_type_id] ?? [];
            return (
              <div key={line.vehicle_type_id} className="rounded-md border p-3">
                <p className="font-medium text-gray-900">
                  {line.vehicle_type_name} - {line.duration_label} x {line.quantity}
                </p>
                <select
                  multiple
                  value={selected}
                  size={Math.min(8, Math.max(4, options.length))}
                  onChange={(event) => {
                    const ids = Array.from(event.target.selectedOptions).map((o) => o.value);
                    setAssignments((prev) => ({ ...prev, [line.vehicle_type_id]: ids }));
                  }}
                  className="mt-2 w-full rounded-md border px-3 py-2 text-sm"
                >
                  {options
                    .filter((vehicle) => showUnavailableVehicles || vehicle.available)
                    .map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.asset_tag} {vehicle.available ? "(available)" : "(in use)"}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-600">
                  Selected {selected.length} / {line.quantity}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={overrideFlag}
            onChange={(event) => setOverrideFlag(event.target.checked)}
          />
          Override conflicts
        </label>
        {overrideFlag && (
          <input
            className="mt-3 w-full rounded-md border px-3 py-2 text-sm"
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            placeholder="Override reason (required)"
            required
          />
        )}
      </section>

      <SubmitButton
        label="Start Rental"
        pendingLabel="Starting..."
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      />
    </form>
  );
}

