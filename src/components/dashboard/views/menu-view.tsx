"use client";

import Image from "next/image";
import { cloneElement, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactElement } from "react";

import type { MenuPayload, OpsApi } from "@/components/dashboard/dashboard-app";
import { MenuImageUploader } from "@/components/dashboard/menu/menu-image-uploader";
import { EmptyState } from "@/components/foundation/EmptyState";
import { Panel } from "@/components/foundation/Panel";
import { SectionHeader } from "@/components/foundation/SectionHeader";
import { StatusBadge, type StatusBadgeStatus } from "@/components/foundation/StatusBadge";
import { Sheet } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/dashboard/format";
import {
  deriveMenuCategories,
  getMenuAttentionReasons,
  getMenuMediaState,
  getMenuWorkspaceCounts,
  queryMenuWorkspace,
  type MenuAttentionReason,
  type MenuAvailabilityFilter,
  type MenuInventoryRisk,
  type MenuMediaFilter,
  type MenuMediaState,
} from "@/lib/dashboard/menu-workspace";
import type { InventoryItem, MenuAvailability, MenuItem } from "@/types/domain";

const AVAILABILITIES: readonly MenuAvailability[] = ["Live", "Watch", "Paused", "Sold Out"];

type Draft = {
  slug: string; name: string; category: string; price: string; availability: MenuAvailability;
  allocationLimit: string; description: string; imageUrl: string; sortOrder: string;
  isFeatured: boolean; notes: string;
};
type DraftKey = keyof Draft;
type Errors = Partial<Record<DraftKey, string>>;

function Icon({ type }: { type: "search" | "media" | "notice" }) {
  if (type === "search") return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4.5 4.5"/></svg>;
  if (type === "media") return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m5 17 5-5 3 3 2-2 4 4"/><circle cx="8" cy="9" r="1"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 10v6m0-9v.2"/></svg>;
}

function availabilityTone(value: MenuAvailability): StatusBadgeStatus {
  return value === "Live" ? "ready" : value === "Watch" ? "review" : value === "Sold Out" ? "blocked" : "neutral";
}
function mediaTone(value: MenuMediaState): StatusBadgeStatus { return value === "missing" ? "review" : "neutral"; }
function mediaLabel(value: MenuMediaState) { return value === "stored" ? "Stored media" : value === "external" ? "Direct media" : "Missing media"; }
function slugify(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80); }

