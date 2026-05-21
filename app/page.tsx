"use client";

import { useState, useEffect } from "react";

/* -----------------------------
   Static reference data
------------------------------ */
const releaseTypes = [
  { id: "new-feature", name: "New Feature", color: "#2563EB" },
  { id: "enhancement", name: "Enhancement", color: "#7C3AED" },
  { id: "bug-fix", name: "Bug Fix", color: "#DC2626" },
  { id: "dap-migration", name: "DAP Migration", color: "#0D9488" },
  { id: "retirement", name: "Retirement", color: "#374151" },
  { id: "platform-req", name: "Platform Requirement", color: "#F59E0B" },
  { id: "technical-debt", name: "Technical Debt", color: "#1E3A8A" }
];

const releaseStatuses = [
  { id: "planned", name: "Planned", color: "#9CA3AF" },
  { id: "completed", name: "Completed", color: "#16A34A" }
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface ReleaseItem {
  id: number;
  name: string;
  product: string;
  plannedDate: string;
  actualDate?: string;
  type: string;
  status: "planned" | "completed";
}

/* ======================
   AUTO TEXT CONTRAST
   ====================== */
const getContrastingTextColor = (bgColor: string) => {
  const hex = bgColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 160 ? "#000000" : "#FFFFFF";
};

export default function ReleaseTrackerApp() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [editingRelease, setEditingRelease] = useState<ReleaseItem | null>(null);

  const [form, setForm] = useState({
    name: "",
    product: "",
    plannedDate: "",
    actualDate: "",
    type: "",
    status: "planned" as "planned" | "completed"
  });

  const [productFilter, setProductFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"planned" | "completed" | null>(null);
  const [monthFilter, setMonthFilter] = useState<number | null>(null);

  const [viewMode, setViewMode] = useState<"tracker" | "executive">("tracker");

  const [executiveSummaryStatusFilter, setExecutiveSummaryStatusFilter] =
  useState<"planned" | "completed" | null>(null);

  const [productMixStatusFilter, setProductMixStatusFilter] =
  useState<"planned" | "completed" | null>(null);

  const storageKey = `releaseTracker:${selectedYear}`;

  /* Load data */
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as any[];

        const normalized: ReleaseItem[] = parsed.map(r => ({
          ...r,
          plannedDate: r.plannedDate ?? r.date ?? "",
          actualDate: r.actualDate ?? "",
          status: r.status ?? "planned"
        }));

        setReleases(normalized);
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
    if (!form.name.trim()) {
      alert("Release Name is required.");
      return;
    }

    if (!form.product.trim()) {
      alert("Product / App is required.");
      return;
    }

    if (!form.plannedDate) {
      alert("Planned Release Date is required.");
      return;
    }

    if (!form.type) {
      alert("Release Type is required.");
      return;
    }

    if (form.status === "completed" && !form.actualDate) {
      alert("Actual Release Date is required for completed releases.");
      return;
    }

    const releaseYear = new Date(
      form.actualDate || form.plannedDate
    ).getFullYear();

    if (releaseYear !== selectedYear) {
      alert(`Release Date must be within the selected year (${selectedYear}).`);
      return;
    }

    const normalizedName = form.name.trim().toLowerCase();

    const duplicate = releases.some(r =>
      r.name.trim().toLowerCase() === normalizedName &&
      r.id !== editingRelease?.id
    );

    if (duplicate) {
      alert("A release with this name already exists for this year.");
      return;
    }

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

    setForm({
      name: "",
      product: "",
      plannedDate: "",
      actualDate: "",
      type: "",
      status: "planned"
    });
  };

  const deleteRelease = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this release?")) return;
    setReleases(prev => prev.filter(r => r.id !== id));
  };

  /* Filtering */
  const baseFiltered = releases.filter(r => {
    const effectiveDate = r.actualDate || r.plannedDate;

    if (new Date(effectiveDate).getFullYear() !== selectedYear) return false;

    if (
      productFilter &&
      !r.product.toLowerCase().includes(productFilter.toLowerCase())
    ) return false;

    return true;
  });

  const filteredReleases = baseFiltered.filter(r => {
    const effectiveDate = r.actualDate || r.plannedDate;

    if (typeFilter.length && !typeFilter.includes(r.type)) return false;

    if (
      monthFilter !== null &&
      new Date(effectiveDate).getMonth() !== monthFilter
    ) return false;

    if (statusFilter && (r.status ?? "planned") !== statusFilter) return false;

    return true;
  });

  const releaseTypeCounts = baseFiltered.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  const totalYearCount = baseFiltered.length;

  const exportYearToExcel = () => {
    const header =
      "Release Name,Product,Planned Release Date,Actual Release Date,Year,Month,Release Type,Release Status\n";

    const rows = baseFiltered
      .map(r => {
        const effectiveDate = r.actualDate || r.plannedDate;
        const d = new Date(effectiveDate);

        const month = MONTHS[d.getMonth()];

        const typeName =
          releaseTypes.find(t => t.id === r.type)?.name || r.type;

        const statusName =
          r.status === "completed" ? "Completed" : "Planned";

        return `"${r.name}","${r.product}","${r.plannedDate}","${r.actualDate ?? ""}","${selectedYear}","${month}","${typeName}","${statusName}"`;
      })
      .join("\n");

    const blob = new Blob([header + rows], {
      type: "text/csv;charset=utf-8;"
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `IBP_Release_Tracker_${selectedYear}.csv`;
    link.click();
  };

  const clearForm = () => {
    setForm({
      name: "",
      product: "",
      plannedDate: "",
      actualDate: "",
      type: "",
      status: "planned"
    });
  };

  const discardEdit = () => {
    setEditingRelease(null);

    setForm({
      name: "",
      product: "",
      plannedDate: "",
      actualDate: "",
      type: "",
      status: "planned"
    });
  };

  /* ======================
     EXECUTIVE SUMMARY DATA
     ====================== */
  const executiveSummary = MONTHS.map((month, idx) => {
    const items = baseFiltered.filter(r => {
      const effectiveDate = r.actualDate || r.plannedDate;
      return new Date(effectiveDate).getMonth() === idx;
    });

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
        <button
          disabled={viewMode === "tracker"}
          onClick={() => setViewMode("tracker")}
        >
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

      {viewMode === "tracker" && (
        <>
          {/* Year + Export */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16
            }}
          >
            <strong>Year:</strong>

            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
            >
              {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button onClick={exportYearToExcel}>
              Export Year to Excel
            </button>
          </div>

          {/* Add / Edit */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 16,
              marginBottom: 16
            }}
          >
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                Release Name
              </div>
              <input
                placeholder="Release Name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                Product / App
              </div>
              <input
                placeholder="Product / App"
                value={form.product}
                onChange={e => setForm({ ...form, product: e.target.value })}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                Planned Release Date
              </div>
              <input
                type="date"
                value={form.plannedDate}
                onChange={e =>
                  setForm({ ...form, plannedDate: e.target.value })
                }
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                Release Type
              </div>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}
                style={{ width: "100%" }}
              >
                <option value="">Release Type</option>
                {releaseTypes.map(rt => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                Release Status
              </div>
              <select
                value={form.status}
                onChange={e =>
                  setForm({
                    ...form,
                    status: e.target.value as "planned" | "completed"
                  })
                }
                style={{ width: "100%" }}
              >
                {releaseStatuses.map(rs => (
                  <option key={rs.id} value={rs.id}>
                    {rs.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.status === "completed" && (
            <div
              style={{
                marginBottom: 16,
                maxWidth: 240
              }}
            >
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                Actual Release Date
              </div>

              <input
                type="date"
                value={form.actualDate}
                onChange={e =>
                  setForm({ ...form, actualDate: e.target.value })
                }
                style={{ width: "100%" }}
              />
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 24
            }}
          >
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
            <strong>
              Release Type Legend — Total releases: {totalYearCount}
            </strong>

            <button
              onClick={() => setTypeFilter([])}
              style={{ marginLeft: 12 }}
            >
              Clear Release Type Filter
            </button>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 8
              }}
            >
              {releaseTypes.map(rt => {
                const isSelected = typeFilter.includes(rt.id);

                return (
                  <button
                    key={rt.id}
                    onClick={() =>
                      setTypeFilter(p =>
                        p.includes(rt.id)
                          ? p.filter(t => t !== rt.id)
                          : [...p, rt.id]
                      )
                    }
                    style={{
                      background: rt.color,
                      color: getContrastingTextColor(rt.color),
                      padding: "4px 8px",
                      border: isSelected
                        ? "3px solid #000"
                        : "1px solid #ccc",
                      boxShadow: isSelected
                        ? "0 0 0 2px rgba(0,0,0,0.15)"
                        : "none",
                      transform: isSelected
                        ? "scale(1.05)"
                        : "scale(1)",
                      transition: "all 0.15s ease"
                    }}
                  >
                    {rt.name} ({releaseTypeCounts[rt.id] || 0})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters */}
          <div
            style={{
              marginBottom: 24,
              display: "flex",
              gap: 8
            }}
          >
            <input
              placeholder="Filter by product"
              value={productFilter}
              onChange={e => setProductFilter(e.target.value)}
            />

            {productFilter && (
              <button onClick={() => setProductFilter("")}>×</button>
            )}

            <select
              value={monthFilter ?? ""}
              onChange={e =>
                setMonthFilter(
                  e.target.value ? Number(e.target.value) : null
                )
              }
            >
              <option value="">Filter by month</option>

              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>

            {monthFilter !== null && (
              <button onClick={() => setMonthFilter(null)}>
                Clear Month
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div style={{ marginBottom: 16 }}>
            <strong>Release Status</strong>

            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {releaseStatuses.map(rs => (
                <button
                  key={rs.id}
                  onClick={() =>
                    setStatusFilter(p =>
                      p === rs.id
                        ? null
                        : (rs.id as "planned" | "completed")
                    )
                  }
                  style={{
                    background: rs.color,
                    color: "#fff",
                    border:
                      statusFilter === rs.id
                        ? "3px solid #000"
                        : "1px solid #ccc",
                    padding: "4px 8px"
                  }}
                >
                  {rs.name}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {monthFilter !== null ? (
            <div>
              <h3>
                {MONTHS[monthFilter]} {selectedYear}
              </h3>

              {filteredReleases.map(r => {
                const rt = releaseTypes.find(t => t.id === r.type);

                return (
                  <div
                    key={r.id}
                    style={{
                      background: rt?.color,
                      color: rt
                        ? getContrastingTextColor(rt.color)
                        : "#000",
                      padding: 8,
                      marginTop: 6,
                      border: "1px solid #ccc"
                    }}
                  >
                    <strong>{r.name}</strong>

                    <div style={{ fontSize: 12 }}>
                      {r.product} • {rt?.name}
                    </div>

                    <div style={{ fontSize: 12 }}>
                      Planned: {r.plannedDate}
                    </div>

                    {r.actualDate && (
                      <div style={{ fontSize: 12 }}>
                        Actual: {r.actualDate}
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 4
                      }}
                    >
                      <button
                        style={{ fontSize: 12 }}
                        onClick={() => {
                          setEditingRelease(r);
                          setForm({
                            name: r.name,
                            product: r.product,
                            plannedDate: r.plannedDate,
                            actualDate: r.actualDate || "",
                            type: r.type,
                            status: r.status
                          });

                          window.scrollTo({
                            top: 0,
                            behavior: "smooth"
                          });
                        }}
                      >
                        Edit
                      </button>

                      <button
                        style={{ fontSize: 12, color: "red" }}
                        onClick={() => deleteRelease(r.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16
              }}
            >
              {MONTHS.map((month, index) => (
                <div
                  key={month}
                  style={{ border: "1px solid #ccc", padding: 12 }}
                >
                  <strong>
                    {month} {selectedYear}
                  </strong>

                  {filteredReleases
                    .filter(r => {
                      const effectiveDate =
                        r.actualDate || r.plannedDate;

                      return (
                        new Date(effectiveDate).getMonth() === index
                      );
                    })
                    .map(r => {
                      const rt = releaseTypes.find(t => t.id === r.type);

                      return (
                        <div
                          key={r.id}
                          style={{
                            background: rt?.color,
                            color: rt
                              ? getContrastingTextColor(rt.color)
                              : "#000",
                            padding: 6,
                            marginTop: 6
                          }}
                        >
                          <strong>{r.name}</strong>

                          <div style={{ fontSize: 12 }}>
                            {r.product} • {rt?.name}
                          </div>

                          <div style={{ fontSize: 12 }}>
                            Planned: {r.plannedDate}
                          </div>

                          {r.actualDate && (
                            <div style={{ fontSize: 12 }}>
                              Actual: {r.actualDate}
                            </div>
                          )}

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              marginTop: 4
                            }}
                          >
                            <button
                              style={{ fontSize: 12 }}
                              onClick={() => {
                                setEditingRelease(r);

                                setForm({
                                  name: r.name,
                                  product: r.product,
                                  plannedDate: r.plannedDate,
                                  actualDate: r.actualDate || "",
                                  type: r.type,
                                  status: r.status
                                });

                                window.scrollTo({
                                  top: 0,
                                  behavior: "smooth"
                                });
                              }}
                            >
                              Edit
                            </button>

                            <button
                              style={{ fontSize: 12, color: "red" }}
                              onClick={() => deleteRelease(r.id)}
                            >
                              Delete
                            </button>
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

            {/* EXECUTIVE VIEW */}
      {viewMode === "executive" && (
        <>
          <h2>Monthly Executive Summary</h2>

          {/* Executive Summary Status Filter */}
          <div style={{ marginBottom: 16 }}>
            <strong>Release Status</strong>

            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {releaseStatuses.map(rs => (
                <button
                  key={rs.id}
                  onClick={() =>
                    setExecutiveSummaryStatusFilter(p =>
                      p === rs.id
                        ? null
                        : (rs.id as "planned" | "completed")
                    )
                  }
                  style={{
                    background: rs.color,
                    color: "#fff",
                    border:
                      executiveSummaryStatusFilter === rs.id
                        ? "3px solid #000"
                        : "1px solid #ccc",
                    padding: "4px 8px"
                  }}
                >
                  {rs.name}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16
            }}
          >
            {MONTHS.map((month, idx) => {
              const items = baseFiltered.filter(r => {
                const effectiveDate =
                  r.actualDate || r.plannedDate;

                if (
                  new Date(effectiveDate).getMonth() !== idx
                ) {
                  return false;
                }

                if (
                  executiveSummaryStatusFilter &&
                  r.status !== executiveSummaryStatusFilter
                ) {
                  return false;
                }

                return true;
              });

              const total = items.length;

              const byType = releaseTypes
                .map(rt => {
                  const count = items.filter(
                    r => r.type === rt.id
                  ).length;

                  return {
                    ...rt,
                    count,
                    percent: total
                      ? Math.round((count / total) * 100)
                      : 0
                  };
                })
                .filter(t => t.count > 0);

              return (
                <div
                  key={month}
                  style={{
                    border: "1px solid #ccc",
                    padding: 12
                  }}
                >
                  <strong>{month}</strong>

                  <div>Total Releases: {total}</div>

                  {byType.map(t => (
                    <div key={t.id} style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 12 }}>
                        {t.name}: {t.count} ({t.percent}%)
                      </div>

                      <div
                        style={{
                          background: "#eee",
                          height: 8
                        }}
                      >
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
              );
            })}
          </div>

{/* =====================
   DELIVERY EFFICIENCY
   ===================== */}
<h2 style={{ marginTop: 32 }}>
  Delivery Efficiency
</h2>

{(() => {
  const today = new Date();

  /* =====================
     VALID RELEASES FOR KPI
     Include:
     - Completed releases
     - Planned releases where
       planned date <= today
     ===================== */
  const validReleases = baseFiltered.filter(r => {
    const comparisonDate = new Date(
      r.actualDate || r.plannedDate
    );

    return comparisonDate <= today;
  });

  const completedReleases = validReleases.filter(
    r => r.status === "completed"
  );

  const plannedReleases = baseFiltered.filter(
  r => r.status === "planned"
  );

  /* =====================
     ON-TIME RELEASES
     actual date = planned date
     ===================== */
  const onTimeReleases = completedReleases.filter(r => {
    if (!r.actualDate) return false;

    return (
      new Date(r.actualDate).getTime() ===
      new Date(r.plannedDate).getTime()
    );
  });

  /* =====================
     BEFORE-TIME RELEASES
     actual date < planned date
     ===================== */
  const beforeTimeReleases = completedReleases.filter(r => {
    if (!r.actualDate) return false;

    return (
      new Date(r.actualDate).getTime() <
      new Date(r.plannedDate).getTime()
    );
  });

  /* =====================
     DELAYED RELEASES
     actual date > planned date
     ===================== */
  const delayedReleases = completedReleases.filter(r => {
    if (!r.actualDate) return false;

    return (
      new Date(r.actualDate).getTime() >
      new Date(r.plannedDate).getTime()
    );
  });

  /* =====================
     COMPLETION RATE
     ===================== */
  const completionRate = validReleases.length
    ? Math.round(
        (completedReleases.length / validReleases.length) * 100
      )
    : 0;

  /* =====================
     ON-TIME RATE
     before-time also counts
     as successful delivery
     ===================== */
  const successfulDeliveries =
    onTimeReleases.length + beforeTimeReleases.length;

  const onTimeRate = completedReleases.length
    ? Math.round(
        (successfulDeliveries / completedReleases.length) * 100
      )
    : 0;

  const getMetricColor = (value: number) => {
    if (value >= 85) return "#16A34A";
    if (value >= 70) return "#F59E0B";
    return "#DC2626";
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 16,
        marginTop: 16,
        marginBottom: 32
      }}
    >
      {/* Completion Rate */}
      <div
        style={{
          border: "1px solid #ccc",
          padding: 16,
          borderRadius: 8
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#6B7280",
            marginBottom: 8
          }}
        >
          Completion Rate
        </div>

        <div
          style={{
            fontSize: 32,
            fontWeight: "bold",
            color: getMetricColor(completionRate)
          }}
        >
          {completionRate}%
        </div>

        <div style={{ fontSize: 12, marginTop: 8 }}>
          {completedReleases.length} completed out of {validReleases.length}
        </div>
      </div>

      {/* On-Time Delivery */}
      <div
        style={{
          border: "1px solid #ccc",
          padding: 16,
          borderRadius: 8
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#6B7280",
            marginBottom: 8
          }}
        >
          On-Time Delivery
        </div>

        <div
          style={{
            fontSize: 32,
            fontWeight: "bold",
            color: getMetricColor(onTimeRate)
          }}
        >
          {onTimeRate}%
        </div>

        <div style={{ fontSize: 12, marginTop: 8 }}>
          {successfulDeliveries} successful out of {completedReleases.length}
        </div>
      </div>

      {/* Before-Time Releases */}
      <div
        style={{
          border: "1px solid #ccc",
          padding: 16,
          borderRadius: 8
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#6B7280",
            marginBottom: 8
          }}
        >
          Before-Time Releases
        </div>

        <div
          style={{
            fontSize: 32,
            fontWeight: "bold",
            color:
              beforeTimeReleases.length > 0
                ? "#16A34A"
                : "#6B7280"
          }}
        >
          {beforeTimeReleases.length}
        </div>

        <div style={{ fontSize: 12, marginTop: 8 }}>
          Completed before planned date
        </div>
      </div>

      {/* Delayed Releases */}
      <div
        style={{
          border: "1px solid #ccc",
          padding: 16,
          borderRadius: 8
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#6B7280",
            marginBottom: 8
          }}
        >
          Delayed Releases
        </div>

        <div
          style={{
            fontSize: 32,
            fontWeight: "bold",
            color:
              delayedReleases.length > 0
                ? "#DC2626"
                : "#16A34A"
          }}
        >
          {delayedReleases.length}
        </div>

        <div style={{ fontSize: 12, marginTop: 8 }}>
          Completed after planned date
        </div>
      </div>

      {/* Pending Releases */}
      <div
        style={{
          border: "1px solid #ccc",
          padding: 16,
          borderRadius: 8
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "#6B7280",
            marginBottom: 8
          }}
        >
          Pending Releases
        </div>

        <div
          style={{
            fontSize: 32,
            fontWeight: "bold",
            color:
              plannedReleases.length > 0
                ? "#F59E0B"
                : "#16A34A"
          }}
        >
          {plannedReleases.length}
        </div>

        <div style={{ fontSize: 12, marginTop: 8 }}>
          Releases in planned status
        </div>
      </div>
    </div>
  );
})()}

           
          {/* =====================
             PRODUCT RELEASE MIX
             ===================== */}
          <h2 style={{ marginTop: 32 }}>
            Product Release Mix
          </h2>

          {/* Product Mix Status Filter */}
          <div style={{ marginBottom: 16 }}>
            <strong>Release Status</strong>

            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {releaseStatuses.map(rs => (
                <button
                  key={rs.id}
                  onClick={() =>
                    setProductMixStatusFilter(p =>
                      p === rs.id
                        ? null
                        : (rs.id as "planned" | "completed")
                    )
                  }
                  style={{
                    background: rs.color,
                    color: "#fff",
                    border:
                      productMixStatusFilter === rs.id
                        ? "3px solid #000"
                        : "1px solid #ccc",
                    padding: "4px 8px"
                  }}
                >
                  {rs.name}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 16
            }}
          >
            {(() => {
              const products = Array.from(
                new Set(baseFiltered.map(r => r.product))
              );

              return products.map(product => {
                const productReleases = baseFiltered.filter(r => {
                  if (r.product !== product) return false;

                  if (
                    productMixStatusFilter &&
                    r.status !== productMixStatusFilter
                  ) {
                    return false;
                  }

                  return true;
                });

                const total = productReleases.length;

                if (total === 0) return null;

                const byType = releaseTypes
                  .map(rt => {
                    const count = productReleases.filter(
                      r => r.type === rt.id
                    ).length;

                    const percent = Math.round(
                      (count / total) * 100
                    );

                    return { ...rt, count, percent };
                  })
                  .filter(t => t.count > 0);

                return (
                  <div
                    key={product}
                    style={{
                      border: "1px solid #ccc",
                      padding: 12
                    }}
                  >
                    <strong>{product}</strong>

                    <div
                      style={{
                        fontSize: 12,
                        marginBottom: 6
                      }}
                    >
                      Total Releases: {total}
                    </div>

                    {/* Stacked bar */}
                    <div
                      style={{
                        display: "flex",
                        height: 16,
                        width: "100%",
                        border: "1px solid #ddd",
                        overflow: "hidden"
                      }}
                    >
                      {byType.map(t => (
                        <div
                          key={t.id}
                          title={`${t.name}: ${t.count} (${t.percent}%)`}
                          style={{
                            width: `${t.percent}%`,
                            background: t.color
                          }}
                        />
                      ))}
                    </div>

                    {/* Legend */}
                    <div
                      style={{
                        fontSize: 12,
                        marginTop: 6
                      }}
                    >
                      {byType.map(t => (
                        <span
                          key={t.id}
                          style={{ marginRight: 12 }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: 10,
                              height: 10,
                              background: t.color,
                              marginRight: 4
                            }}
                          />
                          {t.name}: {t.count} ({t.percent}%)
                        </span>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </>
      )}
    </div>
  );
}
