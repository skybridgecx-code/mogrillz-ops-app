"use client";

import { useMemo, useState } from "react";

import type { MenuPayload, OpsApi } from "@/components/dashboard/dashboard-app";
import { MenuImageUploader } from "@/components/dashboard/menu/menu-image-uploader";
import { Sheet } from "@/components/ui/sheet";
import { formatCurrency, statusTone } from "@/lib/dashboard/format";
import type { InventoryItem, MenuItem } from "@/types/domain";

const AVAILABILITIES: MenuItem["availability"][] = ["Live", "Watch", "Paused", "Sold Out"];

interface DraftState {
  slug: string;
  name: string;
  category: string;
  price: string;
  availability: MenuItem["availability"];
  allocationLimit: string;
  description: string;
  imageUrl: string;
  sortOrder: string;
  isFeatured: boolean;
  notes: string;
}

function itemToDraft(item?: MenuItem | null): DraftState {
  return {
    slug: item?.slug ?? "",
    name: item?.name ?? "",
    category: item?.category ?? "signature",
    price: item ? (item.priceCents / 100).toFixed(2) : "",
    availability: item?.availability ?? "Live",
    allocationLimit: item ? String(item.allocationLimit) : "0",
    description: item?.description ?? "",
    imageUrl: item?.imageUrl ?? "",
    sortOrder: item ? String(item.sortOrder) : "0",
    isFeatured: item?.isFeatured ?? false,
    notes: item?.notes ?? "",
  };
}

function draftToPayload(draft: DraftState): MenuPayload | null {
  const priceCents = Math.round(Number(draft.price) * 100);
  if (!draft.name.trim() || !draft.slug.trim() || !Number.isFinite(priceCents) || priceCents < 0) {
    return null;
  }
  return {
    slug: draft.slug.trim(),
    name: draft.name.trim(),
    category: draft.category.trim() || "signature",
    priceCents,
    availability: draft.availability,
    allocationLimit: Number(draft.allocationLimit) || 0,
    description: draft.description,
    imageUrl: draft.imageUrl,
    sortOrder: Number(draft.sortOrder) || 0,
    isFeatured: draft.isFeatured,
    notes: draft.notes,
  };
}

