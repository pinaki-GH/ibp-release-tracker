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

  const [productFilter, setProductFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [monthFilter, setMonthFilter] = useState<number | null>(null);

  /* ✅ NEW: View toggle */
  const [viewMode, setViewMode] = useState<"tracker" | "executive">("tracker");

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
  // ---- Mandatory field validation ----
  if (!form.name.trim()) {
    alert("Release Name is required.");
    return;
  }

  if (!form.product.trim()) {
    alert("Product / App is required.");
    return;
  }

  if (!form.date) {
    alert("Release Date is required.");
    return;
  }

  if (!form.type) {
    alert("Release Type is required.");
    return;
  }

  // ---- Year validation ----
  const releaseYear = new Date(form.date).getFullYear();
  if (releaseYear !== selectedYear) {
    alert(`Release Date must be within the selected year (${selectedYear}).`);
    return;
  }

  // ---- Duplicate name validation (existing) ----
  const normalizedName = form.name.trim().toLowerCase();
  const duplicate = releases.some(r =>
    r.name.trim().toLowerCase() === normalizedName &&
    r.id !== editingRelease?.id
  );

  if (duplicate) {
    alert("A release with this name already exists for this year.");
    return;
  }

  // ---- Save logic (unchanged) ----
  if (editingRelease) {
    setReleases(prev =>
      prev.map(r =>
        r.id === editingRelease.id ? { ...editingRelease, ...form } : r
      )
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

  /* Filtering */
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
   
/* ======================
     FORM HELPERS (NEW)
     ====================== */
  const clearForm = () => {
    setForm({ name: "", product: "", date: "", type: "" });
  };

  const discardEdit = () => {
    setEditingRelease(null);
    setForm({ name: "", product: "", date: "", type: "" });
  };
   
  /* ======================
     EXECUTIVE SUMMARY DATA
     ====================== */
  const executiveSummary = MONTHS.map((month, idx) => {
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

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>IBP Release Tracker</h1>

      {/* View Toggle */}
      <div style={{ marginBottom: 16 }}>
        <button disabled={viewMode === "tracker"} onClick={() => setViewMode("tracker")}>
          Tracker View
        </button>
        <button
          disabled={viewMode === "executive"}
          onClick={() => setViewMode("executive")}
          style={{ marginLeft: 8 }}
        >
          Executive View
        </button>
      </div>

      {/* =====================
         TRACKER VIEW (INTACT)
         ===================== */}
      {viewMode === "tracker" && (
        <>
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
          <div
  style={{
    display: "grid",
    gridTemplateColumns: "2fr 2fr 1.2fr 1.5fr 1fr 1fr",
    gap: 8,
    marginBottom: 24,
    alignItems: "center"
  }}
>

            <input placeholder="Release Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Product / App" value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} />
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="">Release Type</option>
              {releaseTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
            </select>
            <button onClick={saveRelease}>
  {editingRelease ? "Update" : "Add"}
</button>

{editingRelease ? (
  <button
    onClick={discardEdit}
    style={{ background: "#f3f4f6" }}
  >
    Discard
  </button>
) : (
  <button
    onClick={clearForm}
    style={{ background: "#f3f4f6" }}
  >
    Clear
  </button>
)}

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
                  onClick={() =>
                    setTypeFilter(p => (p.includes(rt.id) ? p.filter(t => t !== rt.id) : [...p, rt.id]))
                  }
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
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* =====================
         EXECUTIVE VIEW (% BAR)
         ===================== */}
      {viewMode === "executive" && (
        <>
          <h2>Monthly Executive Summary</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {executiveSummary.map(m => (
              <div key={m.month} style={{ border: "1px solid #ccc", padding: 12 }}>
                <strong>{m.month}</strong>
                <div>Total Releases: {m.total}</div>

                {m.byType.map(t => (
                  <div key={t.id} style={{ marginTop: 6 }}>
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
