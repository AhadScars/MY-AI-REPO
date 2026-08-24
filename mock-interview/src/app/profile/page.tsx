"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Alert, Button, Card, Field, Input, Skeleton } from "@/components/ui";
import { api } from "@/lib/api-client";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ user: { name: string; email: string } }>("/api/profile")
      .then((data) => {
        setName(data.user.name);
        setEmail(data.user.email);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api("/api/profile", { method: "PATCH", body: JSON.stringify({ name }) });
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-6 h-40 w-full max-w-xl" />
      </div>
    );
  }

  return (
    <AppShell user={{ name, email }}>
      <h1 className="font-serif text-4xl text-navy">Profile</h1>
      <Card className="mt-6 max-w-xl p-6">
        <form onSubmit={save} className="space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          {message ? <Alert tone="success">{message}</Alert> : null}
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Email" hint="Email is used to sign in and cannot be changed here.">
            <Input value={email} disabled />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>
    </AppShell>
  );
}