function itemDraft(item: MenuItem | null, category: string): Draft {
  return {
    slug: item?.slug ?? "", name: item?.name ?? "", category: item?.category ?? category,
    price: item ? (item.priceCents / 100).toFixed(2) : "", availability: item?.availability ?? "Live",
    allocationLimit: item ? String(item.allocationLimit) : "0", description: item?.description ?? "",
    imageUrl: item?.storedImageUrl ?? "", sortOrder: item ? String(item.sortOrder) : "0",
    isFeatured: item?.isFeatured ?? false, notes: item?.notes ?? "",
  };
}
function itemPayload(item: MenuItem): MenuPayload {
  return { slug: item.slug, name: item.name, category: item.category, priceCents: item.priceCents,
    availability: item.availability, allocationLimit: item.allocationLimit, description: item.description,
    imageUrl: item.storedImageUrl ?? "", sortOrder: item.sortOrder, isFeatured: item.isFeatured, notes: item.notes ?? "" };
}
function fingerprint(draft: Draft) {
  return JSON.stringify({ ...draft, slug: slugify(draft.slug), name: draft.name.trim(), category: draft.category.trim(),
    price: draft.price.trim(), allocationLimit: draft.allocationLimit.trim(), description: draft.description.trim(),
    imageUrl: draft.imageUrl.trim(), sortOrder: draft.sortOrder.trim(), notes: draft.notes.trim() });
}
function validate(draft: Draft): { errors: Errors; payload: MenuPayload | null } {
  const errors: Errors = {};
  const name = draft.name.trim(), slug = slugify(draft.slug), category = draft.category.trim();
  const description = draft.description.trim(), imageUrl = draft.imageUrl.trim(), notes = draft.notes.trim();
  const price = Number(draft.price), priceCents = Math.round(price * 100);
  const allocationLimit = Number(draft.allocationLimit), sortOrder = Number(draft.sortOrder);
  if (!name) errors.name = "Enter a dish name."; else if (name.length > 120) errors.name = "Use 120 characters or fewer.";
  if (!slug) errors.slug = "Enter a URL slug."; else if (draft.slug.trim().length > 80) errors.slug = "Use 80 characters or fewer.";
  if (!category) errors.category = "Enter a category."; else if (category.length > 60) errors.category = "Use 60 characters or fewer.";
  if (!draft.price.trim() || !Number.isFinite(price) || priceCents < 0 || priceCents > 100000) errors.price = "Use a price from $0 to $1,000.";
  if (!AVAILABILITIES.includes(draft.availability)) errors.availability = "Choose a supported availability.";
  if (!Number.isInteger(allocationLimit) || allocationLimit < 0 || allocationLimit > 100) errors.allocationLimit = "Use an integer from 0 to 100.";
  if (!description) errors.description = "Enter a public description."; else if (description.length > 500) errors.description = "Use 500 characters or fewer.";
  if (imageUrl.length > 2048) errors.imageUrl = "Use 2,048 characters or fewer.";
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) errors.sortOrder = "Use an integer from 0 to 100,000.";
  if (notes.length > 400) errors.notes = "Use 400 characters or fewer.";
  if (Object.keys(errors).length) return { errors, payload: null };
  return { errors, payload: { slug, name, category, priceCents, availability: draft.availability, allocationLimit,
    description, imageUrl, sortOrder, isFeatured: draft.isFeatured, notes } };
}
function focusables(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')]
    .filter((element) => element.getAttribute("aria-hidden") !== "true");
}
function reasonText(reason: MenuAttentionReason, risks: MenuInventoryRisk[]) {
  if (reason === "state-mismatch") return "Visibility state needs repair";
  if (reason === "missing-media") return "Live listing is missing media";
  return risks.map((risk) => `${risk.name} (${risk.status})`).join(", ");
}

function Field({ label, error, help, wide, children }: { label: string; error?: string; help?: string; wide?: boolean; children: ReactElement<{ id?: string; "aria-describedby"?: string }> }) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return <label className={`menu-editor__field${wide ? " menu-editor__field--wide" : ""}`} htmlFor={id}>
    <span>{label}</span>{cloneElement(children, { id, "aria-describedby": describedBy })}{help ? <small id={helpId}>{help}</small> : null}{error ? <small className="menu-editor__error" id={errorId}>{error}</small> : null}
  </label>;
}

