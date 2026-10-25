import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  GraduationCap,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/app/auth-context";
import { Button } from "@/components/common/Button";
import { USE_MOCKS } from "@/lib/constants";
import type { AdminRole } from "@/lib/domain";

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address").max(254),
  password: z.string().min(1, "Enter your password").max(4096),
});

export function LoginPage() {
  const { user, loading, authError, signInWithPassword, signInDemo } =
    useAuth();
  const [pending, setPending] = useState(false);
  const form = useForm<z.infer<typeof credentialsSchema>>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });
  const busy = pending || loading || form.formState.isSubmitting;
  if (user) return <Navigate to="/" replace />;

  async function login(action: () => Promise<void>) {
    setPending(true);
    try {
      await action();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.06fr_0.94fr] dark:bg-slate-950">
      <div className="relative hidden overflow-hidden bg-[#F4F8F7] p-12 lg:flex lg:flex-col lg:justify-between dark:bg-slate-900">
        <div className="absolute -right-16 -top-24 size-[32rem] rounded-full border border-[#D7E8E5] dark:border-slate-700" />
        <div className="absolute -right-5 -top-12 size-[24rem] rounded-full border border-[#D7E8E5] dark:border-slate-700" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-accent text-white">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-ink dark:text-white">Hexa Learn</p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted">
              Admin console
            </p>
          </div>
        </div>
        <div className="relative max-w-lg">
          <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            <span className="size-1.5 rounded-full bg-accent" />
            Learning, made human
          </p>
          <h1 className="text-[42px] font-semibold leading-[1.12] tracking-[-0.045em] text-ink dark:text-white">
            A clearer view of every learner's journey.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-slate-500 dark:text-slate-400">
            Create thoughtful courses, support your community, and see how your
            lessons are making a difference.
          </p>
          <div className="mt-10 flex gap-3">
            <span className="flex items-center gap-2 rounded-full border border-[#D8E6E3] bg-white/70 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <BookOpenCheck className="size-3.5 text-accent" />
              Course tools
            </span>
            <span className="flex items-center gap-2 rounded-full border border-[#D8E6E3] bg-white/70 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <ShieldCheck className="size-3.5 text-accent" />
              Role protected
            </span>
          </div>
        </div>
        <p className="relative text-xs text-slate-400">
          © {new Date().getFullYear()} Hexa Learn
        </p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[390px]">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <div className="grid size-9 place-items-center rounded-xl bg-accent text-white">
              <GraduationCap className="size-5" />
            </div>
            <span className="font-semibold">Hexa Learn</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
            Welcome back
          </p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.035em] text-ink dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Enter your admin email and password to continue.
          </p>
          {authError && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {authError}
            </div>
          )}
          <form
            onSubmit={form.handleSubmit(signInWithPassword)}
            className="mt-7 space-y-4"
          >
            <div>
              <label htmlFor="admin-email" className="field-label">
                Email address
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                className="field"
                {...form.register("email", {
                  setValueAs: (value: string) => value.trim(),
                })}
              />
              {form.formState.errors.email && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="admin-password" className="field-label">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                className="field"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p role="alert" className="mt-1 text-xs text-red-600">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Sign in
              <ArrowRight className="ml-auto size-4 opacity-70" />
            </Button>
          </form>
          {USE_MOCKS && (
            <div className="mt-8 rounded-2xl border border-line bg-[#FBFCFC] p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-ink dark:text-white">
                  Preview the dashboard
                </p>
                <span className="rounded-full bg-[#E7F4F1] px-2 py-1 text-[10px] font-medium text-[#0B786A]">
                  Mock mode
                </span>
              </div>
              <p className="mb-3 text-xs leading-5 text-muted">
                Choose a role to explore how the workspace changes.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void login(() =>
                      signInDemo("super_admin" satisfies AdminRole),
                    )
                  }
                >
                  <Check className="size-3.5 text-accent" />
                  Super admin
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void login(() =>
                      signInDemo("page_admin" satisfies AdminRole),
                    )
                  }
                >
                  Page admin
                </Button>
              </div>
            </div>
          )}
          {!USE_MOCKS && !loading && (
            <p className="mt-5 text-center text-xs text-muted">
              Your access is managed by the Hexa Learn team.
            </p>
          )}
          <p className="mt-9 text-center text-[11px] leading-5 text-slate-400">
            By continuing, you agree to use learner information only for
            platform administration.
          </p>
        </div>
      </div>
    </div>
  );
}
