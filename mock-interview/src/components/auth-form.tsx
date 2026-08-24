"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Button, Field, Input, Logo } from "./ui";
import { api } from "@/lib/api-client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "google" ? "Google sign-in was cancelled or failed." : null,
  );
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    api<{ googleEnabled: boolean }>("/api/auth/config")
      .then((data) => setGoogleEnabled(data.googleEnabled))
      .catch(() => setGoogleEnabled(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(mode === "login" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(mode === "login" ? { email, password } : { name, email, password }),
      });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title={mode === "login" ? "Welcome back" : "Create your account"}
      subtitle={
        mode === "login"
          ? "Sign in to continue your interview practice."
          : "Start with a resume and a realistic first interview."
      }
    >
      {googleEnabled ? (
        <a
          href="/api/auth/google"
          className="flex h-11 items-center justify-center rounded-xl border border-border bg-white text-sm font-medium text-navy hover:bg-slate-50"
        >
          Continue with Google
        </a>
      ) : null}
      {googleEnabled ? <p className="text-center text-xs text-slate-400">or use email</p> : null}
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {mode === "signup" ? (
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </Field>
        ) : null}
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "signup" ? 8 : undefined}
            required
          />
        </Field>
        {mode === "login" ? (
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password
            </Link>
          </div>
        ) : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </Button>
      </form>
      <p className="text-center text-sm text-slate-500">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </AuthFrame>
  );
}

export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Logo />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-card sm:p-8">
        <h1 className="font-serif text-3xl text-navy">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        <div className="mt-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}
