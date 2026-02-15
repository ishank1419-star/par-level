"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const [fullName, setFullName] = useState(""); // ✅ added
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName, // ✅ saved to user metadata
          },
        },
      });

      setLoading(false);

      if (error) {
        setErr(error.message);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
      return;
    }

    // ✅ Sign in
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#272727", color: "#fff" }}>
      <form onSubmit={onSubmit} style={{ width: 380, border: "1px solid #333", padding: 20, borderRadius: 14, background: "#1f1f1f" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <img src="/logo.png" alt="Company Logo" style={{ height: 70, width: "auto" }} />
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setMode("signin")}
            style={mode === "signin" ? tabActive() : tab()}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            style={mode === "signup" ? tabActive() : tab()}
          >
            Create account
          </button>
        </div>

        {mode === "signup" && (
          <>
            <label style={{ display: "block", marginTop: 10 }}>Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="e.g., Mohammed Alharbi"
              style={input()}
            />
          </>
        )}

        <label style={{ display: "block", marginTop: 12 }}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={input()} />

        <label style={{ display: "block", marginTop: 12 }}>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required style={input()} />

        {err && <p style={{ color: "#ff6b6b", marginTop: 10 }}>{err}</p>}

        <button disabled={loading} style={primaryBtn()}>
          {loading ? (mode === "signup" ? "Creating..." : "Signing in...") : mode === "signup" ? "Create account" : "Sign in"}
        </button>

        <div style={{ position: "relative", height: 30, marginTop: 10 }}>
          <small style={{ position: "absolute", right: 0, bottom: 0, opacity: 0.7 }}>Created By Mohand</small>
        </div>
      </form>
    </div>
  );
}

function input(): React.CSSProperties {
  return {
    width: "100%",
    padding: 10,
    borderRadius: 10,
    border: "1px solid #333",
    background: "#111",
    color: "#fff",
    outline: "none",
    marginTop: 6,
  };
}

function primaryBtn(): React.CSSProperties {
  return {
    width: "100%",
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    border: "1px solid #8b0000",
    background: "#8b0000",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function tab(): React.CSSProperties {
  return {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #444",
    background: "transparent",
    color: "#e0e0e0",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function tabActive(): React.CSSProperties {
  return {
    ...tab(),
    background: "#2f2f2f",
    border: "1px solid #666",
    color: "#fff",
  };
}
