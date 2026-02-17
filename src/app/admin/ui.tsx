"use client";

import { useMemo, useState } from "react";
import type { Observation, Profile } from "@/lib/types";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { ObservationsTable } from "@/components/ObservationsTable";
import { ObservationForm } from "@/components/ObservationForm";
import { CONTRACTORS, RISK_LEVELS, STATUSES } from "@/lib/constants";
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

  // Filters
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

  async function refresh() {
    const { data } = await supabase.from("observations").select("*").order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  }

  function resetFilters() {
    setContractor("");
    setRisk("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
  }

  async function deleteRow(row: Observation) {
    const ok = confirm(`Delete observation ${row.item_no ?? ""}?`);
    if (!ok) return;

    const { error } = await supabase.from("observations").delete().eq("id", row.id);
    if (error) {
      alert(error.message);
      return;
    }
    await refresh();
  }

async function deleteAll() {
  const ok = confirm("⚠️ Delete ALL observations and ALL photos?\nThis cannot be undone.");
  if (!ok) return;

  try {
    const res = await fetch("/api/admin/purge-observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}

    if (!res.ok) {
      alert(json?.error ? `Error: ${json.error}` : `Failed: ${res.status}\n${text}`);
      return;
    }

    alert(`Done ✅ Deleted photos: ${json?.deletedPhotos ?? 0}`);
    await refresh();
  } catch (e: any) {
    alert(`Request failed: ${e?.message ?? e}`);
  }
}

    // 1) Get admin name (optional)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let adminName = "Admin";
    if (user?.id) {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      adminName = prof?.full_name ?? "Admin";
    }

    // 2) Load ExcelJS (client-side)
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = adminName;

    const ws = wb.addWorksheet("Observations", {
      views: [{ state: "frozen", ySplit: 6 }],
    });

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);

    // Helper: add nice borders
    function setBorder(rowIndex: number, fromCol: number, toCol: number) {
      for (let c = fromCol; c <= toCol; c++) {
        const cell = ws.getCell(rowIndex, c);
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    }

    // Helper: get image ArrayBuffer
    async function getImageArrayBufferFromValue(value: string): Promise<{ ab: ArrayBuffer; ext: "png" | "jpeg" } | null> {
      try {
        // if it's a full URL already
        if (value.startsWith("http://") || value.startsWith("https://")) {
          const res = await fetch(value);
          if (!res.ok) return null;
          const ab = await res.arrayBuffer();
          const ext = value.toLowerCase().includes(".png") ? "png" : "jpeg";
          return { ab, ext };
        }

        // else assume it's a storage path inside bucket "observations"
        const { data, error } = await supabase.storage.from("observations").createSignedUrl(value, 60 * 10);
        if (error || !data?.signedUrl) return null;

        const res = await fetch(data.signedUrl);
        if (!res.ok) return null;

        const ab = await res.arrayBuffer();
        const ext = value.toLowerCase().endsWith(".png") ? "png" : "jpeg";
        return { ab, ext };
      } catch {
        return null;
      }
    }

    // Build header area
    ws.mergeCells("A1:L1");
    ws.mergeCells("A2:L2");
    ws.mergeCells("A3:L3");

    ws.getRow(1).height = 34;
    ws.getRow(2).height = 22;
    ws.getRow(3).height = 18;

    ws.getCell("A1").value = "Monthly Observation Report";
    ws.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
    ws.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
    ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8B0000" } };

    ws.getCell("A2").value = `Report Date: ${dateStr}   |   Created by: ${adminName}`;
    ws.getCell("A2").font = { bold: true, size: 11, color: { argb: "FFE0E0E0" } };
    ws.getCell("A2").alignment = { vertical: "middle", horizontal: "center" };
    ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2A2A2A" } };

    const filters = [
      contractor ? `Contractor=${contractor}` : null,
      risk ? `Risk=${risk}` : null,
      status ? `Status=${status}` : null,
      dateFrom ? `From=${dateFrom}` : null,
      dateTo ? `To=${dateTo}` : null,
    ]
      .filter(Boolean)
      .join("  |  ");

    ws.getCell("A3").value = filters ? `Filters: ${filters}` : "Filters: None";
    ws.getCell("A3").font = { size: 10, color: { argb: "FFB0B0B0" } };
    ws.getCell("A3").alignment = { vertical: "middle", horizontal: "center" };
    ws.getCell("A3").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F1F1F" } };

    // Columns
    ws.columns = [
      { header: "Item No", key: "item_no", width: 14 },
      { header: "Date", key: "date", width: 12 },
      { header: "Contractor", key: "contractor", width: 18 },
      { header: "Location", key: "location", width: 18 },
      { header: "Category", key: "category", width: 22 },
      { header: "Risk", key: "risk", width: 10 },
      { header: "Status", key: "status", width: 10 },
      { header: "Assigned To", key: "assigned_to", width: 16 },
      { header: "Observation", key: "observation", width: 30 },
      { header: "Recommendation", key: "recommendation", width: 30 },
      { header: "Before Photo", key: "before_img", width: 18 },
      { header: "After Photo", key: "after_img", width: 18 },
    ];

    // Table Header Row
    const tableHeaderRow = 6;
    ws.getRow(4).height = 8;
    ws.getRow(5).height = 8;

    const headers = [
      "Item No",
      "Date",
      "Contractor",
      "Location",
      "Category",
      "Risk",
      "Status",
      "Assigned To",
      "Observation",
      "Recommendation",
      "Before Photo",
      "After Photo",
    ];

    ws.getRow(tableHeaderRow).values = ["", ...headers];
    ws.getRow(tableHeaderRow).height = 22;
    ws.getRow(tableHeaderRow).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(tableHeaderRow).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    ws.getRow(tableHeaderRow).eachCell((cell: any) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3A3A3A" } };
    });
    setBorder(tableHeaderRow, 1, 12);

    // Rows
    for (let i = 0; i < filteredRows.length; i++) {
      const r = filteredRows[i];
      const rowIndex = tableHeaderRow + 1 + i;

      ws.getRow(rowIndex).height = 78;
      ws.getRow(rowIndex).alignment = { vertical: "top", wrapText: true };

      ws.getCell(rowIndex, 1).value = r.item_no ?? "";
      ws.getCell(rowIndex, 2).value = r.date ?? "";
      ws.getCell(rowIndex, 3).value = r.contractor ?? "";
      ws.getCell(rowIndex, 4).value = r.location ?? "";
      ws.getCell(rowIndex, 5).value = r.category ?? "";
      ws.getCell(rowIndex, 6).value = r.risk ?? "";
      ws.getCell(rowIndex, 7).value = r.status ?? "";
      ws.getCell(rowIndex, 8).value = r.assigned_to ?? "";
      ws.getCell(rowIndex, 9).value = r.observation ?? "";
      ws.getCell(rowIndex, 10).value = r.recommendation ?? "";

      setBorder(rowIndex, 1, 12);

      // Before image (col K = 11)
      if (r.before_photo_url) {
        const img = await getImageArrayBufferFromValue(r.before_photo_url);
        if (img) {
          const b64 = arrayBufferToBase64(img.ab);
          const imgId = wb.addImage({
            base64: `data:image/${img.ext};base64,${b64}`,
            extension: img.ext,
          });

          // ExcelJS uses 0-based col/row for image placement
          ws.addImage(imgId, {
            tl: { col: 10, row: rowIndex - 1 },
            ext: { width: 120, height: 80 },
          });
        } else {
          ws.getCell(rowIndex, 11).value = "Image not доступ";
        }
      } else {
        ws.getCell(rowIndex, 11).value = "-";
      }

      // After image (col L = 12)
      if (r.after_photo_url) {
        const img = await getImageArrayBufferFromValue(r.after_photo_url);
        if (img) {
          const b64 = arrayBufferToBase64(img.ab);
          const imgId = wb.addImage({
            base64: `data:image/${img.ext};base64,${b64}`,
            extension: img.ext,
          });

          ws.addImage(imgId, {
            tl: { col: 11, row: rowIndex - 1 },
            ext: { width: 120, height: 80 },
          });
        } else {
          ws.getCell(rowIndex, 12).value = "Image not доступ";
        }
      } else {
        ws.getCell(rowIndex, 12).value = "-";
      }
    }

    // Footer
    const footerRow = tableHeaderRow + filteredRows.length + 2;
    ws.mergeCells(`A${footerRow}:L${footerRow}`);
    ws.getCell(`A${footerRow}`).value = "Generated from Par Level Observation System";
    ws.getCell(`A${footerRow}`).alignment = { horizontal: "center" };
    ws.getCell(`A${footerRow}`).font = { italic: true, size: 10, color: { argb: "FFB0B0B0" } };

    // Export
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, `Monthly_Observation_Report_${dateStr}.xlsx`);
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
        onDeleteAll={deleteAll}
      />

      {/* FILTER BAR */}
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

      <div style={{ position: "fixed", right: 16, bottom: 12, opacity: 0.7, fontSize: 12 }}>Created by Mohand</div>
    </div>
  );
}

