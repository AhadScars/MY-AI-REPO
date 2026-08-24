"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthFrame } from "@/components/auth-form";
import { Alert, Button, Field, Input } from "@/components/ui";
import { api } from "@/lib/api-client";

function ResetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "This reset link is missing a token.");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Choose a new password" subtitle="Use at least 8 characters.">
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="New password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </Field>
        <Button type="submit" className="w-full" disabled={busy || !token}>
          {busy ? "Saving…" : "Update password"}
        </Button>
      </form>
    </AuthFrame>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}
