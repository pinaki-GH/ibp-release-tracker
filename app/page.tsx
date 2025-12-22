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
    const confirmed = window.confirm("Are you sure you want to delete this release?");
    if (!confirmed) return;

    setReleases(prev => prev.filter(r => r.id !== id));

    if (editingRelease?.id === id) {
      setEditingRelease(null);
      setForm({ name: "", product: "", date: "", type: "" });
    }
  };

  /* Base filtered set (year + product) */
  const baseFiltered = releases.filter(r => {
    if (new Date(r.date).getFullYear() !== selectedYear) return false;
    if (productFilter && !r.product.toLowerCase().includes(productFilter.toLowerCase())) return false;
    return true;
  });

  /* Final filtered set (includes type + month) */
  const filteredReleases = baseFiltered.filter(r => {
    if (typeFilter.length && !typeFilter.includes(r.type)) return false;
    if (monthFilter !== null && new Date(r.date).getMonth() !== monthFilter) return false;
    return true;
  });

  /* Counts */
  const releaseTypeCounts = baseFiltered.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  const totalYearCount = baseFiltered.length;

  /* Export year data to Excel (CSV) */
  const exportYearToExcel = () => {
    const header = "Release Name,Product,Date,Year,Month,Release Type\n";

    const rows = baseFiltered
      .map(r => {
        const d = new Date(r.date);
        const month = MONTHS[d.getMonth()];
        const typeName = releaseTypes.find(t => t.id === r.type)?.name || r.type;
        return `"${r.name}","${r.product}","${r.date}","${selectedYear}","${month}","${typeName}"`;
      })
      .join("\n");

    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `IBP_Release_Tracker_${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>IBP Release Tracker</h1>

      {/* Year + Export */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <strong>Year:</strong>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
          {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button onClick={exportYearToExcel}>Export Year to Excel</button>
      </div>

      {/* Add / Edit */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 24 }}>
        <input placeholder="Release Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Product / App" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} />
        <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
          <option value="">Release Type</option>
          {releaseTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
        </select>
        <button onClick={saveRelease}>{editingRelease ? "Update" : "Add"}</button>
      </div>

      {/* Legend */}
      <div style={{ marginBottom: 16 }}>
        <strong>Release Type Legend — Total releases: {totalYearCount}</strong>
        <button onClick={() => setTypeFilter([])} style={{ marginLeft: 12 }}>
          Clear Release Type Filter
        </button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {releaseTypes.map(rt => (
            <button
              key={rt.id}
              onClick={() => setTypeFilter(p => (p.includes(rt.id) ? p.filter(t => t !== rt.id) : [...p, rt.id]))}
              style={{ background: rt.color, padding: "4px 8px", border: "1px solid #ccc" }}
            >
              {rt.name} ({releaseTypeCounts[rt.id] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 24, display: "flex", gap: 8 }}>
        <input placeholder="Filter by product" value={productFilter} onChange={e => setProductFilter(e.target.value)} />
        {productFilter && <button onClick={() => setProductFilter("")}>×</button>}
        <select value={monthFilter ?? ""} onChange={e => setMonthFilter(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Filter by month</option>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        {monthFilter !== null && <button onClick={() => setMonthFilter(null)}>Clear Month</button>}
      </div>

      {/* Results */}
      {monthFilter !== null ? (
        <div>
          <h3>{MONTHS[monthFilter]} {selectedYear}</h3>
          {filteredReleases.map(r => {
            const rt = releaseTypes.find(t => t.id === r.type);
            return (
              <div key={r.id} style={{ background: rt?.color, padding: 8, marginTop: 6, border: "1px solid #ccc" }}>
                <strong>{r.name}</strong>
                <div style={{ fontSize: 12 }}>{r.product} • {r.date} • {rt?.name}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button style={{ fontSize: 12 }} onClick={() => { setEditingRelease(r); setForm(r); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                  <button style={{ fontSize: 12, color: "red" }} onClick={() => deleteRelease(r.id)}>Delete</button>
                </div>
              </div>
            );
          })}
          {filteredReleases.length === 0 && <div style={{ fontSize: 12, color: "#999" }}>No releases</div>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {MONTHS.map((month, index) => (
            <div key={month} style={{ border: "1px solid #ccc", padding: 12 }}>
              <strong>{month} {selectedYear}</strong>
              {filteredReleases.filter(r => new Date(r.date).getMonth() === index).map(r => {
                const rt = releaseTypes.find(t => t.id === r.type);
                return (
                  <div key={r.id} style={{ background: rt?.color, padding: 6, marginTop: 6 }}>
                    <strong>{r.name}</strong>
                    <div style={{ fontSize: 12 }}>{r.product} • {r.date}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button style={{ fontSize: 12 }} onClick={() => { setEditingRelease(r); setForm(r); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                      <button style={{ fontSize: 12, color: "red" }} onClick={() => deleteRelease(r.id)}>Delete</button>
                    </div>
                  </div>
                );
              })}
              {filteredReleases.filter(r => new Date(r.date).getMonth() === index).length === 0 && <div style={{ fontSize: 12, color: "#999" }}>No releases</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
