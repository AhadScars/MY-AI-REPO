"use client";

import { useEffect, useMemo, useState } from "react";
import { parseWhen, unique } from "@/lib/text";
import type { Requirements, ScoredJob, SourceResult, WorkMode, JobType, Seniority } from "@/lib/types";
import { emptyRequirements } from "@/lib/types";

const REQ_KEY = "job-finder:requirements";
const SAVED_KEY = "job-finder:saved";

const PRESETS: Array<{ label: string; req: Partial<Requirements> }> = [
  {
    label: "Frontend",
    req: {
      title: "Frontend Developer",
      skills: ["React", "TypeScript", "Next.js"],
      workMode: "remote",
      seniority: "mid",
    },
  },
  {
    label: "Backend",
    req: {
      title: "Backend Engineer",
      skills: ["Node.js", "Python", "PostgreSQL"],
      workMode: "remote",
      seniority: "mid",
    },
  },
  {
    label: "Full stack",
    req: {
      title: "Full Stack Engineer",
      skills: ["React", "Node.js", "TypeScript"],
      workMode: "any",
      seniority: "mid",
    },
  },
  {
    label: "Data",
    req: {
      title: "Data Analyst",
      skills: ["SQL", "Python", "Tableau"],
      workMode: "any",
      seniority: "mid",
    },
  },
  {
    label: "Design",
    req: {
      title: "Product Designer",
      skills: ["Figma", "UX", "UI"],
      workMode: "remote",
      seniority: "mid",
    },
  },
];

type SearchPayload = {
  jobs: ScoredJob[];
  total: number;
  scanned: number;
  sources: SourceResult[];
  searchedAt: string;
};

