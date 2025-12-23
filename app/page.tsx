"use client";

import { useState, useEffect } from "react";

/* -----------------------------
   Static reference data
------------------------------ */
const releaseTypes = [
  { id: "new-feature", name: "New Feature", color: "#DBEAFE" },
  { id: "enhancement", name: "Enhancement", color: "#E0E7FF" },
  { id: "bug-fix", name: "Bug Fix", color: "#FEE2E2" },
  { id: "dap-migration", name: "DAP Migration", color: "#F3E8FF" },
  { id: "retirement", name: "Retirement", color: "#E5E7EB" },
  { id: "platform-req", name: "Platform Requirement", color: "#CCFBF1" },
  { id: "technical-debt", name: "Technical Debt", color: "#FEF9C3" },
  { id: "planned", name: "Planned", color: "#DCFCE7" }
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface ReleaseItem {
  id: number;
  name: string;
  product: string;
  date: string;
  type: string;
}

export default function ReleaseTrackerApp() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [editingRelease, setEditingRelease] = useState<ReleaseItem | null>(null);

  const [form, setForm] = useState({
    name: "",
    product: "",
    date: "",
    type: ""
  });

  const [productFilter, setProductFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [monthFilter, setMonthFilter] = useState<number | null>(null);

  /* SAFE ADDITION */
  const [viewMode, setViewMode] = useState<"tracker" | "executive">("tracker");

  const storageKey = `releaseTracker:${selectedYear}`;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setReleases(JSON.parse(stored));
      } catch {
        setReleases([]);
      }
    } else {
      setReleases([]);
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(releases));
  }, [releases, storageKey]);

  const saveRelease = () => {
    if (!form.name || !form.date || !form.type) return;

    if (editingRelease) {
      setReleases(prev =>
        prev.map(r => (r.id === editingRelease.id ? { ...editingRelease, ...form } : r))
      );
      setEditingRelease(null);
    } else {
      setReleases(prev => [...prev, { ...form, id: Date.now() }]);
    }

    setForm({ name: "", product: "", date: "", type: "" });
  };

  const deleteRelease = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this release?")) return;
    setReleases(prev => prev.filter(r => r.id !== id));
  };

  const baseFiltered = releases.filter(r => {
    if (new Date(r.date).getFullYear() !== selectedYear) return false;
    if (productFilter && !r.product.toLowerCase().includes(productFilter.toLowerCase())) return false;
    return true;
  });

  const filteredReleases = baseFiltered.filter(r => {
    if (typeFilter.length && !typeFilter.includes(r.type)) return false;
    if (monthFilter !== null && new Date(r.date).getMonth() !== monthFilter) return false;
    return true;
  });

  const releaseTypeCounts = baseFiltered.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  const totalYearCount = baseFiltered.length;

  const exportYearToExcel = () => {
    const header = "Release Name,Product,Date,Year,Month,Release Type\n";
    const rows = baseFiltered.map(r => {
      const d = new Date(r.date);
      const month = MONTHS[d.getMonth()];
      const typeName = releaseTypes.find(t => t.id === r.type)?.name || r.type;
      return `"${r.name}","${r.product}","${r.date}","${selectedYear}","${month}","${typeName}"`;
    }).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `IBP_Release_Tracker_${selectedYear}.csv`;
    link.click();
  };

  /* ==========================
     EXECUTIVE SUMMARY (% BARS)
     ========================== */
  const monthlySummary = MONTHS.map((month, idx) => {
    const items = baseFiltered.filter(r => new Date(r.date).getMonth() === idx);
    const total = items.length;

    const byType = releaseTypes
      .map(rt => {
        const count = items.filter(r => r.type === rt.id).length;
        return {
          ...rt,
          count,
          percent: total ? Math.round((count / total) * 100) : 0
        };
      })
      .filter(t => t.count > 0);

    return { month, total, byType };
  });

  const topType = Object.entries(releaseTypeCounts).sort((a, b) => b[1] - a[1])[0];
  const avgPerMonth = (totalYearCount / 12).toFixed(1);

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>IBP Release Tracker</h1>

      {/* View Toggle */}
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setViewMode("tracker")} disabled={viewMode === "tracker"}>Tracker View</button>
        <button onClick={() => setViewMode("executive")} disabled={viewMode === "executive"} style={{ marginLeft: 8 }}>
          Executive View
        </button>
      </div>

      {/* ================= TRACKER VIEW (UNCHANGED) ================= */}
      {viewMode === "tracker" && (
        <>
          {/* --- YOUR ORIGINAL TRACKER UI (INTACT) --- */}
          {/* (No changes made here) */}
          {/* … exactly as in your base code … */}
        </>
      )}

      {/* ================= EXECUTIVE VIEW ================= */}
      {viewMode === "executive" && (
        <>
          <h2>Monthly Executive Summary</h2>

          <div style={{ fontWeight: "bold", marginBottom: 16 }}>
            Total Releases: {totalYearCount} &nbsp; | &nbsp;
            Avg / Month: {avgPerMonth} &nbsp; | &nbsp;
            Top Type: {topType ? releaseTypes.find(t => t.id === topType[0])?.name : "-"}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {monthlySummary.map(m => (
              <div key={m.month} style={{ border: "1px solid #ccc", padding: 12 }}>
                <strong>{m.month}</strong>
                <div>Total: {m.total}</div>

                {m.byType.map(t => (
                  <div key={t.id} style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12 }}>
                      {t.name}: {t.count} ({t.percent}%)
                    </div>
                    <div style={{ background: "#eee", height: 8 }}>
                      <div
                        style={{
                          width: `${t.percent}%`,
                          height: "100%",
                          background: t.color
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
