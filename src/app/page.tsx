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
};

type SearchResponse = {
  query: string;
  count: number;
  results: Recall[];
  error?: string;
};

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<Recall[]>([]);

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
            <p className="font-semibold text-[var(--ok)]">No open recalls found</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              No matching recall records were found for{" "}
              <span className="font-semibold text-[var(--ink)]">{query.trim()}</span>.
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
                  Please schedule service at an authorized Honda garage.
                </p>
              </div>
            </div>
            <div className="table-wrap rounded-xl border border-[var(--line)] overflow-hidden">
              <table className="data">
                <thead>
                  <tr>
                    <th>Reg. No</th>
                    <th>Vin Number</th>
                    <th>Model</th>
                    <th>Recall No.</th>
                    <th>Part Number</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.id}>
                      <td className="font-semibold">{row.reg_no || "—"}</td>
                      <td className="font-mono text-sm">{row.vin_number || "—"}</td>
                      <td>{row.model || "—"}</td>
                      <td>{row.recall_no || "—"}</td>
                      <td>{row.part_number || "—"}</td>
                      <td>{row.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
