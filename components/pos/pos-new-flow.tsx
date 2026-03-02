"use client";

import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/admin/submit-button";

type Rule = {
  id: string;
  vehicle_type_id: string;
  duration_unit: "hour" | "day" | "week";
  duration_value: number;
  price_cents: number;
};

type VehicleType = {
  id: string;
  name: string;
};

type Vehicle = {
  id: string;
  asset_tag: string;
  vehicle_type_id: string;
  available: boolean;
};

type LineItem = {
  vehicle_type_id: string;
  pricing_rule_id: string;
  quantity: number;
  assigned_vehicle_ids: string[];
};

type WalkInPayload = {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  notes: string;
  payment_method: "cash" | "stripe" | "none";
  amount_cents: number;
  override_flag: boolean;
  override_reason: string;
  line_items: LineItem[];
};

function formatDuration(rule: Rule) {
  return `${rule.duration_value} ${rule.duration_unit}${rule.duration_value > 1 ? "s" : ""}`;
}

function toCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PosNewFlow({
  vehicleTypes,
  pricingRules,
  vehicles,
  action,
}: {
  vehicleTypes: VehicleType[];
  pricingRules: Rule[];
  vehicles: Vehicle[];
  action: (formData: FormData) => void;
}) {
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      vehicle_type_id: vehicleTypes[0]?.id ?? "",
      pricing_rule_id: "",
      quantity: 1,
      assigned_vehicle_ids: [],
    },
  ]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "stripe" | "none">("cash");
  const [amountCents, setAmountCents] = useState(0);
  const [overrideFlag, setOverrideFlag] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [showUnavailableVehicles, setShowUnavailableVehicles] = useState(false);

  const rulesByType = useMemo(() => {
    const map = new Map<string, Rule[]>();
    for (const rule of pricingRules) {
      const list = map.get(rule.vehicle_type_id) ?? [];
      list.push(rule);
      map.set(rule.vehicle_type_id, list);
    }
    return map;
  }, [pricingRules]);

  const vehiclesByType = useMemo(() => {
    const map = new Map<string, Vehicle[]>();
    for (const vehicle of vehicles) {
      const list = map.get(vehicle.vehicle_type_id) ?? [];
      list.push(vehicle);
      map.set(vehicle.vehicle_type_id, list);
    }
    return map;
  }, [vehicles]);

  const inferredSubtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const rule = pricingRules.find((r) => r.id === item.pricing_rule_id);
      return sum + (rule ? rule.price_cents * item.quantity : 0);
    }, 0);
  }, [lineItems, pricingRules]);

  const payload: WalkInPayload = {
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    notes,
    payment_method: paymentMethod,
    amount_cents: amountCents,
    override_flag: overrideFlag,
    override_reason: overrideReason,
    line_items: lineItems,
  };

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="payload_json" value={JSON.stringify(payload)} />

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Walk-In Line Items</h2>
        <div className="mt-3 space-y-4">
          {lineItems.map((item, index) => {
            const rules = rulesByType.get(item.vehicle_type_id) ?? [];
            const options = vehiclesByType.get(item.vehicle_type_id) ?? [];
            return (
              <div key={index} className="rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    value={item.vehicle_type_id}
                    onChange={(event) => {
                      const vehicleTypeId = event.target.value;
                      const nextRules = rulesByType.get(vehicleTypeId) ?? [];
                      setLineItems((prev) =>
                        prev.map((line, idx) =>
                          idx === index
                            ? {
                                ...line,
                                vehicle_type_id: vehicleTypeId,
                                pricing_rule_id: nextRules[0]?.id ?? "",
                                assigned_vehicle_ids: [],
                              }
                            : line
                        )
                      );
                    }}
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    {vehicleTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={item.pricing_rule_id}
                    onChange={(event) =>
                      setLineItems((prev) =>
                        prev.map((line, idx) =>
                          idx === index ? { ...line, pricing_rule_id: event.target.value } : line
                        )
                      )
                    }
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Select duration</option>
                    {rules.map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {formatDuration(rule)} - {toCurrency(rule.price_cents)}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) =>
                      setLineItems((prev) =>
                        prev.map((line, idx) =>
                          idx === index
                            ? {
                                ...line,
                                quantity: Math.max(1, Number(event.target.value) || 1),
                              }
                            : line
                        )
                      )
                    }
                    className="rounded-md border px-3 py-2 text-sm"
                  />
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Assigned vehicles (select {item.quantity})
                  </label>
                  <select
                    multiple
                    size={Math.min(8, Math.max(4, options.length))}
                    value={item.assigned_vehicle_ids}
                    onChange={(event) => {
                      const selected = Array.from(event.target.selectedOptions).map(
                        (option) => option.value
                      );
                      setLineItems((prev) =>
                        prev.map((line, idx) =>
                          idx === index ? { ...line, assigned_vehicle_ids: selected } : line
                        )
                      );
                    }}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    {options
                      .filter((vehicle) => showUnavailableVehicles || vehicle.available)
                      .map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.asset_tag} {vehicle.available ? "(available)" : "(in use)"}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-gray-600">
                    Selected {item.assigned_vehicle_ids.length} / {item.quantity}
                  </p>
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLineItems((prev) => prev.filter((_, idx) => idx !== index))
                      }
                      className="rounded-md border px-2 py-1 text-xs font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setLineItems((prev) => [
                ...prev,
                {
                  vehicle_type_id: vehicleTypes[0]?.id ?? "",
                  pricing_rule_id: "",
                  quantity: 1,
                  assigned_vehicle_ids: [],
                },
              ])
            }
            className="rounded-md border px-3 py-2 text-xs font-medium"
          >
            Add Line Item
          </button>
          <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={showUnavailableVehicles}
              onChange={(event) => setShowUnavailableVehicles(event.target.checked)}
            />
            Show unavailable vehicles
          </label>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Customer and Payment</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Customer name"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
            required
          />
          <input
            placeholder="Phone (optional)"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
          <input
            placeholder="Email (optional)"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
          <select
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(event.target.value as "cash" | "stripe" | "none")
            }
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="cash">Cash</option>
            <option value="stripe">Card (Stripe)</option>
            <option value="none">No payment recorded</option>
          </select>
          <input
            type="number"
            min={0}
            value={amountCents}
            onChange={(event) => setAmountCents(Math.max(0, Number(event.target.value) || 0))}
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Amount paid (cents)"
          />
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="rounded-md border px-3 py-2 text-sm sm:col-span-2"
            placeholder="Internal notes"
            rows={3}
          />
        </div>
        <p className="mt-2 text-xs text-gray-600">
          Inferred subtotal: {toCurrency(inferredSubtotal)}
        </p>
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
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            className="mt-3 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Override reason (required)"
            required
          />
        )}
      </section>

      <SubmitButton
        label="Start Rental"
        pendingLabel="Starting Rental..."
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      />
    </form>
  );
}

