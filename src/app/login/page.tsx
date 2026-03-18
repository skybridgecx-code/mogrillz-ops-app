import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import {
  canBypassAuthForMockMode,
  getAdminAccessState,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/auth";

export default async function LoginPage() {
  if (canBypassAuthForMockMode()) {
    redirect("/");
  }

  if (isSupabaseAuthConfigured()) {
    const access = await getAdminAccessState();

    if (access?.status === "admin") {
      redirect("/");
    }

    if (access?.status === "forbidden") {
      redirect("/unauthorized");
    }
  }

  return <LoginForm authReady={isSupabaseAuthConfigured()} />;
}
