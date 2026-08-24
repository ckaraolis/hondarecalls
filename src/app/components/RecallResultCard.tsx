"use client";

export type RecallResultCardData = {
  id: number;
  reg_no: string;
  recall_no: string;
  description: string;
  done: number;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-[var(--ink)]">
        {value.trim() ? value : "—"}
      </dd>
    </div>
  );
}

export default function RecallResultCard<T extends RecallResultCardData>({
  recall,
  onRequestAppointment,
}: {
  recall: T;
  onRequestAppointment?: (recall: T) => void;
}) {
  const status = recall.done ? "Completed" : "Pending";

  return (
    <article className="rounded-xl border border-[var(--line)] bg-white p-4">
      <dl className="grid gap-3">
        <Field label="Car Number" value={recall.reg_no} />
        <Field label="Recall No." value={recall.recall_no} />
        <Field label="Description" value={recall.description} />
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            Status
          </dt>
          <dd
            className={`mt-1 font-semibold ${
              recall.done ? "text-[var(--ok)]" : "text-[var(--warn)]"
            }`}
          >
            {status}
          </dd>
        </div>
      </dl>
      {!recall.done && onRequestAppointment && (
        <button
          type="button"
          className="btn btn-primary mt-4 w-full px-3 py-2 text-sm"
          onClick={() => onRequestAppointment(recall)}
        >
          Request for Appointment
        </button>
      )}
    </article>
  );
}
