"use client";

import { useEffect, useState } from "react";
import type { Observation } from "@/lib/types";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { ObservationsTable } from "@/components/ObservationsTable";
import { ObservationForm } from "@/components/ObservationForm";

export default function EmployeeClient({ initialRows }: { initialRows: Observation[] }) {
  const supabase = createSupabaseBrowser();
  const [rows, setRows] = useState<Observation[]>(initialRows);
  const [editing, setEditing] = useState<Observation | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const { data } = await supabase.from("observations").select("*").order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  }

  useEffect(() => {
    // realtime اختياري لاحقاً
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#1e1e1e", color: "#e0e0e0", padding: 18 }}>
      <Header
        title="Employee Dashboard"
        onNew={() => {
          setCreating(true);
          setEditing(null);
        }}
      />

      {(creating || editing) && (
        <div style={{ marginBottom: 14 }}>
          <ObservationForm
            mode={creating ? "create" : "edit"}
            initial={editing}
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
        rows={rows}
        onEdit={(r) => {
          setEditing(r);
          setCreating(false);
        }}
      />

      {/* ✅ Created by Mohand */}
      <div style={{ position: "fixed", right: 16, bottom: 12, opacity: 0.7, fontSize: 12 }}>
        Created by Mohand
      </div>
    </div>
  );
}

function Header({ title, onNew }: { title: string; onNew: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
      {/* Logo + Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src="/logo.png" alt="Company Logo" style={{ height: 42, width: "auto" }} />
        <h1 style={{ margin: 0, fontSize: 18 }}>{title}</h1>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <form action="/api/auth/signout" method="post">
          <button type="submit" style={btnAlt()}>
            Sign out
          </button>
        </form>

        <button onClick={onNew} style={btn()}>
          + New
        </button>
      </div>
    </div>
  );
}

function btn(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    background: "#8b0000",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function btnAlt(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #555",
    background: "transparent",
    color: "#e0e0e0",
    fontWeight: 700,
    cursor: "pointer",
  };
}
