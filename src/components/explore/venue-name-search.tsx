"use client";

/**
 * F1 venue-name-search UI.
 *
 * Thin combobox wrapped around `searchVenuesByName` server action:
 *   - 300ms debounce on input
 *   - minimum 3 chars before a server round-trip
 *   - AbortController cancels stale requests as the user keeps typing
 *   - keyboard navigation (↑ ↓ Enter Esc) via aria-activedescendant
 *   - 0-result and throttled states lean on copy from the design doc
 *
 * Selection hands off to the parent via `onSelect(hit)` so the same
 * `addVenueFromUrl → confirmVenueFromUrl` progressive-fill pipeline
 * already in AddVenueSheet powers the import (no duplicate skeleton code).
 */

import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { searchVenuesByName } from "@/server/actions/venue-search";
import type { VenueSearchHit } from "@/lib/venue-search/types";
import { MIN_QUERY_LENGTH } from "@/lib/venue-search/types";
import { debounce } from "@/lib/venue-search/debounce";

/** Client-side uuid (crypto.randomUUID() with fallback). */
function makeSessionToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

interface VenueNameSearchProps {
  /** Called once the user taps a suggestion. Parent decides the import path.
   *  `sessionToken` must be passed to any follow-up Places Details call so
   *  Google bundles autocomplete + details into a single billable session. */
  onSelect: (hit: VenueSearchHit, sessionToken: string) => void;
  /** Called when the user wants to fall back to URL / manual entry. */
  onEscape?: (target: "url" | "manual") => void;
  /** Disable the input (e.g. while a selected hit is being imported). */
  disabled?: boolean;
}