export function JobFinder() {
  const [req, setReq] = useState<Requirements>(emptyRequirements);
  const [resumeText, setResumeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchPayload | null>(null);
  const [saved, setSaved] = useState<ScoredJob[]>([]);
  const [tab, setTab] = useState<"matches" | "saved">("matches");
  const [minScore, setMinScore] = useState(50);
  const [sort, setSort] = useState<"match" | "newest">("match");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const rawReq = localStorage.getItem(REQ_KEY);
      if (rawReq) setReq({ ...emptyRequirements(), ...JSON.parse(rawReq) });
      const rawSaved = localStorage.getItem(SAVED_KEY);
      if (rawSaved) setSaved(JSON.parse(rawSaved));
    } catch {
      /* ignore broken local data */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(REQ_KEY, JSON.stringify(req));
  }, [req, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  }, [saved, hydrated]);

  const visible = useMemo(() => {
    const rows = (result?.jobs || []).filter((job) => {
      if (job.score < minScore) return false;
      if (sourceFilter !== "all" && job.source !== sourceFilter) return false;
      return true;
    });
    if (sort === "newest") {
      return [...rows].sort(
        (a, b) => (parseWhen(b.publishedAt) ?? 0) - (parseWhen(a.publishedAt) ?? 0),
      );
    }
    return rows;
  }, [result, minScore, sort, sourceFilter]);

  const savedIds = useMemo(() => new Set(saved.map((j) => j.id)), [saved]);

  const patch = (partial: Partial<Requirements>) => setReq((prev) => ({ ...prev, ...partial }));

  const applyPreset = (partial: Partial<Requirements>) => {
    setReq((prev) => ({
      ...prev,
      ...partial,
      skills: unique([...(partial.skills || prev.skills)]),
    }));
  };

  const extract = async () => {
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: resumeText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read that text");
      const extracted = data.extracted as Partial<Requirements>;
      setReq((prev) => ({
        ...prev,
        ...extracted,
        skills: unique([...(extracted.skills || []), ...prev.skills]),
        mustHaves: unique([...(extracted.mustHaves || []), ...prev.mustHaves]),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extract failed");
    } finally {
      setExtracting(false);
    }
  };

  const search = async () => {
    setBusy(true);
    setError(null);
    setTab("matches");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResult(data as SearchPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleSave = (job: ScoredJob) => {
    setSaved((prev) =>
      prev.some((j) => j.id === job.id) ? prev.filter((j) => j.id !== job.id) : [job, ...prev],
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
            Live boards · ranked to your brief
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Job Finder</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Enter the role, skills, location, and must-haves you actually want. Openings from
            Remotive, Remote OK, Jobicy, Arbeitnow, and The Muse are scored against that brief.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm ${tab === "matches" ? "bg-indigo-500 text-white" : "glass text-slate-300"}`}
            onClick={() => setTab("matches")}
          >
            Matches{result ? ` (${result.total})` : ""}
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm ${tab === "saved" ? "bg-indigo-500 text-white" : "glass text-slate-300"}`}
            onClick={() => setTab("saved")}
          >
            Saved ({saved.length})
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="glass h-fit rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            Your requirements
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.req)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:border-cyan-400/40 hover:text-white"
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="mt-5 block text-xs font-medium text-slate-400">Target role</label>
          <input
            value={req.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="e.g. Senior React Engineer"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none ring-indigo-400 focus:ring-2"
          />

          <ChipField
            label="Skills you have / want used"
            values={req.skills}
            onChange={(skills) => patch({ skills })}
            placeholder="Type a skill and press Enter"
          />

          <label className="mt-4 block text-xs font-medium text-slate-400">Location</label>
          <input
            value={req.location}
            onChange={(e) => patch({ location: e.target.value })}
            placeholder="Remote, London, NYC…"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none ring-indigo-400 focus:ring-2"
          />

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Select
              label="Work mode"
              value={req.workMode}
              onChange={(workMode) => patch({ workMode: workMode as WorkMode })}
              options={[
                ["any", "Any"],
                ["remote", "Remote"],
                ["hybrid", "Hybrid"],
                ["onsite", "On-site"],
              ]}
            />
            <Select
              label="Job type"
              value={req.jobType}
              onChange={(jobType) => patch({ jobType: jobType as JobType })}
              options={[
                ["any", "Any"],
                ["full-time", "Full-time"],
                ["contract", "Contract"],
                ["part-time", "Part-time"],
                ["internship", "Internship"],
              ]}
            />
            <Select
              label="Level"
              value={req.seniority}
              onChange={(seniority) => patch({ seniority: seniority as Seniority })}
              options={[
                ["any", "Any"],
                ["intern", "Intern"],
                ["junior", "Junior"],
                ["mid", "Mid"],
                ["senior", "Senior"],
                ["lead", "Lead / Staff"],
              ]}
            />
            <label className="block text-xs font-medium text-slate-400">
              Min salary (USD)
              <input
                type="number"
                min={0}
                step={5000}
                value={req.minSalary ?? ""}
                onChange={(e) =>
                  patch({ minSalary: e.target.value ? Number(e.target.value) : null })
                }
                placeholder="Optional"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none ring-indigo-400 focus:ring-2"
              />
            </label>
          </div>

          <ChipField
            label="Must-haves"
            values={req.mustHaves}
            onChange={(mustHaves) => patch({ mustHaves })}
            placeholder="visa, healthcare, React Native…"
          />
          <ChipField
            label="Deal-breakers"
            values={req.dealBreakers}
            onChange={(dealBreakers) => patch({ dealBreakers })}
            placeholder="unpaid, crypto, relocation…"
          />

          <label className="mt-4 block text-xs font-medium text-slate-400">
            Extra notes
          </label>
          <textarea
            value={req.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            rows={3}
            placeholder="Timezone overlap with PKT, Series B+, no agencies…"
            className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none ring-indigo-400 focus:ring-2"
          />

          <label className="mt-4 block text-xs font-medium text-slate-400">
            Or paste a resume / brief
          </label>
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            rows={4}
            placeholder="Paste text and we’ll pull role, skills, and level into the form."
            className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none ring-indigo-400 focus:ring-2"
          />
          <button
            type="button"
            onClick={extract}
            disabled={extracting || !resumeText.trim()}
            className="mt-2 w-full rounded-xl border border-white/10 py-2 text-sm text-slate-200 hover:border-cyan-400/40"
          >
            {extracting ? "Reading…" : "Fill form from text"}
          </button>

          <button
            type="button"
            onClick={search}
            disabled={busy || (!req.title.trim() && req.skills.length === 0)}
            className="mt-4 w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400"
          >
            {busy ? "Scoring live jobs…" : "Find matching jobs"}
          </button>
          {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        </aside>

        <section className="min-w-0">
          {tab === "saved" ? (
            saved.length === 0 ? (
              <Empty
                title="No saved jobs yet"
                body="Star a match and it stays in this browser so you can apply later."
              />
            ) : (
              <ul className="space-y-4">
                {saved.map((job) => (
                  <JobCard key={job.id} job={job} saved onToggle={() => toggleSave(job)} />
                ))}
              </ul>
            )
          ) : !result ? (
            <Empty
              title="Tell us what you want"
              body="Set a role and a few skills on the left. We’ll search public boards and rank every listing against that brief — not just keyword dumps."
            />
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-400">
                  Ranked {result.total} of {result.scanned} listings
                  {result.sources.length ? " · " : ""}
                  {result.sources
                    .map((s) => (s.error ? `${s.name} offline` : `${s.name} ${s.count}`))
                    .join(" · ")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as "match" | "newest")}
                    className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs"
                  >
                    <option value="match">Best match</option>
                    <option value="newest">Newest</option>
                  </select>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs"
                  >
                    <option value="all">All sources</option>
                    {(result.sources || []).map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    Min {minScore}%
                    <input
                      type="range"
                      min={0}
                      max={90}
                      step={5}
                      value={minScore}
                      onChange={(e) => setMinScore(Number(e.target.value))}
                    />
                  </label>
                </div>
              </div>
              {result.total === 0 ? (
                <Empty
                  title="No listings match this role"
                  body="These boards only keep a job if the title or tags mention your role or skills. Try a closer title (Frontend Developer, Data Analyst) or add a skill like React."
                />
              ) : visible.length === 0 ? (
                <Empty
                  title="Nothing at this match threshold"
                  body="Lower the minimum score or drop a must-have that’s too strict."
                />
              ) : (
                <ul className="space-y-4">
                  {visible.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      saved={savedIds.has(job.id)}
                      onToggle={() => toggleSave(job)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function JobCard({
  job,
  saved,
  onToggle,
}: {
  job: ScoredJob;
  saved: boolean;
  onToggle: () => void;
}) {
  const tone =
    job.score >= 75 ? "text-emerald-300" : job.score >= 55 ? "text-cyan-300" : "text-amber-300";
  return (
    <li className="glass rounded-2xl p-5">
      <div className="flex gap-4">
        <div className={`w-14 shrink-0 text-center ${tone}`}>
          <div className="text-2xl font-semibold tabular-nums">{job.score}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">match</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold leading-snug">{job.title}</h3>
              <p className="text-sm text-slate-300">
                {job.company}
                <span className="text-slate-500"> · {job.location}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onToggle}
                className={`rounded-full px-3 py-1 text-xs ${saved ? "bg-amber-400/20 text-amber-200" : "border border-white/10 text-slate-300"}`}
              >
                {saved ? "Saved" : "Save"}
              </button>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900"
              >
                Apply
              </a>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {job.source}
            {job.jobType !== "any" ? ` · ${job.jobType.replace("-", " ")}` : ""}
            {job.workMode !== "any" ? ` · ${job.workMode}` : ""}
            {job.salary ? ` · ${job.salary}` : ""}
            {job.publishedAt ? ` · ${relative(job.publishedAt)}` : ""}
          </p>
          {job.excerpt && <p className="mt-3 text-sm leading-6 text-slate-300">{job.excerpt}</p>}
          {job.reasons.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.reasons.map((r) => (
                <span
                  key={r}
                  className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[11px] text-emerald-200"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
          {job.gaps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.gaps.map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-amber-400/10 px-2.5 py-0.5 text-[11px] text-amber-200"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function ChipField({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(/[,|\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    onChange(unique([...values, ...parts]));
    setDraft("");
  };
  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(values.filter((v) => v !== value))}
            className="rounded-full bg-indigo-400/15 px-2.5 py-0.5 text-[11px] text-indigo-100"
            title="Remove"
          >
            {value} ×
          </button>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none ring-indigo-400 focus:ring-2"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block text-xs font-medium text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none ring-indigo-400 focus:ring-2"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass rounded-2xl px-6 py-16 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function relative(raw: unknown) {
  const t = parseWhen(raw);
  if (t == null) return "";
  const days = Math.round((Date.now() - t) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(t).toISOString().slice(0, 10);
}