function DishEditor({ item, initialCategory, api, onClose }: { item: MenuItem | null; initialCategory: string; api: OpsApi; onClose: () => void }) {
  const initial = useMemo(() => itemDraft(item, initialCategory), [item, initialCategory]);
  const [draft, setDraft] = useState(initial), [baseline, setBaseline] = useState(initial);
  const [saving, setSaving] = useState(false), [slugTouched, setSlugTouched] = useState(Boolean(item));
  const rootRef = useRef<HTMLDivElement>(null), firstRef = useRef<HTMLInputElement>(null), saved = useRef(false);
  const result = validate(draft), dirty = fingerprint(draft) !== fingerprint(baseline), isNew = !item;
  const mismatch = Boolean(item && typeof item.isActive === "boolean" && item.isActive !== (item.availability === "Live"));
  const requestClose = useCallback(() => {
    if (!saving && (!dirty || saved.current || window.confirm("Discard unsaved dish changes?"))) onClose();
  }, [dirty, onClose, saving]);
  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const dialog = rootRef.current?.closest<HTMLElement>('[role="dialog"]'); if (!dialog) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); requestClose(); return; }
      if (event.key !== "Tab") return;
      const list = focusables(dialog); if (!list.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === list[0]) { event.preventDefault(); list.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === list.at(-1)) { event.preventDefault(); list[0].focus(); }
    };
    window.addEventListener("keydown", keydown, true); return () => window.removeEventListener("keydown", keydown, true);
  }, [requestClose]);
  function set<K extends DraftKey>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value, ...(isNew && key === "name" && !slugTouched ? { slug: slugify(String(value)) } : {}) }));
  }
  async function saveDish() {
    if (!result.payload || !dirty || saving) return; setSaving(true);
    try { const ok = item ? await api.saveMenuItem(item.id, result.payload) : Boolean(await api.createMenuItem(result.payload)); if (ok) { saved.current = true; onClose(); } }
    finally { setSaving(false); }
  }
  const publicCopy = draft.availability === "Live" ? "Listed on the public ordering site." : "Hidden from the public ordering site.";
  return <Sheet onClose={requestClose} title={isNew ? "Add dish" : `Edit · ${item.name}`}>
    <div className="menu-editor" ref={rootRef}>
      <section className="menu-editor__section"><header><h3>Identity</h3><p>Catalog identity and URL path.</p></header><div className="menu-editor__grid">
        <Field label="Dish name" error={result.errors.name} wide><input ref={firstRef} maxLength={120} aria-invalid={Boolean(result.errors.name)} value={draft.name} onChange={(e) => set("name", e.target.value)}/></Field>
        <Field label="Category" error={result.errors.category}><input maxLength={60} aria-invalid={Boolean(result.errors.category)} value={draft.category} onChange={(e) => set("category", e.target.value)}/></Field>
        <Field label="URL slug" error={result.errors.slug} help={`Saved as: ${slugify(draft.slug) || "—"}`}><input maxLength={80} aria-invalid={Boolean(result.errors.slug)} value={draft.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }}/></Field>
      </div></section>
      <section className="menu-editor__section"><header><h3>Public listing</h3><p>Customer-facing price, status, and description.</p></header><div className="menu-editor__grid">
        <Field label="Price" error={result.errors.price}><input type="number" min="0" max="1000" step="0.01" aria-invalid={Boolean(result.errors.price)} value={draft.price} onChange={(e) => set("price", e.target.value)}/></Field>
        <Field label="Availability" error={result.errors.availability} help={publicCopy}><select value={draft.availability} onChange={(e) => set("availability", e.target.value as MenuAvailability)}>{AVAILABILITIES.map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Public description" error={result.errors.description} help={`${draft.description.length}/500 characters`} wide><textarea rows={5} maxLength={500} aria-invalid={Boolean(result.errors.description)} value={draft.description} onChange={(e) => set("description", e.target.value)}/></Field>
        <label className="menu-editor__check menu-editor__field--wide"><input type="checkbox" checked={draft.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)}/><span><strong>Featured dish</strong><small>Marks this item for highlighted placement where supported.</small></span></label>
      </div>{mismatch ? <p className="menu-editor__notice">Saving will repair the conflicting stored active flag.</p> : null}</section>
      <section className="menu-editor__section"><header><h3>Media</h3><p>Public menu image.</p></header>{item ?
        <MenuImageUploader itemId={item.id} itemName={draft.name || item.name} currentImageUrl={draft.imageUrl || item.imageUrl || null} onUploaded={(url) => { setDraft((d) => ({ ...d, imageUrl: url })); setBaseline((d) => ({ ...d, imageUrl: url })); }}/>
        : <Field label="Image URL" error={result.errors.imageUrl} help="Create the dish first to upload a file."><input type="url" maxLength={2048} aria-invalid={Boolean(result.errors.imageUrl)} value={draft.imageUrl} onChange={(e) => set("imageUrl", e.target.value)}/></Field>}</section>
      <section className="menu-editor__section"><header><h3>Operations</h3><p>Site order and weekly allocation.</p></header><div className="menu-editor__grid">
        <Field label="Site order" error={result.errors.sortOrder}><input type="number" min="0" max="100000" step="1" aria-invalid={Boolean(result.errors.sortOrder)} value={draft.sortOrder} onChange={(e) => set("sortOrder", e.target.value)}/></Field>
        <Field label="Weekly allocation limit" error={result.errors.allocationLimit} help="0 means no configured limit."><input type="number" min="0" max="100" step="1" aria-invalid={Boolean(result.errors.allocationLimit)} value={draft.allocationLimit} onChange={(e) => set("allocationLimit", e.target.value)}/></Field>
      </div>{item && [item.calories,item.proteinG,item.carbsG,item.fatG].some((v) => v != null) ? <p className="menu-editor__notice">Existing nutrition values are preserved but not editable here.</p> : null}</section>
      <section className="menu-editor__section"><header><h3>Internal notes</h3><p>Operator context customers never see.</p></header><Field label="Notes" error={result.errors.notes} help={`${draft.notes.length}/400 characters`}><textarea rows={4} maxLength={400} aria-invalid={Boolean(result.errors.notes)} value={draft.notes} onChange={(e) => set("notes", e.target.value)}/></Field></section>
      <div className="menu-editor__actions"><button disabled={saving} onClick={requestClose} type="button">Cancel</button><button className="menu-editor__save" disabled={!result.payload || !dirty || saving} onClick={() => void saveDish()} type="button">{saving ? "Saving…" : isNew ? "Create dish" : "Save dish"}</button></div>
    </div></Sheet>;
}

