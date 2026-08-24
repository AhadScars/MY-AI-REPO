"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { api } from "@/lib/api-client";
import {
  DIFFICULTIES,
  DURATIONS,
  EXPERIENCE_LEVELS,
  INTERVIEW_TYPES,
  ROLES,
  STYLES,
} from "@/lib/constants";
import type { ParsedResume } from "@/lib/schemas";
import type { PublicInterview } from "@/lib/types";

type ResumePayload = {
  id: string;
  fileName: string;
  parsedData: ParsedResume;
};

export function SetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [resume, setResume] = useState<ResumePayload | null>(null);
  const [parsed, setParsed] = useState<ParsedResume | null>(null);

  const [role, setRole] = useState("Software Engineer");
  const [customRole, setCustomRole] = useState("");
  const [company, setCompany] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("mid");
  const [interviewType, setInterviewType] = useState("mixed");
  const [difficulty, setDifficulty] = useState("medium");
  const [duration, setDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState("");
  const [style, setStyle] = useState("professional");

  const targetRole = role === "custom" ? customRole : role;
  const minutes = customDuration ? Number(customDuration) : duration;

  async function uploadFile(file: File) {
    setBusy(true);
    setError(null);
    setWarning(null);
    setStatus("Analyzing your experience…");
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await api<{ resume: ResumePayload; warning?: string }>("/api/resumes/upload", {
        method: "POST",
        body: form,
      });
      setResume(data.resume);
      setParsed(data.resume.parsedData);
      if (data.resume.parsedData.name && !customRole) {
        /* keep role selection */
      }
      if (data.warning) setWarning(data.warning);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume upload failed.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function createInterview() {
    if (!resume || !parsed) return;
    if (!targetRole.trim()) {
      setError("Enter a target role.");
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 8 || minutes > 90) {
      setError("Duration must be between 8 and 90 minutes.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("Building questions around your background…");
    try {
      const data = await api<{ interview: PublicInterview }>("/api/interviews", {
        method: "POST",
        body: JSON.stringify({
          resumeId: resume.id,
          role: targetRole.trim(),
          company,
          experienceLevel,
          interviewType,
          difficulty,
          duration: minutes,
          style,
          parsedData: parsed,
        }),
      });
      router.push(`/interview/${data.interview.id}/lobby`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare the interview.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  const listField = useMemo(
    () =>
      function ListField({
        label,
        value,
        onChange,
      }: {
        label: string;
        value: string[];
        onChange: (next: string[]) => void;
      }) {
        return (
          <Field label={label} hint="Comma-separated">
            <Input value={value.join(", ")} onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
          </Field>
        );
      },
    [],
  );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-primary">Step {step} of 2</p>
      <h1 className="mt-1 font-serif text-4xl text-navy">
        {step === 1 ? "Upload your latest resume" : "Configure the interview"}
      </h1>
      <p className="mt-2 text-slate-600">
        {step === 1
          ? "Your resume helps the AI create questions specifically around your experience."
          : "Choose the role, style, and difficulty. The interviewer will stay inside this brief."}
      </p>

      {error ? (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      {warning ? (
        <div className="mt-4">
          <Alert tone="warning">{warning}</Alert>
        </div>
      ) : null}
      {status ? (
        <div className="mt-4">
          <Alert>{status}</Alert>
        </div>
      ) : null}

      {step === 1 ? (
        <Card
          className={`mt-8 border-dashed p-10 text-center ${drag ? "border-primary bg-blue-50/40" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void uploadFile(file);
          }}
        >
          <p className="font-medium text-navy">Drag and drop a PDF, DOC, or DOCX</p>
          <p className="mt-1 text-sm text-slate-500">Maximum 8 MB. Text-based files parse best.</p>
          <label className="mt-6 inline-flex cursor-pointer">
            <span className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white">
              {busy ? "Uploading…" : "Choose file"}
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
          </label>
        </Card>
      ) : parsed ? (
        <div className="mt-8 space-y-6">
          <Card className="space-y-4 p-5">
            <h2 className="font-semibold text-navy">Parsed resume preview</h2>
            <p className="text-sm text-slate-500">Edit anything the parser missed before you enter the room.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input value={parsed.name} onChange={(e) => setParsed({ ...parsed, name: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input value={parsed.email} onChange={(e) => setParsed({ ...parsed, email: e.target.value })} />
              </Field>
              <Field label="Years of experience">
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={parsed.yearsOfExperience}
                  onChange={(e) => setParsed({ ...parsed, yearsOfExperience: Number(e.target.value) })}
                />
              </Field>
              <Field label="Phone">
                <Input value={parsed.phone} onChange={(e) => setParsed({ ...parsed, phone: e.target.value })} />
              </Field>
            </div>
            {listField({
              label: "Skills",
              value: parsed.skills,
              onChange: (skills) => setParsed({ ...parsed, skills }),
            })}
            {listField({
              label: "Technologies",
              value: parsed.technologies,
              onChange: (technologies) => setParsed({ ...parsed, technologies }),
            })}
            <Field label="Summary">
              <Input value={parsed.summary} onChange={(e) => setParsed({ ...parsed, summary: e.target.value })} />
            </Field>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-semibold text-navy">Interview setup</h2>
            <Field label="Target role">
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
                <option value="custom">Custom role…</option>
              </Select>
            </Field>
            {role === "custom" ? (
              <Field label="Custom role">
                <Input value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder="Staff Platform Engineer" />
              </Field>
            ) : null}
            <Field label="Target company (optional)" hint="Used only to adapt public interview style — never claimed as leaked material.">
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Google" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Experience level">
                <Select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)}>
                  {EXPERIENCE_LEVELS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Interview type">
                <Select value={interviewType} onChange={(e) => setInterviewType(e.target.value)}>
                  {INTERVIEW_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Difficulty">
                <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  {DIFFICULTIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Interview style">
                <Select value={style} onChange={(e) => setStyle(e.target.value)}>
                  {STYLES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Length">
                <Select
                  value={customDuration ? "custom" : String(duration)}
                  onChange={(e) => {
                    if (e.target.value === "custom") setCustomDuration("25");
                    else {
                      setCustomDuration("");
                      setDuration(Number(e.target.value));
                    }
                  }}
                >
                  {DURATIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                  <option value="custom">Custom</option>
                </Select>
              </Field>
              {customDuration ? (
                <Field label="Custom minutes">
                  <Input
                    type="number"
                    min={8}
                    max={90}
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                  />
                </Field>
              ) : null}
            </div>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>
              Back
            </Button>
            <Button onClick={createInterview} disabled={busy}>
              {busy ? "Preparing interview…" : "Continue to lobby"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
