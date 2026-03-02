"use client";

import { useMemo, useState } from "react";

type PricingRule = {
  id: string;
  duration_unit: "hour" | "day" | "week";
  duration_value: number;
  price_cents: number;
  deposit_cents: number;
};

type VehicleTypeWithRules = {
  id: string;
  name: string;
  category: "bike" | "car";
  pricing_rules: PricingRule[];
};

type Props = {
  vehicleTypes: VehicleTypeWithRules[];
};

type AvailabilityResult = {
  vehicle_type_id: string;
  pricing_rule_id: string;
  quantity: number;
  available: boolean;
  available_count: number;
  total_count: number;
  blocked_count: number;
  end_time: string;
};

type SelectedLineItem = {
  vehicle_type_id: string;
  pricing_rule_id: string;
  quantity: number;
};

type CustomerInfo = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string;
};

function formatDuration(rule: PricingRule) {
  return `${rule.duration_value} ${rule.duration_unit}${rule.duration_value > 1 ? "s" : ""}`;
}

function toCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ReserveFlow({ vehicleTypes }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedRuleByType, setSelectedRuleByType] = useState<Record<string, string>>({});
  const [quantityByType, setQuantityByType] = useState<Record<string, number>>({});
  const [startTimeLocal, setStartTimeLocal] = useState("");
  const [deliveryRequired, setDeliveryRequired] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryTimeLocal, setDeliveryTimeLocal] = useState("");
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    notes: "",
  });
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [availabilityResults, setAvailabilityResults] = useState<AvailabilityResult[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const ruleById = useMemo(() => {
    const map = new Map<string, PricingRule>();
    for (const vehicleType of vehicleTypes) {
      for (const rule of vehicleType.pricing_rules) {
        map.set(rule.id, rule);
      }
    }
    return map;
  }, [vehicleTypes]);

  const selectedItems = useMemo(() => {
    const items: SelectedLineItem[] = [];
    for (const vehicleType of vehicleTypes) {
      const quantity = quantityByType[vehicleType.id] ?? 0;
      const selectedRuleId = selectedRuleByType[vehicleType.id];
      if (quantity > 0 && selectedRuleId) {
        items.push({
          vehicle_type_id: vehicleType.id,
          pricing_rule_id: selectedRuleId,
          quantity,
        });
      }
    }
    return items;
  }, [quantityByType, selectedRuleByType, vehicleTypes]);

  const subtotalCents = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const rule = ruleById.get(item.pricing_rule_id);
      if (!rule) return sum;
      return sum + rule.price_cents * item.quantity;
    }, 0);
  }, [selectedItems, ruleById]);

  const totalDepositCents = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const rule = ruleById.get(item.pricing_rule_id);
      if (!rule) return sum;
      return sum + rule.deposit_cents * item.quantity;
    }, 0);
  }, [selectedItems, ruleById]);

  const hasUnavailableItems =
    availabilityChecked && availabilityResults.some((result) => !result.available);

  async function handleCheckAvailability() {
    setErrorMessage("");
    setAvailabilityChecked(false);
    setAvailabilityResults([]);

    if (!startTimeLocal) {
      setErrorMessage("Please select a start time.");
      return;
    }

    if (selectedItems.length === 0) {
      setErrorMessage("Please select at least one vehicle.");
      return;
    }

    const response = await fetch("/api/public/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: "main",
        start_time: new Date(startTimeLocal).toISOString(),
        items: selectedItems,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setErrorMessage(payload.error ?? "Failed to check availability");
      return;
    }

    setAvailabilityChecked(true);
    setAvailabilityResults(payload.results ?? []);
    if (!(payload.ok ?? false)) {
      setErrorMessage(
        "Some items are unavailable at the selected time. Please adjust your cart or start time."
      );
    }
  }

  async function handleCreateReservation() {
    setSubmitting(true);
    setErrorMessage("");

    try {
      if (!startTimeLocal) {
        throw new Error("Start time is required.");
      }

      if (!customerInfo.customer_name.trim()) {
        throw new Error("Customer name is required.");
      }

      if (deliveryRequired && (!deliveryAddress.trim() || !deliveryTimeLocal)) {
        throw new Error("Delivery address and delivery time are required.");
      }

      const response = await fetch("/api/public/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: "main",
          start_time: new Date(startTimeLocal).toISOString(),
          customer_name: customerInfo.customer_name.trim(),
          customer_email: customerInfo.customer_email.trim(),
          customer_phone: customerInfo.customer_phone.trim(),
          notes: customerInfo.notes.trim(),
          delivery_required: deliveryRequired,
          delivery_time: deliveryRequired
            ? new Date(deliveryTimeLocal).toISOString()
            : undefined,
          delivery_address: deliveryRequired ? deliveryAddress.trim() : undefined,
          items: selectedItems,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create reservation.");
      }

      const reservationId = payload.reservation?.id;
      const reservationStatus = payload.reservation?.status;
      if (!reservationId) {
        throw new Error("Reservation created but no ID returned.");
      }

      if (reservationStatus === "pending") {
        const depositResponse = await fetch("/api/public/deposit-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservation_id: reservationId }),
        });
        const depositPayload = await depositResponse.json();

        if (!depositResponse.ok) {
          throw new Error(depositPayload.error ?? "Failed to start deposit checkout.");
        }

        if (depositPayload.requires_payment && depositPayload.checkout_url) {
          window.location.href = depositPayload.checkout_url as string;
          return;
        }
      }

      window.location.href = `/reserve/success?id=${encodeURIComponent(reservationId)}`;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to submit reservation."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm text-gray-600">Step {step} of 4</p>
        <h2 className="mt-1 text-xl font-bold text-gray-900">
          {step === 1 && "Choose Items"}
          {step === 2 && "Schedule and Availability"}
          {step === 3 && "Customer Information"}
          {step === 4 && "Review and Reserve"}
        </h2>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4">
          {vehicleTypes.map((vehicleType) => {
            const selectedRuleId = selectedRuleByType[vehicleType.id] ?? "";
            const quantity = quantityByType[vehicleType.id] ?? 0;
            return (
              <div key={vehicleType.id} className="rounded-lg border bg-white p-4">
                <h3 className="font-semibold text-gray-900">{vehicleType.name}</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <select
                    value={selectedRuleId}
                    onChange={(event) =>
                      setSelectedRuleByType((prev) => ({
                        ...prev,
                        [vehicleType.id]: event.target.value,
                      }))
                    }
                    className="rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Select duration</option>
                    {vehicleType.pricing_rules.map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {formatDuration(rule)} - {toCurrency(rule.price_cents)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={quantity}
                    onChange={(event) =>
                      setQuantityByType((prev) => ({
                        ...prev,
                        [vehicleType.id]: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                    className="rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-lg border bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Start time</label>
              <input
                type="datetime-local"
                value={startTimeLocal}
                onChange={(event) => {
                  setStartTimeLocal(event.target.value);
                  setAvailabilityChecked(false);
                  setAvailabilityResults([]);
                }}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleCheckAvailability}
                className="rounded-md border px-4 py-2 text-sm font-medium"
              >
                Check Availability
              </button>
            </div>
          </div>

          <div className="rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={deliveryRequired}
                onChange={(event) => setDeliveryRequired(event.target.checked)}
              />
              Delivery required
            </label>
            {deliveryRequired && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  placeholder="Delivery address"
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  className="rounded-md border px-3 py-2 text-sm"
                />
                <input
                  type="datetime-local"
                  value={deliveryTimeLocal}
                  onChange={(event) => setDeliveryTimeLocal(event.target.value)}
                  className="rounded-md border px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          {availabilityChecked && (
            <div className="space-y-2">
              {availabilityResults.map((result) => {
                const vehicle = vehicleTypes.find((v) => v.id === result.vehicle_type_id);
                const rule = ruleById.get(result.pricing_rule_id);
                return (
                  <div
                    key={`${result.vehicle_type_id}-${result.pricing_rule_id}`}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      result.available
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {vehicle?.name ?? "Item"} ({rule ? formatDuration(rule) : "duration"}) x{" "}
                    {result.quantity}:{" "}
                    {result.available
                      ? `Available (${result.available_count} remaining)`
                      : `Unavailable (${result.available_count} remaining)`}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-3 rounded-lg border bg-white p-4">
          <input
            placeholder="Full name"
            value={customerInfo.customer_name}
            onChange={(event) =>
              setCustomerInfo((prev) => ({ ...prev, customer_name: event.target.value }))
            }
            className="rounded-md border px-3 py-2 text-sm"
          />
          <input
            placeholder="Email (optional)"
            value={customerInfo.customer_email}
            onChange={(event) =>
              setCustomerInfo((prev) => ({ ...prev, customer_email: event.target.value }))
            }
            className="rounded-md border px-3 py-2 text-sm"
          />
          <input
            placeholder="Phone (optional)"
            value={customerInfo.customer_phone}
            onChange={(event) =>
              setCustomerInfo((prev) => ({ ...prev, customer_phone: event.target.value }))
            }
            className="rounded-md border px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Notes (optional)"
            value={customerInfo.notes}
            onChange={(event) =>
              setCustomerInfo((prev) => ({ ...prev, notes: event.target.value }))
            }
            className="rounded-md border px-3 py-2 text-sm"
            rows={4}
          />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 rounded-lg border bg-white p-4">
          <h3 className="font-semibold text-gray-900">Reservation Summary</h3>
          <div className="space-y-2">
            {selectedItems.map((item) => {
              const vehicle = vehicleTypes.find((v) => v.id === item.vehicle_type_id);
              const rule = ruleById.get(item.pricing_rule_id);
              if (!vehicle || !rule) return null;
              return (
                <div
                  key={`${item.vehicle_type_id}-${item.pricing_rule_id}`}
                  className="flex justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{vehicle.name}</p>
                    <p className="text-gray-600">
                      {formatDuration(rule)} x {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium">
                    {toCurrency(rule.price_cents * item.quantity)}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="rounded-md border bg-gray-50 p-3 text-sm">
            <p>
              <span className="font-medium">Start:</span>{" "}
              {startTimeLocal ? new Date(startTimeLocal).toLocaleString() : "-"}
            </p>
            <p>
              <span className="font-medium">Subtotal:</span> {toCurrency(subtotalCents)}
            </p>
            <p>
              <span className="font-medium">Deposit due now:</span>{" "}
              {toCurrency(totalDepositCents)}
            </p>
            <p>
              <span className="font-medium">Customer:</span>{" "}
              {customerInfo.customer_name || "-"}
            </p>
            {deliveryRequired && (
              <p>
                <span className="font-medium">Delivery:</span> {deliveryAddress} at{" "}
                {deliveryTimeLocal ? new Date(deliveryTimeLocal).toLocaleString() : "-"}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}
            className="rounded-md border px-4 py-2 text-sm font-medium"
          >
            Back
          </button>
        )}
        {step < 4 && (
          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              if (step === 1 && selectedItems.length === 0) {
                setErrorMessage("Please select at least one line item.");
                return;
              }
              if (step === 2) {
                if (!availabilityChecked) {
                  setErrorMessage("Please run availability check first.");
                  return;
                }
                if (hasUnavailableItems) {
                  setErrorMessage("Please adjust unavailable items before continuing.");
                  return;
                }
                if (deliveryRequired && (!deliveryAddress.trim() || !deliveryTimeLocal)) {
                  setErrorMessage("Delivery address and delivery time are required.");
                  return;
                }
              }
              if (step === 3 && !customerInfo.customer_name.trim()) {
                setErrorMessage("Customer name is required.");
                return;
              }
              setStep((step + 1) as 1 | 2 | 3 | 4);
            }}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Continue
          </button>
        )}
        {step === 4 && (
          <button
            type="button"
            disabled={submitting}
            onClick={handleCreateReservation}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Creating Reservation..." : "Create Reservation"}
          </button>
        )}
      </div>
    </div>
  );
}
