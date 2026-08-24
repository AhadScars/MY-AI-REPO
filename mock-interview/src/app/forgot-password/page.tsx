"use client";

import { useState } from "react";
import { AuthFrame } from "@/components/auth-form";
import { Alert, Button, Field, Input } from "@/components/ui";
import { api } from "@/lib/api-client";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ message: string; resetUrl: string | null }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(data.message);
      setResetUrl(data.resetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a reset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Reset your password" subtitle="We’ll prepare a secure reset link for your account.">
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
        {resetUrl ? (
          <Alert tone="info">
            Local development link:{" "}
            <Link href={resetUrl} className="underline">
              Reset password
            </Link>
          </Alert>
        ) : null}
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="text-primary hover:underline">
          Back to login
        </Link>
      </p>
    </AuthFrame>
  );
}