function itemToPayload(item: MenuItem): MenuPayload {
  return {
    slug: item.slug,
    name: item.name,
    category: item.category,
    priceCents: item.priceCents,
    availability: item.availability,
    allocationLimit: item.allocationLimit,
    description: item.description,
    imageUrl: item.imageUrl ?? "",
    sortOrder: item.sortOrder,
    isFeatured: item.isFeatured,
    notes: item.notes ?? "",
  };
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function DishSheet({
  item,
  api,
  onClose,
}: {
  item: MenuItem | null;
  api: OpsApi;
  onClose: () => void;
}) {
  const isNew = !item;
  const [draft, setDraft] = useState<DraftState>(() => itemToDraft(item));
  const [saving, setSaving] = useState(false);

  function set<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (isNew && key === "name" && (!current.slug || current.slug === slugify(current.name))) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  }

  const payload = draftToPayload(draft);

  async function save() {
    if (!payload) return;
    setSaving(true);
    const ok = item ? await api.saveMenuItem(item.id, payload) : Boolean(await api.createMenuItem(payload));
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Sheet onClose={onClose} title={isNew ? "Add a new dish" : `Edit · ${item.name}`}>
      <div className="form-grid">
        <label className="field span-2">
          Dish name
          <input className="input" onChange={(event) => set("name", event.target.value)} value={draft.name} />
        </label>
        <label className="field">
          Price ($)
          <input className="input" inputMode="decimal" onChange={(event) => set("price", event.target.value)} value={draft.price} />
        </label>
        <label className="field">
          Status on the site
          <select
            className="selectbox"
            onChange={(event) => set("availability", event.target.value as MenuItem["availability"])}
            value={draft.availability}
          >
            {AVAILABILITIES.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="field span-2">
          Description customers see
          <textarea className="textarea" onChange={(event) => set("description", event.target.value)} value={draft.description} />
        </label>
        <label className="field">
          Category
          <input className="input" onChange={(event) => set("category", event.target.value)} value={draft.category} />
        </label>
        <label className="field">
          Display order (lower shows first)
          <input className="input" inputMode="numeric" onChange={(event) => set("sortOrder", event.target.value)} value={draft.sortOrder} />
        </label>
        <label className="field">
          Daily limit (0 = unlimited)
          <input className="input" inputMode="numeric" onChange={(event) => set("allocationLimit", event.target.value)} value={draft.allocationLimit} />
        </label>
        <label className="field">
          URL slug
          <input className="input" onChange={(event) => set("slug", event.target.value)} value={draft.slug} />
        </label>
        <div className="span-2">
          {item ? (
            <MenuImageUploader
              currentImageUrl={draft.imageUrl || null}
              itemId={item.id}
              onUploaded={(url) => set("imageUrl", url)}
            />
          ) : (
            <label className="field">
              Image URL (you can upload a photo after creating)
              <input className="input" onChange={(event) => set("imageUrl", event.target.value)} value={draft.imageUrl} />
            </label>
          )}
        </div>
        <label className="field span-2" style={{ flexDirection: "row", alignItems: "center", gap: "0.6rem" }}>
          <input
            checked={draft.isFeatured}
            onChange={(event) => set("isFeatured", event.target.checked)}
            type="checkbox"
          />
          Feature this dish on the site
        </label>
        <label className="field span-2">
          Internal note (customers never see this)
          <textarea className="textarea" onChange={(event) => set("notes", event.target.value)} style={{ minHeight: 60 }} value={draft.notes} />
        </label>
      </div>

      <button className="btn btn-primary btn-block" disabled={!payload || saving} onClick={save} type="button">
        {saving ? "Saving…" : isNew ? "Add to live menu" : "Save changes"}
      </button>
    </Sheet>
  );
}

export function MenuView({
  menu,
  inventory,
  api,
}: {
  menu: MenuItem[];
  inventory: InventoryItem[];
  api: OpsApi;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...menu].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)),
    [menu],
  );

  const riskByMenuId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of inventory) {
      if (item.status !== "Low" && item.status !== "Out") continue;
      for (const linked of item.linkedMenuItems) {
        const list = map.get(linked.id) ?? [];
        list.push(item.name);
        map.set(linked.id, list);
      }
    }
    return map;
  }, [inventory]);

  const editingItem = menu.find((item) => item.id === editingId) ?? null;
  const liveCount = menu.filter((item) => item.availability === "Live").length;

  async function quickToggle(item: MenuItem) {
    const next: MenuItem["availability"] = item.availability === "Live" ? "Paused" : "Live";
    setTogglingId(item.id);
    await api.saveMenuItem(item.id, { ...itemToPayload(item), availability: next });
    setTogglingId(null);
  }

  return (
    <>
      <div className="card-head" style={{ marginBottom: "1rem" }}>
        <span className="pill success">{liveCount} of {menu.length} dishes live on the site</span>
        <button className="btn btn-primary" onClick={() => setCreating(true)} type="button">
          + Add dish
        </button>
      </div>

      <div className="menu-grid">
        {sorted.map((item) => {
          const risks = riskByMenuId.get(item.id) ?? [];
          return (
            <div
              className="dish-card"
              key={item.id}
              onClick={() => setEditingId(item.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setEditingId(item.id);
              }}
              role="button"
              tabIndex={0}
            >
              <div
                className="dish-img"
                style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}
              >
                {item.imageUrl ? null : "🍽️"}
              </div>
              <div className="dish-body">
                <div className="dish-top">
                  <span className="dish-name">{item.name}</span>
                  <span className={`pill ${statusTone(item.availability)}`}>{item.availability}</span>
                </div>
                <div className="dish-desc">{item.description || "No description yet."}</div>
                {risks.length ? (
                  <div className="ticket-flag" style={{ color: "var(--red)" }}>
                    ⚠️ Low ingredient: {risks.join(", ")}
                  </div>
                ) : null}
                <div className="dish-foot">
                  <span className="dish-price">{formatCurrency(item.priceCents)}</span>
                  <button
                    className={`btn btn-sm ${item.availability === "Live" ? "btn-ghost" : "btn-primary"}`}
                    disabled={togglingId === item.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      quickToggle(item);
                    }}
                    type="button"
                  >
                    {togglingId === item.id ? "…" : item.availability === "Live" ? "Pause" : "Go live"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editingItem ? (
        <DishSheet api={api} item={editingItem} key={editingItem.id} onClose={() => setEditingId(null)} />
      ) : null}
      {creating ? <DishSheet api={api} item={null} onClose={() => setCreating(false)} /> : null}
    </>
  );
}
