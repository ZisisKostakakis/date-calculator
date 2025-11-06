"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import 'flatpickr/dist/flatpickr.min.css';
import './flatpickr-dark.css';
import flatpickr from 'flatpickr';

type Pair = { start: string; end: string; id?: string };

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function RangeRow({ p, idx, onDuplicate, onRemove, onChange }: { p: Pair; idx: number; onDuplicate: () => void; onRemove: () => void; onChange: (pair: Pair) => void; }) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (!inputRef.current) return;
    const fp = flatpickr(inputRef.current, {
      mode: 'range',
      dateFormat: 'Y-m-d',
      defaultDate: (p.start && p.end) ? [p.start, p.end] : undefined,
      onChange: (selectedDates: Date[]) => {
        if (selectedDates.length === 2) {
          const [s, e] = selectedDates;
          const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          onChange({ start: toStr(s), end: toStr(e) });
        } else if (selectedDates.length === 0) {
          // Clear the dates when flatpickr is cleared
          onChange({ start: "", end: "" });
        }
      },
    });
    
    // If both start and end are empty, clear the flatpickr
    if (!p.start && !p.end) {
      fp.clear();
    }
    
    return () => { fp.destroy(); };
  }, [idx, p.start, p.end]); // Removed onChange from dependencies
  return (
    <div className="rounded-xl p-3 mb-3 bg-[var(--card-bg)] border border-[var(--border)] shadow-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-sm font-semibold text-[var(--text)]">Range: <input ref={inputRef} type="text" placeholder="Select start → end" className="border border-[var(--border)] rounded-lg px-2.5 py-2 min-w-[260px] bg-[var(--input-bg)] text-[var(--text)] placeholder:text-[var(--muted-text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]" /></label>
        <button onClick={onDuplicate} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--button-bg)] text-[var(--text)] hover:bg-[var(--button-hover-bg)] hover:border-[var(--accent-border)] transition-colors">Duplicate</button>
        <button onClick={onRemove} className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)] hover:border-[var(--danger-text)] hover:bg-[var(--danger-bg)]/80 transition-colors">Remove</button>
      </div>
      {(!p.start || !p.end) && (<div className="text-[var(--danger-text)] text-xs mt-1">Please select both start and end dates.</div>)}
    </div>
  );
}

