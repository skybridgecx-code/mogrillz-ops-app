"use client";

import { useMemo, useState } from "react";

import type { OpsApi } from "@/components/dashboard/dashboard-app";
import { Sheet } from "@/components/ui/sheet";
import { statusTone, timeAgo } from "@/lib/dashboard/format";
import type { InventoryItem } from "@/types/domain";

const STATUS_ORDER: Record<InventoryItem["status"], number> = {
  Out: 0,
  Low: 1,
  Watch: 2,
  Healthy: 3,
};

function coverage(item: InventoryItem) {
  if (item.parLevel <= 0) return 1;
  return Math.min(item.onHand / item.parLevel, 1);
}

function fillClass(item: InventoryItem) {
  if (item.status === "Low" || item.status === "Out") return "low";
  if (item.status === "Healthy") return "ok";
  return "";
}

function StockSheet({
  item,
  api,
  onClose,
}: {
  item: InventoryItem;
  api: OpsApi;
  onClose: () => void;
}) {
  const [onHand, setOnHand] = useState(String(item.onHand));
  const [parLevel, setParLevel] = useState(String(item.parLevel));
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);

  const onHandNum = Number(onHand);
  const parNum = Number(parLevel);
  const valid = Number.isFinite(onHandNum) && onHandNum >= 0 && Number.isFinite(parNum) && parNum >= 0;

  function bump(delta: number) {
    const current = Number(onHand);
    const base = Number.isFinite(current) ? current : 0;
    setOnHand(String(Math.max(0, Math.round((base + delta) * 100) / 100)));
  }

  async function save() {
    if (!valid) return;
    setSaving(true);
    const ok = await api.saveInventory(item.id, {
      onHand: onHandNum,
      parLevel: parNum,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Sheet
      headerExtra={<span className={`pill ${statusTone(item.status)}`}>{item.status}</span>}
      onClose={onClose}
      title={item.name}
    >
      <label className="field">
        On hand ({item.unit})
        <div className="stepper">
          <button aria-label="Decrease" className="stepper-btn" onClick={() => bump(-1)} type="button">−</button>
          <input
            className="input"
            inputMode="decimal"
            onChange={(event) => setOnHand(event.target.value)}
            value={onHand}
          />
          <button aria-label="Increase" className="stepper-btn" onClick={() => bump(1)} type="button">+</button>
        </div>
      </label>

      <label className="field">
        Par level — the amount you want on hand ({item.unit})
        <input
          className="input"
          inputMode="decimal"
          onChange={(event) => setParLevel(event.target.value)}
          value={parLevel}
        />
      </label>

      <label className="field">
        Note (supplier, prep reminders…)
        <textarea className="textarea" onChange={(event) => setNotes(event.target.value)} value={notes} />
      </label>

      {item.linkedMenuItems.length ? (
        <div className="callout">
          🍽️ Used by: {item.linkedMenuItems.map((linked) => linked.name).join(", ")}
          {item.status === "Low" || item.status === "Out"
            ? " — consider pausing these dishes if you can't restock in time."
            : ""}
        </div>
      ) : null}

      <p className="muted" style={{ margin: 0 }}>Last updated {timeAgo(item.lastUpdatedAt)}</p>

      <button className="btn btn-primary btn-block" disabled={!valid || saving} onClick={save} type="button">
        {saving ? "Saving…" : "Save stock"}
      </button>
    </Sheet>
  );
}

export function InventoryView({ inventory, api }: { inventory: InventoryItem[]; api: OpsApi }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...inventory].sort(
        (left, right) =>
          STATUS_ORDER[left.status] - STATUS_ORDER[right.status] || left.name.localeCompare(right.name),
      ),
    [inventory],
  );

  const flaggedCount = inventory.filter((item) => item.status === "Low" || item.status === "Out").length;
  const openItem = inventory.find((item) => item.id === openId) ?? null;

  return (
    <>
      {flaggedCount ? (
        <div className="callout danger" style={{ marginBottom: "1rem" }}>
          🚨 {flaggedCount} ingredient{flaggedCount > 1 ? "s" : ""} need restocking — they&rsquo;re sorted to the top.
        </div>
      ) : (
        <div className="callout" style={{ marginBottom: "1rem" }}>
          ✅ Stock looks healthy across the board. Tap any card to adjust counts.
        </div>
      )}

      <div className="stock-grid">
        {sorted.map((item) => (
          <div
            className={`stock-card ${item.status === "Low" || item.status === "Out" ? "flagged" : ""}`}
            key={item.id}
            onClick={() => setOpenId(item.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setOpenId(item.id);
            }}
            role="button"
            tabIndex={0}
          >
            <div className="stock-top">
              <span className="stock-name">{item.name}</span>
              <span className={`pill ${statusTone(item.status)}`}>{item.status}</span>
            </div>
            <div className="stock-bar">
              <div
                className={`stock-fill ${fillClass(item)}`}
                style={{ width: `${Math.max(coverage(item) * 100, item.onHand > 0 ? 6 : 0)}%` }}
              />
            </div>
            <div className="stock-meta">
              {item.onHand} / {item.parLevel} {item.unit}
              {item.linkedMenuItems.length ? ` · feeds ${item.linkedMenuItems.length} dish${item.linkedMenuItems.length > 1 ? "es" : ""}` : ""}
            </div>
          </div>
        ))}
      </div>

      {openItem ? <StockSheet api={api} item={openItem} key={openItem.id} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}
