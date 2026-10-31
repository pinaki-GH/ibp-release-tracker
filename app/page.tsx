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

const DEFAULT_PRODUCTS = [
  "Air Freight Approval Tool",
  "DDPS",
  "Lead Time Check",
  "Predictable Material Capability",
  "Supplier Performance Card",
  "Supply Visualization"
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
  delayReason?: string;
}

/* Parse date-only values as UTC to avoid timezone-related month/year shifts. */
const parseDateOnly = (value?: string | null): Date | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

const getEffectiveReleaseDate = (release: ReleaseItem): string =>
  release.status === "completed" && release.actualDate
    ? release.actualDate
    : release.plannedDate;

/* Escape CSV cells, including embedded quotes, commas, and line breaks. */
const toCsvCell = (value: unknown): string => {
  let text = value == null ? "" : String(value);

  // Reduce spreadsheet formula-injection risk for user-entered text.
  if (/^[\t\r ]*[=+@]/.test(text) || /^[\t\r ]*-/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

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
  const [hasLoadedReleases, setHasLoadedReleases] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [editingRelease, setEditingRelease] = useState<ReleaseItem | null>(null);

  const [form, setForm] = useState({
    name: "",
    product: "",
    plannedDate: "",
    actualDate: "",
    type: "",
    status: "planned" as "planned" | "completed",
    delayReason: ""
  });

  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"planned" | "completed" | null>(null);
  const [monthFilter, setMonthFilter] = useState<number[]>([]);
  const [productFilterSearch, setProductFilterSearch] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [viewMode, setViewMode] = useState<"tracker" | "executive">("tracker");

  const [executiveSummaryStatusFilter, setExecutiveSummaryStatusFilter] =
  useState<"planned" | "completed" | null>(null);

  const [productMixStatusFilter, setProductMixStatusFilter] = useState<"planned" | "completed" | null>(null);

  const [showDelayedDetails, setShowDelayedDetails] = useState(false);
  const [showDataQualityDetails, setShowDataQualityDetails] = useState(false);

  const storageKey = "releaseTracker:all";

  /* Product options are derived from the starter list plus every product
     already used by a saved release. New products therefore appear in all
     product selectors automatically after the release is saved. */
  const availableProducts = Array.from(
    new Map(
      [...DEFAULT_PRODUCTS, ...releases.map(release => release.product)]
        .map(product => String(product ?? "").trim().replace(/\s+/g, " "))
        .filter(Boolean)
        .map(product => [product.toLocaleLowerCase(), product] as const)
    ).values()
  );

  /* Load the shared release list once. If it does not exist yet, consolidate
     legacy year-specific lists while retaining the old keys as backups. */
  useEffect(() => {
    setStorageError(null);

    try {
      const sharedStored = window.localStorage.getItem(storageKey);
      let sourceRecords: any[] = [];

      if (sharedStored !== null) {
        const parsed = JSON.parse(sharedStored);
        if (!Array.isArray(parsed)) throw new Error("Shared release data is not a list.");
        sourceRecords = parsed;
      } else {
        const legacyKeys = Object.keys(window.localStorage).filter(key =>
          /^releaseTracker:\d{4}$/.test(key)
        );

        for (const key of legacyKeys) {
          const legacyStored = window.localStorage.getItem(key);
          if (legacyStored === null) continue;
          const parsed = JSON.parse(legacyStored);
          if (!Array.isArray(parsed)) {
            throw new Error(`Saved release data in ${key} is not a list.`);
          }
          sourceRecords.push(...parsed);
        }
      }

      const normalized: ReleaseItem[] = sourceRecords.map((r: any) => ({
        ...r,
        plannedDate: r.plannedDate ?? r.date ?? "",
        actualDate: r.actualDate ?? "",
        status: r.status === "completed" ? "completed" : "planned",
        delayReason: r.delayReason ?? ""
      }));

      // Avoid duplicate entries if a release exists in multiple legacy lists.
      const uniqueRecords = Array.from(
        new Map(normalized.map(record => [record.id, record])).values()
      );
      setReleases(uniqueRecords);
      setHasLoadedReleases(true);
    } catch {
      setStorageError(
        "Saved release data could not be read. It has been left untouched to avoid data loss."
      );
    }
  }, [storageKey]);

  /* Persist only after the shared list has loaded successfully. */
  useEffect(() => {
    if (!hasLoadedReleases || storageError) return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(releases));
    } catch {
      setStorageError(
        "Your releases could not be saved to browser storage. Check available storage space or browser privacy settings."
      );
    }
  }, [releases, storageKey, hasLoadedReleases, storageError]);

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

    if (!parseDateOnly(form.plannedDate)) {
      alert("Please enter a valid Planned Release Date.");
      return;
    }

    if (form.status === "completed") {
      if (!form.actualDate) {
        alert("Actual Release Date is required for completed releases.");
        return;
      }

      if (!parseDateOnly(form.actualDate)) {
        alert("Please enter a valid Actual Release Date.");
        return;
      }
    }

    if (!form.type) {
      alert("Release Type is required.");
      return;
    }

    const isDelayed =
     form.status === "completed" &&
     form.actualDate &&
     form.actualDate >
       form.plannedDate;

   if (
     isDelayed &&
     !form.delayReason.trim()
      ) {
     alert(
       "Delay Reason is required for delayed releases."
     );
     return;
   } 

    const effectiveFormDate =
      form.status === "completed" ? form.actualDate : form.plannedDate;
    const parsedEffectiveDate = parseDateOnly(effectiveFormDate);
    const releaseYear = parsedEffectiveDate?.getUTCFullYear();

    // New releases must belong to the selected year. When editing, allow the
    // effective date to move to another year; shared storage and year filtering
    // will place it under the correct year after saving.
    if (!editingRelease && releaseYear !== selectedYear) {
      alert(`Release Date must be within the selected year (${selectedYear}).`);
      return;
    }

    const normalizedName = form.name.trim().replace(/\s+/g, " ").toLocaleLowerCase();

    const duplicate = releases.some(r =>
      r.name.trim().replace(/\s+/g, " ").toLocaleLowerCase() === normalizedName &&
      r.id !== editingRelease?.id
    );

    if (duplicate) {
      alert("A release with this name already exists. Please use a distinct release name.");
      return;
    }

    const releaseToSave: Omit<ReleaseItem, "id"> = {
      ...form,
      name: form.name.trim().replace(/\s+/g, " "),
      product: form.product.trim(),
      actualDate: form.status === "completed" ? form.actualDate : "",
      delayReason: form.status === "completed" && isDelayed ? form.delayReason.trim() : ""
    };

    if (editingRelease) {
      setReleases(prev =>
        prev.map(r =>
          r.id === editingRelease.id ? { ...r, ...releaseToSave } : r
        )
      );

      setEditingRelease(null);
    } else {
      setReleases(prev => [...prev, { ...releaseToSave, id: Date.now() }]);
    }

    setForm({
      name: "",
      product: "",
      plannedDate: "",
      actualDate: "",
      type: "",
      status: "planned",
      delayReason: ""
    });
  };

  const deleteRelease = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this release?")) return;
    setReleases(prev => prev.filter(r => r.id !== id));
  };

  /* Filtering */
  const baseFiltered = releases.filter(r => {
  const effectiveDate = getEffectiveReleaseDate(r);

  if (!parseDateOnly(effectiveDate) || parseDateOnly(effectiveDate)?.getUTCFullYear() !== selectedYear) {
    return false;
  }

  if (
    productFilter.length > 0 &&
  !productFilter.includes(r.product)
  ) {
    return false;
  }

  /* Apply month filter globally */
  if (
    monthFilter.length > 0 &&
  !monthFilter.includes(parseDateOnly(effectiveDate)?.getUTCMonth())
  ) {
    return false;
  }

  return true;
  });

  /* Data-quality checks run against the complete shared release list, not just
     the selected year or currently visible filters. */
  const normalizedReleaseName = (name: unknown) =>
    String(name ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

  const releaseNameCounts = releases.reduce<Record<string, number>>((counts, release) => {
    const key = normalizedReleaseName(release.name);
    if (key) counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  const dataQualityIssues = releases.map(release => {
    const issues: string[] = [];
    const name = String(release.name ?? "").trim();
    const product = String(release.product ?? "").trim();
    const plannedDateValid = Boolean(parseDateOnly(release.plannedDate));
    const actualDateValid = Boolean(parseDateOnly(release.actualDate));
    const isCompleted = release.status === "completed";
    const isDelayed = isCompleted && actualDateValid && plannedDateValid &&
      String(release.actualDate) > String(release.plannedDate);

    if (!name) issues.push("Release name is missing.");
    if (!product) issues.push("Product / App is missing.");
    if (!release.type) issues.push("Release type is missing.");
    if (!plannedDateValid) issues.push("Planned release date is missing or invalid.");

    if (isCompleted && !release.actualDate) {
      issues.push("Completed release is missing its actual release date.");
    } else if (isCompleted && !actualDateValid) {
      issues.push("Actual release date is invalid.");
    }

    if (isDelayed && !String(release.delayReason ?? "").trim()) {
      issues.push("Delayed release is missing a delay reason.");
    }

    if (!isCompleted && (release.actualDate || String(release.delayReason ?? "").trim())) {
      issues.push("Planned release contains completed-only details (actual date or delay reason).");
    }

    if (isCompleted && plannedDateValid && actualDateValid && !isDelayed && String(release.delayReason ?? "").trim()) {
      issues.push("Delay reason is present, but the release is not delayed.");
    }

    const nameKey = normalizedReleaseName(release.name);
    if (nameKey && releaseNameCounts[nameKey] > 1) {
      issues.push("Release name is duplicated across the shared tracker (names must be globally unique across all years).");
    }

    const effectiveDate = getEffectiveReleaseDate(release);
    const effectiveYear = parseDateOnly(effectiveDate)?.getUTCFullYear();

    return {
      id: release.id,
      name: name || "Unnamed release",
      product: product || "Product / App not provided",
      status: isCompleted ? "Completed" : "Planned",
      effectiveYear: effectiveYear ?? "Year unavailable",
      issues
    };
  }).filter(item => item.issues.length > 0);

  const dataQualityIssueCount = dataQualityIssues.reduce(
    (count, item) => count + item.issues.length, 0
  );

   const filteredReleases = baseFiltered.filter(r => {
     if (typeFilter.length && !typeFilter.includes(r.type)) {
       return false;
     }

     if (
    statusFilter &&
    (r.status ?? "planned") !== statusFilter
     ) {
       return false;
    }

     const query = searchQuery.trim().toLocaleLowerCase();
     if (query && ![r.name, r.product, r.plannedDate, r.actualDate || ""]
       .some(value => String(value).toLocaleLowerCase().includes(query))) {
       return false;
     }

     return true;
   });

  const releaseTypeCounts = baseFiltered.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  const totalYearCount = baseFiltered.length;

  const exportYearToExcel = () => {
    const header =
      "Release Name,Product,Planned Release Date,Actual Release Date,Year,Month,Release Type,Release Status,Delay Reason\n";

    const rows = baseFiltered
      .map(r => {
        const effectiveDate = getEffectiveReleaseDate(r);
        const d = parseDateOnly(effectiveDate);

        const month = d ? MONTHS[d.getUTCMonth()] : "Unknown";

        const typeName =
          releaseTypes.find(t => t.id === r.type)?.name || r.type;

        const statusName =
          r.status === "completed" ? "Completed" : "Planned";

        return [
          r.name,
          r.product,
          r.plannedDate,
          r.actualDate ?? "",
          selectedYear,
          month,
          typeName,
          statusName,
          r.delayReason || ""
        ].map(toCsvCell).join(",");
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
    status: "planned",
    delayReason: ""
  });
};

const startEditingRelease = (release: ReleaseItem) => {
  setEditingRelease(release);
  setForm({
    name: release.name ?? "",
    product: release.product ?? "",
    plannedDate: release.plannedDate ?? "",
    actualDate: release.actualDate || "",
    type: release.type ?? "",
    status: release.status === "completed" ? "completed" : "planned",
    delayReason: release.delayReason || ""
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
};

const discardEdit = () => {
  setEditingRelease(null);

  setForm({
    name: "",
    product: "",
    plannedDate: "",
    actualDate: "",
    type: "",
    status: "planned",
    delayReason: ""
  });
};

const delayedReleases = baseFiltered.filter(r => {
  if (r.status !== "completed") return false;
  if (!r.actualDate) return false;

  return (
    r.actualDate > r.plannedDate
  );
});
   
  /* ======================
     EXECUTIVE SUMMARY DATA
     ====================== */
  const executiveSummary = MONTHS.map((month, idx) => {
    const items = baseFiltered.filter(r => {
      const effectiveDate = getEffectiveReleaseDate(r);
      return parseDateOnly(effectiveDate)?.getUTCMonth() === idx;
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
    <div className="rt-app" style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>IBP Release Tracker</h1>

      {storageError && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: 12,
            border: "1px solid #DC2626",
            borderRadius: 6,
            background: "#FEF2F2",
            color: "#991B1B"
          }}
        >
          <strong>Storage warning:</strong> {storageError}
        </div>
      )}

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
        <div className="rt-tracker">
          {/* Year + Export */}
          <div className="rt-year-toolbar"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16
            }}
          >
            <strong>Reporting year</strong>

            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
            >
              {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button className="rt-export-button" onClick={exportYearToExcel}>
              ↓ Export CSV
            </button>
          </div>

          {/* Data Quality Summary — checks all years and ignores view filters. */}
          {hasLoadedReleases && !storageError && (
          <div
            className="rt-quality-summary"
            role="status"
            style={{
              marginBottom: 20,
              padding: 12,
              border: `1px solid ${dataQualityIssueCount ? "#FCA5A5" : "#86EFAC"}`,
              borderRadius: 6,
              background: dataQualityIssueCount ? "#FEF2F2" : "#F0FDF4",
              color: dataQualityIssueCount ? "#991B1B" : "#166534"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <strong>
                {dataQualityIssueCount === 0
                  ? "Data Quality: All records valid"
                  : `Data Quality: ${dataQualityIssues.length} release(s) need review — ${dataQualityIssueCount} issue(s)`}
              </strong>
              {dataQualityIssues.length > 0 && (
                <button onClick={() => setShowDataQualityDetails(value => !value)}>
                  {showDataQualityDetails ? "Hide issues" : "View issues"}
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Checks cover all years in the shared tracker, regardless of the selected year or active filters.
            </div>
            {showDataQualityDetails && dataQualityIssues.length > 0 && (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {dataQualityIssues.map(item => (
                  <div key={item.id} style={{ background: "#FFFFFF", border: "1px solid #FECACA", borderRadius: 4, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <strong>{item.name}</strong>
                        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>
                          {item.product} • {item.status} • {item.effectiveYear}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const release = releases.find(r => r.id === item.id);
                          if (release) startEditingRelease(release);
                        }}
                        style={{ fontSize: 12, whiteSpace: "nowrap" }}
                      >
                        Edit this release
                      </button>
                    </div>
                    <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                      {item.issues.map((issue, index) => (
                        <li key={`${item.id}-${index}`} style={{ fontSize: 12, marginTop: 3 }}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Add / Edit */}
          <section className="rt-form-panel">
          <div className="rt-section-heading">
            <div>
              <div className="rt-eyebrow">RELEASE MANAGEMENT</div>
              <h2>{editingRelease ? "Update release" : "Add a release"}</h2>
              <p>Capture the planned delivery and track its actual outcome.</p>
            </div>
            {editingRelease && <span className="rt-editing-pill">Editing existing release</span>}
          </div>
          <div className="rt-form-grid"
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
                onChange={e => {
                  const nextStatus = e.target.value as "planned" | "completed";
                  setForm({
                    ...form,
                    status: nextStatus,
                    ...(nextStatus === "planned"
                      ? { actualDate: "", delayReason: "" }
                      : {})
                  });
                }}
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
      display: "grid",
      gridTemplateColumns:
        form.actualDate &&
        form.actualDate >
          form.plannedDate
          ? "240px 1fr"
          : "240px",
      gap: 16,
      marginBottom: 16
    }}
  >
    <div>
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        Actual Release Date
      </div>

      <input
        type="date"
        value={form.actualDate}
        onChange={e =>
          setForm({
            ...form,
            actualDate: e.target.value
          })
        }
        style={{ width: "100%" }}
      />
    </div>

    {form.actualDate &&
      form.actualDate >
        form.plannedDate && (
      <div>
        <div style={{ fontSize: 12, marginBottom: 4 }}>
          Delay Reason
        </div>

        <textarea
          value={form.delayReason}
          onChange={e =>
            setForm({
              ...form,
              delayReason: e.target.value
            })
          }
          rows={2}
          style={{ width: "100%" }}
        />
      </div>
    )}
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
          </section>

          {/* Legend */}
          <section className="rt-filter-panel">
          <div className="rt-legend-heading">
            <div>
              <div className="rt-eyebrow">BROWSE RELEASES</div>
              <h2>Release type</h2>
              <p>{totalYearCount} release(s) in {selectedYear}</p>
            </div>

            <button
              onClick={() => setTypeFilter([])}
              className="rt-text-button"
            >
              Clear type filter
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
                    className={`rt-type-chip ${isSelected ? "is-selected" : ""}`}
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
<div className="rt-filter-controls"
  style={{
    marginBottom: 24,
    display: "flex",
    gap: 24,
    flexWrap: "wrap"
  }}
>
  <div className="rt-search-field">
    <label htmlFor="release-search">Search releases</label>
    <input
      id="release-search"
      type="search"
      placeholder="Search name, product or date…"
      value={searchQuery}
      onChange={e => setSearchQuery(e.target.value)}
    />
  </div>
  {/* Product selector */}
  <div className="rt-choice-panel rt-product-choice">
    <div className="rt-choice-heading">
      <div>
        <label>Products</label>
        <span className="rt-choice-count">{productFilter.length === 0 ? "All products" : `${productFilter.length} selected`}</span>
      </div>
      <button type="button" className="rt-text-button" onClick={() => setProductFilter(productFilter.length === availableProducts.length ? [] : [...availableProducts])}>
        {productFilter.length === availableProducts.length ? "Clear all" : "Select all"}
      </button>
    </div>
    <input
      type="search"
      aria-label="Find a product"
      placeholder="Find a product…"
      value={productFilterSearch}
      onChange={e => setProductFilterSearch(e.target.value)}
      className="rt-choice-search"
    />
    <div className="rt-choice-options" role="group" aria-label="Filter by product">
      {availableProducts.filter(product => product.toLocaleLowerCase().includes(productFilterSearch.trim().toLocaleLowerCase())).map(product => (
        <label className="rt-choice-option" key={product}>
          <input
            type="checkbox"
            checked={productFilter.includes(product)}
            onChange={e => setProductFilter(current => e.target.checked ? [...current, product] : current.filter(item => item !== product))}
          />
          <span>{product}</span>
        </label>
      ))}
      {availableProducts.filter(product => product.toLocaleLowerCase().includes(productFilterSearch.trim().toLocaleLowerCase())).length === 0 && (
        <div className="rt-choice-empty">No matching products</div>
      )}
    </div>
    {productFilter.length > 0 && (
      <div className="rt-selected-chips" aria-label="Selected products">
        {productFilter.map(product => (
          <button type="button" className="rt-selected-chip" key={product} onClick={() => setProductFilter(current => current.filter(item => item !== product))} aria-label={`Remove ${product}`}>
            {product} <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
    )}
  </div>

  {/* Month selector */}
  <div className="rt-choice-panel rt-month-choice">
    <div className="rt-choice-heading">
      <div>
        <label>Months</label>
        <span className="rt-choice-count">{monthFilter.length === 0 ? "All months" : `${monthFilter.length} selected`}</span>
      </div>
      <button type="button" className="rt-text-button" onClick={() => setMonthFilter(monthFilter.length === MONTHS.length ? [] : MONTHS.map((_, index) => index))}>
        {monthFilter.length === MONTHS.length ? "Clear all" : "Select all"}
      </button>
    </div>
    <div className="rt-month-options" role="group" aria-label="Filter by month">
      {MONTHS.map((month, index) => (
        <label className={`rt-month-option ${monthFilter.includes(index) ? "is-selected" : ""}`} key={month}>
          <input
            type="checkbox"
            checked={monthFilter.includes(index)}
            onChange={e => setMonthFilter(current => e.target.checked ? [...current, index].sort((a, b) => a - b) : current.filter(item => item !== index))}
          />
          <span>{month}</span>
        </label>
      ))}
    </div>
    {monthFilter.length > 0 && (
      <div className="rt-selected-chips" aria-label="Selected months">
        {monthFilter.slice().sort((a, b) => a - b).map(index => (
          <button type="button" className="rt-selected-chip" key={index} onClick={() => setMonthFilter(current => current.filter(item => item !== index))} aria-label={`Remove ${MONTHS[index]}`}>
            {MONTHS[index]} <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
    )}
  </div>
</div>
          </section>
          {/* Status Filter */}
          <div className="rt-status-filter" style={{ marginBottom: 16 }}>
            <strong>Release status</strong>

            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {releaseStatuses.map(rs => (
                <button
                  className={`rt-status-chip ${statusFilter === rs.id ? "is-selected" : ""}`}
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
          <div className="rt-results-heading">
            <div>
              <div className="rt-eyebrow">RELEASE SCHEDULE</div>
              <h2>{monthFilter.length === 1 ? `${MONTHS[monthFilter[0]]} ${selectedYear}` : `Monthly schedule · ${selectedYear}`}</h2>
            </div>
            <span>{filteredReleases.length} matching release(s)</span>
          </div>
          {monthFilter.length === 1 ? (
            <div className="rt-month-list">
              <h3>
                {MONTHS[monthFilter[0]]} {selectedYear}
              </h3>

              {filteredReleases.length === 0 && <div className="rt-empty-state">No releases match these filters. Try clearing a filter or changing your search.</div>}
              {filteredReleases.map(r => {
                const rt = releaseTypes.find(t => t.id === r.type);

                return (
                  <div
                    key={r.id}
                    className="rt-release-card"
                    style={{
                      borderLeft: `4px solid ${rt?.color || "#94A3B8"}`,
                      background: `${rt?.color || "#94A3B8"}12`
                    }}
                  >
                    <strong>{r.name}</strong>

                    <div className="rt-release-card-meta" style={{ fontSize: 12 }}>
                      <span>{r.product}</span>
                      {rt && <span className="rt-release-type-tag" style={{ background: `${rt.color}18`, color: rt.color, borderColor: `${rt.color}55` }}>{rt.name}</span>}
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
                            status: r.status,
                            delayReason: r.delayReason || ""
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
            <div className="rt-month-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16
              }}
            >
              {MONTHS.map((month, index) => (
                <div
                  className="rt-month-card"
                  key={month}
                  style={{ border: "1px solid #ccc", padding: 12 }}
                >
                  <strong>
                    {month} {selectedYear}
                  </strong>

                  {filteredReleases
                    .filter(r => {
                      const effectiveDate = getEffectiveReleaseDate(r);

                      return (
                        parseDateOnly(effectiveDate)?.getUTCMonth() === index
                      );
                    })
                    .map(r => {
                      const rt = releaseTypes.find(t => t.id === r.type);

                      return (
                        <div
                          className="rt-release-card rt-release-card-compact"
                          key={r.id}
                          style={{
                            borderLeft: `4px solid ${rt?.color || "#94A3B8"}`,
                            background: `${rt?.color || "#94A3B8"}12`
                          }}
                        >
                          <strong>{r.name}</strong>

                          <div className="rt-release-card-meta" style={{ fontSize: 12 }}>
                            <span>{r.product}</span>
                            {rt && <span className="rt-release-type-tag" style={{ background: `${rt.color}18`, color: rt.color, borderColor: `${rt.color}55` }}>{rt.name}</span>}
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
                                  status: r.status,
                                  delayReason: r.delayReason || ""
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
        </div>
      )}

            {/* EXECUTIVE VIEW */}
      {viewMode === "executive" && (
        <div className="rt-executive">
          <div className="rt-exec-page-heading"><div className="rt-eyebrow">REPORTING OVERVIEW</div><h2 className="rt-page-section-title">Monthly Executive Summary</h2><p>Release activity, delivery performance and product mix for {selectedYear}.</p></div>

          {/* Executive Summary Status Filter */}
          <div className="rt-exec-filter-panel" style={{ marginBottom: 16 }}>
            <strong>Release Status</strong>

            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {releaseStatuses.map(rs => (
                <button
                  key={rs.id}
                  type="button"
                  aria-pressed={executiveSummaryStatusFilter === rs.id}
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

          <div className="rt-exec-month-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16
            }}
          >
            {MONTHS.map((month, idx) => {
              const items = baseFiltered.filter(r => {
                const effectiveDate = getEffectiveReleaseDate(r);

                if (
                  parseDateOnly(effectiveDate)?.getUTCMonth() !== idx
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
                <div className="rt-exec-month-card rt-exec-product-card"
                  key={month}
                  style={{
                    border: "1px solid #ccc",
                    padding: 12
                  }}
                >
                  <strong>{month}</strong>

                  <div
                    style={{
                      fontSize: 12,
                      marginBottom: 6
                    }}
                  >
                    Total Releases: {total}
                  </div>

                  {/* Stacked bar, matching Product Release Mix */}
                  <div
                    style={{
                      display: "flex",
                      height: 16,
                      width: "100%",
                      border: "1px solid #ddd",
                      overflow: "hidden",
                      background: "#EAF1F7"
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

                  {/* Matching release-type legend */}
                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 6
                    }}
                  >
                    {byType.length > 0 ? byType.map(t => (
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
                    )) : (
                      <span>No releases this month</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

{/* =====================
   DELIVERY EFFICIENCY
   ===================== */}
<div className="rt-exec-section-heading"><div className="rt-eyebrow">PERFORMANCE</div><h2>Delivery Efficiency</h2><p>Completed and pending delivery outcomes for the selected reporting year.</p></div>

{(() => {
  // Use a date-only key so KPI cutoffs are independent of browser timezone.
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  /* =====================
     KPI POPULATION
     Include completed releases whose actual date is today or earlier,
     plus planned releases whose planned date is today or earlier.
     Future releases are excluded from the completion-rate denominator.
     ===================== */
  const validReleases = baseFiltered.filter(r => {
    const comparisonDate =
      r.status === "completed" ? (r.actualDate || r.plannedDate) : r.plannedDate;

    return Boolean(parseDateOnly(comparisonDate)) && comparisonDate <= todayKey;
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
      r.actualDate === r.plannedDate
    );
  });

  /* =====================
     BEFORE-TIME RELEASES
     actual date < planned date
     ===================== */
  const beforeTimeReleases = completedReleases.filter(r => {
    if (!r.actualDate) return false;

    return (
      r.actualDate < r.plannedDate
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
    <div className="rt-exec-kpi-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 16,
        marginTop: 16,
        marginBottom: 32
      }}
    >
      {/* Completion Rate */}
      <div className="rt-exec-kpi-card"
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
      <div className="rt-exec-kpi-card"
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
          On-Time or Early Delivery
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
          {successfulDeliveries} on-time or early deliveries out of {completedReleases.length}
        </div>
      </div>

      {/* Before-Time Releases */}
      <div className="rt-exec-kpi-card"
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
        onClick={() =>
          setShowDelayedDetails(!showDelayedDetails)
        }
        className="rt-exec-kpi-card rt-exec-kpi-clickable"
        style={{
          border: "1px solid #ccc",
          padding: 16,
          borderRadius: 8,
          cursor: "pointer"
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

         <div
         style={{
         fontSize: 11,
         marginTop: 6,
         color: "#2563EB",
         fontWeight: 600
        }}
      >
  Click to view details →
</div>
      </div>

      {/* Pending Releases */}
      <div className="rt-exec-kpi-card"
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

{showDelayedDetails &&
  delayedReleases.length > 0 && (
    <div className="rt-exec-delayed-panel"
      style={{
        marginTop: 24,
        marginBottom: 24,
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        padding: 20,
        background: "#FAFAFA"
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: 16,
          color: "#374151"
        }}
      >
        Delayed Releases
      </h3>

      <div
        style={{
          display: "grid",
          gap: 12
        }}
      >
        {delayedReleases.map(r => {
          const rt = releaseTypes.find(t => t.id === r.type);
          const typeColor = rt?.color || "#94A3B8";
          return (
          <div
            key={r.id}
            className="rt-exec-delayed-release-card"
            style={{
              border: "1px solid #E5E7EB",
              borderLeft: `4px solid ${typeColor}`,
              borderRadius: 10,
              padding: 16,
              background: `${typeColor}12`
            }}
          >
            <div
              style={{
                fontWeight: 400,
                fontSize: 16,
                marginBottom: 10,
                color: "#111827"
              }}
            >
              {r.name}
            </div>

            <div className="rt-release-card-meta" style={{ marginBottom: 8, fontSize: 12 }}>
              <span><strong>Product:</strong> {r.product}</span>
              {rt && <span className="rt-release-type-tag" style={{ background: `${typeColor}18`, color: typeColor, borderColor: `${typeColor}55` }}>{rt.name}</span>}
            </div>

            <div
              style={{
                color: "#6B7280",
                marginBottom: 4,
                fontSize: 12
              }}
            >
              <strong>Planned Date:</strong> {r.plannedDate}
            </div>

            <div
              style={{
                color: "#DC2626",
                marginBottom: 4,
                fontSize: 12
              }}
            >
              <strong>Actual Date:</strong> {r.actualDate}
            </div>

            <div
              style={{
                marginTop: 10,
                padding: 10,
                background: "#FEF2F2",
                borderLeft: "4px solid #DC2626",
                borderRadius: 4
              }}
            >
              <div
                style={{
                  fontWeight: 400,
                  color: "#991B1B",
                  marginBottom: 4
                }}
              >
                Delay Reason
              </div>

              <div
                style={{
                  color: "#374151",
                  fontSize: 12,
                  whiteSpace: "pre-wrap"
                }}
              >
                {r.delayReason || "Not Provided"}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
)}
           
           
          {/* =====================
             PRODUCT RELEASE MIX
             ===================== */}
          <div className="rt-exec-section-heading"><div className="rt-eyebrow">PORTFOLIO VIEW</div><h2>Product Release Mix</h2><p>Distribution of release types across products and applications.</p></div>

          {/* Product Mix Status Filter */}
          <div className="rt-exec-filter-panel" style={{ marginBottom: 16 }}>
            <strong>Release Status</strong>

            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {releaseStatuses.map(rs => (
                <button
                  key={rs.id}
                  type="button"
                  aria-pressed={productMixStatusFilter === rs.id}
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

          <div className="rt-exec-product-grid"
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
                  <div className="rt-exec-product-card"
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
        </div>
      )}
      <style jsx global>{`
        .rt-app { color: #24364B; background: #F4F8FC; min-height: 100vh; }
        .rt-app h1 { margin: 0 0 18px; color: #013F6A; font-size: 28px; font-weight: 750; letter-spacing: -.035em; }
        .rt-app h2 { color: #013F6A; letter-spacing: -.025em; }
        .rt-app h3 { color: #174B78; }
        .rt-app p { color: #718096; }
        .rt-app button, .rt-app input, .rt-app select, .rt-app textarea { font: inherit; }
        .rt-app button { border: 1px solid #D8E4EF; border-radius: 9px; padding: 9px 13px; background: #fff; color: #174B78; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .15s ease, border-color .15s ease; }
        .rt-app button:hover:not(:disabled) { background: #EDF5FC; border-color: #8CB9E8; }
        .rt-app button:disabled { background: #013F6A; border-color: #013F6A; color: #fff; cursor: default; opacity: 1; }
        .rt-app button:focus-visible, .rt-app input:focus-visible, .rt-app select:focus-visible, .rt-app textarea:focus-visible { outline: 3px solid rgba(17,116,230,.20); outline-offset: 1px; border-color: #1174E6; }
        .rt-app input, .rt-app select, .rt-app textarea { box-sizing: border-box; min-height: 40px; border: 1px solid #D8E4EF; border-radius: 9px; padding: 9px 11px; background: #fff; color: #24364B; font-size: 13px; }
        .rt-app textarea { min-height: 76px; resize: vertical; }
        .rt-app > div[style*="margin-bottom: 16px"] { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px !important; padding-bottom: 14px; border-bottom: 1px solid #DCE7F1; }
        .rt-tracker { color: #24364B; }
        .rt-tracker h2 { margin: 0; color: #013F6A; font-size: 20px; letter-spacing: -0.025em; }
        .rt-tracker h3 { color: #013F6A; }
        .rt-year-toolbar { padding: 15px 17px; border: 1px solid #DCE7F1; border-radius: 14px; background: #fff; box-shadow: 0 3px 12px rgba(1,63,106,.045); }
        .rt-year-toolbar select { min-width: 112px; font-weight: 700; }
        .rt-export-button { margin-left: auto; background: #013F6A !important; border-color: #013F6A !important; color: #fff !important; }
        .rt-export-button:hover { background: #075B9A !important; }
        .rt-quality-summary { border-radius: 12px !important; padding: 14px 16px !important; }
        .rt-form-panel, .rt-filter-panel { margin-bottom: 20px; padding: 20px; border: 1px solid #DCE7F1; border-radius: 15px; background: #fff; box-shadow: 0 4px 16px rgba(1,63,106,.045); }
        .rt-section-heading, .rt-legend-heading, .rt-results-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 17px; }
        .rt-section-heading p, .rt-legend-heading p { margin: 5px 0 0; font-size: 12px; }
        .rt-eyebrow { margin-bottom: 5px; color: #5B86AA; font-size: 10px; font-weight: 800; letter-spacing: .12em; }
        .rt-editing-pill { padding: 6px 10px; border-radius: 999px; background: #EAF3FC; color: #075B9A; font-size: 11px; font-weight: 700; white-space: nowrap; }
        .rt-form-grid { grid-template-columns: repeat(auto-fit, minmax(175px, 1fr)) !important; gap: 14px !important; margin-bottom: 14px !important; }
        .rt-form-grid > div > div:first-child { margin-bottom: 6px !important; color: #49677F; font-size: 11px !important; font-weight: 700; }
        .rt-form-grid input, .rt-form-grid select { width: 100%; }
        .rt-form-panel > div[style*="grid-template-columns"] { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) !important; }
        .rt-form-panel > div[style*="display: flex"] { align-items: center; margin-top: 12px; margin-bottom: 0 !important; }
        .rt-form-panel button:first-child { background: #013F6A; border-color: #013F6A; color: #fff; }
        .rt-filter-panel { padding-bottom: 17px; }
        .rt-legend-heading { margin-bottom: 12px; }
        .rt-text-button { padding: 6px 9px !important; border: 0 !important; background: transparent !important; color: #1174E6 !important; font-size: 12px !important; }
        .rt-type-chip { border-radius: 999px !important; padding: 7px 11px !important; border: 1px solid rgba(1,63,106,.16); font-size: 11px !important; }
        .rt-type-chip.is-selected { outline: 2px solid #013F6A; outline-offset: 2px; box-shadow: 0 0 0 4px rgba(78,138,112,.12) !important; }
        .rt-filter-controls { display: grid !important; grid-template-columns: minmax(220px,1.25fr) minmax(280px,1.25fr) minmax(250px,1fr); gap: 14px !important; align-items: stretch; padding: 17px; border: 1px solid #DCE7F1; border-radius: 14px; background: #F7FAFD; }
        .rt-filter-controls label { display: block; color: #49677F; font-size: 11px; font-weight: 700; }
        .rt-search-field input { width: 100%; }
        .rt-choice-panel { min-width: 0; padding: 12px; border: 1px solid #DCE7F1; border-radius: 11px; background: #fff; }
        .rt-choice-heading { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 9px; }
        .rt-choice-heading > div { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; }
        .rt-choice-heading label { margin: 0 !important; color: #174B78 !important; font-size: 12px !important; font-weight: 750 !important; }
        .rt-choice-count { color: #718096; font-size: 10px; font-weight: 600; }
        .rt-choice-search { width: 100%; min-height: 34px !important; margin-bottom: 8px; padding: 7px 9px !important; font-size: 12px !important; }
        .rt-choice-options { display: grid; gap: 2px; max-height: 148px; overflow-y: auto; padding: 3px; }
        .rt-choice-option { display: flex !important; align-items: center; gap: 8px; padding: 6px 7px; border-radius: 7px; color: #334E68 !important; font-size: 11px !important; font-weight: 500 !important; cursor: pointer; }
        .rt-choice-option:hover { background: #F2F7FC; }
        .rt-choice-option input, .rt-month-option input { width: 15px; height: 15px; min-height: 15px; margin: 0; accent-color: #1174E6; flex: 0 0 auto; }
        .rt-choice-empty { padding: 12px 7px; color: #718096; font-size: 11px; }
        .rt-month-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
        .rt-month-option { display: flex !important; align-items: center; gap: 7px; padding: 7px 8px; border: 1px solid transparent; border-radius: 7px; color: #49677F !important; font-size: 11px !important; font-weight: 500 !important; cursor: pointer; }
        .rt-month-option:hover { background: #F2F7FC; }
        .rt-month-option.is-selected { border-color: #B9D6F2; background: #EAF3FC; color: #013F6A !important; font-weight: 700 !important; }
        .rt-selected-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; padding-top: 8px; border-top: 1px solid #EDF2F7; }
        .rt-selected-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 7px !important; border: 1px solid #C7DDF2 !important; border-radius: 999px !important; background: #EFF6FD !important; color: #174B78 !important; font-size: 10px !important; font-weight: 600 !important; }
        .rt-selected-chip span { color: #1174E6; font-size: 14px; line-height: 10px; }
        .rt-status-filter { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin: 15px 0 20px !important; }
        .rt-status-filter > strong { color: #49677F; font-size: 12px; }
        .rt-status-chip { border-radius: 999px !important; padding: 7px 13px !important; background: #fff !important; color: #49677F !important; border-color: #D8E4EF !important; }
        .rt-status-chip.is-selected { background: #E5F1FC !important; border-color: #1174E6 !important; color: #013F6A !important; }
        .rt-results-heading { margin: 22px 0 12px; }
        .rt-results-heading > span { color: #718096; font-size: 12px; }
        .rt-month-grid { grid-template-columns: repeat(auto-fit, minmax(255px, 1fr)) !important; gap: 14px !important; }
        .rt-month-card { min-width: 0; padding: 15px !important; border: 1px solid #DCE7F1 !important; border-radius: 13px; background: #fff; box-shadow: 0 3px 12px rgba(1,63,106,.035); }
        .rt-month-card > strong { display: block; padding-bottom: 10px; border-bottom: 1px solid #edf1ee; color: #174B78; font-size: 13px; }
        .rt-release-card { margin-top: 9px !important; padding: 12px 13px !important; border: 1px solid #e5ece8; border-left-width: 4px; border-radius: 9px; color: #263b32 !important; }
        .rt-release-card > strong { display: block; margin-bottom: 5px; color: #203d31; font-size: 13px; }
        .rt-release-card-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 9px; }
        .rt-release-type-tag { display: inline-flex; align-items: center; width: fit-content; padding: 3px 8px; border: 1px solid; border-radius: 999px; font-size: 10px; font-weight: 750; line-height: 1.35; white-space: nowrap; }
        .rt-release-card > div { margin-top: 4px; color: #718096; font-size: 11px !important; line-height: 1.45; }
        .rt-release-card button { padding: 5px 9px !important; font-size: 11px !important; }
        .rt-release-card button:last-child { color: #b54747 !important; }
        .rt-release-card-compact { padding: 10px !important; }
        .rt-month-list .rt-release-card { max-width: 760px; }
        .rt-empty-state { padding: 26px; border: 1px dashed #C8D8E8; border-radius: 12px; background: #FBFDFF; color: #718096; text-align: center; font-size: 13px; }
        .rt-executive { color: #24364B; }
        .rt-executive > h2 { margin: 24px 0 14px; font-size: 21px; }
        .rt-executive > div[style*="grid-template-columns"] { grid-template-columns: repeat(auto-fit, minmax(245px, 1fr)) !important; gap: 14px !important; }
        .rt-executive > div[style*="grid-template-columns"] > div { border: 1px solid #DCE7F1 !important; border-radius: 13px; padding: 16px !important; background: #fff; box-shadow: 0 3px 12px rgba(1,63,106,.045); }
        .rt-executive [style*="grid-template-columns: repeat(5"] { grid-template-columns: repeat(auto-fit, minmax(175px, 1fr)) !important; }
        .rt-executive [style*="border: 1px solid #ccc"] { border: 1px solid #DCE7F1 !important; border-radius: 13px !important; background: #fff; box-shadow: 0 3px 12px rgba(1,63,106,.045); }
        .rt-executive [style*="cursor: pointer"] { transition: transform .15s ease, box-shadow .15s ease; }
        .rt-executive { display: block; }
        .rt-exec-page-heading { margin: 4px 0 20px; padding: 2px 0 16px; border-bottom: 1px solid #DCE7F1; }
        .rt-exec-page-heading h2 { margin: 0; font-size: 23px; }
        .rt-exec-page-heading p, .rt-exec-section-heading p { margin: 6px 0 0; color: #718096; font-size: 12px; }
        .rt-exec-filter-panel { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 14px 16px; border: 1px solid #DCE7F1; border-radius: 13px; background: #fff; box-shadow: 0 3px 12px rgba(1,63,106,.035); }
        .rt-exec-filter-panel > strong { color: #49677F; font-size: 12px; }
        .rt-exec-filter-panel > div { margin-top: 0 !important; }
        .rt-exec-filter-panel button { border-radius: 999px !important; padding: 7px 13px !important; background: #fff !important; border: 1px solid #D8E4EF !important; color: #49677F !important; }
        .rt-exec-filter-panel button[aria-pressed="true"] { background: #E5F1FC !important; border-color: #1174E6 !important; color: #013F6A !important; }
        .rt-exec-month-grid { grid-template-columns: repeat(auto-fit, minmax(245px, 1fr)) !important; gap: 14px !important; }
        .rt-exec-month-card { min-width: 0; padding: 16px !important; border: 1px solid #DCE7F1 !important; border-radius: 13px; background: #fff; box-shadow: 0 3px 12px rgba(1,63,106,.04); }
        .rt-exec-month-card > strong { display: block; margin-bottom: 5px; color: #174B78; font-size: 14px; }
        .rt-exec-month-card > div:nth-child(2) { color: #718096; font-size: 11px; }
        .rt-exec-month-card > div[style*="height: 16px"] { border: 0 !important; border-radius: 999px; background: #EAF1F7 !important; }
        .rt-exec-month-card > div:last-child { display: flex; flex-wrap: wrap; gap: 7px 12px; color: #718096; font-size: 10px !important; line-height: 1.6; }
        .rt-exec-section-heading { margin: 30px 0 14px; }
        .rt-exec-section-heading h2 { margin: 0; font-size: 20px; }
        .rt-exec-kpi-grid { grid-template-columns: repeat(auto-fit, minmax(185px, 1fr)) !important; gap: 14px !important; margin-top: 14px !important; }
        .rt-exec-kpi-card { min-width: 0; border: 1px solid #DCE7F1 !important; border-radius: 13px !important; padding: 17px !important; background: #fff; box-shadow: 0 3px 12px rgba(1,63,106,.045); }
        .rt-exec-kpi-card > div:first-child { color: #718096 !important; font-size: 11px !important; font-weight: 700; letter-spacing: .01em; }
        .rt-exec-kpi-card > div:nth-child(2) { font-size: 30px !important; line-height: 1.15; letter-spacing: -.04em; }
        .rt-exec-kpi-card > div:nth-child(3) { color: #718096; font-size: 11px !important; line-height: 1.5; }
        .rt-exec-kpi-clickable { cursor: pointer; }
        .rt-exec-delayed-panel { border: 1px solid #DCE7F1 !important; border-radius: 14px !important; padding: 18px !important; background: #fff !important; box-shadow: 0 3px 12px rgba(1,63,106,.035); }
        .rt-exec-delayed-panel > div > .rt-exec-delayed-release-card { border-radius: 10px !important; }
        .rt-exec-product-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important; gap: 14px !important; }
        .rt-exec-product-card { min-width: 0; padding: 16px !important; border: 1px solid #DCE7F1 !important; border-radius: 13px; background: #fff; box-shadow: 0 3px 12px rgba(1,63,106,.04); }
        .rt-exec-product-card > strong { display: block; margin-bottom: 6px; color: #174B78; font-size: 13px; }
        .rt-exec-product-card > div:nth-child(2) { color: #718096; font-size: 11px !important; }
        .rt-exec-product-card > div[style*="height: 16px"] { border: 0 !important; border-radius: 999px; }
        .rt-exec-product-card > div:last-child { display: flex; flex-wrap: wrap; gap: 7px 12px; color: #718096; font-size: 10px !important; line-height: 1.6; }
        @media (max-width: 760px) {
          .rt-app { padding: 16px !important; }
          .rt-app h1 { font-size: 24px; }
          .rt-form-panel, .rt-filter-panel { padding: 15px; }
          .rt-filter-controls { grid-template-columns: 1fr !important; }
          .rt-choice-options { max-height: 180px; }
          .rt-section-heading, .rt-legend-heading, .rt-results-heading { align-items: flex-start; }
          .rt-year-toolbar { flex-wrap: wrap; }
          .rt-export-button { margin-left: 0; }
          .rt-executive > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
          .rt-exec-filter-panel { align-items: flex-start; }
          .rt-exec-page-heading h2 { font-size: 21px; }
          .rt-exec-section-heading { margin-top: 24px; }
        }
      `}</style>
    </div>
  );
}
