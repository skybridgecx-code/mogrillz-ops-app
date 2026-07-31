"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import styles from "@/app/login/page.module.css";
import { createSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";

type SubmitState = {
  email: string;
  password: string;
};

type LoginFormProps = {
  authReady: boolean;
};

function readNextRoute() {
  if (typeof window === "undefined") return "/";

  const nextRoute = new URLSearchParams(window.location.search).get("next");
  if (!nextRoute || !nextRoute.startsWith("/") || nextRoute.startsWith("//")) {
    return "/";
  }

  return nextRoute;
}

export function LoginForm({ authReady }: LoginFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<SubmitState>({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const browserClientReady = isSupabaseBrowserConfigured();

  function updateField<K extends keyof SubmitState>(key: K, value: SubmitState[K]) {
    setForm((current) => ({ ...current, [key]: value }));

    if (errorMessage) setErrorMessage(null);
    if (successMessage) setSuccessMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (!form.email.trim() || !form.password.trim()) {
        throw new Error("Enter your email and password to continue.");
      }

      if (!browserClientReady) {
        throw new Error("Configure Supabase auth env vars before signing in to Shama’s Kitchen Ops.");
      }

      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        throw new Error("Supabase client could not be created in this environment.");
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (error) {
        throw new Error("Email or password is incorrect.");
      }

      setSuccessMessage("Signed in. Redirecting to Shama’s Kitchen Ops...");
      router.replace(readNextRoute());
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <div className={styles.brandRow}>
          <div>
            <p className={styles.kicker}>Shama’s Kitchen Ops</p>
            <h1 className={styles.title}>Protected Access</h1>
          </div>
          <div className={styles.badge}>{browserClientReady ? "Supabase Ready" : "Setup Required"}</div>
        </div>

        <p className={styles.copy}>
          Sign in to review live orders, inventory pressure, menu controls, and operational guidance without exposing the operator app.
        </p>

        <div className={styles.surfaceRow}>
          <div className={styles.surface}>
            <span className={styles.surfaceLabel}>Service model</span>
            <strong>Pickup operations</strong>
          </div>
          <div className={styles.surface}>
            <span className={styles.surfaceLabel}>Access</span>
            <strong>Admin only</strong>
          </div>
        </div>

        {!browserClientReady ? (
          <p className={styles.setupNote}>
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and a publishable or anon key in the app env before using this login.
          </p>
        ) : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              autoCapitalize="none"
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="owner@example.com"
              spellCheck={false}
              type="email"
              value={form.email}
            />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <div className={styles.passwordWrap}>
              <input
                autoComplete="current-password"
                name="password"
                onChange={(event) => updateField("password", event.target.value)}
                placeholder="Enter password"
                type={showPassword ? "text" : "password"}
                value={form.password}
              />
              <button
                className={styles.passwordToggle}
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <div aria-atomic="true" aria-live="polite" className={styles.messageStack}>
            {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
            {successMessage ? <p className={styles.success}>{successMessage}</p> : null}
          </div>

          <button className={styles.submit} disabled={isSubmitting || !authReady} type="submit">
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className={styles.footerRow}>
          <Link className={styles.link} href="/">
            Back to dashboard
          </Link>
          <a className={styles.link} href="mailto:shamaskitchenva@gmail.com?subject=Shama’s Kitchen%20Ops%20Access">
            Need access?
          </a>
        </div>
      </section>
    </main>
  );
}
