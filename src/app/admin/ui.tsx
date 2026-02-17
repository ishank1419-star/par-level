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

  // ✅ Get admin name from profiles
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let adminName = "Admin";
  if (user?.id) {
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    adminName = prof?.full_name ?? "Admin";
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report");

  // ---------- Helpers ----------
  async function fetchAsBase64(url: string) {
    const res = await fetch(url);
    const ab = await res.arrayBuffer();
    return arrayBufferToBase64(ab);
  }

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

  // ---------- Layout ----------
  // columns for the table (starting later)
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

  // ---------- Header area ----------
  // Merge top area for a clean report header
  ws.mergeCells("A1:L1");
  ws.mergeCells("A2:L2");
  ws.mergeCells("A3:L3");

  ws.getRow(1).height = 36;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 18;

  // Title
  ws.getCell("A1").value = "Monthly Observation Report";
  ws.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  ws.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8B0000" } };

  // Subtitle (date + admin)
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);

  ws.getCell("A2").value = `Report Date: ${dateStr}   |   Created by: ${adminName}`;
  ws.getCell("A2").font = { bold: true, size: 11, color: { argb: "FFE0E0E0" } };
  ws.getCell("A2").alignment = { vertical: "middle", horizontal: "center" };
  ws.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2A2A2A" } };

  // Filters info
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

  // Add logo (from public folder)
  // NOTE: This uses the same origin. On localhost and on Vercel it works.
  // If logo fails to load, it will just skip.
  try {
    const logoBase64 = await fetchAsBase64("/logo.png");
    const logoId = wb.addImage({ base64: `data:image/png;base64,${logoBase64}`, extension: "png" });

    // Place logo at top-left area
    ws.addImage(logoId, {
      tl: { col: 0, row: 0 },
      ext: { width: 120, height: 60 },
    });
  } catch {
    // ignore if logo cannot be fetched
  }

  // ---------- Table header row ----------
  const tableHeaderRow = 5; // we start table at row 5
  ws.getRow(4).height = 8;

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

  // ---------- Data rows ----------
  for (let i = 0; i < filteredRows.length; i++) {
    const r = filteredRows[i];
    const rowIndex = tableHeaderRow + 1 + i;

    ws.getRow(rowIndex).height = 75;
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

    // Risk cell coloring (subtle)
    const riskCell = ws.getCell(rowIndex, 6);
    if ((r.risk ?? "") === "High") {
      riskCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "33FF0000" } };
    }

    // Before image (col 11)
    if (r.before_photo_url) {
      const imgId = await pathToImageId(r.before_photo_url);
      if (imgId) {
        ws.addImage(imgId, {
          tl: { col: 10, row: rowIndex - 1 },
          ext: { width: 120, height: 80 },
        });
      } else {
        ws.getCell(rowIndex, 11).value = "No Image";
      }
    } else {
      ws.getCell(rowIndex, 11).value = "-";
    }

    // After image (col 12)
    if (r.after_photo_url) {
      const imgId = await pathToImageId(r.after_photo_url);
      if (imgId) {
        ws.addImage(imgId, {
          tl: { col: 11, row: rowIndex - 1 },
          ext: { width: 120, height: 80 },
        });
      } else {
        ws.getCell(rowIndex, 12).value = "No Image";
      }
    } else {
      ws.getCell(rowIndex, 12).value = "-";
    }
  }

  ws.views = [{ state: "frozen", ySplit: tableHeaderRow }];

  // Footer note
  const footerRow = tableHeaderRow + filteredRows.length + 2;
  ws.mergeCells(`A${footerRow}:L${footerRow}`);
  ws.getCell(`A${footerRow}`).value = "Generated from Par Level Observation System";
  ws.getCell(`A${footerRow}`).alignment = { horizontal: "center" };
  ws.getCell(`A${footerRow}`).font = { italic: true, size: 10, color: { argb: "FFB0B0B0" } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `Monthly_Observation_Report_${dateStr}.xlsx`);
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