/** Header **/
function Header({
  title,
  onNew,
  onExport,
  onDeleteAll,
}: {
  title: string;
  onNew: () => void;
  onExport: () => void;
  onDeleteAll: () => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/logo.png" alt="Company Logo" style={{ height: 42, width: "auto" }} />
        <h1 style={{ margin: 0 }}>{title}</h1>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <form action="/api/auth/signout" method="post">
          <button type="submit" style={btnAlt()}>
            Sign out
          </button>
        </form>

        <Link href="/admin/stats" style={btnLink()}>
          Employee Stats
        </Link>

        <button onClick={onExport} style={btnGray()}>
          Export Excel
        </button>

        <button onClick={onDeleteAll} style={btnDanger()}>
          Delete All
        </button>

        <button onClick={onNew} style={btnPrimary()}>
          + New
        </button>
      </div>
    </div>
  );
}

/** Helpers **/
function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Styles **/
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

function btnAlt(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    background: "transparent",
    color: "#e0e0e0",
    border: "1px solid #555",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function btnLink(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    background: "#2f2f2f",
    color: "#fff",
    border: "1px solid #555",
    fontWeight: 800,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  };
}

function btnGray(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    background: "#3a3a3a",
    color: "#fff",
    border: "1px solid #555",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function btnDanger(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 8,
    background: "#8b0000",
    color: "#fff",
    border: "1px solid #8b0000",
    fontWeight: 900,
    cursor: "pointer",
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 8,
    background: "#8b0000",
    color: "#fff",
    border: "none",
    fontWeight: 800,
    cursor: "pointer",
  };
}
