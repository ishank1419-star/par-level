"use client";

import { useMemo, useState } from "react";
import type { Observation, Profile } from "@/lib/types";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { ObservationsTable } from "@/components/ObservationsTable";
import { ObservationForm } from "@/components/ObservationForm";
import { CONTRACTORS, RISK_LEVELS, STATUSES } from "@/lib/constants";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Link from "next/link";

export default function AdminClient({
  initialRows,
  initialStats,
  employees,
}: {
  initialRows: Observation[];
  initialStats: any;
  employees: Profile[];
}) {
  const supabase = createSupabaseBrowser();

  const [rows, setRows] = useState<Observation[]>(initialRows);
  const [editing, setEditing] = useState<Observation | null>(null);
  const [creating, setCreating] = useState(false);
  const [owner, setOwner] = useState<string>(employees.find((e) => e.role === "employee")?.id ?? "");

  // 🔎 Filters
  const [contractor, setContractor] = useState<string>("");
  const [risk, setRisk] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (contractor && r.contractor !== contractor) return false;
      if (risk && r.risk !== risk) return false;
      if (status && r.status !== status) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    });
  }, [rows, contractor, risk, status, dateFrom, dateTo]);

  function exportToExcel() {
    if (!filteredRows.length) {
      alert("No data to export");
      return;
    }

    const formatted = filteredRows.map((r) => ({
      Item: r.item_no ?? "",
      Date: r.date ?? "",
      Contractor: r.contractor ?? "",
      Location: r.location ?? "",
      Category: r.category ?? "",
      Risk: r.risk ?? "",
      Status: r.status ?? "",
      Assigned: r.assigned_to ?? "",
      Observation: r.observation ?? "",
      Recommendation: r.recommendation ?? "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(formatted);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Observations");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const data = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    saveAs(data, `Observations_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function resetFilters() {
    setContractor("");
    setRisk("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
  }
  async function deleteRow(row: Observation) {
  const { error } = await supabase.from("observations").delete().eq("id", row.id);
  if (error) {
    alert(error.message);
    return;
  }
  await refresh();
}

  async function refresh() {
    const { data } = await supabase
      .from("observations")
      .select("*")
      .order("created_at", { ascending: false });

    setRows((data as any) ?? []);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#1e1e1e", color: "#e0e0e0", padding: 18 }}>
      <Header
        title="Admin Dashboard"
        onNew={() => {
          setCreating(true);
          setEditing(null);
        }}
        onExport={exportToExcel}
      />

      {/* 🔎 FILTER BAR */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 12,
          marginBottom: 20,
          background: "#2a2a2a",
          padding: 15,
          borderRadius: 12,
          border: "1px solid #333",
        }}
      >
        <select value={contractor} onChange={(e) => setContractor(e.target.value)} style={input()}>
          <option value="">All Contractors</option>
          {CONTRACTORS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select value={risk} onChange={(e) => setRisk(e.target.value)} style={input()}>
          <option value="">All Risk</option>
          {RISK_LEVELS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)} style={input()}>
          <option value="">All Status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={input()} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={input()} />

        <button onClick={resetFilters} style={resetBtn()}>
          Reset
        </button>
      </div>

      {/* Create/Edit */}
      {(creating || editing) && (
        <div style={{ marginBottom: 20 }}>
          {creating && (
            <div style={{ marginBottom: 10 }}>
              <select value={owner} onChange={(e) => setOwner(e.target.value)} style={input()}>
                {employees
                  .filter((e) => e.role === "employee")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name ?? e.id}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <ObservationForm
            mode={creating ? "create" : "edit"}
            initial={editing}
            ownerUserIdForAdmin={creating ? owner : undefined}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSaved={async () => {
              setCreating(false);
              setEditing(null);
              await refresh();
            }}
          />
        </div>
      )}

      <ObservationsTable
  rows={filteredRows}
  onEdit={(r) => {
    setEditing(r);
    setCreating(false);
  }}
  onDelete={deleteRow}
/>

      {/* ✅ Created by Mohand */}
      <div style={{ position: "fixed", right: 16, bottom: 12, opacity: 0.7, fontSize: 12 }}>
        Created by Mohand
      </div>
    </div>
  );
}

function Header({
  title,
  onNew,
  onExport,
}: {
  title: string;
  onNew: () => void;
  onExport: () => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/logo.png" alt="Company Logo" style={{ height: 42, width: "auto" }} />
        <h1 style={{ margin: 0 }}>{title}</h1>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {/* Sign out */}
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "transparent",
              color: "#e0e0e0",
              border: "1px solid #555",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </form>
        <Link
  href="/admin/stats"
  style={{
    padding: "10px 14px",
    borderRadius: 8,
    background: "#2f2f2f",
    color: "#fff",
    border: "1px solid #555",
    fontWeight: 800,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  }}
>
  Employee Stats
</Link>

        {/* Export Excel */}
        <button
          onClick={onExport}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "#3a3a3a",
            color: "#fff",
            border: "1px solid #555",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Export Excel
        </button>

        {/* New */}
        <button
          onClick={onNew}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            background: "#8b0000",
            color: "#fff",
            border: "none",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          + New
        </button>
      </div>
    </div>
  );
}

function input(): React.CSSProperties {
  return {
    padding: 8,
    borderRadius: 8,
    border: "1px solid #444",
    background: "#2f2f2f",
    color: "#e0e0e0",
    outline: "none",
  };
}

function resetBtn(): React.CSSProperties {
  return {
    padding: 8,
    borderRadius: 8,
    background: "#444",
    color: "#e0e0e0",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
  };
}