function DishRow({ item, reasons, risks, toggling, onEdit, onToggle }: { item: MenuItem; reasons: MenuAttentionReason[]; risks: MenuInventoryRisk[]; toggling: boolean; onEdit: (item: MenuItem, trigger: HTMLButtonElement) => void; onToggle: (item: MenuItem) => void }) {
  const media = getMenuMediaState(item), action = item.availability === "Live" ? "Pause" : "Publish";
  const nutrition = [item.calories == null ? null : `${item.calories} cal`, item.proteinG == null ? null : `${item.proteinG}g protein`, item.carbsG == null ? null : `${item.carbsG}g carbs`, item.fatG == null ? null : `${item.fatG}g fat`].filter(Boolean).join(" · ");
  return <Panel as="article" className="menu-item" data-attention={Boolean(reasons.length)}>
    <div className="menu-item__media" data-state={media}>{item.imageUrl ? <Image alt={`${item.name} menu image`} fill sizes="96px" src={item.imageUrl} unoptimized/> : <Icon type="media"/>}</div>
    <div className="menu-item__content"><div className="menu-item__topline"><div><h3>{item.name}</h3><p>{item.category} · /{item.slug}</p></div><div className="menu-item__badges"><StatusBadge status={availabilityTone(item.availability)}>{item.availability}</StatusBadge><StatusBadge status={mediaTone(media)}>{mediaLabel(media)}</StatusBadge>{item.isFeatured ? <StatusBadge status="review">Featured</StatusBadge> : null}</div></div>
      <p className="menu-item__description">{item.description || "No public description recorded."}</p>{nutrition ? <p className="menu-item__nutrition">{nutrition}</p> : null}
      {reasons.length ? <ul className="menu-item__reasons">{reasons.map((reason) => <li key={reason}>{reasonText(reason, risks)}</li>)}</ul> : null}
      <dl className="menu-item__facts"><div><dt>Price</dt><dd>{formatCurrency(item.priceCents)}</dd></div><div><dt>Allocation</dt><dd>{item.allocationLimit ? `${item.allocationLimit}/week` : "Unlimited"}</dd></div><div><dt>Site order</dt><dd>{item.sortOrder}</dd></div><div><dt>Linked risks</dt><dd>{risks.length || "None recorded"}</dd></div></dl>
    </div><div className="menu-item__actions"><button onClick={(e) => onEdit(item, e.currentTarget)} type="button">Edit</button><button className="menu-item__toggle" disabled={toggling} onClick={() => onToggle(item)} type="button">{toggling ? "Saving…" : action}</button></div>
  </Panel>;
}

