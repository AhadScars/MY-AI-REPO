import type { JobType, Seniority, WorkMode } from "./types";
import { normalize } from "./text";

export function inferWorkMode(location: string, remoteFlag?: boolean): WorkMode {
  const t = normalize(`${location} ${remoteFlag ? "remote" : ""}`);
  if (/\bhybrid\b/.test(t)) return "hybrid";
  if (/\bonsite\b|\bon-site\b|\bin office\b|\bin-office\b/.test(t)) return "onsite";
  if (remoteFlag || /\bremote\b|\bworldwide\b|\banywhere\b|\bwork from home\b|\bwfh\b/.test(t)) {
    return "remote";
  }
  return "onsite";
}

export function inferJobType(raw: string | string[] | undefined): JobType {
  const t = normalize(Array.isArray(raw) ? raw.join(" ") : raw || "");
  if (/\bintern\b|\binternship\b/.test(t)) return "internship";
  if (/\bcontract\b|\bfreelance\b|\bcontractor\b|\btemporary\b/.test(t)) return "contract";
  if (/\bpart[- ]?time\b/.test(t)) return "part-time";
  if (/\bfull[- ]?time\b|\bpermanent\b/.test(t)) return "full-time";
  return "full-time";
}

export function inferSeniority(title: string, extra = ""): Seniority {
  const t = normalize(`${title} ${extra}`);
  if (/\bintern\b|\binternship\b|\bapprentice\b/.test(t)) return "intern";
  if (/\bjunior\b|\bjr\b|\bentry\b|\bassociate\b|\bgraduate\b/.test(t)) return "junior";
  if (/\bstaff\b|\bprincipal\b|\bdistinguished\b|\barchitect\b|\bhead of\b|\bdirector\b|\bvp\b|\blead\b|\bmanager\b/.test(t)) {
    return "lead";
  }
  if (/\bsenior\b|\bsr\b/.test(t)) return "senior";
  if (/\bmid[- ]?level\b|\bmid\b/.test(t)) return "mid";
  return "mid";
}

export function museCategory(title: string): string | undefined {
  const t = normalize(title);
  if (/\bdesign|ux|ui|product design/.test(t)) return "Design and UX";
  if (/\bdata|analyst|scientist|machine learning|ml |ai /.test(t)) return "Data Science";
  if (/\bproduct manager|product owner/.test(t)) return "Product";
  if (/\bmarket|growth|seo|content/.test(t)) return "Marketing";
  if (/\bsales|account exec|sdr|bdr/.test(t)) return "Sales";
  if (/\bhr |recruiter|people/.test(t)) return "HR";
  if (/\bfinance|account|controller/.test(t)) return "Accounting and Finance";
  if (/\bengineer|developer|software|frontend|backend|fullstack|devops|sre/.test(t)) {
    return "Software Engineering";
  }
  return undefined;
}
