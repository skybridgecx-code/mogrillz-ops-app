"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { OpsApi } from "@/components/dashboard/dashboard-app";
import { EmptyState } from "@/components/foundation/EmptyState";
import { Panel } from "@/components/foundation/Panel";
import { SectionHeader } from "@/components/foundation/SectionHeader";
import { StatusBadge, type StatusBadgeStatus } from "@/components/foundation/StatusBadge";
import { Sheet } from "@/components/ui/sheet";
import { timeAgo } from "@/lib/dashboard/format";
import {
  filterInventoryWorkspace,
  getInventoryCoverage,
  getInventoryWorkspaceCounts,
  previewInventoryStatus,
  sortInventoryWorkspace,
  type InventoryWorkspaceFilter,
} from "@/lib/dashboard/inventory-workspace";
import type { InventoryItem, InventoryStatus } from "@/types/domain";

const STATUS_FILTERS: readonly InventoryWorkspaceFilter[] = ["all", "attention", "Out", "Low", "Watch", "Healthy"];
const STATUS_ORDER: readonly InventoryStatus[] = ["Out", "Low", "Watch", "Healthy"];

function statusBadgeStatus(status: InventoryStatus): StatusBadgeStatus {
  if (status === "Healthy") return "ready";
  if (status === "Watch") return "review";
  return "blocked";
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatCoverage(value: number | null) {
  if (value === null) return "Par not set";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}% of par`;
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" focusable="false" height="18" viewBox="0 0 24 24" width="18">
      <circle cx="10.8" cy="10.8" r="6.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m16 16 4.5 4.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function InventoryEmptyIcon() {
  return <span aria-hidden="true">—</span>;
}

function StockCard({ item, onOpen }: { item: InventoryItem; onOpen: (itemId: string, trigger: HTMLButtonElement) => void }) {
  const coverage = getInventoryCoverage(item.onHand, item.parLevel);
  const isAttention = item.status === "Out" || item.status === "Low";

  return (
    <Panel as="article" className="inventory-stock" data-status={item.status}>
      <div className="inventory-stock__topline">
        <div className="inventory-stock__heading">
          <h3>{item.name}</h3>
          <StatusBadge status={statusBadgeStatus(item.status)}>{item.status}</StatusBadge>
        </div>
        <span className="inventory-stock__unit">{item.unit}</span>
      </div>

      <div className="inventory-stock__coverage">
        <div className="inventory-stock__coverage-heading">
          <span>Par coverage</span>
          <strong>{formatCoverage(coverage.percentageOfPar)}</strong>
        </div>
        <div
          aria-label={`${item.name} par coverage`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={coverage.percentageOfPar === null ? undefined : Math.min(coverage.percentageOfPar, 100)}
          aria-valuetext={formatCoverage(coverage.percentageOfPar)}
          className="inventory-stock__bar"
          role="progressbar"
          style={{ "--inventory-coverage": `${coverage.visualFillPercent}%` } as CSSProperties}
        >
          <span />
        </div>
        <div className="inventory-stock__quantity">
          <strong>{formatQuantity(item.onHand)} {item.unit}</strong>
          <span>of {formatQuantity(item.parLevel)} {item.unit} par</span>
        </div>
      </div>

      <dl className="inventory-stock__details">
        <div>
          <dt>Pressure</dt>
          <dd>{coverage.quantityNeeded > 0 ? `${formatQuantity(coverage.quantityNeeded)} ${item.unit} needed` : "At or above par"}</dd>
        </div>
        {item.linkedMenuItems.length ? (
          <div>
            <dt>Linked menu</dt>
            <dd>{item.linkedMenuItems.length} dish{item.linkedMenuItems.length === 1 ? "" : "es"}</dd>
          </div>
        ) : null}
      </dl>

      <div className="inventory-stock__footer">
        <span>Updated {timeAgo(item.lastUpdatedAt)}</span>
        <button
          aria-label={`Update stock for ${item.name}`}
          className="inventory-stock__update"
          onClick={(event) => onOpen(item.id, event.currentTarget)}
          type="button"
        >
          Update stock
        </button>
      </div>
      {isAttention ? <span className="sr-only">Requires attention.</span> : null}
    </Panel>
  );
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getAttribute("aria-hidden") !== "true");
}

function StockEditor({ item, api, onClose }: { item: InventoryItem; api: OpsApi; onClose: () => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef(false);
  const [onHand, setOnHand] = useState(String(item.onHand));
  const [parLevel, setParLevel] = useState(String(item.parLevel));
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);

  const onHandNumber = Number(onHand);
  const parLevelNumber = Number(parLevel);
  const onHandError = !onHand.trim()
    ? "Enter an on-hand quantity."
    : !Number.isFinite(onHandNumber) || onHandNumber < 0
      ? "Use a non-negative number."
      : null;
  const parLevelError = !parLevel.trim()
    ? "Enter a par quantity."
    : !Number.isFinite(parLevelNumber) || parLevelNumber < 0
      ? "Use a non-negative number."
      : null;
  const notesError = notes.length > 400 ? "Notes must be 400 characters or fewer." : null;
  const valid = !onHandError && !parLevelError && !notesError;
  const normalizedNotes = notes.trim();
  const hasSemanticChanges = valid
    ? onHandNumber !== item.onHand || parLevelNumber !== item.parLevel || normalizedNotes !== (item.notes ?? "").trim()
    : onHand !== String(item.onHand) || parLevel !== String(item.parLevel) || notes !== (item.notes ?? "");
  const previewStatus = valid ? previewInventoryStatus(onHandNumber, parLevelNumber) : null;

  const requestClose = useCallback(() => {
    if (saving) return;
    if (!hasSemanticChanges || savedRef.current || window.confirm("Discard unsaved stock changes?")) onClose();
  }, [hasSemanticChanges, onClose, saving]);

  useEffect(() => {
    firstInputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = editorRef.current?.closest<HTMLElement>('[role="dialog"]');
      if (!dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        requestClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = getFocusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [requestClose]);

  async function save() {
    if (!valid || !hasSemanticChanges || saving) return;
    setSaving(true);
    try {
      const ok = await api.saveInventory(item.id, {
        onHand: onHandNumber,
        parLevel: parLevelNumber,
        notes: normalizedNotes || null,
      });
      if (ok) {
        savedRef.current = true;
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet headerExtra={<StatusBadge status={statusBadgeStatus(item.status)}>{item.status}</StatusBadge>} onClose={requestClose} title={`Update stock · ${item.name}`}>
      <div className="inventory-editor" ref={editorRef}>
        <div className="inventory-editor__intro">
          <p>Update the working quantity and par for this ingredient.</p>
          <span>Last updated {timeAgo(item.lastUpdatedAt)}</span>
        </div>

        <div className="inventory-editor__fields">
          <label className="inventory-editor__field" htmlFor={`inventory-on-hand-${item.id}`}>
            <span>On hand <small>({item.unit})</small></span>
            <input
              aria-describedby={onHandError ? `inventory-on-hand-error-${item.id}` : undefined}
              aria-invalid={Boolean(onHandError)}
              className="inventory-editor__input"
              data-inventory-editor-focus="true"
              id={`inventory-on-hand-${item.id}`}
              inputMode="decimal"
              min="0"
              onChange={(event) => setOnHand(event.target.value)}
              ref={firstInputRef}
              step="any"
              type="number"
              value={onHand}
            />
            {onHandError ? <span className="inventory-editor__error" id={`inventory-on-hand-error-${item.id}`}>{onHandError}</span> : null}
          </label>

          <label className="inventory-editor__field" htmlFor={`inventory-par-${item.id}`}>
            <span>Par level <small>({item.unit})</small></span>
            <input
              aria-describedby={parLevelError ? `inventory-par-error-${item.id}` : undefined}
              aria-invalid={Boolean(parLevelError)}
              className="inventory-editor__input"
              id={`inventory-par-${item.id}`}
              inputMode="decimal"
              min="0"
              onChange={(event) => setParLevel(event.target.value)}
              step="any"
              type="number"
              value={parLevel}
            />
            {parLevelError ? <span className="inventory-editor__error" id={`inventory-par-error-${item.id}`}>{parLevelError}</span> : null}
          </label>
        </div>

        <div className="inventory-editor__preview" aria-live="polite">
          <div>
            <span>Resulting status</span>
            {previewStatus ? <StatusBadge status={statusBadgeStatus(previewStatus)}>{previewStatus}</StatusBadge> : <strong>Enter valid quantities</strong>}
          </div>
          {previewStatus && previewStatus !== item.status ? <p>Current status: <strong>{item.status}</strong> → <strong>{previewStatus}</strong></p> : null}
        </div>

        <label className="inventory-editor__field" htmlFor={`inventory-notes-${item.id}`}>
          <span>Notes <small>(supplier or prep context)</small></span>
          <textarea
            aria-describedby={`inventory-notes-count-${item.id}`}
            aria-invalid={Boolean(notesError)}
            className="inventory-editor__textarea"
            id={`inventory-notes-${item.id}`}
            maxLength={400}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            value={notes}
          />
          <span className="inventory-editor__count" id={`inventory-notes-count-${item.id}`}>
            {notes.length}/400 characters
          </span>
          {notesError ? <span className="inventory-editor__error">{notesError}</span> : null}
        </label>

        <section aria-labelledby={`inventory-links-${item.id}`} className="inventory-editor__links">
          <div className="inventory-editor__section-heading">
            <h3 id={`inventory-links-${item.id}`}>Linked menu items</h3>
            <span>{item.linkedMenuItems.length}</span>
          </div>
          {item.linkedMenuItems.length ? (
            <ul>
              {item.linkedMenuItems.map((linked) => <li key={linked.id}>{linked.name}</li>)}
            </ul>
          ) : (
            <EmptyState
              className="inventory-editor__empty"
              description="No menu links are recorded for this ingredient. This does not change menu availability."
              icon={<InventoryEmptyIcon />}
              title="No linked menu items"
            />
          )}
        </section>

        <div className="inventory-editor__actions">
          <button className="inventory-editor__cancel" disabled={saving} onClick={requestClose} type="button">Cancel</button>
          <button className="inventory-editor__save" disabled={!valid || !hasSemanticChanges || saving} onClick={save} type="button">
            {saving ? "Saving…" : "Save stock"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function InventoryView({ inventory, api }: { inventory: InventoryItem[]; api: OpsApi }) {
  const [filter, setFilter] = useState<InventoryWorkspaceFilter>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);

  const counts = useMemo(() => getInventoryWorkspaceCounts(inventory), [inventory]);
  const filteredItems = useMemo(
    () => sortInventoryWorkspace(filterInventoryWorkspace(inventory, { filter, search })),
    [filter, inventory, search],
  );
  const attentionItems = filteredItems.filter((item) => item.status === "Out" || item.status === "Low");
  const stockItems = filteredItems.filter((item) => item.status !== "Out" && item.status !== "Low");
  const openItem = inventory.find((item) => item.id === openId) ?? null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key !== "/" ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      searchRef.current?.focus();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (openItem) return;
    const trigger = returnFocusRef.current;
    if (!trigger) return;
    window.requestAnimationFrame(() => trigger.focus());
    returnFocusRef.current = null;
  }, [openItem]);

  const openEditor = useCallback((itemId: string, trigger: HTMLButtonElement) => {
    returnFocusRef.current = trigger;
    setOpenId(itemId);
  }, []);

  return (
    <section aria-labelledby="inventory-workspace-title" className="inventory-workspace">
      <SectionHeader
        description="Prioritize exceptions, check par coverage, and update working stock without changing menu or order rules."
        eyebrow="Inventory control"
        title={<span id="inventory-workspace-title">Inventory workspace</span>}
      />

      {inventory.length ? (
        <>
          <div className="inventory-summary">
            {STATUS_ORDER.map((status) => (
              <article className="inventory-summary__card" data-status={status} key={status}>
                <div className="inventory-summary__label">
                  <span className="inventory-summary__signal" />
                  <span>{status}</span>
                </div>
                <strong>{counts[status]}</strong>
                <span>{counts[status] === 1 ? "item" : "items"}</span>
              </article>
            ))}
          </div>

          <div className="inventory-workspace__controls">
            <label className="inventory-workspace__search">
              <SearchIcon />
              <span className="sr-only">Search inventory</span>
              <input
                aria-label="Search inventory"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ingredients, notes, or linked dishes"
                ref={searchRef}
                type="search"
                value={search}
              />
              <kbd aria-hidden="true">/</kbd>
            </label>
            <div aria-label="Inventory filters" className="inventory-workspace__filters" role="group">
              {STATUS_FILTERS.map((option) => {
                const count = counts[option === "all" ? "all" : option];
                const label = option === "all" ? "All stock" : option === "attention" ? "Attention" : option;
                return (
                  <button
                    aria-pressed={filter === option}
                    className="inventory-workspace__filter"
                    key={option}
                    onClick={() => setFilter(option)}
                    type="button"
                  >
                    <span>{label}</span>
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredItems.length ? (
            <>
              {(filter === "all" || filter === "attention" || filter === "Out" || filter === "Low") ? (
                <section aria-labelledby="inventory-queue-title" className="inventory-queue">
                  <SectionHeader
                    description="Out and Low items are listed first so restocking pressure is visible before routine stock."
                    eyebrow="Exception queue"
                    title={<span id="inventory-queue-title">Needs attention · {attentionItems.length}</span>}
                  />
                  {attentionItems.length ? (
                    <div className="inventory-queue__list">
                      {attentionItems.map((item) => <StockCard item={item} key={item.id} onOpen={openEditor} />)}
                    </div>
                  ) : (
                    <EmptyState
                      className="inventory-queue__empty"
                      description="No Out or Low items match the current search."
                      icon={<InventoryEmptyIcon />}
                      title="No attention items"
                    />
                  )}
                </section>
              ) : null}

              {stockItems.length ? (
                <section aria-labelledby="inventory-stock-title" className="inventory-stock-overview">
                  <SectionHeader
                    description="Every remaining filtered ingredient, sorted by pressure and coverage."
                    eyebrow="Complete stock overview"
                    title={<span id="inventory-stock-title">All other stock · {stockItems.length}</span>}
                  />
                  <div className="inventory-stock__grid">
                    {stockItems.map((item) => <StockCard item={item} key={item.id} onOpen={openEditor} />)}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <EmptyState
              className="inventory-workspace__empty"
              description={filter === "attention" && !search ? "Out and Low items will appear here when stock pressure is detected." : "Try a different search term or filter."}
              icon={<InventoryEmptyIcon />}
              title={filter === "attention" && !search ? "No attention items" : "No stock matches this view"}
            />
          )}
        </>
      ) : (
        <EmptyState
          className="inventory-workspace__empty"
          description="Inventory records will appear here once stock data is available."
          icon={<InventoryEmptyIcon />}
          title="No inventory data"
        />
      )}

      {openItem ? <StockEditor api={api} item={openItem} key={openItem.id} onClose={() => setOpenId(null)} /> : null}
    </section>
  );
}
