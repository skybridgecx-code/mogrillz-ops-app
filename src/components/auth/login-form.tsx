"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import styles from "@/app/login/page.module.css";

type SubmitState = {
  email: string;
  password: string;
  remember: boolean;
};

type LoginFormProps = {
  authReady: boolean;
};

function readNextRoute() {
  if (typeof window === "undefined") return "/";

  const nextRoute = new URLSearchParams(window.location.search).get("next");
  return nextRoute && nextRoute.startsWith("/") ? nextRoute : "/";
}

export function LoginForm({ authReady }: LoginFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<SubmitState>({
    email: "",
    password: "",
    remember: true,
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
        throw new Error("Configure Supabase auth env vars before signing in to MoGrillz Ops.");
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
        throw new Error(error.message);
      }

      setSuccessMessage("Signed in. Redirecting to MoGrillz Ops...");
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
            <p className={styles.kicker}>MoGrillz Ops</p>
            <h1 className={styles.title}>Protected Access</h1>
          </div>
          <div className={styles.badge}>{browserClientReady ? "Supabase Ready" : "Setup Required"}</div>
        </div>

        <p className={styles.copy}>
          Sign in to review live orders, inventory pressure, menu controls, and AI guidance without exposing the operator app.
        </p>

        <div className={styles.surfaceRow}>
          <div className={styles.surface}>
            <span className={styles.surfaceLabel}>Drop model</span>
            <strong>Mon / Wed / Fri</strong>
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
              autoComplete="email"
              inputMode="email"
              name="email"
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="chefmo@mogrillzva.com"
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

          <label className={styles.checkRow}>
            <input
              checked={form.remember}
              onChange={(event) => updateField("remember", event.target.checked)}
              type="checkbox"
            />
            <span>Keep me signed in on this device</span>
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
          <a className={styles.link} href="mailto:mogrillzva@gmail.com?subject=MoGrillz%20Ops%20Access">
            Need access?
          </a>
        </div>
      </section>
    </main>
  );
}
