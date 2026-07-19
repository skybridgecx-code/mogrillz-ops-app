"use client";

import { useMemo, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { formatCurrency, initials, statusTone, timeAgo } from "@/lib/dashboard/format";
import type { Customer, EmailUpdate } from "@/types/domain";

const TIER_ORDER: Record<Customer["loyaltyTier"], number> = {
  VIP: 0,
  High: 1,
  Rising: 2,
  Early: 3,
};

type Tab = "customers" | "subscribers";

export function CustomersView({
  customers,
  emailUpdates,
}: {
  customers: Customer[];
  emailUpdates: EmailUpdate[];
}) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("customers");
  const [search, setSearch] = useState("");

  const sortedCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...customers]
      .filter(
        (customer) =>
          !query ||
          customer.name.toLowerCase().includes(query) ||
          (customer.email ?? "").toLowerCase().includes(query),
      )
      .sort(
        (left, right) =>
          TIER_ORDER[left.loyaltyTier] - TIER_ORDER[right.loyaltyTier] ||
          right.lifetimeValueCents - left.lifetimeValueCents,
      );
  }, [customers, search]);

  const sortedUpdates = useMemo(
    () =>
      [...emailUpdates].sort(
        (left, right) => new Date(right.lastRequestedAt).getTime() - new Date(left.lastRequestedAt).getTime(),
      ),
    [emailUpdates],
  );

  const activeEmails = useMemo(
    () => sortedUpdates.filter((update) => update.status === "Active").map((update) => update.email).filter(Boolean),
    [sortedUpdates],
  );

  const vipCount = customers.filter((customer) => customer.loyaltyTier === "VIP").length;

  async function copyEmails() {
    if (!activeEmails.length) return;
    try {
      await navigator.clipboard.writeText(activeEmails.join(", "));
      toast(`Copied ${activeEmails.length} subscriber emails`, "success");
    } catch {
      toast("Couldn't copy on this device", "error");
    }
  }

  function openDraft() {
    if (!activeEmails.length) return;
    const body = [
      "You asked to hear about the latest Shama's Kitchen menu updates.",
      "",
      "Here's what's new on the menu this week.",
      "",
      "Reply if you need pickup timing help or want to place a larger order.",
      "",
      "Chef Mo",
      "Shama's Kitchen",
    ].join("\n");
    const mailto = new URL("mailto:");
    mailto.searchParams.set("bcc", activeEmails.join(","));
    mailto.searchParams.set("subject", "Shama's Kitchen Menu Update");
    mailto.searchParams.set("body", body);
    window.location.href = mailto.toString();
  }

  return (
    <>
      <div className="card-head" style={{ marginBottom: "1rem", flexWrap: "wrap" }}>
        <div className="seg" role="tablist">
          <button
            className={`seg-btn ${tab === "customers" ? "active" : ""}`}
            onClick={() => setTab("customers")}
            type="button"
          >
            Customers ({customers.length})
          </button>
          <button
            className={`seg-btn ${tab === "subscribers" ? "active" : ""}`}
            onClick={() => setTab("subscribers")}
            type="button"
          >
            Email list ({activeEmails.length})
          </button>
        </div>
        {tab === "customers" ? (
          <input
            className="input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email…"
            style={{ maxWidth: 240 }}
            value={search}
          />
        ) : (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-sm" disabled={!activeEmails.length} onClick={copyEmails} type="button">
              Copy emails
            </button>
            <button className="btn btn-sm btn-primary" disabled={!activeEmails.length} onClick={openDraft} type="button">
              ✉️ Draft update
            </button>
          </div>
        )}
      </div>

      {tab === "customers" ? (
        <>
          {vipCount ? (
            <p className="muted" style={{ margin: "0 0 0.8rem" }}>
              ⭐ {vipCount} VIP{vipCount > 1 ? "s" : ""} — your best people are sorted to the top.
            </p>
          ) : null}
          <div className="cust-list">
            {sortedCustomers.map((customer) => (
              <div className="cust-row" key={customer.id}>
                <div className="avatar">{initials(customer.name)}</div>
                <div className="cust-main">
                  <div className="cust-name">{customer.name}</div>
                  <div className="cust-meta">
                    {customer.totalOrders} order{customer.totalOrders !== 1 ? "s" : ""} · {customer.zone}
                    {customer.email ? (
                      <> · <a href={`mailto:${customer.email}`} style={{ color: "var(--gold)" }}>{customer.email}</a></>
                    ) : null}
                    {customer.notes ? ` · ${customer.notes}` : ""}
                  </div>
                </div>
                <div className="cust-right">
                  <div className="cust-ltv">{formatCurrency(customer.lifetimeValueCents)}</div>
                  <span className={`pill ${statusTone(customer.loyaltyTier)}`}>{customer.loyaltyTier}</span>
                </div>
              </div>
            ))}
            {!sortedCustomers.length ? (
              <div className="allclear">
                <div aria-hidden className="allclear-emoji">👥</div>
                <div className="allclear-title">No matches</div>
                {search ? "Try a different search." : "Customers appear here after their first order."}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="cust-list">
          {sortedUpdates.map((update) => (
            <div className="cust-row" key={update.id}>
              <div className="avatar">✉️</div>
              <div className="cust-main">
                <div className="cust-name">{update.email}</div>
                <div className="cust-meta">
                  Signed up {timeAgo(update.createdAt)} · last requested {timeAgo(update.lastRequestedAt)}
                </div>
              </div>
              <div className="cust-right">
                <span className={`pill ${statusTone(update.status)}`}>{update.status}</span>
              </div>
            </div>
          ))}
          {!sortedUpdates.length ? (
            <div className="allclear">
              <div aria-hidden className="allclear-emoji">✉️</div>
              <div className="allclear-title">No subscribers yet</div>
              Signups from your site&rsquo;s email form will land here.
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