export default function Home() {
  const [pairs, setPairs] = useState<Pair[]>([{ start: "", end: "", id: Date.now().toString() }]);
  const [anchorMonth, setAnchorMonth] = useState<number>(9);
  const [anchorDay, setAnchorDay] = useState<number>(17);
  const [minDays, setMinDays] = useState<number>(183);
  const [mergeOverlaps, setMergeOverlaps] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState<string>("");

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
    const newPair = p ? { ...p, id: Date.now().toString() } : { start: "", end: "", id: Date.now().toString() };
    setPairs((prev) => [...prev, newPair]);
  }
  const updatePair = useCallback((idx: number, p: Pair) => {
    setPairs((prev) => prev.map((q, i) => (i === idx ? p : q)));
  }, []);
  function removePair(idx: number) {
    setPairs((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [{ start: "", end: "", id: Date.now().toString() }];
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
    const sorted = [...inp].sort((a, b) => toDate(a.start).getTime() - toDate(b.start).getTime());
    const merged: Pair[] = [];
    for (const p of sorted) {
      if (!merged.length) { merged.push({ ...p }); continue; }
      const last = merged[merged.length - 1];
      const lastEnd = toDate(last.end);
      const lastEndPlusOne = new Date(lastEnd); lastEndPlusOne.setDate(lastEndPlusOne.getDate() + 1);
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
    if (pairs.some((p) => !p.start || !p.end)) {
      setMessage("Please complete all ranges before calculating.");
      return;
    }
    setMessage("");
    // Build payload
    const API = (process.env.NEXT_PUBLIC_API_URL as string) || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:5000` : "");
    if (!API) { setMessage("API base URL not set"); return; }
    const pairsForCalc = mergeOverlaps ? mergePairs(uniquePairs) : uniquePairs;
    const payload = {
      ranges: pairsForCalc.map((p) => [p.start, p.end]),
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
      
      // Check for error response from backend
      if (!res.ok || data.error) {
        setMessage(data.error || `API error: ${res.status} ${res.statusText}`);
        setResult(null);
        return;
      }
      
      setResult(data);
    } catch (err) {
      setMessage("Failed to reach backend. Ensure API is running on port 5000.");
      setResult(null);
    }
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
      const ym = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const mStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const cells: React.JSX.Element[] = [];
      const it = new Date(mStart);
      while (it <= mEnd) {
        const iso = fmt(it);
        const active = heat.has(iso);
        cells.push(
          <div key={iso} className={`w-2.5 h-2.5 m-0.5 rounded-sm ${active ? 'bg-[var(--accent)]' : 'bg-[var(--heat-empty)]'}`} />
        );
        it.setDate(it.getDate() + 1);
      }
      months.push(
        <div key={ym}>
          <div className="text-xs font-semibold text-slate-300 mb-1">{ym}</div>
          <div style={{ display: "flex", flexWrap: "wrap", width: 126 }}>{cells}</div>
        </div>
      );
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>{months}</div>;
  }

  return (
    <div className="max-w-[920px] mx-auto p-6 md:p-8 text-[var(--text)] bg-[var(--bg)]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="m-0 text-xl font-bold">Date Calculator</h2>
      </div>

      <p className="text-[var(--muted-text)] text-sm -mt-1 mb-3">Add one or more date ranges. Each entry uses a single range picker.</p>

      <div className="flex flex-wrap gap-2 mb-3">
        <select id="presetSelect" onChange={(e) => {
          const val = e.target.value; const today = new Date(); let s = "", eDate = "";
          if (val === "today") { s = fmt(today); eDate = fmt(today); }
          else if (val === "last7") { const st = new Date(today); st.setDate(st.getDate()-6); s = fmt(st); eDate = fmt(today); }
          else if (val === "last30") { const st = new Date(today); st.setDate(st.getDate()-29); s = fmt(st); eDate = fmt(today); }
          else if (val === "thisSepYear") { const y = today.getMonth()<8 || (today.getMonth()===8 && today.getDate()<17) ? today.getFullYear()-1 : today.getFullYear(); s = fmt(new Date(y,8,17)); eDate = fmt(new Date(y+1,8,16)); }
          else if (val === "lastSepYear") { const base = new Date(today.getFullYear()-1, today.getMonth(), today.getDate()); const y = base.getMonth()<8 || (base.getMonth()===8 && base.getDate()<17) ? base.getFullYear()-1 : base.getFullYear(); s = fmt(new Date(y,8,17)); eDate = fmt(new Date(y+1,8,16)); }
          if (s && eDate) addPair({ start: s, end: eDate });
          (document.getElementById('presetSelect') as HTMLSelectElement).value = "";
        }} defaultValue="" className="border rounded-lg px-2 py-1.5 text-sm font-medium bg-[var(--input-bg)] border-[var(--border)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
          <option value="">Quick Preset…</option>
          <option value="today">Today</option>
          <option value="last7">Last 7 days</option>
          <option value="last30">Last 30 days</option>
          <option value="thisSepYear">This Sept-year</option>
          <option value="lastSepYear">Last Sept-year</option>
        </select>
        <span className="text-sm font-medium text-[var(--text)]">Anchor: <input type="number" value={anchorMonth} min={1} max={12} onChange={(e) => setAnchorMonth(Number(e.target.value) || 9)} className="w-[60px] border rounded-lg px-2 py-1.5 bg-[var(--input-bg)] border-[var(--border)] text-[var(--text)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />/<input type="number" value={anchorDay} min={1} max={31} onChange={(e) => setAnchorDay(Number(e.target.value) || 17)} className="w-[60px] border rounded-lg px-2 py-1.5 bg-[var(--input-bg)] border-[var(--border)] text-[var(--text)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" /></span>
        <span className="text-sm font-medium text-[var(--text)]">Threshold: <input type="number" value={minDays} min={1} max={366} onChange={(e) => setMinDays(Number(e.target.value) || 183)} className="w-[80px] border rounded-lg px-2 py-1.5 bg-[var(--input-bg)] border-[var(--border)] text-[var(--text)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" /> days</span>
        <label className="text-sm inline-flex items-center gap-2 text-[var(--text)] font-medium cursor-pointer"><input type="checkbox" checked={mergeOverlaps} onChange={(e) => setMergeOverlaps(e.target.checked)} className="size-4 cursor-pointer accent-[var(--accent)]" /> Merge overlaps</label>
        <label className="text-sm inline-flex items-center gap-2 text-[var(--text)] font-medium cursor-pointer"><input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} className="size-4 cursor-pointer accent-[var(--accent)]" /> Show heatmap</label>
      </div>

      <div>
        {pairs.map((p, idx) => (
          <RangeRow
            key={p.id || idx}
            p={p}
            idx={idx}
            onDuplicate={() => addPair(p)}
            onRemove={() => removePair(idx)}
            onChange={(pair) => updatePair(idx, pair)}
          />
        ))}
      </div>

      <div className="flex gap-2 flex-wrap my-3">
        <button onClick={() => addPair()} className="px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--button-bg)] text-[var(--text)] hover:bg-[var(--button-hover-bg)] hover:border-[var(--accent-border)] transition-colors">Add Date Range</button>
        <button onClick={clearAll} className="px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--button-bg)] text-[var(--text)] hover:bg-[var(--button-hover-bg)] hover:border-[var(--accent-border)] transition-colors">Clear All</button>
        <button onClick={calculate} className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent)] text-slate-900 hover:bg-[var(--accent-strong)] transition-colors">Calculate Total</button>
      </div>

      {message && <div className="border rounded-xl p-3 mb-2 bg-[var(--notice-bg)] border-[var(--notice-border)] text-sm font-medium text-[var(--text)]">{message}</div>}

      <h3 className="mt-4 mb-2 font-bold text-[var(--text)]">Results</h3>
      <div className="border rounded-xl p-3 bg-[var(--surface)] border-[var(--border)]">
        {!result && <div className="text-sm font-medium text-[var(--muted-text)]">No results yet. Click "Calculate Total" to see your results.</div>}
        {result && (
          <>
            {result.errors && result.errors.length > 0 && (
              <div className="border rounded-xl p-3 mb-2 bg-[var(--danger-bg)] border-[var(--danger-border)] whitespace-pre-line text-[var(--danger-text)] font-medium">
                <strong className="font-bold">Errors</strong>{"\n"}{result.errors.join("\n")}
              </div>
            )}
            <div className="border rounded-xl p-3 mb-2 bg-[var(--surface-alt)] border-[var(--border)] text-[var(--text)] font-medium">
              Overall: <strong className={result.overall_pass ? "text-[var(--success)] font-bold" : "text-[var(--danger-text)] font-bold"}>{result.overall_pass ? "PASS" : "FAIL"}</strong> (≥ {result.threshold} days per Sept-year)
            </div>
            {(() => {
              const years = Object.keys(result.totals || {}).sort();
              const sum = years.reduce((acc: number, y: string) => acc + (result.totals[y] || 0), 0);
              const avg = years.length ? Math.round(sum / years.length) : 0;
              return (
                <div className="flex gap-3 flex-wrap mb-2">
                  <span className="px-3 py-1.5 rounded-full border bg-[var(--chip-bg)] border-[var(--accent-border)] text-sm text-[var(--chip-text)] font-medium">
<strong className="font-bold">Total days:</strong> {sum}</span>
                  <span className="px-3 py-1.5 rounded-full border bg-[var(--chip-bg)] border-[var(--accent-border)] text-sm text-[var(--chip-text)] font-medium">
<strong className="font-bold">Average per year:</strong> {avg}</span>
                </div>
              );
            })()}
            {(() => {
              const years: string[] = Object.keys(result.totals || {}).sort();
              if (years.length === 0) return <div className="border rounded-xl p-3">No valid ranges selected.</div>;
              return (
                <div className="grid gap-3 mt-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                  {years.map((y) => {
                    const d = result.totals[y];
                    const endYear = parseInt(y.split("-")[1], 10);
                    const isLeap = endYear % 4 === 0 && (endYear % 100 !== 0 || endYear % 400 === 0);
                    const denom = isLeap ? 366 : 365;
                    const pct = Math.min(100, Math.round((d / denom) * 100));
                    const pass = result.passes && result.passes[y];
                    const heat = result.heatmap && result.heatmap[y] ? new Set<string>(result.heatmap[y]) : undefined;
                    return (
                      <div key={y} className="border rounded-xl p-3 bg-[var(--card-bg)] border-[var(--border)] shadow-sm">
                        <div className="font-semibold text-[var(--muted-text)] mb-1">Sep {y}</div>
                        <div className={`inline-block rounded-full px-3 py-1 font-semibold mb-2 ${pass ? 'bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success-border)]' : 'bg-[var(--chip-bg)] text-[var(--chip-text)] border border-[var(--accent-border)]'}`}>{d} / {denom} days {pass ? "✓" : ""}</div>
                        <div className="h-2 overflow-hidden rounded-full border bg-[var(--heat-empty)] border-[var(--border)]">
                          <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                        </div>
                        <Heatmap y={y} heat={heat} />
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
