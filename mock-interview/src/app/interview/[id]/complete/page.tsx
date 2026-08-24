"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { api } from "@/lib/api-client";

export default function CompletePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [progress, setProgress] = useState(18);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let tick: number | undefined;
    tick = window.setInterval(() => {
      setProgress((p) => (p >= 92 ? p : p + 4));
    }, 400);
    (async () => {
      try {
        await api(`/api/interviews/${id}/complete`, { method: "POST" });
        setProgress(100);
        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not generate the report.");
      } finally {
        if (tick) window.clearInterval(tick);
      }
    })();
    return () => {
      if (tick) window.clearInterval(tick);
    };
  }, [id]);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-lg p-8 text-center">
        <p className="text-sm font-medium text-primary">Interview complete</p>
        <h1 className="mt-2 font-serif text-4xl text-navy">Great work.</h1>
        <p className="mt-3 text-slate-600">Your interview has been analyzed.</p>
        <p className="mt-6 text-sm text-slate-500">
          {ready ? "Your personalized interview report is ready." : "Generating your personalized interview report…"}
        </p>
        <div className="mx-auto mt-4 max-w-sm">
          <div className="progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-400">{progress}%</p>
        </div>
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        <Button className="mt-6" disabled={!ready} onClick={() => router.push(`/interview/${id}/report`)}>
          View My Results
        </Button>
      </Card>
    </div>
  );
}
