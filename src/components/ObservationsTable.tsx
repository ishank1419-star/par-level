"use client";

import { useMemo, useState } from "react";
import type { Observation } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export function ObservationsTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Observation[];
  onEdit: (row: Observation) => void;
  onDelete?: (row: Observation) => void;
}) {
  const supabase = createSupabaseBrowser();

  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ url: string; title: string } | null>(null);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [signedMap, setSignedMap] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return rows.filter((r) => {
      const s = `${r.item_no ?? ""} ${r.date ?? ""} ${r.contractor ?? ""} ${r.location ?? ""} ${r.category ?? ""} ${r.risk ?? ""} ${
        r.status ?? ""
      } ${r.assigned_to ?? ""} ${r.observation ?? ""} ${r.recommendation ?? ""}`.toLowerCase();
      return s.includes(needle);
    });
  }, [rows, q]);

  async function openImage(path: string | null, title: string) {
    if (!path) return;

    const cached = signedMap[path];
    if (cached) {
      setModal({ url: cached, title });
      return;
    }

    setLoadingPath(path);
    const { data, error } = await supabase.storage.from("observations").createSignedUrl(path, 60 * 5);
    setLoadingPath(null);

    if (error || !data?.signedUrl) {
      alert(error?.message ?? "Failed to load image");
      return;
    }

    setSignedMap((prev) => ({ ...prev, [path]: data.signedUrl }));
    setModal({ url: data.signedUrl, title });
  }

  return (
    <>
      <div style={{ border: "1px solid #333", borderRadius: 14, overflow: "hidden", background: "#2a2a2a" }}>
        {/* Search */}
        <div style={{ padding: 12, background: "#242424", borderBottom: "1px solid #333" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 12,
              border: "1px solid #444",
              background: "#1f1f1f",
              color: "#e0e0e0",
              outline: "none",
            }}
          />
        </div>

        {/* Table */}
        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1300 }}>
            <thead>
              <tr style={{ background: "#1f1f1f" }}>
                {["Item", "Date", "Contractor", "Location", "Category", "Risk", "Status", "Assigned", "Before", "After", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderBottom: "1px solid #333",
                      fontSize: 12,
                      color: "#cfcfcf",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => {
                const beforePath = r.before_photo_url ?? null;
                const afterPath = r.after_photo_url ?? null;

                return (
                  <tr key={r.id}>
                    <td style={cell()}>{r.item_no ?? "-"}</td>
                    <td style={cell()}>{r.date ?? "-"}</td>
                    <td style={cell()}>{r.contractor ?? "-"}</td>
                    <td style={cell()}>{r.location ?? "-"}</td>
                    <td style={cell()}>{r.category ?? "-"}</td>
                    <td style={cell()}>{r.risk ?? "-"}</td>
                    <td style={cell()}>
                      <StatusBadge status={r.status} />
                    </td>
                    <td style={cell()}>{r.assigned_to ?? "-"}</td>

                    <td style={cell()}>
                      {beforePath ? (
                        <button type="button" onClick={() => openImage(beforePath, `Before - Item ${r.item_no ?? ""}`)} style={viewBtn()}>
                          {loadingPath === beforePath ? "Loading..." : "View"}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td style={cell()}>
                      {afterPath ? (
                        <button type="button" onClick={() => openImage(afterPath, `After - Item ${r.item_no ?? ""}`)} style={viewBtn()}>
                          {loadingPath === afterPath ? "Loading..." : "View"}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td style={cell()}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => onEdit(r)} style={editBtn()}>
                          Edit
                        </button>

                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => {
                              const ok = confirm(`Delete item ${r.item_no ?? ""}?`);
                              if (ok) onDelete(r);
                            }}
                            style={deleteBtn()}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: 16, textAlign: "center", color: "#aaa" }}>
                    No rows
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(980px, 96vw)",
              maxHeight: "92vh",
              background: "#1f1f1f",
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid #333",
              display: "flex",
              flexDirection: "column",
              color: "#e0e0e0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: "#242424",
                borderBottom: "1px solid #333",
              }}
            >
              <div style={{ fontWeight: 900 }}>{modal.title}</div>
              <button type="button" onClick={() => setModal(null)} style={closeBtn()}>
                Close
              </button>
            </div>

            <div style={{ padding: 12, overflow: "auto" }}>
              <img
                src={modal.url}
                alt={modal.title}
                style={{ width: "100%", height: "auto", borderRadius: 12, border: "1px solid #333", display: "block" }}
              />
              <div style={{ marginTop: 10, fontSize: 12, color: "#aaa" }}>
                * الرابط مؤقت (Signed URL). إذا انتهت صلاحيته، اضغط View مرة ثانية.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function cell(): React.CSSProperties {
  return {
    padding: 12,
    borderBottom: "1px solid #2f2f2f",
    color: "#e0e0e0",
    fontSize: 13,
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  };
}

function editBtn(): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 10,
    border: "1px solid #8b0000",
    background: "#8b0000",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function deleteBtn(): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 10,
    border: "1px solid #555",
    background: "#1f1f1f",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function viewBtn(): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 10,
    border: "1px solid #555",
    background: "#1f1f1f",
    color: "#e0e0e0",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function closeBtn(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #8b0000",
    background: "#8b0000",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  };
}
