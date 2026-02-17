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

  function resetFilters() {
    setContractor("");
    setRisk("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
  }

  async function refresh() {
    const { data } = await supabase.from("observations").select("*").order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  }

  async function deleteRow(row: Observation) {
    const { error } = await supabase.from("observations").delete().eq("id", row.id);
    if (error) {
      alert(error.message);
      return;
    }
    await refresh();
  }

  // ✅ Delete ALL (calls API route)
  async function deleteAll() {
    const ok = confirm("⚠️ Delete ALL observations and ALL photos?\nThis cannot be undone.");
    if (!ok) return;

    const res = await fetch("/api/admin/purge-observations", { method: "POST" });
    const json = await res.json();

    if (!res.ok) {
      alert(json?.error ?? "Failed");
      return;
    }

    alert(`Done ✅ Deleted photos: ${json.deletedPhotos ?? 0}`);
    await refresh();
  }

  // ✅ Excel Export with images (Private bucket => Signed URLs)
  async function exportToExcel() {
    if (!filteredRows.length) {
      alert("No data to export");
      return;
    }

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Observations");

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

    // Header style
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
    ws.getRow(1).height = 22;
    ws.getRow(1).eachCell((cell: any) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8B0000" } };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    async function pathToImageId(path: string) {
      const { data, error } = await supabase.storage.from("observations").createSignedUrl(path, 60 * 5);
      if (error || !data?.signedUrl) return null;

      const res = await fetch(data.signedUrl);
      if (!res.ok) return null;

      const ab = await res.arrayBuffer();
      const b64 = arrayBufferToBase64(ab);
      const ext = path.toLowerCase().endsWith(".png") ? "png" : "jpeg";

      return wb.addImage({ base64: `data:image/${ext};base64,${b64}`, extension: ext });
    }

    // Rows + images
    for (let i = 0; i < filteredRows.length; i++) {
      const r = filteredRows[i];
      const rowIndex = i + 2;

      ws.addRow({
        item_no: r.item_no ?? "",
        date: r.date ?? "",
        contractor: r.contractor ?? "",
        location: r.location ?? "",
        category: r.category ?? "",
        risk: r.risk ?? "",
        status: r.status ?? "",
        assigned_to: r.assigned_to ?? "",
        observation: r.observation ?? "",
        recommendation: r.recommendation ?? "",
      });

      ws.getRow(rowIndex).height = 70;
      ws.getRow(rowIndex).alignment = { vertical: "top", wrapText: true };

      ws.getRow(rowIndex).eachCell((cell: any) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Before (K)
      if (r.before_photo_url) {
        const imgId = await pathToImageId(r.before_photo_url);
        if (imgId) {
          ws.addImage(imgId, { tl: { col: 10, row: rowIndex - 1 }, ext: { width: 120, height: 80 } });
        } else {
          ws.getCell(`K${rowIndex}`).value = "No Image";
        }
      } else {
        ws.getCell(`K${rowIndex}`).value = "-";
      }

      // After (L)
      if (r.after_photo_url) {
        const imgId = await pathToImageId(r.after_photo_url);
        if (imgId) {
          ws.addImage(imgId, { tl: { col: 11, row: rowIndex - 1 }, ext: { width: 120, height: 80 } });
        } else {
          ws.getCell(`L${rowIndex}`).value = "No Image";
        }
      } else {
        ws.getCell(`L${rowIndex}`).value = "-";
      }
    }

    ws.views = [{ state: "frozen", ySplit: 1 }];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `Observations_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

      <div style={{ position: "fixed", right: 16, bottom: 12, opacity: 0.7, fontSize: 12 }}>Created by Mohand</div>
    </div>
  );
}

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
          Export Excel (with images)
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

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
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
