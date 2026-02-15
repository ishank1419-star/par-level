"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Observation, Profile } from "@/lib/types";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

export default function AdminStatsClient({
  employees,
  rows,
}: {
  employees: Profile[];
  rows: Observation[];
}) {
  const [selected, setSelected] = useState<string>(employees[0]?.id ?? "");

  const empRows = useMemo(() => {
    return rows.filter((r) => r.owner_user_id === selected);
  }, [rows, selected]);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selected);
  }, [employees, selected]);

  const stats = useMemo(() => {
    const riskCounts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    const statusCounts: Record<string, number> = { Open: 0, Close: 0 };
    const categoryCounts: Record<string, number> = {};
    const byMonthCounts: Record<string, { Open: number; Close: number }> = {};

    for (const r of empRows) {
      riskCounts[r.risk] = (riskCounts[r.risk] ?? 0) + 1;
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
      categoryCounts[r.category] = (categoryCounts[r.category] ?? 0) + 1;

      // yyyy-mm
      const month = (r.date || "").slice(0, 7);
      if (month) {
        byMonthCounts[month] ||= { Open: 0, Close: 0 };
        byMonthCounts[month][r.status] += 1;
      }
    }

    const riskData = (["High", "Medium", "Low"] as const).map((k) => ({ name: k, value: riskCounts[k] || 0 }));
    const statusData = (["Open", "Close"] as const).map((k) => ({ name: k, value: statusCounts[k] || 0 }));

    const topCategories = Object.entries(categoryCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const monthTrend = Object.entries(byMonthCounts)
      .map(([month, v]) => ({ month, Open: v.Open, Close: v.Close }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { riskData, statusData, topCategories, monthTrend };
  }, [empRows]);

  return (
    <div style={{ minHeight: "100vh", background: "#1e1e1e", color: "#e0e0e0", padding: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="Company Logo" style={{ height: 42, width: "auto" }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Employee Statistics</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Detailed charts per employee</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            href="/admin"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #555",
              color: "#e0e0e0",
              textDecoration: "none",
            }}
          >
            ← Back
          </Link>

          <form action="/api/auth/signout" method="post">
            <button style={btnAlt()} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Selector */}
      <div style={{ ...card(), marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800 }}>Select employee:</div>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} style={input()}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name ?? e.id}
              </option>
            ))}
          </select>

          <div style={{ marginLeft: "auto", opacity: 0.85 }}>
            Total records: <b>{empRows.length}</b> — {selectedEmployee?.full_name ?? ""}
          </div>
        </div>
      </div>

      {/* Charts grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1.2fr", gap: 12, marginBottom: 12 }}>
        {/* Risk pie */}
        <div style={card()}>
          <div style={cardTitle()}>Risk Distribution</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.riskData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                  {stats.riskData.map((d) => (
                    <Cell
                      key={d.name}
                      fill={d.name === "High" ? "#8b0000" : d.name === "Medium" ? "#666" : "#b0b0b0"}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status bar */}
        <div style={card()}>
          <div style={cardTitle()}>Open vs Close</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value">
                  {stats.statusData.map((d) => (
                    <Cell key={d.name} fill={d.name === "Open" ? "#8b0000" : "#666"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trend line */}
        <div style={card()}>
          <div style={cardTitle()}>Monthly Trend</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Open" stroke="#8b0000" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Close" stroke="#b0b0b0" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top categories */}
      <div style={card()}>
        <div style={cardTitle()}>Top Categories</div>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.topCategories} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={180} />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8b0000" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Created by */}
      <div style={{ position: "fixed", right: 16, bottom: 12, opacity: 0.7, fontSize: 12 }}>
        Created by Mohand
      </div>
    </div>
  );
}

function card(): React.CSSProperties {
  return {
    background: "#2a2a2a",
    border: "1px solid #333",
    borderRadius: 12,
    padding: 12,
    color: "#e0e0e0",
  };
}

function cardTitle(): React.CSSProperties {
  return { fontWeight: 900, marginBottom: 10 };
}

function input(): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #444",
    background: "#2f2f2f",
    color: "#e0e0e0",
    outline: "none",
    minWidth: 280,
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