export function MenuView({ menu, inventory, api }: { menu: MenuItem[]; inventory: InventoryItem[]; api: OpsApi }) {
  const [editingId,setEditingId] = useState<string|null>(null), [creating,setCreating] = useState(false), [togglingId,setTogglingId] = useState<string|null>(null);
  const [availability,setAvailability] = useState<MenuAvailabilityFilter>("all"), [category,setCategory] = useState("all"), [media,setMedia] = useState<MenuMediaFilter>("all"), [featuredOnly,setFeaturedOnly] = useState(false), [search,setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null), returnFocus = useRef<HTMLButtonElement|null>(null);
  const categories = useMemo(() => deriveMenuCategories(menu),[menu]), counts = useMemo(() => getMenuWorkspaceCounts(menu,inventory),[menu,inventory]);
  const workspace = useMemo(() => queryMenuWorkspace(menu,inventory,{availability,category,media,featuredOnly,search}),[menu,inventory,availability,category,media,featuredOnly,search]);
  const editing = menu.find((item) => item.id === editingId) ?? null, open = creating || Boolean(editing), initialCategory = categories.find((c) => c.value === category)?.label ?? "";
  useEffect(() => { const keydown = (event: KeyboardEvent) => { const target=event.target; if(open||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.key!=="/"||target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target instanceof HTMLSelectElement||(target instanceof HTMLElement&&target.isContentEditable)) return; event.preventDefault(); searchRef.current?.focus(); }; window.addEventListener("keydown",keydown); return()=>window.removeEventListener("keydown",keydown); },[open]);
  useEffect(() => { if (!open && returnFocus.current) { const target=returnFocus.current; requestAnimationFrame(()=>target.focus()); returnFocus.current=null; } },[open]);
  function edit(item: MenuItem, trigger: HTMLButtonElement) { returnFocus.current=trigger; setEditingId(item.id); }
  async function toggle(item: MenuItem) { if(togglingId) return; const next: MenuAvailability=item.availability==="Live"?"Paused":"Live", missing=getMenuMediaState(item)==="missing"; const ok=window.confirm(next==="Live"?`Publish ${item.name}? It will be public.${missing?" This dish has no image.":""}`:`Pause ${item.name}? It will be removed from the public menu.`); if(!ok)return; setTogglingId(item.id); try{await api.saveMenuItem(item.id,{...itemPayload(item),availability:next});}finally{setTogglingId(null);} }
  const filters: readonly MenuAvailabilityFilter[]=["all",...AVAILABILITIES];
  return <section className="menu-workspace" aria-labelledby="menu-title"><SectionHeader eyebrow="Menu control" title={<span id="menu-title">Menu workspace</span>} description="Control public availability, media readiness, and catalog details without changing ordering or inventory-link rules." action={<button className="menu-workspace__add" onClick={(e)=>{returnFocus.current=e.currentTarget;setCreating(true);}} type="button">Add dish</button>}/>
    {menu.length ? <><div className="menu-summary">{[["Live",counts.Live,`${counts.featured} featured`],["Watch",counts.Watch,"Hidden until published"],["Offline",counts.offline,`${counts.Paused} paused · ${counts["Sold Out"]} sold out`],["Missing media",counts.mediaMissing,`${counts.mediaReady} media ready`]].map(([label,value,copy])=><Panel as="article" className="menu-summary__card" key={String(label)}><span>{label}</span><strong>{value}</strong><small>{copy}</small></Panel>)}</div>
    <Panel as="aside" className="menu-dependency"><Icon type="notice"/><div><strong>{counts.linkedDishes?"Inventory dependency coverage":"Dependency coverage unavailable"}</strong><p>{counts.linkedDishes?`${counts.linkedDishes} dishes have recorded inventory links; ${workspace.riskMap.size} have Low or Out risk.`:"No inventory dependency links are recorded in this snapshot. Automatic ingredient-risk coverage is unavailable."}</p></div></Panel>
    <div className="menu-workspace__controls"><label className="menu-workspace__search"><Icon type="search"/><input ref={searchRef} aria-label="Search menu" type="search" placeholder="Search dishes, slugs, categories, or notes" value={search} onChange={(e)=>setSearch(e.target.value)}/><kbd aria-hidden="true">/</kbd></label><div className="menu-workspace__availability" role="group" aria-label="Availability filters">{filters.map((value)=><button key={value} aria-pressed={availability===value} onClick={()=>setAvailability(value)} type="button"><span>{value==="all"?"All":value}</span><span>{value==="all"?counts.total:counts[value]}</span></button>)}</div>
      <label className="menu-workspace__select"><span>Category</span><select value={category} onChange={(e)=>setCategory(e.target.value)}><option value="all">All categories ({menu.length})</option>{categories.map((c)=><option key={c.value} value={c.value}>{c.label} ({c.count})</option>)}</select></label><label className="menu-workspace__select"><span>Media</span><select value={media} onChange={(e)=>setMedia(e.target.value as MenuMediaFilter)}><option value="all">All media</option><option value="ready">Media ready ({counts.mediaReady})</option><option value="missing">Missing media ({counts.mediaMissing})</option></select></label><button className="menu-workspace__featured" aria-pressed={featuredOnly} onClick={()=>setFeaturedOnly((v)=>!v)} type="button">Featured only <span>{counts.featured}</span></button></div>
    <p className="menu-workspace__results"><strong>{workspace.filtered.length}</strong> of {menu.length} dishes shown</p>{workspace.filtered.length?<><section className="menu-section"><SectionHeader eyebrow="Publishing attention" title={`Needs review · ${workspace.attentionItems.length}`} description="Visibility mismatches, missing media on Live dishes, and recorded Low or Out ingredients."/>{workspace.attentionItems.length?<div className="menu-list">{workspace.attentionItems.map((item)=><DishRow key={item.id} item={item} reasons={getMenuAttentionReasons(item,workspace.riskMap.get(item.id))} risks={workspace.riskMap.get(item.id)??[]} toggling={togglingId===item.id} onEdit={edit} onToggle={(i)=>void toggle(i)}/>)}</div>:<EmptyState title="No publishing attention items" description="No current exceptions match this view." icon={<Icon type="notice"/>}/>}</section>{workspace.catalogItems.length?<section className="menu-section"><SectionHeader eyebrow="Catalog" title={`All other dishes · ${workspace.catalogItems.length}`} description="The remaining filtered catalog in public site order."/><div className="menu-list">{workspace.catalogItems.map((item)=><DishRow key={item.id} item={item} reasons={[]} risks={workspace.riskMap.get(item.id)??[]} toggling={togglingId===item.id} onEdit={edit} onToggle={(i)=>void toggle(i)}/>)}</div></section>:null}</>:<EmptyState title="No dishes match this view" description="Try a different search term or filter." icon={<Icon type="search"/>}/>}</>:<EmptyState title="No menu data" description="Add the first dish to begin managing the catalog." icon={<Icon type="media"/>} action={<button className="menu-workspace__add" onClick={(e)=>{returnFocus.current=e.currentTarget;setCreating(true);}} type="button">Add the first dish</button>}/>} 
    {editing?<DishEditor key={editing.id} item={editing} initialCategory={editing.category} api={api} onClose={()=>setEditingId(null)}/>:null}{creating?<DishEditor item={null} initialCategory={initialCategory} api={api} onClose={()=>setCreating(false)}/>:null}</section>;
}
