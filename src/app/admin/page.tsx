"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Recall = {
  id: number;
  reg_no: string;
  vin_number: string;
  model: string;
  recall_no: string;
  description: string;
  part_number: string;
  surname: string;
  first_name: string;
  telephone: string;
  city: string;
  done: number;
  sms_sent: number;
  registration_date: string;
  engine_number: string;
};

type RecallGroup = {
  recall_no: string;
  count: number;
};

type MainSection = "overview" | "upload" | "campaigns" | "sms";

const SMS_MAX_LENGTH = 160;

const MAIN_TABS: { id: MainSection; label: string; hint: string }[] = [
  { id: "overview", label: "Overview", hint: "Status at a glance" },
  { id: "upload", label: "Upload", hint: "Excel import" },
  { id: "campaigns", label: "Recall Campaigns", hint: "Edit & manage" },
  { id: "sms", label: "SMS", hint: "Template & send" },
];

function StatusPill({
  yes,
  yesLabel = "Yes",
  noLabel = "No",
}: {
  yes: boolean;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
        yes
          ? "bg-emerald-50 text-[var(--ok)]"
          : "bg-[#eef2f6] text-[var(--muted)]"
      }`}
    >
      {yes ? yesLabel : noLabel}
    </span>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [mainSection, setMainSection] = useState<MainSection>("overview");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [groups, setGroups] = useState<RecallGroup[]>([]);
  const [rows, setRows] = useState<Recall[]>([]);
  const [recallFilter, setRecallFilter] = useState("all");
  const [smsBusyId, setSmsBusyId] = useState<number | null>(null);
  const [smsFeedback, setSmsFeedback] = useState<string | null>(null);
  const [bulkSmsBusy, setBulkSmsBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Omit<Recall, "id"> | null>(null);
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);
  const [smsTemplate, setSmsTemplate] = useState("");
  const [smsTemplateSaving, setSmsTemplateSaving] = useState(false);
  const [smsTemplateMessage, setSmsTemplateMessage] = useState<string | null>(
    null,
  );
  const [smsTemplateError, setSmsTemplateError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const done = rows.filter((r) => r.done).length;
    const smsSent = rows.filter((r) => r.sms_sent).length;
    const withPhone = rows.filter((r) => r.telephone.trim()).length;
    return {
      total: count,
      campaigns: groups.length,
      doneInView: done,
      smsSentInView: smsSent,
      withPhoneInView: withPhone,
      openInView: rows.length - done,
    };
  }, [count, groups.length, rows]);

  const loadSmsTemplate = useCallback(async () => {
    const response = await fetch("/api/admin/sms-template");
    if (response.status === 401) {
      setAuthed(false);
      return;
    }
    const data = await response.json();
    setSmsTemplate(data.template ?? "");
  }, []);

  const loadRecalls = useCallback(
    async (recallNo = recallFilter) => {
      const query =
        recallNo && recallNo !== "all"
          ? `?recallNo=${encodeURIComponent(recallNo)}`
          : "";
      const response = await fetch(`/api/admin/recalls${query}`);
      if (response.status === 401) {
        setAuthed(false);
        return;
      }
      const data = await response.json();
      setCount(data.count ?? 0);
      setGroups(data.groups ?? []);
      setRows(data.rows ?? []);
      setAuthed(true);
    },
    [recallFilter],
  );

  useEffect(() => {
    Promise.all([loadRecalls(), loadSmsTemplate()])
      .catch(() => setAuthed(false))
      .finally(() => setChecking(false));
  }, [loadRecalls, loadSmsTemplate]);

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setLoginError(data.error || "Login failed.");
        return;
      }
      setPassword("");
      setRecallFilter("all");
      setMainSection("overview");
      await Promise.all([loadRecalls("all"), loadSmsTemplate()]);
    } catch {
      setLoginError("Could not reach the server.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function onLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setRows([]);
    setGroups([]);
    setCount(0);
    setRecallFilter("all");
    setMainSection("overview");
    setMessage(null);
    setError(null);
    setSmsFeedback(null);
    setEditingId(null);
    setDraft(null);
    setSmsTemplate("");
    setSmsTemplateMessage(null);
    setSmsTemplateError(null);
  }

  async function saveSmsTemplate(event: FormEvent) {
    event.preventDefault();
    setSmsTemplateSaving(true);
    setSmsTemplateMessage(null);
    setSmsTemplateError(null);

    try {
      const response = await fetch("/api/admin/sms-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: smsTemplate }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSmsTemplateError(data.error || "Could not save template.");
        return;
      }
      setSmsTemplate(data.template ?? smsTemplate);
      setSmsTemplateMessage(data.message || "SMS template saved.");
    } catch {
      setSmsTemplateError("Could not save SMS template.");
    } finally {
      setSmsTemplateSaving(false);
    }
  }

  async function onUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose an Excel file first.");
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Upload failed.");
        return;
      }

      setMessage(data.message || `Added ${data.added} records.`);
      setFile(null);
      await loadRecalls(recallFilter);
    } catch {
      setError("Could not upload the file.");
    } finally {
      setUploading(false);
    }
  }

  async function selectRecallFilter(tab: string) {
    setRecallFilter(tab);
    setEditingId(null);
    setDraft(null);
    await loadRecalls(tab);
  }

  function startEdit(row: Recall) {
    setEditingId(row.id);
    setDraft({
      reg_no: row.reg_no,
      vin_number: row.vin_number,
      model: row.model ?? "",
      recall_no: row.recall_no,
      description: row.description,
      part_number: row.part_number ?? "",
      surname: row.surname,
      first_name: row.first_name,
      telephone: row.telephone,
      city: row.city ?? "",
      registration_date: row.registration_date ?? "",
      engine_number: row.engine_number ?? "",
      done: row.done ? 1 : 0,
      sms_sent: row.sms_sent ? 1 : 0,
    });
    setError(null);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function updateDraft<K extends keyof Omit<Recall, "id">>(
    key: K,
    value: Omit<Recall, "id">[K],
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function saveEdit(id: number) {
    if (!draft) return;
    if (!draft.reg_no.trim() && !draft.vin_number.trim()) {
      setError("Reg. No or Vin Number is required.");
      return;
    }

    setRowBusyId(id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/recalls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not save row.");
        return;
      }
      setMessage("Row updated.");
      setEditingId(null);
      setDraft(null);
      await loadRecalls(recallFilter);
    } catch {
      setError("Could not save row.");
    } finally {
      setRowBusyId(null);
    }
  }

  async function deleteRow(row: Recall) {
    const label = row.reg_no || row.vin_number || `#${row.id}`;
    const confirmed = window.confirm(
      `Are you sure you want to delete this entry?\n\n` +
        `Vehicle: ${label}\n` +
        `Recall No.: ${row.recall_no || "—"}\n\n` +
        `This cannot be undone.`,
    );
    if (!confirmed) return;

    setRowBusyId(row.id);
    setError(null);
    setMessage(null);
    setSmsFeedback(null);
    try {
      const response = await fetch(`/api/admin/recalls/${row.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Could not delete row.");
        return;
      }
      if (editingId === row.id) {
        setEditingId(null);
        setDraft(null);
      }
      const success = `Entry deleted successfully (${label}).`;
      setMessage(success);
      window.alert(success);
      await loadRecalls(recallFilter);
    } catch {
      setError("Could not delete row.");
    } finally {
      setRowBusyId(null);
    }
  }

  async function deleteCampaign() {
    if (recallFilter === "all") {
      setError("Select a specific Recall No. campaign to delete.");
      return;
    }

    const confirmed = window.confirm(
      `Delete the entire recall campaign "${recallFilter}"?\n\n` +
        `This will permanently remove ${rows.length} record${rows.length === 1 ? "" : "s"}.`,
    );
    if (!confirmed) return;

    setCampaignBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recallNo: recallFilter }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not delete campaign.");
        return;
      }
      setMessage(data.message || "Campaign deleted.");
      window.alert(data.message || "Campaign deleted successfully.");
      setEditingId(null);
      setDraft(null);
      setRecallFilter("all");
      await loadRecalls("all");
    } catch {
      setError("Could not delete campaign.");
    } finally {
      setCampaignBusy(false);
    }
  }

  async function sendSms(id: number) {
    const row = rows.find((item) => item.id === id);
    const label = row
      ? row.reg_no || row.vin_number || `#${id}`
      : `#${id}`;
    const phone = row?.telephone?.trim() || "unknown number";

    const confirmed = window.confirm(
      `Are you sure you want to send an SMS?\n\n` +
        `Vehicle: ${label}\n` +
        `Telephone: ${phone}\n` +
        `Recall No.: ${row?.recall_no || "—"}`,
    );
    if (!confirmed) return;

    setSmsBusyId(id);
    setSmsFeedback(null);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      const detail = [
        data.message || data.error || "SMS request finished.",
        data.preview
          ? `Preview (${data.length ?? data.preview.length}/160): ${data.preview}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      setSmsFeedback(detail);
      if (response.ok) {
        const success = data.message || `SMS sent successfully to ${phone}.`;
        setMessage(success);
        window.alert(success);
        await loadRecalls(recallFilter);
      } else {
        window.alert(data.message || data.error || "SMS could not be sent.");
      }
    } catch {
      setSmsFeedback("Could not send SMS request.");
      window.alert("Could not send SMS request.");
    } finally {
      setSmsBusyId(null);
    }
  }

  async function sendBulkSms() {
    if (recallFilter === "all") {
      setSmsFeedback(
        "Select a Recall No. filter in Recall Campaigns first, then send SMS to all owners.",
      );
      setMainSection("campaigns");
      return;
    }

    const withPhone = rows.filter((row) => row.telephone.trim()).length;
    const confirmed = window.confirm(
      `Are you sure you want to send SMS to all owners on campaign "${recallFilter}"?\n\n` +
        `${rows.length} row(s) in this campaign\n` +
        `${withPhone} with a telephone number`,
    );
    if (!confirmed) return;

    setBulkSmsBusy(true);
    setSmsFeedback(null);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/sms/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recallNo: recallFilter }),
      });
      const data = await response.json();
      const detail = data.message || data.error || "Bulk SMS finished.";
      setSmsFeedback(detail);
      if (response.ok || data.sent > 0) {
        setMessage(detail);
        window.alert(detail);
      } else {
        window.alert(detail);
      }
      await loadRecalls(recallFilter);
    } catch {
      setSmsFeedback("Could not send bulk SMS.");
      window.alert("Could not send bulk SMS.");
    } finally {
      setBulkSmsBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="fade-up flex flex-1 items-center justify-center py-20">
        <p className="text-[var(--muted)]">Loading admin…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="fade-up mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
        <p className="brand-mark text-xs font-bold text-[var(--honda-red)]">
          Galatariotis
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl tracking-wide">
          Admin
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          Sign in to upload recalls, manage owners, and send SMS notices.
        </p>
        <form
          onSubmit={onLogin}
          className="panel mt-8 space-y-4 rounded-2xl p-6 sm:p-7"
        >
          <label className="block text-sm font-semibold" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
          {loginError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {loginError}
            </p>
          )}
          <button className="btn btn-primary w-full" disabled={loggingIn}>
            {loggingIn ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="fade-up space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="brand-mark text-xs font-bold text-[var(--honda-red)]">
            Control panel
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl tracking-wide sm:text-5xl">
            Admin
          </h1>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Import Excel data, manage vehicle recalls, and notify owners by SMS.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onLogout} type="button">
          Log out
        </button>
      </header>

      <nav
        className="panel flex flex-wrap gap-2 rounded-2xl p-2"
        role="tablist"
        aria-label="Admin sections"
      >
        {MAIN_TABS.map((tab) => {
          const active = mainSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMainSection(tab.id)}
              className={`min-w-[7.5rem] flex-1 rounded-xl px-4 py-3 text-left transition-all ${
                active
                  ? "bg-[var(--honda-red)] text-white shadow-sm"
                  : "text-[var(--muted)] hover:bg-[#f3f6fa] hover:text-[var(--ink)]"
              }`}
            >
              <span className="block text-sm font-bold">{tab.label}</span>
              <span
                className={`mt-0.5 block text-xs ${
                  active ? "text-white/80" : "text-[var(--muted)]"
                }`}
              >
                {tab.hint}
              </span>
            </button>
          );
        })}
      </nav>

      {mainSection === "overview" && (
        <section className="space-y-5" role="tabpanel">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total records", value: stats.total },
              { label: "Recall campaigns", value: stats.campaigns },
              {
                label: "In current view",
                value: rows.length,
              },
              {
                label: "With phone (view)",
                value: stats.withPhoneInView,
              },
            ].map((card) => (
              <div key={card.label} className="panel rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  {card.label}
                </p>
                <p className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-wide text-[var(--ink)]">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <div className="panel rounded-2xl p-6">
            <h2 className="text-lg font-semibold">Quick actions</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Jump to the task you need.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-white p-4 text-left transition hover:border-[var(--honda-red)]"
                onClick={() => setMainSection("upload")}
              >
                <p className="font-bold">Upload Excel</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Import or update recall rows
                </p>
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-white p-4 text-left transition hover:border-[var(--honda-red)]"
                onClick={() => setMainSection("campaigns")}
              >
                <p className="font-bold">Manage campaigns</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Filter, edit, delete, mark done
                </p>
              </button>
              <button
                type="button"
                className="rounded-xl border border-[var(--line)] bg-white p-4 text-left transition hover:border-[var(--honda-red)]"
                onClick={() => setMainSection("sms")}
              >
                <p className="font-bold">SMS tools</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Edit template and notify owners
                </p>
              </button>
            </div>
          </div>

          {groups.length > 0 && (
            <div className="panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold">Recall campaigns</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {groups.map((group) => (
                  <button
                    key={group.recall_no}
                    type="button"
                    className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--honda-red)] hover:text-[var(--honda-red)]"
                    onClick={() => {
                      setMainSection("campaigns");
                      void selectRecallFilter(group.recall_no);
                    }}
                  >
                    {group.recall_no}{" "}
                    <span className="text-[var(--muted)]">({group.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {mainSection === "upload" && (
        <section className="panel space-y-5 rounded-2xl p-6 sm:p-7" role="tabpanel">
          <div>
            <h2 className="text-xl font-semibold">Upload Excel</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Use the template columns exactly. Re-uploads update matching
              vehicle + Recall No. rows (including Done). New Recall No. values
              are added.
            </p>
          </div>

          <div className="rounded-xl border border-dashed border-[var(--line)] bg-[#f7f9fc] p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Required columns
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--ink)]">
              Reg. No · Vin Number · Model · Recall No. · Description · Part
              Number · Surname · Name · Telephone · City · Done · Registration
              Date · Engine Number
            </p>
            <a
              href="/templates/honda-recalls-upload-template.xlsx"
              download="honda-recalls-upload-template.xlsx"
              className="btn btn-secondary mt-4 px-4 py-2 text-sm"
            >
              Download Excel template
            </a>
          </div>

          <form
            onSubmit={onUpload}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[var(--muted)] file:mr-4 file:rounded-lg file:border-0 file:bg-[#edf1f6] file:px-4 file:py-2 file:font-semibold file:text-[var(--ink)]"
            />
            <button className="btn btn-primary shrink-0" disabled={uploading}>
              {uploading ? "Importing…" : "Upload Excel"}
            </button>
          </form>

          {file && (
            <p className="text-sm text-[var(--muted)]">
              Selected:{" "}
              <span className="font-semibold text-[var(--ink)]">{file.name}</span>
            </p>
          )}

          {message && (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-[var(--ok)]">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3 border-t border-[var(--line)] pt-5">
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => setMainSection("campaigns")}
            >
              View campaigns
            </button>
          </div>
        </section>
      )}

      {mainSection === "campaigns" && (
        <section className="space-y-4" role="tabpanel">
          <div className="panel rounded-2xl p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Recall Campaigns</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Filter by Recall No., then edit, delete rows, or remove a whole
                  campaign.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary px-4 py-2 text-sm"
                  disabled={
                    bulkSmsBusy ||
                    campaignBusy ||
                    recallFilter === "all" ||
                    rows.length === 0
                  }
                  onClick={sendBulkSms}
                >
                  {bulkSmsBusy
                    ? "Sending…"
                    : recallFilter === "all"
                      ? "Pick a campaign to SMS all"
                      : `SMS all on ${recallFilter}`}
                </button>
                <button
                  type="button"
                  className="btn px-4 py-2 text-sm text-white"
                  style={{ background: "#9b1c1c" }}
                  disabled={
                    campaignBusy || recallFilter === "all" || rows.length === 0
                  }
                  onClick={deleteCampaign}
                  title={
                    recallFilter === "all"
                      ? "Select a Recall No. campaign first"
                      : `Delete campaign ${recallFilter}`
                  }
                >
                  {campaignBusy
                    ? "Deleting…"
                    : recallFilter === "all"
                      ? "Pick a campaign to delete"
                      : `Delete campaign`}
                </button>
              </div>
            </div>

            <div
              className="mt-4 flex flex-wrap gap-2"
              role="tablist"
              aria-label="Recall number filters"
            >
              <button
                type="button"
                role="tab"
                aria-selected={recallFilter === "all"}
                onClick={() => selectRecallFilter("all")}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  recallFilter === "all"
                    ? "border-[var(--honda-red)] bg-[var(--honda-red)] text-white"
                    : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--honda-red)] hover:text-[var(--honda-red)]"
                }`}
              >
                All ({count})
              </button>
              {groups.map((group) => (
                <button
                  key={group.recall_no}
                  type="button"
                  role="tab"
                  aria-selected={recallFilter === group.recall_no}
                  onClick={() => selectRecallFilter(group.recall_no)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    recallFilter === group.recall_no
                      ? "border-[var(--honda-red)] bg-[var(--honda-red)] text-white"
                      : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--honda-red)] hover:text-[var(--honda-red)]"
                  }`}
                >
                  {group.recall_no} ({group.count})
                </button>
              ))}
            </div>

            {(message || error || smsFeedback) && (
              <div className="mt-4 space-y-2">
                {message && (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-[var(--ok)]">
                    {message}
                  </p>
                )}
                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </p>
                )}
                {smsFeedback && (
                  <p className="whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-[#f7f9fc] px-4 py-3 text-sm text-[var(--ink)]">
                    {smsFeedback}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="panel overflow-hidden rounded-2xl">
            {rows.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-semibold">No vehicles in this campaign</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Upload an Excel file to populate the table.
                </p>
                <button
                  type="button"
                  className="btn btn-primary mt-4 text-sm"
                  onClick={() => setMainSection("upload")}
                >
                  Go to Upload
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Reg. No</th>
                      <th>Vin Number</th>
                      <th>Model</th>
                      <th>Recall No.</th>
                      <th>Description</th>
                      <th>Part Number</th>
                      <th>Surname</th>
                      <th>Name</th>
                      <th>Telephone</th>
                      <th>City</th>
                      <th>Done</th>
                      <th>Reg. Date</th>
                      <th>Engine No.</th>
                      <th>Actions</th>
                      <th>SMS Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isEditing = editingId === row.id && draft;
                      const busy = rowBusyId === row.id;

                      if (isEditing) {
                        return (
                          <tr key={row.id}>
                            <td>
                              <input
                                className="input px-2 py-2 text-sm"
                                value={draft.reg_no}
                                onChange={(e) =>
                                  updateDraft("reg_no", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input px-2 py-2 font-mono text-sm"
                                value={draft.vin_number}
                                onChange={(e) =>
                                  updateDraft("vin_number", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input px-2 py-2 text-sm"
                                value={draft.model}
                                onChange={(e) =>
                                  updateDraft("model", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input px-2 py-2 text-sm"
                                value={draft.recall_no}
                                onChange={(e) =>
                                  updateDraft("recall_no", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input px-2 py-2 text-sm"
                                value={draft.description}
                                onChange={(e) =>
                                  updateDraft("description", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input px-2 py-2 text-sm"
                                value={draft.part_number}
                                onChange={(e) =>
                                  updateDraft("part_number", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input px-2 py-2 text-sm"
                                value={draft.surname}
                                onChange={(e) =>
                                  updateDraft("surname", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input px-2 py-2 text-sm"
                                value={draft.first_name}
                                onChange={(e) =>
                                  updateDraft("first_name", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input px-2 py-2 text-sm"
                                value={draft.telephone}
                                onChange={(e) =>
                                  updateDraft("telephone", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input px-2 py-2 text-sm"
                                value={draft.city}
                                onChange={(e) =>
                                  updateDraft("city", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <select
                                className="input px-2 py-2 text-sm"
                                value={draft.done ? "1" : "0"}
                                onChange={(e) =>
                                  updateDraft(
                                    "done",
                                    e.target.value === "1" ? 1 : 0,
                                  )
                                }
                              >
                                <option value="0">No</option>
                                <option value="1">Yes</option>
                              </select>
                            </td>
                            <td>
                              <input
                                className="input px-2 py-2 text-sm"
                                value={draft.registration_date}
                                onChange={(e) =>
                                  updateDraft(
                                    "registration_date",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input px-2 py-2 text-sm"
                                value={draft.engine_number}
                                onChange={(e) =>
                                  updateDraft("engine_number", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="btn btn-primary px-3 py-2 text-sm"
                                  disabled={busy}
                                  onClick={() => saveEdit(row.id)}
                                >
                                  {busy ? "Saving…" : "Save"}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary px-3 py-2 text-sm"
                                  disabled={busy}
                                  onClick={cancelEdit}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                            <td>
                              <select
                                className="input px-2 py-2 text-sm"
                                value={draft.sms_sent ? "1" : "0"}
                                onChange={(e) =>
                                  updateDraft(
                                    "sms_sent",
                                    e.target.value === "1" ? 1 : 0,
                                  )
                                }
                              >
                                <option value="0">No</option>
                                <option value="1">Yes</option>
                              </select>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={row.id}>
                          <td className="font-semibold">{row.reg_no || "—"}</td>
                          <td className="font-mono text-sm">
                            {row.vin_number || "—"}
                          </td>
                          <td>{row.model || "—"}</td>
                          <td>{row.recall_no || "—"}</td>
                          <td>{row.description || "—"}</td>
                          <td>{row.part_number || "—"}</td>
                          <td>{row.surname || "—"}</td>
                          <td>{row.first_name || "—"}</td>
                          <td>{row.telephone || "—"}</td>
                          <td>{row.city || "—"}</td>
                          <td>
                            <StatusPill yes={Boolean(row.done)} />
                          </td>
                          <td>{row.registration_date || "—"}</td>
                          <td>{row.engine_number || "—"}</td>
                          <td>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-secondary px-3 py-2 text-sm"
                                disabled={busy || editingId !== null}
                                onClick={() => startEdit(row)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary px-3 py-2 text-sm"
                                disabled={
                                  busy ||
                                  smsBusyId === row.id ||
                                  !row.telephone ||
                                  editingId !== null
                                }
                                onClick={() => sendSms(row.id)}
                                title={
                                  row.telephone
                                    ? "Send recall SMS to this customer"
                                    : "No telephone on this record"
                                }
                              >
                                {smsBusyId === row.id ? "Sending…" : "SMS"}
                              </button>
                              <button
                                type="button"
                                className="btn px-3 py-2 text-sm text-white"
                                style={{ background: "#9b1c1c" }}
                                disabled={busy || editingId !== null}
                                onClick={() => deleteRow(row)}
                              >
                                {busy ? "…" : "Delete"}
                              </button>
                            </div>
                          </td>
                          <td>
                            <StatusPill yes={Boolean(row.sms_sent)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {mainSection === "sms" && (
        <section className="space-y-4" role="tabpanel">
          <div className="panel rounded-2xl p-6 sm:p-7">
            <h2 className="text-xl font-semibold">SMS template</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Max {SMS_MAX_LENGTH} characters. Placeholders:{" "}
              <span className="font-semibold text-[var(--ink)]">
                {"{name} {surname} {owner} {reg} {vin} {model} {recall_no} {description} {part_number} {city} {engine}"}
              </span>
            </p>
            <form onSubmit={saveSmsTemplate} className="mt-4 space-y-3">
              <textarea
                className="input min-h-32 resize-y"
                value={smsTemplate}
                maxLength={SMS_MAX_LENGTH}
                onChange={(e) =>
                  setSmsTemplate(e.target.value.slice(0, SMS_MAX_LENGTH))
                }
                placeholder="Honda recall {recall_no} for {reg}. Please visit an authorized Honda garage."
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p
                  className={`text-sm font-semibold ${
                    smsTemplate.length >= SMS_MAX_LENGTH
                      ? "text-[var(--honda-red)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {smsTemplate.length} / {SMS_MAX_LENGTH} characters
                </p>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={smsTemplateSaving || !smsTemplate.trim()}
                >
                  {smsTemplateSaving ? "Saving…" : "Save template"}
                </button>
              </div>
            </form>
            {smsTemplateMessage && (
              <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-[var(--ok)]">
                {smsTemplateMessage}
              </p>
            )}
            {smsTemplateError && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {smsTemplateError}
              </p>
            )}
          </div>

          <div className="panel rounded-2xl p-6 sm:p-7">
            <h2 className="text-xl font-semibold">Send SMS</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Send to one owner from Recall Campaigns, or message everyone on a
              selected Recall No.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-secondary text-sm"
                onClick={() => setMainSection("campaigns")}
              >
                Open Recall Campaigns to send one-by-one
              </button>
              <button
                type="button"
                className="btn btn-primary text-sm"
                disabled={
                  bulkSmsBusy || recallFilter === "all" || rows.length === 0
                }
                onClick={sendBulkSms}
              >
                {bulkSmsBusy
                  ? "Sending…"
                  : recallFilter === "all"
                    ? "Select a recall filter first"
                    : `Send to all on ${recallFilter}`}
              </button>
            </div>

            {recallFilter !== "all" && (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Current filter:{" "}
                <span className="font-semibold text-[var(--ink)]">
                  {recallFilter}
                </span>{" "}
                · {rows.length} rows · {stats.withPhoneInView} with phone
              </p>
            )}

            {smsFeedback && (
              <p className="mt-4 whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-[#f7f9fc] px-4 py-3 text-sm text-[var(--ink)]">
                {smsFeedback}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
