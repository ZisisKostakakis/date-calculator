"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "flatpickr/dist/flatpickr.min.css";
import "./flatpickr-dark.css";
import flatpickr from "flatpickr";
import { getApiUrl } from "@/lib/constants";
import type { CalculateResponse } from "@/types";
import { jsPDF } from "jspdf";

type Pair = { start: string; end: string; id?: string };

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function RangeRow({
  p,
  idx,
  onDuplicate,
  onRemove,
  onChange,
}: {
  p: Pair;
  idx: number;
  onDuplicate: () => void;
  onRemove: () => void;
  onChange: (pair: Pair) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const isClearingRef = useRef(false);

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!inputRef.current) return;
    const fp = flatpickr(inputRef.current, {
      mode: "range",
      dateFormat: "Y-m-d",
      defaultDate: p.start && p.end ? [p.start, p.end] : undefined,
      onChange: (selectedDates: Date[]) => {
        // Don't trigger onChange if we're programmatically clearing
        if (isClearingRef.current) return;
        
        if (selectedDates.length === 2) {
          const [s, e] = selectedDates;
          const toStr = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
              2,
              "0"
            )}-${String(d.getDate()).padStart(2, "0")}`;
          const newStart = toStr(s);
          const newEnd = toStr(e);
          // Only update if values actually changed
          if (newStart !== p.start || newEnd !== p.end) {
            onChangeRef.current({ start: newStart, end: newEnd });
          }
        } else if (selectedDates.length === 0) {
          // Only clear if not already empty
          if (p.start || p.end) {
            onChangeRef.current({ start: "", end: "" });
          }
        }
      },
    });

    // If both start and end are empty, clear the flatpickr
    if (!p.start && !p.end) {
      isClearingRef.current = true;
      fp.clear();
      // Reset the flag after a brief delay to allow flatpickr to process
      setTimeout(() => {
        isClearingRef.current = false;
      }, 0);
    }

    return () => {
      fp.destroy();
    };
  }, [idx, p.start, p.end]);
  return (
    <div className="rounded-xl p-3 mb-3 bg-[var(--card-bg)] border border-[var(--border)] shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-wrap">
        <label className="text-sm font-semibold text-[var(--text)] flex-1 min-w-0">
          <span className="block mb-1 sm:inline sm:mb-0">Range: </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Select start → end"
            className="w-full sm:min-w-[260px] border border-[var(--border)] rounded-lg px-2.5 py-2.5 sm:py-2 bg-[var(--input-bg)] text-[var(--text)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] text-base sm:text-sm"
          />
        </label>
        <div className="flex gap-2 sm:flex-shrink-0">
          <button
            onClick={onDuplicate}
            className="flex-1 sm:flex-none px-3 py-2.5 sm:py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--button-bg)] text-[var(--text)] hover:bg-[var(--button-hover-bg)] hover:border-[var(--accent-border)] transition-colors touch-manipulation"
          >
            Duplicate
          </button>
          <button
            onClick={onRemove}
            className="flex-1 sm:flex-none px-3 py-2.5 sm:py-1.5 text-sm font-medium rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)] hover:border-[var(--danger-text)] hover:bg-[var(--danger-bg)]/80 transition-colors touch-manipulation"
          >
            Remove
          </button>
        </div>
      </div>
      {(!p.start || !p.end) && (
        <div className="text-[var(--danger-text)] text-xs mt-1">
          Please select both start and end dates.
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [pairs, setPairs] = useState<Pair[]>([
    { start: "", end: "", id: Date.now().toString() },
  ]);
  const [anchorMonth, setAnchorMonth] = useState<number>(9);
  const [anchorDay, setAnchorDay] = useState<number>(17);
  const [minDays, setMinDays] = useState<number>(183);
  const [mergeOverlaps, setMergeOverlaps] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [result, setResult] = useState<CalculateResponse | null>(null);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [configExpanded, setConfigExpanded] = useState<boolean>(false);

  useEffect(() => {
    // Load saved pairs
    try {
      const raw = localStorage.getItem("nx_pairs");
      if (raw) setPairs(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("nx_pairs", JSON.stringify(pairs));
  }, [pairs]);

  function addPair(p?: Pair) {
    const newPair = p
      ? { ...p, id: Date.now().toString() }
      : { start: "", end: "", id: Date.now().toString() };
    setPairs((prev: Pair[]) => [...prev, newPair]);
  }
  const updatePair = useCallback((idx: number, p: Pair) => {
    setPairs((prev: Pair[]) =>
      prev.map((q: Pair, i: number) => (i === idx ? p : q))
    );
  }, []);
  function removePair(idx: number) {
    setPairs((prev: Pair[]) => {
      const next = prev.filter((_: Pair, i: number) => i !== idx);
      return next.length
        ? next
        : [{ start: "", end: "", id: Date.now().toString() }];
    });
  }
  function clearAll() {
    setPairs([{ start: "", end: "", id: Date.now().toString() }]);
    setResult(null);
  }

  function dedupePairs(inp: Pair[]) {
    const seen = new Set<string>();
    const out: Pair[] = [];
    for (const p of inp) {
      if (!p.start || !p.end) continue;
      const k = `${p.start}|${p.end}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
    return out;
  }

  const uniquePairs = useMemo(() => dedupePairs(pairs), [pairs]);

  function mergePairs(inp: Pair[]): Pair[] {
    if (!inp.length) return inp;
    const toDate = (s: string) => new Date(s);
    const sorted = [...inp].sort(
      (a, b) => toDate(a.start).getTime() - toDate(b.start).getTime()
    );
    const merged: Pair[] = [];
    for (const p of sorted) {
      if (!merged.length) {
        merged.push({ ...p });
        continue;
      }
      const last = merged[merged.length - 1];
      const lastEnd = toDate(last.end);
      const lastEndPlusOne = new Date(lastEnd);
      lastEndPlusOne.setDate(lastEndPlusOne.getDate() + 1);
      const currStart = toDate(p.start);
      const currEnd = toDate(p.end);
      if (currStart <= lastEndPlusOne) {
        if (currEnd > lastEnd) {
          last.end = fmt(currEnd);
        }
      } else {
        merged.push({ ...p });
      }
    }
    return merged;
  }

  async function calculate() {
    // Inline validation
    if (pairs.some((p: Pair) => !p.start || !p.end)) {
      setMessage("Please complete all ranges before calculating.");
      return;
    }
    setMessage("");
    setLoading(true);
    // Build payload
    const API = getApiUrl();
    if (!API) {
      setMessage(
        "API base URL not configured. Please set NEXT_PUBLIC_API_URL environment variable."
      );
      setLoading(false);
      return;
    }
    const pairsForCalc = mergeOverlaps ? mergePairs(uniquePairs) : uniquePairs;
    const payload = {
      ranges: pairsForCalc.map((p: Pair) => [p.start, p.end]),
      anchorMonth,
      anchorDay,
      minDays,
      mergeOverlaps,
      heatmap: showHeatmap,
    };
    try {
      const res = await fetch(`${API}/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      // Check for error response from API
      if (!res.ok || data.error) {
        setMessage(data.error || `API error: ${res.status} ${res.statusText}`);
        setResult(null);
        setLoading(false);
        return;
      }

      setResult(data);
      setLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Check if this is a CORS error
      if (
        errorMessage.includes("CORS") ||
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("ERR_FAILED")
      ) {
        setMessage(
          `CORS error: The API at ${API} is not configured to allow requests from this origin. The API Gateway endpoint needs to be configured with CORS enabled, including proper OPTIONS method handling and CORS headers (Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers).`
        );
      } else {
        setMessage(
          `Failed to reach API at ${API}. Error: ${errorMessage}. Please check your connection and ensure the API is running.`
        );
      }
      setResult(null);
      setLoading(false);
    }
  }

  function downloadResults() {
    if (!result) return;

    const pairsForCalc = mergeOverlaps ? mergePairs(uniquePairs) : uniquePairs;
    const years = Object.keys(result.totals || {}).sort();
    const sum = years.reduce(
      (acc: number, y: string) => acc + (result.totals?.[y] || 0),
      0
    );
    const avg = years.length ? Math.round(sum / years.length) : 0;

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const formatDate = (dateStr: string) => {
      const [y, m, d] = dateStr.split("-");
      return `${monthNames[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
    };

    const formatNumber = (num: number) => {
      return num.toLocaleString();
    };

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let yPos = 30;
    const lineHeight = 8;

    // Simple helper to add text
    const addText = (text: string, fontSize = 12, isBold = false) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 30;
      }
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, margin, yPos);
      yPos += lines.length * lineHeight + 3;
    };

    // Title
    addText("Date Calculator Results", 18, true);
    addText(`Generated: ${new Date().toLocaleString()}`, 10);
    yPos += 5;

    // Configuration
    addText("Configuration", 14, true);
    addText(`Anchor Period: ${monthNames[anchorMonth - 1]} ${anchorDay}`);
    addText(`Threshold: ${formatNumber(minDays)} days per period`);
    addText(`Merge Overlaps: ${mergeOverlaps ? "Yes" : "No"}`);
    addText(`Show Heatmap: ${showHeatmap ? "Yes" : "No"}`);
    yPos += 5;

    // Date Ranges
    addText("Date Ranges", 14, true);
    if (pairsForCalc.length === 0) {
      addText("(No date ranges specified)");
    } else {
      pairsForCalc.forEach((p: Pair, idx: number) => {
        addText(`${idx + 1}. ${p.start} to ${p.end}`);
        addText(`   ${formatDate(p.start)} to ${formatDate(p.end)}`, 10);
      });
    }
    yPos += 5;

    // Errors
    if (result.errors && result.errors.length > 0) {
      addText("Errors", 14, true);
      result.errors.forEach((err: string, idx: number) => {
        addText(`${idx + 1}. ${err}`);
      });
      yPos += 5;
    }

    // Summary
    addText("Summary", 14, true);
    const statusText = result.overall_pass ? "PASS" : "FAIL";
    addText(`Overall Status: ${statusText}`, 12, true);
    addText(`Requirement: ≥ ${formatNumber(minDays)} days per period`, 10);
    addText(`Total Days: ${formatNumber(sum)}`);
    addText(`Average per Period: ${formatNumber(avg)} days`);
    addText(`Periods Tracked: ${formatNumber(years.length)}`);
    yPos += 5;

    // Period Breakdown
    if (years.length > 0) {
      addText("Period Breakdown", 14, true);
      years.forEach((y, idx) => {
        const d = result.totals[y];
        const endYear = parseInt(y.split("-")[1], 10);
        const isLeap =
          endYear % 4 === 0 && (endYear % 100 !== 0 || endYear % 400 === 0);
        const denom = isLeap ? 366 : 365;
        const pct = Math.round((d / denom) * 100);
        const pass = result.passes && result.passes[y];
        const heat =
          result.heatmap && result.heatmap[y]
            ? new Set<string>(result.heatmap[y])
            : undefined;

        const periodLabel = `${monthNames[anchorMonth - 1]} ${y}`;
        const periodStatus = pass ? "PASS" : "FAIL";

        addText(`Period ${idx + 1}: ${periodLabel}`, 12, true);
        addText(`Status: ${periodStatus}`);
        addText(`Days: ${d} / ${denom} (${pct}%)`);

        if (heat && showHeatmap) {
          const heatDates = Array.from(heat).sort();
          addText(`Active Dates: ${heatDates.length} days`, 10);
          if (heatDates.length <= 15) {
            addText(`Dates: ${heatDates.join(", ")}`, 9);
          } else {
            const firstFew = heatDates.slice(0, 5).join(", ");
            const lastFew = heatDates.slice(-5).join(", ");
            addText(`Dates: ${firstFew} ... ${lastFew}`, 9);
            addText(`(showing first and last 5 of ${heatDates.length} dates)`, 9);
          }
        }
        yPos += 3;
      });
    }

    // Save the PDF
    doc.save(
      `date-calculator-results-${new Date().toISOString().split("T")[0]}.pdf`
    );
  }

  // heatmap rendering for a given year label
  function Heatmap({ y, heat }: { y: string; heat?: Set<string> }) {
    if (!heat || !showHeatmap) return null;
    const [startYear] = y.split("-").map((n) => parseInt(n, 10));
    const aMonth = anchorMonth;
    const aDay = anchorDay;
    const start = new Date(startYear, aMonth - 1, aDay);
    const end = new Date(startYear + 1, aMonth - 1, aDay - 1);
    const months: React.JSX.Element[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const ym = `${cursor.getFullYear()}-${String(
        cursor.getMonth() + 1
      ).padStart(2, "0")}`;
      const mStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const cells: React.JSX.Element[] = [];
      const it = new Date(mStart);
      while (it <= mEnd) {
        const iso = fmt(it);
        const active = heat.has(iso);
        cells.push(
          <div
            key={iso}
            className={`w-2.5 h-2.5 m-0.5 rounded-sm ${
              active ? "bg-[var(--accent)]" : "bg-[var(--heat-empty)]"
            }`}
          />
        );
        it.setDate(it.getDate() + 1);
      }
      months.push(
        <div key={ym} className="flex-shrink-0">
          <div className="text-xs font-semibold text-slate-300 mb-1">{ym}</div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              maxWidth: "100%",
              width: 126,
            }}
          >
            {cells}
          </div>
        </div>
      );
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return (
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}
        className="overflow-x-auto"
      >
        {months}
      </div>
    );
  }

  return (
    <div className="max-w-[920px] mx-auto p-4 sm:p-6 md:p-8 text-[var(--text)] bg-[var(--bg)] min-h-screen">
      {/* Hero Section */}
      <div className="mb-8 sm:mb-10 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-6">
          <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent-soft)] border border-[var(--accent-border)] flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 sm:w-10 sm:h-10 text-[var(--accent)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3 text-[var(--text)] leading-tight">
              Date Calculator
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-[var(--muted-text)] leading-relaxed">
              Track and calculate days across custom date ranges with ease.
              Perfect for residency tracking, travel days, or any time-based
              calculations you need.
            </p>
          </div>
        </div>
        <div className="rounded-xl p-4 sm:p-5 md:p-6 bg-gradient-to-br from-[var(--card-bg)] to-[var(--surface-alt)] border border-[var(--accent-border)]/30 shadow-lg">
          <p className="text-[var(--text)] text-sm sm:text-base leading-relaxed">
            <span className="font-semibold text-[var(--accent)] inline-flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              How it works:
            </span>{" "}
            Simply add your date ranges, configure your anchor period (the start
            of your custom year), and let the calculator show you how many days
            fall within each period. You can track multiple ranges, merge
            overlaps, and even visualize your data with heatmaps.
          </p>
        </div>
      </div>

      {/* Quick Presets Section */}
      <div className="mb-4 sm:mb-6">
        <div className="rounded-xl p-4 sm:p-5 bg-[var(--card-bg)] border border-[var(--border)] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-sm font-semibold text-[var(--text)] flex items-center gap-2 flex-shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-[var(--accent)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Quick Presets:
            </label>
            <select
              id="presetSelect"
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const val = e.target.value;
                const today = new Date();
                let s = "",
                  eDate = "";
                if (val === "today") {
                  s = fmt(today);
                  eDate = fmt(today);
                } else if (val === "last7") {
                  const st = new Date(today);
                  st.setDate(st.getDate() - 6);
                  s = fmt(st);
                  eDate = fmt(today);
                } else if (val === "last30") {
                  const st = new Date(today);
                  st.setDate(st.getDate() - 29);
                  s = fmt(st);
                  eDate = fmt(today);
                } else if (val === "thisSepYear") {
                  const y =
                    today.getMonth() < 8 ||
                    (today.getMonth() === 8 && today.getDate() < 17)
                      ? today.getFullYear() - 1
                      : today.getFullYear();
                  s = fmt(new Date(y, 8, 17));
                  eDate = fmt(new Date(y + 1, 8, 16));
                } else if (val === "lastSepYear") {
                  const base = new Date(
                    today.getFullYear() - 1,
                    today.getMonth(),
                    today.getDate()
                  );
                  const y =
                    base.getMonth() < 8 ||
                    (base.getMonth() === 8 && base.getDate() < 17)
                      ? base.getFullYear() - 1
                      : base.getFullYear();
                  s = fmt(new Date(y, 8, 17));
                  eDate = fmt(new Date(y + 1, 8, 16));
                }
                if (s && eDate) addPair({ start: s, end: eDate });
                (
                  document.getElementById("presetSelect") as HTMLSelectElement
                ).value = "";
              }}
              defaultValue=""
              className="flex-1 min-w-0 border rounded-lg px-3 py-2.5 sm:py-2 text-base sm:text-sm font-medium bg-[var(--input-bg)] border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">Select a preset to add a date range…</option>
              <option value="today">Today</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
              <option value="thisSepYear">This Sept-year</option>
              <option value="lastSepYear">Last Sept-year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="mb-4 sm:mb-6">
        <div className="rounded-xl bg-[var(--card-bg)] border border-[var(--border)] shadow-sm overflow-hidden">
          <button
            onClick={() => setConfigExpanded(!configExpanded)}
            className="w-full px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between text-left hover:bg-[var(--surface-hover)] transition-colors touch-manipulation"
          >
            <div className="flex items-center gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-[var(--accent)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-base sm:text-lg font-semibold text-[var(--text)]">
                Configuration
              </span>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-5 h-5 text-[var(--muted-text)] transition-transform duration-200 ${
                configExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {configExpanded && (
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 border-t border-[var(--border)] animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-4 sm:space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <label className="text-sm font-medium text-[var(--text)] flex items-center gap-2 min-w-[120px]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 text-[var(--accent)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Anchor Period:
                  </label>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      value={anchorMonth}
                      min={1}
                      max={12}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setAnchorMonth(Number(e.target.value) || 9)
                      }
                      className="w-20 sm:w-16 border rounded-lg px-3 py-2.5 sm:py-2 bg-[var(--input-bg)] border-[var(--border)] text-[var(--text)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-base sm:text-sm"
                      placeholder="Month"
                    />
                    <span className="text-[var(--muted-text)]">/</span>
                    <input
                      type="number"
                      value={anchorDay}
                      min={1}
                      max={31}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setAnchorDay(Number(e.target.value) || 17)
                      }
                      className="w-20 sm:w-16 border rounded-lg px-3 py-2.5 sm:py-2 bg-[var(--input-bg)] border-[var(--border)] text-[var(--text)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-base sm:text-sm"
                      placeholder="Day"
                    />
                    <span className="text-sm text-[var(--muted-text)] ml-1">
                      (MM/DD)
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <label className="text-sm font-medium text-[var(--text)] flex items-center gap-2 min-w-[120px]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 text-[var(--accent)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    Threshold:
                  </label>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      value={minDays}
                      min={1}
                      max={366}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setMinDays(Number(e.target.value) || 183)
                      }
                      className="w-24 sm:w-20 border rounded-lg px-3 py-2.5 sm:py-2 bg-[var(--input-bg)] border-[var(--border)] text-[var(--text)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-base sm:text-sm"
                    />
                    <span className="text-sm text-[var(--muted-text)]">
                      days per period
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-2 border-t border-[var(--border)]">
                  <span className="text-sm font-medium text-[var(--text)] min-w-[120px]">
                    Options:
                  </span>
                  <div className="flex flex-wrap gap-4 sm:gap-6">
                    <label className="text-sm inline-flex items-center gap-2 text-[var(--text)] font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mergeOverlaps}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setMergeOverlaps(e.target.checked)
                        }
                        className="size-5 sm:size-4 cursor-pointer accent-[var(--accent)]"
                      />
                      Merge overlaps
                    </label>
                    <label className="text-sm inline-flex items-center gap-2 text-[var(--text)] font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showHeatmap}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setShowHeatmap(e.target.checked)
                        }
                        className="size-5 sm:size-4 cursor-pointer accent-[var(--accent)]"
                      />
                      Show heatmap
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Date Ranges Section */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-[var(--text)] flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-[var(--accent)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            Date Ranges
          </h2>
          <span className="px-3 py-1 rounded-full bg-[var(--chip-bg)] border border-[var(--accent-border)] text-sm font-semibold text-[var(--chip-text)]">
            {pairs.filter((p) => p.start && p.end).length} / {pairs.length}
          </span>
        </div>
        <div className="space-y-3">
          {pairs.map((p: Pair, idx: number) => (
            <RangeRow
              key={p.id || idx}
              p={p}
              idx={idx}
              onDuplicate={() => addPair(p)}
              onRemove={() => removePair(idx)}
              onChange={(pair: Pair) => updatePair(idx, pair)}
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <button
            onClick={() => addPair()}
            className="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 text-base sm:text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--button-bg)] text-[var(--text)] hover:bg-[var(--button-hover-bg)] hover:border-[var(--accent-border)] transition-colors touch-manipulation flex items-center justify-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 sm:w-4 sm:h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add Range
          </button>
          <button
            onClick={clearAll}
            className="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 text-base sm:text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--button-bg)] text-[var(--text)] hover:bg-[var(--button-hover-bg)] hover:border-[var(--accent-border)] transition-colors touch-manipulation flex items-center justify-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 sm:w-4 sm:h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Clear All
          </button>
        </div>
        <button
          onClick={calculate}
          disabled={loading}
          className="w-full sm:w-auto sm:min-w-[180px] px-6 py-3.5 sm:py-3 text-base sm:text-sm font-bold rounded-lg bg-[var(--accent)] text-slate-900 hover:bg-[var(--accent-strong)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation shadow-lg shadow-[var(--accent)]/20 hover:shadow-xl hover:shadow-[var(--accent)]/30"
        >
          {loading && (
            <svg
              className="animate-spin h-5 w-5 sm:h-4 sm:w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          {loading ? "Calculating..." : "Calculate Total"}
        </button>
      </div>

      {message && (
        <div className="border rounded-xl p-4 mb-4 bg-[var(--notice-bg)] border-[var(--notice-border)] text-sm font-medium text-[var(--text)] animate-in slide-in-from-top-2 duration-200">
          {message}
        </div>
      )}

      {/* Results Section */}
      <div className="mt-6 sm:mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-[var(--text)] flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-[var(--accent)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Results
          </h2>
          {result && (
            <button
              onClick={downloadResults}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-base sm:text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--button-bg)] text-[var(--text)] hover:bg-[var(--button-hover-bg)] hover:border-[var(--accent-border)] transition-colors touch-manipulation flex items-center justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 sm:h-4 sm:w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download Results
            </button>
          )}
        </div>
        <div className="border rounded-xl p-4 sm:p-5 bg-[var(--surface)] border-[var(--border)] shadow-sm">
          {!result && (
            <div className="text-center py-8 sm:py-12">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-[var(--muted-text)] opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p className="text-sm sm:text-base font-medium text-[var(--muted-text)]">
                No results yet. Click &quot;Calculate Total&quot; to see your
                results.
              </p>
            </div>
          )}
          {result && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              {result.errors && result.errors.length > 0 && (
                <div className="border rounded-xl p-4 mb-4 bg-[var(--danger-bg)] border-[var(--danger-border)] whitespace-pre-line text-[var(--danger-text)] font-medium animate-in slide-in-from-top-2 duration-200">
                  <strong className="font-bold flex items-center gap-2 mb-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Errors
                  </strong>
                  {result.errors.join("\n")}
                </div>
              )}
              <div className="border rounded-xl p-4 mb-4 bg-gradient-to-br from-[var(--surface-alt)] to-[var(--card-bg)] border-[var(--border)] text-[var(--text)] font-medium">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-sm sm:text-base">Overall Status:</span>
                  <strong
                    className={`text-lg sm:text-xl font-bold ${
                      result.overall_pass
                        ? "text-[var(--success)]"
                        : "text-[var(--danger-text)]"
                    }`}
                  >
                    {result.overall_pass ? "PASS" : "FAIL"}
                  </strong>
                </div>
                <div className="text-xs sm:text-sm text-[var(--muted-text)] mt-1">
                  Requirement: ≥ {minDays} days per period
                </div>
              </div>
              {(() => {
                const years = Object.keys(result.totals || {}).sort();
                const sum = years.reduce(
                  (acc: number, y: string) => acc + (result.totals?.[y] || 0),
                  0
                );
                const avg = years.length ? Math.round(sum / years.length) : 0;
                return (
                  <div className="flex flex-wrap gap-3 mb-4">
                    <span className="px-4 py-2 rounded-full border bg-[var(--chip-bg)] border-[var(--accent-border)] text-sm text-[var(--chip-text)] font-medium">
                      <strong className="font-bold">Total days:</strong> {sum}
                    </span>
                    <span className="px-4 py-2 rounded-full border bg-[var(--chip-bg)] border-[var(--accent-border)] text-sm text-[var(--chip-text)] font-medium">
                      <strong className="font-bold">Average:</strong> {avg} days
                    </span>
                  </div>
                );
              })()}
              {(() => {
                const years: string[] = Object.keys(result.totals || {}).sort();
                if (years.length === 0)
                  return (
                    <div className="border rounded-xl p-4 text-center text-[var(--muted-text)]">
                      No valid ranges selected.
                    </div>
                  );
                return (
                  <div
                    className="grid gap-4 mt-4"
                    style={{
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
                    }}
                  >
                    {years.map((y, idx) => {
                      const d = result.totals[y];
                      const endYear = parseInt(y.split("-")[1], 10);
                      const isLeap =
                        endYear % 4 === 0 &&
                        (endYear % 100 !== 0 || endYear % 400 === 0);
                      const denom = isLeap ? 366 : 365;
                      const pct = Math.min(100, Math.round((d / denom) * 100));
                      const pass = result.passes && result.passes[y];
                      const heat =
                        result.heatmap && result.heatmap[y]
                          ? new Set<string>(result.heatmap[y])
                          : undefined;
                      return (
                        <div
                          key={y}
                          className="border rounded-xl p-4 bg-[var(--card-bg)] border-[var(--border)] shadow-sm hover:shadow-md transition-shadow animate-in fade-in slide-in-from-bottom-2 duration-300"
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          <div className="font-semibold text-[var(--muted-text)] mb-2 text-sm">
                            {y}
                          </div>
                          <div
                            className={`inline-block rounded-full px-3 py-1.5 font-semibold mb-3 ${
                              pass
                                ? "bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success-border)]"
                                : "bg-[var(--chip-bg)] text-[var(--chip-text)] border border-[var(--accent-border)]"
                            }`}
                          >
                            {d} / {denom} days {pass ? "✓" : ""}
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full border bg-[var(--heat-empty)] border-[var(--border)] mb-3">
                            <div
                              className={`h-full transition-all duration-500 ${
                                pass
                                  ? "bg-[var(--success)]"
                                  : "bg-[var(--accent)]"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <Heatmap y={y} heat={heat} />
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
