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

/* -----------------------------
   Types
------------------------------ */
interface ReleaseItem {
  id: number;
  name: string;
  product: string;
  date: string;
  type: string;
}

/* -----------------------------
   Main App Component
------------------------------ */
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

  /* NEW (Option D): toggle for Executive Summary */
  const [showExecSummary, setShowExecSummary] = useState(false);

  const storageKey = `releaseTracker:${selectedYear}`;

  /* Load data */
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

  /* Persist data */
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(releases));
  }, [releases, storageKey]);

  /* Add / Update */
  const saveRelease = () => {
    if (!form.name || !form.date || !form.type) return;

    if (editingRelease) {
      setReleases(prev =>
        prev.map(r => (r.id === editingRelease.id ? { ...editingRelease, ...form } : r))
      );
      setEditingRelease(null);
    } else {
      setReleases(prev => [...prev, { ...form, id: Date.now() } as ReleaseItem]);
    }

    setForm({ name: "", product: "", date: "", type: "" });
  };

  /* Delete */
  const deleteRelease = (id: number) => {
    if (!window.confirm("Delete this release?")) return;
    setReleases(prev => prev.filter(r => r.id !== id));
  };

  /* Base filtered set (YEAR + PRODUCT only — IMPORTANT) */
  const baseFiltered = releases.filter(r => {
    if (new Date(r.date).getFullYear() !== selectedYear) return false;
    if (productFilter && !r.product.toLowerCase().includes(productFilter.toLowerCase())) return false;
    return true;
  });

  /* Final filtered set (calendar/list UI only) */
  const filteredReleases = baseFiltered.filter(r => {
    if (typeFilter.length && !typeFilter.includes(r.type)) return false;
    if (monthFilter !== null && new Date(r.date).getMonth() !== monthFilter) return false;
    return true;
  });

  /* Counts */
  const totalYearCount = baseFiltered.length;

  /* ==============================
     OPTION D — EXECUTIVE SUMMARY
     (READ-ONLY, ISOLATED)
  ============================== */

  const execSummaryByMonth = MONTHS.map((month, idx) => {
    const items = baseFiltered.filter(
      r => new Date(r.date).getMonth() === idx
    );

    const byType = releaseTypes.map(rt => {
      const count = items.filter(r => r.type === rt.id).length;
      const pct = items.length ? Math.round((count / items.length) * 100) : 0;
      return { ...rt, count, pct };
    });

    return {
      month,
      total: items.length,
      byType
    };
  });

  const overallTopType = (() => {
    const counts: Record<string, number> = {};
    baseFiltered.forEach(r => {
      counts[r.type] = (counts[r.type] || 0) + 1;
    });
    return releaseTypes
      .map(rt => ({ ...rt, count: counts[rt.id] || 0 }))
      .sort((a, b) => b.count - a.count)[0];
  })();

  const avgPerMonth =
    Math.round((totalYearCount / 12) * 10) / 10;

  /* ==============================
     RENDER
  ============================== */

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>IBP Release Tracker</h1>

      {/* Year */}
      <div style={{ marginBottom: 12 }}>
        <strong>Year:</strong>{" "}
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
          {[currentYear - 1, currentYear, currentYear + 1].map(y => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Add */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 16 }}>
        <input placeholder="Release Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Product" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} />
        <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
          <option value="">Type</option>
          {releaseTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
        </select>
        <button onClick={saveRelease}>{editingRelease ? "Update" : "Add"}</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input placeholder="Filter by product" value={productFilter} onChange={e => setProductFilter(e.target.value)} />
        <select value={monthFilter ?? ""} onChange={e => setMonthFilter(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <button onClick={() => setTypeFilter([])}>Clear Type</button>
      </div>

      {/* Calendar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {MONTHS.map((m, idx) => (
          <div key={m} style={{ border: "1px solid #ccc", padding: 8 }}>
            <strong>{m}</strong>
            {filteredReleases.filter(r => new Date(r.date).getMonth() === idx).map(r => {
              const rt = releaseTypes.find(t => t.id === r.type);
              return (
                <div key={r.id} style={{ background: rt?.color, padding: 6, marginTop: 6 }}>
                  <strong>{r.name}</strong>
                  <div style={{ fontSize: 12 }}>{r.product} • {r.date}</div>
                  <button onClick={() => deleteRelease(r.id)} style={{ color: "red", fontSize: 12 }}>Delete</button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ==============================
         OPTION D — EXEC SUMMARY UI
      ============================== */}

      <hr style={{ margin: "32px 0" }} />

      <button onClick={() => setShowExecSummary(p => !p)}>
        {showExecSummary ? "Hide Monthly Executive Summary" : "Show Monthly Executive Summary"}
      </button>

      {showExecSummary && (
        <>
          <h2 style={{ marginTop: 16 }}>Monthly Executive Summary</h2>

          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <strong>Total Releases: {totalYearCount}</strong>
            <strong>Avg / Month: {avgPerMonth}</strong>
            {overallTopType && <strong>Top Type: {overallTopType.name}</strong>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {execSummaryByMonth.map(m => (
              <div key={m.month} style={{ border: "1px solid #ccc", padding: 12 }}>
                <strong>{m.month}</strong>
                <div>Total: {m.total}</div>
                {m.byType.filter(t => t.count > 0).map(t => (
                  <div key={t.id} style={{ fontSize: 12, marginTop: 4 }}>
                    {t.name}: {t.count} ({t.pct}%)
                    <div style={{ height: 6, background: "#eee", marginTop: 2 }}>
                      <div style={{ width: `${t.pct}%`, height: 6, background: t.color }} />
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
