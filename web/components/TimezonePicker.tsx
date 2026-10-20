"use client";

import { getCountriesForTimezone } from "countries-and-timezones";
import { Check, ChevronDown, Globe, MapPin, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

interface Zone {
  id: string;
  city: string;
  /** Country names, then the IANA region (e.g. "Romania · Europe"). */
  place: string;
  offset: string;
  offsetMinutes: number;
  time: string;
  haystack: string;
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** "GMT+05:30" → { label: "UTC+5:30", minutes: 330 }, "GMT" → "UTC±0". */
function offsetOf(timeZone: string, now: Date) {
  const raw =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = raw.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return { label: "UTC±0", minutes: 0 };
  const [, sign, h, min] = m;
  const minutes = (sign === "-" ? -1 : 1) * (Number(h) * 60 + Number(min));
  return { label: `UTC${sign}${Number(h)}${min === "00" ? "" : `:${min}`}`, minutes };
}

function buildZones(current: string): Zone[] {
  const now = new Date();
  const ids = Intl.supportedValuesOf("timeZone");
  if (!ids.includes(current)) ids.unshift(current);
  return ids.map((id) => {
    const segments = id.split("/");
    const city = (segments.at(-1) ?? id).replaceAll("_", " ");
    const region = segments.length > 1 ? segments[0]!.replaceAll("_", " ") : "";
    const countries = getCountriesForTimezone(id).map((c) => c.name);
    const { label, minutes } = offsetOf(id, now);
    const place = [...countries, region].filter(Boolean).join(" · ");
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: id, hour: "2-digit", minute: "2-digit" }).format(now);
    const sign = minutes < 0 ? "-" : "+";
    const hours = Math.abs(minutes) / 60;
    return {
      id,
      city,
      place,
      offset: label,
      offsetMinutes: minutes,
      time,
      haystack: normalize(`${city} ${place} ${id.replaceAll("_", " ")} ${label} gmt${sign}${hours} utc${sign}${hours}`),
    };
  });
}

/** Ranks matches: city prefix, then country/region prefix, then anywhere. */
function search(zones: Zone[], query: string): Zone[] {
  const q = normalize(query.trim());
  if (!q) return zones;
  const tokens = q.split(/\s+/);
  const scored: { zone: Zone; score: number }[] = [];
  for (const zone of zones) {
    if (!tokens.every((t) => zone.haystack.includes(t))) continue;
    const city = normalize(zone.city);
    const place = normalize(zone.place);
    const score = city.startsWith(q) ? 0 : place.startsWith(q) || place.includes(` ${q}`) ? 1 : city.includes(q) ? 2 : 3;
    scored.push({ zone, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.zone.city.localeCompare(b.zone.city)).map((s) => s.zone);
}

export function TimezonePicker({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  // Rebuilt on every open so offsets and local times are current.
  const zones = useMemo(() => (open ? buildZones(value) : []), [open, value]);
  const browserZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const results = useMemo(() => {
    if (query.trim()) return search(zones, query);
    // No query: current zone first, then the browser's own zone, then everything by offset.
    const pinned = [value, browserZone].filter((id, i, a) => a.indexOf(id) === i);
    const rest = zones.filter((z) => !pinned.includes(z.id)).sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city));
    return [...pinned.map((id) => zones.find((z) => z.id === id)).filter((z): z is Zone => !!z), ...rest];
  }, [zones, query, value, browserZone]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = () => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  const choose = (id: string) => {
    if (id !== value) onChange(id);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const zone = results[active];
      if (zone) choose(zone.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const currentCity = (value.split("/").at(-1) ?? value).replaceAll("_", " ");

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-fg/[0.08] bg-ink-850/80 px-3 py-1.5 text-xs font-medium text-mist-200 transition hover:border-fg/20 hover:text-mist-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xp-a/50"
        title={value}
      >
        <Globe className="h-3.5 w-3.5 text-mist-400" aria-hidden />
        <span className="max-w-[10rem] truncate">{currentCity}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-mist-500 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="fixed inset-x-4 top-20 z-50 origin-top overflow-hidden rounded-2xl border border-fg/10 bg-ink-950 shadow-2xl shadow-shade/70 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem] sm:origin-top-right"
          >
            <div className="flex items-center gap-2 border-b border-fg/[0.07] px-3.5">
              <Search className="h-4 w-4 shrink-0 text-mist-400" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search city, country or UTC offset"
                className="w-full bg-transparent py-3 text-sm text-mist-50 placeholder:text-mist-500 outline-none"
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
                aria-label="Search time zones"
              />
              <kbd className="hidden rounded border border-fg/10 px-1.5 py-0.5 text-[10px] text-mist-500 sm:block">Esc</kbd>
            </div>

            {!query.trim() && (
              <p className="px-3.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-mist-500">
                Current &amp; detected, then by UTC offset
              </p>
            )}

            <ul ref={listRef} id={listId} role="listbox" aria-label="Time zones" className="max-h-72 overflow-y-auto overscroll-contain p-1.5 [scrollbar-color:color-mix(in_srgb,var(--fg)_20%,transparent)_transparent] [scrollbar-width:thin]">
              {results.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-mist-400">No time zone matches “{query.trim()}”.</li>
              )}
              {results.map((zone, i) => {
                const selected = zone.id === value;
                const detected = zone.id === browserZone && !query.trim();
                return (
                  <li
                    key={zone.id}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(zone.id)}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${
                      i === active ? "bg-fg/[0.07]" : ""
                    } ${selected ? "text-mist-50" : "text-mist-200"}`}
                  >
                    <div className="grid h-4 w-4 shrink-0 place-items-center">
                      {selected ? (
                        <Check className="h-4 w-4 text-xp-b" strokeWidth={3} aria-hidden />
                      ) : detected ? (
                        <MapPin className="h-3.5 w-3.5 text-mist-400" aria-label="Detected from this device" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${selected ? "font-semibold" : "font-medium"}`}>
                        <Highlight text={zone.city} query={query} />
                      </p>
                      <p className="truncate text-xs text-mist-400">
                        <Highlight text={zone.place || zone.id} query={query} />
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold tabular-nums text-mist-200">{zone.time}</p>
                      <p className="text-[11px] tabular-nums text-mist-500">{zone.offset}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Highlights the first occurrence of the query in `text` (diacritic-insensitive). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = normalize(query.trim());
  if (!q) return <>{text}</>;
  const index = normalize(text).indexOf(q);
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-xp-a/30 text-mist-50">{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
}