export function VenueNameSearch({
  onSelect,
  onEscape,
  disabled = false,
}: VenueNameSearchProps) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<VenueSearchHit[]>([]);
  const [fetching, setFetching] = useState(false);
  const [throttled, setThrottled] = useState(false);
  const [touched, setTouched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // IME composition — do not debounce-fetch while the user is still
  // assembling a 漢字 / カタカナ input. compositionend re-fires the effect.
  const isComposingRef = useRef(false);

  // Session token persists across focus→select for Places billing savings.
  // Rotated once a selection happens (start of a new logical session).
  const sessionTokenRef = useRef<string>(makeSessionToken());

  const abortRef = useRef<AbortController | null>(null);
  const listId = useId();
  const inputId = useId();

  // Own the debounced search inside the effect closure. That way we can
  // read refs (sessionToken / abort controller / composition state)
  // without tripping the react-hooks/refs render-phase lint, and the
  // debouncer is cleanly recreated per query change.
  useEffect(() => {
    if (isComposingRef.current) return;

    const run = async (q: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      if (q.length < MIN_QUERY_LENGTH) {
        setHits([]);
        setFetching(false);
        setThrottled(false);
        return;
      }
      setFetching(true);
      setThrottled(false);
      try {
        const res = await searchVenuesByName(q, sessionTokenRef.current);
        if (ctrl.signal.aborted) return;
        setHits(res.hits);
        setThrottled(!!res.throttled);
        setActiveIndex(res.hits.length > 0 ? 0 : -1);
      } catch {
        if (!ctrl.signal.aborted) setHits([]);
      } finally {
        if (!ctrl.signal.aborted) setFetching(false);
      }
    };

    const debounced = debounce((q: string) => void run(q), 300);
    debounced(query);
    return () => {
      debounced.cancel();
    };
  }, [query]);

  const handleClear = () => {
    setQuery("");
    setHits([]);
    setActiveIndex(-1);
    setThrottled(false);
    abortRef.current?.abort();
  };

  const handleSelect = (hit: VenueSearchHit) => {
    // Pass the *current* session token to the parent before rotating,
    // so any follow-up Place Details call completes the billable session
    // that produced this hit.
    const tokenForSelection = sessionTokenRef.current;
    sessionTokenRef.current = makeSessionToken();
    onSelect(hit, tokenForSelection);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? hits.length - 1 : prev - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(hits[activeIndex]);
    } else if (e.key === "Escape") {
      handleClear();
    }
  };

  const showShortQueryHint =
    touched && query.length > 0 && query.length < MIN_QUERY_LENGTH;
  const showEmpty =
    !fetching &&
    touched &&
    query.length >= MIN_QUERY_LENGTH &&
    hits.length === 0 &&
    !throttled;

  return (
    <div className="space-y-2.5">
      {/* Editorial eyebrow + explainer — mirrors design State A copy */}
      <div className="space-y-1">
        <label
          htmlFor={inputId}
          className="text-[11px] tracking-[0.16em] uppercase text-muted-foreground"
        >
          NAME SEARCH
        </label>
      </div>

      {/* Input row */}
      <div
        // Combobox pattern — see design §Accessibility
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-haspopup="listbox"
        aria-owns={listId}
        aria-controls={listId}
        className="relative"
      >
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-[var(--gold-warm)] dark:text-[var(--gold-light)] pointer-events-none"
          aria-hidden
        />
        <input
          id={inputId}
          type="search"
          inputMode="search"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setTouched(true);
          }}
          onFocus={() => setTouched(true)}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={(e) => {
            isComposingRef.current = false;
            // Re-kick the debounce with the final composed value.
            setQuery((e.target as HTMLInputElement).value);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="式場の名前を入れてみてください"
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 && hits[activeIndex]
              ? `${listId}-opt-${activeIndex}`
              : undefined
          }
          data-testid="venue-name-search-input"
          className="w-full h-14 rounded-[14px] border border-border bg-card pl-11 pr-11 text-[15.5px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[var(--gold-warm)]/45 dark:focus:ring-[var(--gold-warm)]/65 transition-shadow disabled:opacity-50"
        />
        {query.length > 0 && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="入力を消す"
            className="group absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground active:scale-90 active:text-foreground transition before:absolute before:inset-[-8px] before:content-['']"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Hint row — stays out of the way when results exist */}
      {!touched && (
        <p className="text-[11.5px] text-[var(--gold-warm)]/80 dark:text-[var(--gold-light)]/80 leading-relaxed">
          アニヴェルセル、ぐらんぷりんせ、…
        </p>
      )}
      {showShortQueryHint && (
        <p className="text-[11.5px] text-muted-foreground leading-relaxed">
          {MIN_QUERY_LENGTH} 文字以上で候補を探します
        </p>
      )}
      {throttled && (
        <p
          className="text-[11.5px] text-muted-foreground leading-relaxed"
          role="status"
          aria-live="polite"
        >
          少しゆっくり入力してもらえると助かります
        </p>
      )}

      {/* Live region — fetching / result count */}
      <span className="sr-only" role="status" aria-live="polite">
        {fetching
          ? "候補を探しています"
          : hits.length > 0
            ? `${hits.length} 件の候補が見つかりました`
            : ""}
      </span>

      {/* Fetching skeleton rows */}
      <AnimatePresence>
        {fetching && (
          <motion.ul
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
            aria-hidden
          >
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-14 rounded-xl bg-surface-sunken animate-pulse"
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* Results listbox */}
      {!fetching && hits.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="rounded-[14px] border border-border bg-card overflow-hidden divide-y divide-border/60"
          data-testid="venue-name-search-results"
        >
          {hits.map((hit, i) => {
            const active = i === activeIndex;
            return (
              <li
                key={hit.id}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={active}
                className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-colors active:scale-[0.98] ${
                  active ? "bg-muted/40" : "hover:bg-muted/30"
                }`}
                onClick={() => handleSelect(hit)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-[family-name:var(--font-display)] text-[14px] font-normal leading-snug truncate">
                    {hit.name}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground truncate">
                    {hit.location ?? "エリア情報なし"}
                  </p>
                </div>
                <SourceBadge source={hit.source} />
              </li>
            );
          })}
        </ul>
      )}

      {/* Empty state — 3 recovery CTAs */}
      {showEmpty && (
        <div className="rounded-[14px] border border-border/70 bg-card px-4 py-5 text-center space-y-3">
          <p className="font-[family-name:var(--font-display)] text-[15px] font-normal">
            見つかりませんでした
          </p>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            名前を少し変えるか、下の方法で試してみてください
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onEscape?.("url")}
              className="h-11 px-4 rounded-[10px] text-[13px] border border-border active:scale-[0.98] transition"
            >
              URL を貼る
            </button>
            <button
              type="button"
              onClick={() => onEscape?.("manual")}
              className="h-11 px-4 rounded-[10px] text-[13px] border border-border active:scale-[0.98] transition"
            >
              手動で入れる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: VenueSearchHit["source"] }) {
  // Copy per design §コピー原文
  const label =
    source === "places" ? "Places" : source === "claude" ? "参考" : "Haretoki";
  const cls =
    source === "claude"
      ? "bg-muted text-muted-foreground"
      : source === "internal"
        ? "bg-primary/10 text-primary"
        : "bg-[var(--gold-subtle)] text-[var(--gold-warm)] dark:bg-[var(--gold-warm)]/18 dark:text-[var(--gold-light)]";
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] tracking-[0.04em] ${cls}`}
    >
      {label}
    </span>
  );
}

