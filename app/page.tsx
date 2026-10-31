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

const PRODUCTS = [
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

  const [viewMode, setViewMode] = useState<"tracker" | "executive">("tracker");

  const [executiveSummaryStatusFilter, setExecutiveSummaryStatusFilter] =
  useState<"planned" | "completed" | null>(null);

  const [productMixStatusFilter, setProductMixStatusFilter] = useState<"planned" | "completed" | null>(null);

  const [showDelayedDetails, setShowDelayedDetails] = useState(false);
  const [showDataQualityDetails, setShowDataQualityDetails] = useState(false);

  const storageKey = "releaseTracker:all";

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
    <div id="release-tracker-app" className="rt-app">
      <style jsx global>{`
        #release-tracker-app {
          --rt-ink: #172b3a;
          --rt-muted: #64748b;
          --rt-green: #176b52;
          --rt-green-dark: #115440;
          --rt-green-soft: #e8f3ee;
          --rt-canvas: #f4f7f6;
          --rt-line: #e1e9e5;
          color: var(--rt-ink);
          background: var(--rt-canvas);
          min-height: 100vh;
          padding: 32px clamp(16px, 3vw, 44px) 48px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 14px;
          line-height: 1.5;
        }
        #release-tracker-app * { box-sizing: border-box; }
        #release-tracker-app .rt-header {
          max-width: 1500px; margin: 0 auto 24px; display: flex;
          align-items: flex-end; justify-content: space-between; gap: 18px; flex-wrap: wrap;
        }
        #release-tracker-app .rt-eyebrow { color: var(--rt-green); font-size: 11px; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; margin-bottom: 5px; }
        #release-tracker-app h1 { color: var(--rt-ink); font-size: clamp(26px, 3vw, 34px); line-height: 1.15; letter-spacing: -.035em; margin: 0; font-weight: 750; }
        #release-tracker-app .rt-subtitle { color: var(--rt-muted); margin: 7px 0 0; font-size: 14px; }
        #release-tracker-app .rt-nav { max-width: 1500px; margin: 0 auto 24px; display: flex; gap: 6px; border-bottom: 1px solid var(--rt-line); }
        #release-tracker-app .rt-nav button { border: 0 !important; border-radius: 9px 9px 0 0 !important; background: transparent !important; color: var(--rt-muted) !important; padding: 11px 18px !important; font-weight: 650; box-shadow: none !important; }
        #release-tracker-app .rt-nav button[aria-current="page"] { color: var(--rt-green-dark) !important; background: #e8f3ee !important; box-shadow: inset 0 -2px 0 var(--rt-green) !important; }
        #release-tracker-app > :not(style) { max-width: 1500px; }
        #release-tracker-app h2 { color: var(--rt-ink); font-size: 21px; letter-spacing: -.02em; margin-bottom: 14px; }
        #release-tracker-app h3 { color: var(--rt-ink); }
        #release-tracker-app button { cursor: pointer; border: 1px solid #cbd8d1; border-radius: 8px; background: #fff; color: #29483d; padding: 8px 12px; font: inherit; font-weight: 600; transition: background .15s ease, border-color .15s ease, transform .15s ease; }
        #release-tracker-app button:hover:not(:disabled) { border-color: #8bb5a2; background: #f2f8f5; }
        #release-tracker-app button:disabled { cursor: default; opacity: .55; }
        #release-tracker-app input, #release-tracker-app select, #release-tracker-app textarea { border: 1px solid #d5dfda; border-radius: 8px; background: #fff; color: var(--rt-ink); padding: 9px 11px; font: inherit; min-height: 38px; }
        #release-tracker-app input:focus, #release-tracker-app select:focus, #release-tracker-app textarea:focus { outline: 3px solid rgba(23,107,82,.13); border-color: #4d987b; }
        #release-tracker-app [style*="border: 1px solid #ccc"] { border-color: var(--rt-line) !important; border-radius: 12px; background-color: #fff; }
        #release-tracker-app [style*="repeat(5, 1fr)"] { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) !important; }
        #release-tracker-app [style*="repeat(3, 1fr)"] { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)) !important; }
        #release-tracker-app [style*="repeat(2, 1fr)"] { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important; }
        @media (max-width: 640px) {
          #release-tracker-app { padding: 22px 14px 32px; }
          #release-tracker-app .rt-nav { overflow-x: auto; }
          #release-tracker-app .rt-nav button { white-space: nowrap; padding: 10px 12px !important; }
          #release-tracker-app select[multiple] { max-width: calc(100vw - 36px); }
        }
      `}</style>
      <header className="rt-header">
        <div>
          <div className="rt-eyebrow">Product delivery workspace</div>
          <h1>IBP Release Tracker</h1>
          <p className="rt-subtitle">Plan releases, monitor delivery progress, and keep teams aligned.</p>
        </div>
      </header>

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

      {/* Primary navigation */}
      <nav className="rt-nav" aria-label="Main navigation">
        <button type="button" aria-current={viewMode === "tracker" ? "page" : undefined} onClick={() => setViewMode("tracker")}>Release Tracker</button>
        <button type="button" aria-current={viewMode === "executive" ? "page" : undefined} onClick={() => setViewMode("executive")}>Executive Insights</button>
      </nav>

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

          {/* Data Quality Summary — checks all years and ignores view filters. */}
          {hasLoadedReleases && !storageError && (
          <div
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
    gap: 24,
    flexWrap: "wrap"
  }}
>
  {/* Product Filter */}
  <div>
    <div style={{ fontSize: 12, marginBottom: 4 }}>
      Products
    </div>

    <select
      multiple
      value={productFilter}
      onChange={e =>
        setProductFilter(
          Array.from(
            e.target.selectedOptions,
            option => option.value
          )
        )
      }
      style={{
        minWidth: 260,
        height: 120
      }}
    >
      {[
        "Air Freight Approval Tool",
        "DDPS",
        "Lead Time Check",
        "Predictable Material Capability",
        "Supplier Performance Card",
        "Supply Visualization"
      ].map(product => (
        <option key={product} value={product}>
          {product}
        </option>
      ))}
    </select>

    <div style={{ marginTop: 6 }}>
      <button onClick={() => setProductFilter([])}>
        All Products
      </button>
    </div>
  </div>

  {/* Month Filter */}
  <div>
    <div style={{ fontSize: 12, marginBottom: 4 }}>
      Months
    </div>

    <select
      multiple
      value={monthFilter.map(String)}
      onChange={e =>
        setMonthFilter(
          Array.from(
            e.target.selectedOptions,
            option => Number(option.value)
          )
        )
      }
      style={{
        minWidth: 180,
        height: 120
      }}
    >
      {MONTHS.map((month, index) => (
        <option key={month} value={index}>
          {month}
        </option>
      ))}
    </select>

    <div style={{ marginTop: 6 }}>
      <button onClick={() => setMonthFilter([])}>
        All Months
      </button>
    </div>
  </div>
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
          {monthFilter.length === 1 ? (
            <div>
              <h3>
                {MONTHS[monthFilter[0]]} {selectedYear}
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
                      const effectiveDate = getEffectiveReleaseDate(r);

                      return (
                        parseDateOnly(effectiveDate)?.getUTCMonth() === index
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
        onClick={() =>
          setShowDelayedDetails(!showDelayedDetails)
        }
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

{showDelayedDetails &&
  delayedReleases.length > 0 && (
    <div
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
        {delayedReleases.map(r => (
          <div
            key={r.id}
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: 6,
              padding: 16,
              background: "#FFFFFF"
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

            <div
              style={{
                color: "#6B7280",
                marginBottom: 4,
                fontSize: 12
              }}
            >
              <strong>Product:</strong> {r.product}
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
        ))}
      </div>
    </div>
)}
           
           
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
