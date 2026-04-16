import Link from "next/link";

import styles from "@/app/login/page.module.css";

export default function UnauthorizedPage() {
  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <div className={styles.brandRow}>
          <div>
            <p className={styles.kicker}>Shama’s Kitchen Ops</p>
            <h1 className={styles.title}>Access Restricted</h1>
          </div>
          <div className={styles.badge}>Admin only</div>
        </div>

        <p className={styles.copy}>
          This account is signed in, but it has not been added to the Shama’s Kitchen admin membership list yet.
          If this should be your ops account, add it in Supabase and try again.
        </p>

        <div className={styles.surfaceRow}>
          <div className={styles.surface}>
            <span className={styles.surfaceLabel}>Status</span>
            <strong>Authenticated</strong>
          </div>
          <div className={styles.surface}>
            <span className={styles.surfaceLabel}>Permission</span>
            <strong>Not assigned</strong>
          </div>
        </div>

        <div className={styles.footerRow}>
          <Link className={styles.link} href="/login">
            Back to login
          </Link>
          <a className={styles.link} href="mailto:shamaskitchenva@gmail.com?subject=Shama’s Kitchen%20Ops%20Access">
            Request access
          </a>
        </div>
      </section>
    </main>
  );
}
