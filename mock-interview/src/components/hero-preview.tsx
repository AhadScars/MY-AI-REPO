export function HeroPreview() {
  return (
    <div className="shadow-card relative overflow-hidden rounded-3xl border border-border bg-white">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-navy">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          AI Interviewer
        </div>
        <div className="text-sm text-slate-500">Senior Frontend Developer Interview</div>
        <div className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-navy">12:48</div>
      </div>
      <div className="grid gap-0 lg:grid-cols-[1fr_220px]">
        <div className="space-y-4 p-5">
          <div className="text-xs font-semibold tracking-wide text-slate-400">QUESTION 3 OF 12</div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">AI Interviewer</p>
            <p className="mt-2 text-[15px] leading-7 text-navy">
              You mentioned improving API performance by 40%. Walk me through what was causing the
              bottleneck and how you measured the improvement.
            </p>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your answer</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The p95 latency was coming from an N+1 query on the notifications table. I added a
              batched lookup, cached the hot path, and confirmed the drop with Datadog…
            </p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-lg bg-navy px-3 py-2 text-xs text-white">Submit answer</span>
            <span className="rounded-lg border border-border px-3 py-2 text-xs text-slate-500">Skip</span>
          </div>
        </div>
        <div className="hidden space-y-3 border-l border-border bg-slate-50 p-4 lg:block">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Coverage</p>
          {[
            ["Introduction", "done"],
            ["Resume Experience", "done"],
            ["Technical Skills", "now"],
            ["System Design", "next"],
            ["Behavioral", "next"],
          ].map(([label, state]) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <span
                className={
                  state === "done"
                    ? "text-emerald-600"
                    : state === "now"
                      ? "text-primary"
                      : "text-slate-300"
                }
              >
                {state === "done" ? "✓" : state === "now" ? "→" : "○"}
              </span>
              <span className={state === "now" ? "font-medium text-navy" : "text-slate-500"}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
