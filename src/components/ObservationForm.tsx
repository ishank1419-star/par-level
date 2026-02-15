"use client";

import { useMemo, useState } from "react";
import type { Observation, RiskLevel, ObsStatus } from "@/lib/types";
import { ASSIGNED_TO, CATEGORIES, CONTRACTORS, LOCATIONS, RISK_LEVELS, STATUSES } from "@/lib/constants";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type FormState = {
  id?: string;
  date: string;
  contractor: string;
  location: string;
  category: string;
  risk: RiskLevel;
  observation: string;
  recommendation: string;
  assigned_to: string;
  status: ObsStatus;
  before_photo_url?: string | null;
  after_photo_url?: string | null;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function uploadPhoto(file: File, kind: "before" | "after") {
  const supabase = createSupabaseBrowser();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/${kind}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("observations").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  // نخزن path (أفضل للـ private buckets)
  return path;
}

export function ObservationForm({
  initial,
  mode,
  ownerUserIdForAdmin,
  onSaved,
  onCancel,
}: {
  initial?: Observation | null;
  mode: "create" | "edit";
  ownerUserIdForAdmin?: string; // للأدمن لو يبي يحدد موظف
  onSaved: () => void;
  onCancel: () => void;
}) {
  const supabase = createSupabaseBrowser();

  const init: FormState = useMemo(() => {
    if (initial) {
      return {
        id: initial.id,
        date: initial.date,
        contractor: initial.contractor,
        location: initial.location,
        category: initial.category,
        risk: initial.risk,
        observation: initial.observation ?? "",
        recommendation: initial.recommendation ?? "",
        assigned_to: initial.assigned_to ?? "",
        status: initial.status,
        before_photo_url: initial.before_photo_url,
        after_photo_url: initial.after_photo_url,
      };
    }
    return {
      date: todayISO(),
      contractor: CONTRACTORS[0],
      location: LOCATIONS[0],
      category: CATEGORIES[0],
      risk: "Medium",
      observation: "",
      recommendation: "",
      assigned_to: ASSIGNED_TO[0],
      status: "Open",
    };
  }, [initial]);

  const [s, setS] = useState<FormState>(init);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    setLoading(true);

    try {
      // owner_user_id:
      let owner_user_id: string | null = ownerUserIdForAdmin ?? null;
      if (!owner_user_id) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        owner_user_id = user.id;
      }

      if (mode === "create") {
        const { error } = await supabase.from("observations").insert({
          date: s.date,
          contractor: s.contractor,
          location: s.location,
          category: s.category,
          risk: s.risk,
          observation: s.observation || null,
          before_photo_url: s.before_photo_url ?? null,
          after_photo_url: s.after_photo_url ?? null,
          recommendation: s.recommendation || null,
          assigned_to: s.assigned_to || null,
          status: s.status,
          owner_user_id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("observations").update({
          date: s.date,
          contractor: s.contractor,
          location: s.location,
          category: s.category,
          risk: s.risk,
          observation: s.observation || null,
          before_photo_url: s.before_photo_url ?? null,
          after_photo_url: s.after_photo_url ?? null,
          recommendation: s.recommendation || null,
          assigned_to: s.assigned_to || null,
          status: s.status,
        }).eq("id", s.id!);
        if (error) throw error;
      }

      onSaved();
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(kind: "before" | "after", file: File | null) {
    if (!file) return;
    setErr(null);
    setLoading(true);
    try {
      const path = await uploadPhoto(file, kind);
      setS((prev) => ({
        ...prev,
        [kind === "before" ? "before_photo_url" : "after_photo_url"]: path,
      }));
    } catch (e: any) {
      setErr(e?.message ?? "Upload error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: "1px solid #911616", borderRadius: 14, padding: 14, background: "#880909" }}>
      <h3 style={{ marginTop: 0 }}>{mode === "create" ? "New Observation" : "Edit Observation"}</h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <Field label="Date">
          <input value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} type="date" style={inp()} />
        </Field>

        <Field label="Contractor">
          <select value={s.contractor} onChange={(e) => setS({ ...s, contractor: e.target.value })} style={inp()}>
            {CONTRACTORS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>

        <Field label="Location">
          <select value={s.location} onChange={(e) => setS({ ...s, location: e.target.value })} style={inp()}>
            {LOCATIONS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>

        <Field label="Category">
          <select value={s.category} onChange={(e) => setS({ ...s, category: e.target.value })} style={inp()}>
            {CATEGORIES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>

        <Field label="Risk">
          <select value={s.risk} onChange={(e) => setS({ ...s, risk: e.target.value as any })} style={inp()}>
            {RISK_LEVELS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>

        <Field label="Status">
          <select value={s.status} onChange={(e) => setS({ ...s, status: e.target.value as any })} style={inp()}>
            {STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>

        <Field label="Assigned to">
          <select value={s.assigned_to} onChange={(e) => setS({ ...s, assigned_to: e.target.value })} style={inp()}>
            {ASSIGNED_TO.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>

        <Field label="Before photo">
          <input type="file" accept="image/*" onChange={(e) => handleFile("before", e.target.files?.[0] ?? null)} />
          <small style={{ opacity: 0.75 }}>{s.before_photo_url ? `saved: ${s.before_photo_url}` : "—"}</small>
        </Field>

        <Field label="After photo">
          <input type="file" accept="image/*" onChange={(e) => handleFile("after", e.target.files?.[0] ?? null)} />
          <small style={{ opacity: 0.75 }}>{s.after_photo_url ? `saved: ${s.after_photo_url}` : "—"}</small>
        </Field>
      </div>

      <div style={{ marginTop: 12 }}>
        <Field label="Observation">
          <textarea value={s.observation} onChange={(e) => setS({ ...s, observation: e.target.value })} rows={3} style={inp()} />
        </Field>

        <Field label="Recommendation">
          <textarea value={s.recommendation} onChange={(e) => setS({ ...s, recommendation: e.target.value })} rows={3} style={inp()} />
        </Field>
      </div>

      {err && <p style={{ color: "#ff6b6b" }}>{err}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button disabled={loading} onClick={save} style={btn()}>
          {loading ? "Saving..." : "Save"}
        </button>
        <button disabled={loading} onClick={onCancel} style={btnAlt()}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}

function inp(): React.CSSProperties {
  return { width: "100%", padding: 10, borderRadius: 12, border: "1px solid #333", background: "#111", color: "#fff" };
}

function btn(): React.CSSProperties {
  return { padding: "10px 14px", borderRadius: 12, border: "1px solid #444", background: "#1a1a1a", color: "#fff", fontWeight: 700 };
}

function btnAlt(): React.CSSProperties {
  return { padding: "10px 14px", borderRadius: 12, border: "1px solid #333", background: "transparent", color: "#fff" };
}
