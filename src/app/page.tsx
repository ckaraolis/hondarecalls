"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Recall = {
  id: number;
  reg_no: string;
  vin_number: string;
  model: string;
  recall_no: string;
  description: string;
  part_number: string;
  done: number;
};

type SearchResponse = {
  query: string;
  count: number;
  results: Recall[];
  error?: string;
};

type AppointmentForm = {
  email: string;
  name: string;
  telephone: string;
  city: string;
  reg_no: string;
  odometer_km: string;
};

const emptyAppointmentForm: AppointmentForm = {
  email: "",
  name: "",
  telephone: "",
  city: "",
  reg_no: "",
  odometer_km: "",
};

function RequiredMark() {
  return (
    <span className="text-red-600" aria-hidden="true">
      {" "}
      *
    </span>
  );
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<Recall[]>([]);
  const [appointmentRecall, setAppointmentRecall] = useState<Recall | null>(
    null,
  );
  const [appointmentForm, setAppointmentForm] =
    useState<AppointmentForm>(emptyAppointmentForm);
  const [appointmentTouched, setAppointmentTouched] = useState(false);
  const [appointmentBusy, setAppointmentBusy] = useState(false);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [appointmentMessage, setAppointmentMessage] = useState<string | null>(
    null,
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSearched(false);

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query.trim())}`,
      );
      const data = (await response.json()) as SearchResponse;

      if (!response.ok) {
        setResults([]);
        setError(data.error || "Search failed.");
        return;
      }

      setResults(data.results);
      setSearched(true);
    } catch {
      setResults([]);
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function openAppointment(recall: Recall) {
    setAppointmentRecall(recall);
    setAppointmentForm({
      ...emptyAppointmentForm,
      reg_no: recall.reg_no || query.trim().toUpperCase(),
    });
    setAppointmentTouched(false);
    setAppointmentError(null);
    setAppointmentMessage(null);
  }

  function closeAppointment() {
    setAppointmentRecall(null);
    setAppointmentForm(emptyAppointmentForm);
    setAppointmentTouched(false);
    setAppointmentError(null);
    setAppointmentBusy(false);
  }

  function updateAppointmentField(
    key: keyof AppointmentForm,
    value: string,
  ) {
    setAppointmentForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmitAppointment(event: FormEvent) {
    event.preventDefault();
    if (!appointmentRecall) return;

    setAppointmentTouched(true);
    const email = appointmentForm.email.trim();
    const name = appointmentForm.name.trim();
    const telephone = appointmentForm.telephone.trim();
    const city = appointmentForm.city.trim();
    const regNo = appointmentForm.reg_no.trim();
    const odometerKm = appointmentForm.odometer_km.trim();

    if (!email || !name || !telephone || !city || !regNo || !odometerKm) {
      setAppointmentError("Please fill in all required fields.");
      return;
    }
    if (!/^\d+$/.test(odometerKm)) {
      setAppointmentError("Odometer KM must be a whole number.");
      return;
    }

    setAppointmentBusy(true);
    setAppointmentError(null);
    setAppointmentMessage(null);
    try {
      const response = await fetch("/api/appointment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          telephone,
          city,
          reg_no: regNo,
          odometer_km: odometerKm,
          recall_id: appointmentRecall.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAppointmentError(data.error || "Could not send appointment request.");
        return;
      }
      setAppointmentMessage(data.message || "Appointment request sent.");
      setTimeout(() => closeAppointment(), 1800);
    } catch {
      setAppointmentError("Could not send appointment request.");
    } finally {
      setAppointmentBusy(false);
    }
  }

  function fieldInvalid(value: string) {
    return appointmentTouched && !value.trim();
  }

  return (
    <div className="flex flex-1 flex-col justify-center gap-8">
      <aside className="fade-up rounded-2xl border border-[var(--line)] bg-white/80 px-5 py-4 text-sm leading-relaxed text-[var(--ink)] shadow-sm sm:px-6">
        <p>
          Want direct information about your vehicle when a new recall is
          uploaded?{" "}
          <Link
            href="/register"
            className="font-semibold text-[var(--honda-red)] underline underline-offset-2 hover:text-[var(--honda-red-dark)]"
          >
            Create an account
          </Link>{" "}
          to stay informed.
        </p>
      </aside>

      <section className="fade-up max-w-2xl">
        <p className="brand-mark text-xs font-bold text-[var(--honda-red)]">
          Official garage action
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-5xl leading-[0.95] tracking-wide text-[var(--ink)] sm:text-6xl">
          Check your Honda recall status
        </h1>
        <p className="mt-4 max-w-xl text-lg text-[var(--muted)]">
          Enter your VIN or registration number to see if an authorized Honda
          garage needs to complete a recall on your vehicle.
        </p>
      </section>

      <section className="fade-up-delay panel rounded-2xl p-5 sm:p-7">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="vehicle-query">
            VIN or registration number
          </label>
          <input
            id="vehicle-query"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="VIN number or Reg. No"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn btn-primary shrink-0" disabled={loading}>
            {loading ? "Searching…" : "Search recalls"}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {searched && results.length === 0 && !error && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <p className="font-semibold text-[var(--ok)]">No recalls found</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              No matching recall records were found for{" "}
              <span className="font-semibold text-[var(--ink)]">
                {query.trim()}
              </span>
              .
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="font-semibold text-[var(--warn)]">
                  {results.length} recall{results.length === 1 ? "" : "s"} found
                </p>
                <p className="text-sm text-[var(--muted)]">
                  Pending recalls can be booked with an appointment request.
                </p>
              </div>
            </div>
            <div className="table-wrap overflow-hidden rounded-xl border border-[var(--line)]">
              <table className="data">
                <thead>
                  <tr>
                    <th>Car Number</th>
                    <th>Recall No.</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => {
                    const status = row.done ? "Completed" : "Pending";
                    return (
                      <tr key={row.id}>
                        <td className="font-semibold">{row.reg_no || "—"}</td>
                        <td>{row.recall_no || "—"}</td>
                        <td>{row.description || "—"}</td>
                        <td>
                          <span
                            className={`font-semibold ${
                              row.done
                                ? "text-[var(--ok)]"
                                : "text-[var(--warn)]"
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td>
                          {!row.done && (
                            <button
                              type="button"
                              className="btn btn-primary px-3 py-2 text-sm"
                              onClick={() => openAppointment(row)}
                            >
                              Request for Appointment
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {appointmentRecall && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-appointment-title"
          onClick={(event) => {
            if (event.target === event.currentTarget && !appointmentBusy) {
              closeAppointment();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2
                id="guest-appointment-title"
                className="text-xl font-semibold tracking-tight"
              >
                Appointment Request
              </h2>
              <button
                type="button"
                className="btn btn-secondary px-3 py-2 text-sm"
                onClick={closeAppointment}
                disabled={appointmentBusy}
              >
                Close
              </button>
            </div>

            <form onSubmit={onSubmitAppointment} className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    className="mb-1 block text-sm font-semibold"
                    htmlFor="guest_email"
                  >
                    Email
                    <RequiredMark />
                  </label>
                  <input
                    id="guest_email"
                    type="email"
                    className={`input ${
                      fieldInvalid(appointmentForm.email)
                        ? "border-red-500 focus:border-red-500"
                        : ""
                    }`}
                    value={appointmentForm.email}
                    onChange={(e) =>
                      updateAppointmentField("email", e.target.value)
                    }
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-sm font-semibold"
                    htmlFor="guest_name"
                  >
                    Name
                    <RequiredMark />
                  </label>
                  <input
                    id="guest_name"
                    className={`input ${
                      fieldInvalid(appointmentForm.name)
                        ? "border-red-500 focus:border-red-500"
                        : ""
                    }`}
                    value={appointmentForm.name}
                    onChange={(e) =>
                      updateAppointmentField("name", e.target.value)
                    }
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-sm font-semibold"
                    htmlFor="guest_telephone"
                  >
                    Telephone
                    <RequiredMark />
                  </label>
                  <input
                    id="guest_telephone"
                    className={`input ${
                      fieldInvalid(appointmentForm.telephone)
                        ? "border-red-500 focus:border-red-500"
                        : ""
                    }`}
                    value={appointmentForm.telephone}
                    onChange={(e) =>
                      updateAppointmentField("telephone", e.target.value)
                    }
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-sm font-semibold"
                    htmlFor="guest_city"
                  >
                    City
                    <RequiredMark />
                  </label>
                  <input
                    id="guest_city"
                    className={`input ${
                      fieldInvalid(appointmentForm.city)
                        ? "border-red-500 focus:border-red-500"
                        : ""
                    }`}
                    value={appointmentForm.city}
                    onChange={(e) =>
                      updateAppointmentField("city", e.target.value)
                    }
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-sm font-semibold"
                    htmlFor="guest_reg_no"
                  >
                    Car Number
                    <RequiredMark />
                  </label>
                  <input
                    id="guest_reg_no"
                    className={`input ${
                      fieldInvalid(appointmentForm.reg_no)
                        ? "border-red-500 focus:border-red-500"
                        : ""
                    }`}
                    value={appointmentForm.reg_no}
                    onChange={(e) =>
                      updateAppointmentField("reg_no", e.target.value)
                    }
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold">
                    Recall Number
                    <RequiredMark />
                  </label>
                  <input
                    className="input"
                    value={appointmentRecall.recall_no || ""}
                    readOnly
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold">
                  Description
                  <RequiredMark />
                </label>
                <textarea
                  className="input min-h-[5rem] resize-y"
                  value={appointmentRecall.description || ""}
                  readOnly
                  required
                />
              </div>

              <div>
                <label
                  className="mb-1 block text-sm font-semibold"
                  htmlFor="guest_odometer_km"
                >
                  Current Odometer KM
                  <RequiredMark />
                </label>
                <input
                  id="guest_odometer_km"
                  className={`input ${
                    fieldInvalid(appointmentForm.odometer_km)
                      ? "border-red-500 focus:border-red-500"
                      : ""
                  }`}
                  inputMode="numeric"
                  value={appointmentForm.odometer_km}
                  onChange={(e) =>
                    updateAppointmentField(
                      "odometer_km",
                      e.target.value.replace(/[^\d]/g, ""),
                    )
                  }
                  required
                  aria-required="true"
                />
              </div>

              {appointmentError && (
                <p className="text-sm text-red-700">{appointmentError}</p>
              )}
              {appointmentMessage && (
                <p className="text-sm text-[var(--ok)]">{appointmentMessage}</p>
              )}

              <button
                type="submit"
                className="btn btn-primary w-full sm:w-auto"
                disabled={appointmentBusy}
              >
                {appointmentBusy ? "Sending…" : "Send request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
