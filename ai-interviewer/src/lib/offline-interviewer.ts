/**
 * Fully offline interview engine — no external AI API required.
 * Uses resume keyword extraction + structured question banks + scoring heuristics.
 */

export type Analysis = {
  candidateName: string;
  summary: string;
  skills: string[];
  experienceHighlights: string[];
  potentialGaps: string[];
  firstQuestion: string;
  suggestedFocusAreas: string[];
  questionBank: string[];
};

export type TurnResult = {
  spokenReply: string;
  nextQuestion: string | null;
  note: string;
  done: boolean;
  followUp: boolean;
};

export type Feedback = {
  overallScore: number;
  strengths: string[];
  areasToImprove: string[];
  keyTakeaways: string[];
  spokenSummary: string;
  detailedFeedback: string;
};

export type ResumeReview = {
  overallScore: number;
  candidateName: string;
  targetRole: string;
  summary: string;
  skills: string[];
  experienceHighlights: string[];
  strengths: string[];
  weaknesses: string[];
  atsTips: string[];
  bulletRewrites: Array<{ original: string; improved: string }>;
  actionPlan: string[];
  detailedReport: string;
};

const SKILL_DICTIONARY = [
  // languages
  "javascript", "typescript", "python", "java", "c++", "c#", "golang", "go", "rust", "php", "ruby", "kotlin", "swift", "scala", "r", "matlab", "sql", "bash", "powershell",
  // web / app
  "react", "react.js", "reactjs", "next.js", "nextjs", "angular", "vue", "vue.js", "svelte", "node", "node.js", "nodejs",
  "express", "nestjs", "django", "flask", "fastapi", "laravel", "spring", "spring boot", ".net", "asp.net",
  "html", "css", "tailwind", "sass", "bootstrap", "redux", "zustand", "graphql", "rest", "rest api", "websocket",
  "jquery", "webpack", "vite", "three.js",
  // data / cloud / devops
  "aws", "amazon web services", "azure", "gcp", "google cloud", "docker", "kubernetes", "k8s", "linux", "unix", "git",
  "ci/cd", "jenkins", "github actions", "gitlab", "terraform", "ansible", "prometheus", "grafana", "nginx",
  "mongodb", "mysql", "postgresql", "postgres", "sql server", "sqlite", "redis", "elasticsearch", "kafka", "rabbitmq",
  "firebase", "supabase", "dynamodb", "snowflake", "bigquery", "spark", "hadoop", "airflow",
  "machine learning", "deep learning", "tensorflow", "pytorch", "scikit-learn", "pandas", "numpy", "nlp", "data analysis",
  "power bi", "tableau", "excel", "looker",
  // mobile / other
  "android", "ios", "flutter", "react native", "swiftui", "figma", "ui/ux", "agile", "scrum", "jira", "confluence",
  "security", "oauth", "jwt", "testing", "jest", "cypress", "playwright", "selenium", "pytest", "junit",
  "microservices", "system design", "soa", "grpc", "protobuf", "opencv", "unity", "unreal",
];

/** Canonical display labels for dictionary hits */
const SKILL_LABEL: Record<string, string> = {
  "next.js": "Next.js",
  nextjs: "Next.js",
  "node.js": "Node.js",
  nodejs: "Node.js",
  node: "Node.js",
  "react.js": "React",
  reactjs: "React",
  "vue.js": "Vue",
  "ci/cd": "CI/CD",
  "c++": "C++",
  "c#": "C#",
  ".net": ".NET",
  "asp.net": "ASP.NET",
  "spring boot": "Spring Boot",
  "react native": "React Native",
  "machine learning": "Machine Learning",
  "deep learning": "Deep Learning",
  "data analysis": "Data Analysis",
  "system design": "System Design",
  "amazon web services": "AWS",
  "google cloud": "GCP",
  "github actions": "GitHub Actions",
  "power bi": "Power BI",
  "scikit-learn": "Scikit-learn",
  "sql server": "SQL Server",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  k8s: "Kubernetes",
  golang: "Go",
};

const ROLE_FOCUS: Record<string, string[]> = {
  default: ["problem solving", "teamwork", "ownership", "communication", "impact"],
  "software engineer": ["coding", "system design", "debugging", "code quality", "collaboration"],
  frontend: ["ui performance", "accessibility", "react/state", "css architecture", "user experience"],
  backend: ["apis", "databases", "scalability", "security", "reliability"],
  "data analyst": ["sql", "dashboards", "insights", "data quality", "stakeholder communication"],
  "data scientist": ["modeling", "feature engineering", "experimentation", "python", "business impact"],
  devops: ["ci/cd", "infrastructure", "monitoring", "incident response", "automation"],
  "product manager": ["prioritization", "user research", "roadmaps", "metrics", "stakeholder alignment"],
};

function normalize(text: string) {
  return text.replace(/\r/g, "\n").replace(/\t/g, " ").trim();
}

function extractName(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12);

  for (const line of lines) {
    // skip emails, urls, phones, section headers
    if (/@|http|www\.|\d{3}[-.\s]?\d{3}|resume|curriculum|profile|summary|objective|experience|education|skills/i.test(line)) {
      continue;
    }
    if (line.length >= 3 && line.length <= 50 && /^[A-Za-z][A-Za-z .'-]+$/.test(line)) {
      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) return line;
    }
  }
  return "Candidate";
}

function labelSkill(skill: string): string {
  const key = skill.toLowerCase();
  if (SKILL_LABEL[key]) return SKILL_LABEL[key];
  // Title-case multi-word
  return skill
    .split(/[\s/]+/)
    .map((w) => (w === w.toUpperCase() && w.length <= 4 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function extractSkillsSection(text: string): string {
  // Capture from Skills / Technical Skills until next major heading
  const m = text.match(
    /(?:^|\n)\s*(?:technical\s+)?(?:skills|tech\s*stack|technologies|tools)[:\s]*\n?([\s\S]{0,1200}?)(?=\n\s*(?:experience|work\s+history|employment|education|projects|certifications|summary|profile|awards)\b|$)/i
  );
  return m?.[1] || text.match(/skills[\s\S]{0,900}/i)?.[0] || "";
}

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string) => {
    const cleaned = raw.replace(/^[,;|/•\-\s]+|[,;|/•\-\s]+$/g, "").trim();
    if (cleaned.length < 2 || cleaned.length > 40) return;
    if (/^(and|or|the|with|using|including|skills|technologies)$/i.test(cleaned)) return;
    const key = cleaned.toLowerCase();
    // de-dupe near-duplicates (node / node.js)
    if (seen.has(key)) return;
    if (key === "js") return add("JavaScript");
    if (key === "ts") return add("TypeScript");
    seen.add(key);
    found.push(labelSkill(cleaned));
  };

  // 1) Dictionary hits on full resume (word-boundary)
  // Prefer longer phrases first so "react native" wins over "react"
  const dict = [...SKILL_DICTIONARY].sort((a, b) => b.length - a.length);
  for (const skill of dict) {
    const re = new RegExp(
      `(?:^|[^a-z0-9+#])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^a-z0-9+#]|$)`,
      "i"
    );
    if (re.test(lower)) add(skill);
  }

  // 2) Skills section list items (comma / pipe / bullet / newline separated)
  const section = extractSkillsSection(text);
  if (section) {
    const pieces = section
      .split(/[\n,|•·▪◦/]| {2,}|(?<=\w)\s{2,}(?=[A-Z])/)
      .map((p) => p.replace(/^[-–—*:\s]+/, "").trim())
      .filter((p) => p.length >= 2 && p.length <= 40);
    for (const p of pieces.slice(0, 40)) {
      // Keep tech-looking tokens from the section even if not in dictionary
      if (/[A-Za-z]/.test(p) && !/^(skills|technical|proficient|expertise|tools)$/i.test(p)) {
        // Avoid full sentences
        if (p.split(/\s+/).length <= 4) add(p);
      }
    }
  }

  // Cap and prefer section/dictionary diversity
  return found.slice(0, 18);
}

function extractHighlights(text: string): string[] {
  const bullets = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-•*●▪]|^\d+\./.test(l) || /\b(developed|built|led|created|implemented|designed|improved|managed|delivered)\b/i.test(l))
    .map((l) => l.replace(/^[-•*●▪\d.\s]+/, "").trim())
    .filter((l) => l.length > 25 && l.length < 220);

  const unique: string[] = [];
  for (const b of bullets) {
    if (!unique.some((u) => u.slice(0, 40) === b.slice(0, 40))) unique.push(b);
    if (unique.length >= 6) break;
  }

  if (unique.length === 0) {
    const sentences = text
      .replace(/\n+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 40 && s.length < 200);
    return sentences.slice(0, 4);
  }
  return unique;
}

function extractYears(text: string): number | null {
  const m = text.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
  return m ? Number(m[1]) : null;
}

function roleKey(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("front")) return "frontend";
  if (r.includes("back")) return "backend";
  if (r.includes("data sci")) return "data scientist";
  if (r.includes("data")) return "data analyst";
  if (r.includes("devops") || r.includes("sre") || r.includes("cloud")) return "devops";
  if (r.includes("product")) return "product manager";
  if (r.includes("software") || r.includes("full") || r.includes("engineer") || r.includes("developer")) {
    return "software engineer";
  }
  return "default";
}

function hardRoleQuestions(role: string, skills: string[], gaps: string[]): string[] {
  const rk = roleKey(role);
  const s0 = skills[0] || "your primary stack";
  const s1 = skills[1] || s0;
  const s2 = skills[2] || s1;
  const g0 = gaps[0] || "system design";

  const byRole: Record<string, string[]> = {
    frontend: [
      `Walk me through how you would diagnose and fix a React app that re-renders excessively. How do you measure it, and what tools do you use?`,
      `Design a performant infinite-scroll feed with ${s0}. Cover virtualization, caching, error states, and accessibility.`,
      `Explain when you would choose client-side state vs server state vs URL state. Give a concrete example from your work.`,
      `How would you reduce Largest Contentful Paint on a marketing page from 4.5s to under 2.5s? Prioritize the top 5 actions and why.`,
      `Describe a frontend architecture decision you regret. What did you learn, and how would you redesign it now?`,
    ],
    backend: [
      `Design an API that must handle 10x traffic spikes without downtime. Cover load balancing, caching, rate limiting, and backpressure.`,
      `You have a slow endpoint (p99 = 2s). Walk me through your debugging process from metrics to root cause to fix.`,
      `How do you design idempotent payment or order APIs? What failure modes do you explicitly handle?`,
      `Compare SQL vs NoSQL for a multi-tenant SaaS with complex reporting. Defend a choice with trade-offs.`,
      `Describe how you would model authentication/authorization for internal microservices. Where do you put trust boundaries?`,
    ],
    "software engineer": [
      `Pick the most complex system on your resume. Draw the architecture verbally: components, data flow, failure points, and bottlenecks.`,
      `How would you design a URL shortener for 100M redirects/day? Cover schema, hashing, caching, and analytics.`,
      `Tell me about a production incident you owned end-to-end. Timeline, diagnosis, mitigation, and prevention.`,
      `Where have you made a hard trade-off between shipping speed and code quality? What was the business context?`,
      `Given ${s0} and ${s1} on your resume, explain a non-obvious performance or correctness bug you fixed involving them.`,
    ],
    "data analyst": [
      `A stakeholder says "revenue is down." How do you structure the analysis? What metrics, cuts, and caveats do you check first?`,
      `Write the logic (in words or SQL-style steps) to compute weekly active users with a 7-day rolling window and exclude bots.`,
      `How do you detect and handle data quality issues before leadership sees a dashboard? Give a real example.`,
      `Describe a time your analysis changed a decision. What was the counterfactual if they ignored you?`,
      `Explain cohort analysis vs funnel analysis and when each misleads stakeholders.`,
    ],
    "data scientist": [
      `Walk through an end-to-end model you shipped: problem framing, features, baseline, evaluation metric, and monitoring in production.`,
      `How do you decide between a simple model and a complex one when business stakeholders want "AI"?`,
      `Your model's precision dropped 8% this week. What is your incident checklist?`,
      `Explain train/serving skew and how you prevent it.`,
      `Describe an experiment (A/B or offline) you designed. What was the hypothesis, power, and decision rule?`,
    ],
    devops: [
      `Design a CI/CD pipeline for a monorepo with multiple services. Cover tests, security scans, canaries, and rollback.`,
      `We have recurring 2am pages for memory pressure. How do you turn this from firefighting into a reliability program?`,
      `Compare blue/green vs canary vs rolling deploys. When is each the wrong choice?`,
      `How would you implement least-privilege access for engineers to production without blocking incident response?`,
      `Walk me through designing observability (metrics, logs, traces) for a new microservice from day one.`,
    ],
    "product manager": [
      `You have three high-priority requests and engineering capacity for one. How do you decide and communicate the no?`,
      `Define success metrics for a feature before build. What leading vs lagging indicators would you track?`,
      `Tell me about a roadmap bet that failed. What signals did you miss, and what process changed?`,
      `How do you resolve a conflict between sales commitments and product strategy?`,
      `Walk me through writing a PRD for a zero-to-one feature with high ambiguity.`,
    ],
    default: [
      `Describe the hardest professional problem you've solved. Why was it hard, and what did you personally do?`,
      `How do you operate when requirements are ambiguous and stakeholders disagree?`,
      `Give an example of owning a failure publicly and recovering trust.`,
      `What systems or processes have you improved that outlasted your direct involvement?`,
      `How do you prioritize when everything is labeled urgent?`,
    ],
  };

  const commonHard = [
    `Challenge: I'll play skeptic. Convince me your biggest resume achievement was *your* impact—not the team's. What uniquely would not have happened without you?`,
    `Dig deeper on failure: Tell me about a decision you made that was wrong. What data did you miss, and what is your updated decision framework?`,
    `Pressure question: You have 48 hours before a critical demo and a major bug appears in ${s0}. Walk me through your plan hour by hour.`,
    `Systems thinking: How would you scale the main product you worked on to 10x users? Name the first three bottlenecks and mitigations.`,
    `Collaboration under conflict: Describe a technical disagreement where you were initially wrong *or* right but had to influence without authority.`,
    `Depth on ${s1}: Don't give a tutorial. Explain a real production constraint you hit with ${s1} and how you worked around it.`,
    `Depth on ${s2}: Compare ${s2} with an alternative you rejected. What metric or constraint decided it?`,
    `Gap probe on ${g0}: For a ${role} role we care about ${g0}. Give the strongest evidence you can—or a 30-day plan to become credible.`,
    `Behavioral bar raiser: Tell me about a time you raised the quality bar for others (reviews, standards, mentoring). What changed measurably?`,
    `Closing stress test: Why should we hire you over someone with a stronger pedigree on paper? Be specific, not motivational.`,
  ];

  return [...(byRole[rk] || byRole.default), ...commonHard];
}

function buildQuestionBank(analysis: Omit<Analysis, "questionBank" | "firstQuestion">, role: string): string[] {
  const skills = analysis.skills;
  const highlights = analysis.experienceHighlights;
  const gaps = analysis.potentialGaps;
  const focus = ROLE_FOCUS[roleKey(role)] || ROLE_FOCUS.default;

  const qs: string[] = [];

  // Opening still professional but immediately substantive
  qs.push(
    `Let's begin. In 90 seconds, pitch why your background is a strong fit for ${role}—then name the single hardest technical or analytical problem on your resume.`
  );

  // Resume claim deep-dives (harder than "tell me about it")
  if (highlights[0]) {
    qs.push(
      `Resume claim: "${highlights[0].slice(0, 130)}". Break this down: problem constraints, your exact ownership, architecture or method, metrics before/after, and what you would redo.`
    );
  } else {
    qs.push(
      `Pick your strongest project. I want constraints, trade-offs, your personal commits/decisions, failure modes, and a metric that proves impact.`
    );
  }

  if (highlights[1]) {
    qs.push(
      `Second claim: "${highlights[1].slice(0, 120)}". What was the hardest edge case, and how did you validate correctness under real traffic or real users?`
    );
  }

  if (highlights[2]) {
    qs.push(
      `Another highlight: "${highlights[2].slice(0, 110)}". Who disagreed with your approach, and how did you defend or revise it?`
    );
  }

  // Skill depth
  if (skills[0]) {
    qs.push(
      `You list ${skills.slice(0, 4).join(", ")}. For ${skills[0]}, describe a production incident or performance issue—root cause, fix, and the guardrail you added afterward.`
    );
  }

  // Role-hard pack
  qs.push(...hardRoleQuestions(role, skills, gaps));

  // Focus-area bar-raiser
  qs.push(
    `${focus[0]} is a bar-raiser for this ${role} seat. Give a STAR example with a quantifiable result—and what a weak candidate usually gets wrong on this.`
  );

  qs.push(
    `Ambiguity test: Leadership wants feature X by Friday with incomplete requirements. How do you clarify, cut scope, and still protect quality?`
  );

  if (gaps[0]) {
    qs.push(
      `Potential gap vs our ${role} bar: ${gaps[0]}. Either prove relevant depth with a concrete story, or outline a rigorous 2-week ramp plan with artifacts you'd produce.`
    );
  }

  qs.push(
    `Final round: What are you optimized for in your next role, and what kind of problems would make you a poor fit? Be candid.`
  );

  return Array.from(new Set(qs)).slice(0, 14);
}

/** Full offline resume critique — no network / no LLM API */
export function reviewResumeOffline(resumeText: string, role: string): ResumeReview {
  const analysis = analyzeResumeOffline(resumeText, role);
  const text = normalize(resumeText);
  const lower = text.toLowerCase();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const words = wordCount(text);
  const bullets = lines.filter((l) => /^[-•*●▪]|^\d+\./.test(l));
  const years = extractYears(text);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const atsTips: string[] = [];
  let score = 5;

  // Length / structure
  if (words >= 250 && words <= 900) {
    score += 1;
    strengths.push("Resume length is in a solid range for most roles");
  } else if (words < 150) {
    score -= 2;
    weaknesses.push("Resume is very short — add concrete project and impact detail");
  } else if (words > 1200) {
    score -= 1;
    weaknesses.push("Resume is long — tighten to 1 page (or 2 for senior) with stronger bullets");
  }

  if (bullets.length >= 4) {
    score += 1;
    strengths.push(`Uses bullet points (${bullets.length} found) which scan well`);
  } else {
    weaknesses.push("Add clearer bullet points under each role/project");
  }

  // Contact / identity signals
  if (/@|email|linkedin\.com|github\.com|phone|\+\d/i.test(text)) {
    score += 1;
    strengths.push("Contact or portfolio links appear present");
  } else {
    score -= 1;
    weaknesses.push("Add email, phone, and LinkedIn/GitHub (if relevant)");
    atsTips.push("Put contact info at the top in plain text (not only in a header image)");
  }

  // Skills
  if (analysis.skills.length >= 6) {
    score += 1;
    strengths.push(`Strong skill coverage detected: ${analysis.skills.slice(0, 6).join(", ")}`);
  } else if (analysis.skills.length >= 3) {
    strengths.push(`Core skills detected: ${analysis.skills.join(", ")}`);
  } else {
    score -= 1;
    weaknesses.push("Few recognizable skills found — add a dedicated Skills section with tools you use");
  }

  // Metrics / impact
  const metricHits = (text.match(/\d+%|\$\d+|\d+\+|increased|reduced|improved|grew|cut|saved|users|revenue|latency|throughput/gi) || []).length;
  if (metricHits >= 3) {
    score += 1;
    strengths.push("Includes numbers or outcome language (metrics help hiring managers)");
  } else {
    score -= 1;
    weaknesses.push("Add measurable impact (%, time saved, users, revenue, performance)");
  }

  // Action verbs
  const actionVerbs = (text.match(/\b(led|built|designed|implemented|developed|created|improved|optimized|shipped|launched|migrated|automated|owned)\b/gi) || []).length;
  if (actionVerbs >= 4) {
    strengths.push("Uses action-oriented language");
  } else {
    weaknesses.push("Start bullets with strong action verbs (Built, Led, Improved, Designed…)");
  }

  // Role alignment
  const focus = ROLE_FOCUS[roleKey(role)] || ROLE_FOCUS.default;
  const roleAligned = analysis.skills.length > 0 || analysis.experienceHighlights.length > 0;
  if (roleAligned) {
    strengths.push(`Content can be tailored further toward ${role} (${focus.slice(0, 3).join(", ")})`);
  }

  // ATS hygiene
  if (/table|column|text box/i.test(lower)) {
    atsTips.push("Avoid complex tables/text boxes if possible — many ATS parsers struggle with them");
  }
  atsTips.push("Use standard section headings: Summary, Experience, Projects, Education, Skills");
  atsTips.push("Save a text-based PDF (not a scanned image) so parsers can read your content");
  atsTips.push(`Mirror keywords from the ${role} job description in Skills and bullets (honestly)`);
  if (!/\beducation\b|\buniversity\b|\bbachelor\b|\bmaster\b|\bbs\b|\bms\b/i.test(text)) {
    atsTips.push("Include an Education section even if brief");
    weaknesses.push("Education section not clearly detected");
  }
  if (years) {
    strengths.push(`Experience signal of ~${years}+ years is easy for recruiters to spot`);
  }

  // Bullet rewrites (top weak-looking bullets)
  const bulletRewrites: Array<{ original: string; improved: string }> = [];
  for (const raw of bullets.slice(0, 8)) {
    const original = raw.replace(/^[-•*●▪\d.\s]+/, "").trim();
    if (original.length < 20) continue;
    const hasMetric = /\d|%|\$|users|revenue|time|improved|reduced/i.test(original);
    if (!hasMetric || original.length < 60) {
      const skillHint = analysis.skills[0] || "the core technology";
      const improved = hasMetric
        ? original
        : `${original.replace(/\.$/, "")} — resulting in [X% faster / N users / Y hours saved] using ${skillHint}.`;
      if (!hasMetric) {
        bulletRewrites.push({
          original,
          improved: improved.startsWith(original.slice(0, 10))
            ? improved
            : `Delivered: ${original.replace(/\.$/, "")}. Impact: [add metric]. Tech: ${skillHint}.`,
        });
      }
    }
    if (bulletRewrites.length >= 3) break;
  }
  if (bulletRewrites.length === 0 && analysis.experienceHighlights[0]) {
    bulletRewrites.push({
      original: analysis.experienceHighlights[0],
      improved: `${analysis.experienceHighlights[0].replace(/\.$/, "")}, improving [metric] by [X%] for [users/team].`,
    });
  }

  const actionPlan = [
    "Rewrite your top 5 bullets using Action + Problem + Result + metric",
    analysis.skills[0]
      ? `Add one deeper ${analysis.skills[0]} project with architecture, trade-offs, and outcome`
      : "Add 1–2 projects with stack, your role, and measurable results",
    analysis.potentialGaps[0]
      ? `Close gap: gain evidence for ${analysis.potentialGaps[0]} (course, PR, or small project)`
      : "Align summary and skills order to the target job description",
    "Export a clean single-column PDF and paste text into an ATS checker offline (or re-read as plain text)",
  ];

  score = Math.max(1, Math.min(10, score));

  const detailedReport = [
    `# Offline Resume Review`,
    ``,
    `**Candidate:** ${analysis.candidateName}`,
    `**Target role:** ${role}`,
    `**Overall score:** ${score}/10`,
    `**Mode:** Fully offline (no cloud AI)`,
    ``,
    `## Summary`,
    analysis.summary,
    ``,
    `## Detected skills`,
    analysis.skills.length ? analysis.skills.join(", ") : "None clearly detected",
    ``,
    `## Experience highlights`,
    ...(analysis.experienceHighlights.length
      ? analysis.experienceHighlights.map((h) => `- ${h}`)
      : ["- Limited highlights extracted — use clearer bullets"]),
    ``,
    `## Strengths`,
    ...strengths.map((s) => `- ${s}`),
    ``,
    `## Weaknesses`,
    ...weaknesses.map((w) => `- ${w}`),
    ``,
    `## ATS / formatting tips`,
    ...atsTips.map((t) => `- ${t}`),
    ``,
    `## Suggested bullet rewrites`,
    ...(bulletRewrites.length
      ? bulletRewrites.flatMap((b, i) => [
          `### Example ${i + 1}`,
          `Original: ${b.original}`,
          `Improved: ${b.improved}`,
          ``,
        ])
      : ["- Add metric-backed bullets so rewrites can be suggested"]),
    `## Action plan`,
    ...actionPlan.map((a, i) => `${i + 1}. ${a}`),
    ``,
    `## Potential gaps for ${role}`,
    ...analysis.potentialGaps.map((g) => `- ${g}`),
  ].join("\n");

  return {
    overallScore: score,
    candidateName: analysis.candidateName,
    targetRole: role,
    summary: analysis.summary,
    skills: analysis.skills,
    experienceHighlights: analysis.experienceHighlights,
    strengths: strengths.slice(0, 8),
    weaknesses: weaknesses.slice(0, 8),
    atsTips: atsTips.slice(0, 8),
    bulletRewrites,
    actionPlan,
    detailedReport,
  };
}

export function analyzeResumeOffline(resumeText: string, role: string): Analysis {
  const text = normalize(resumeText);
  if (!text || text.length < 20) {
    throw new Error(
      "Resume text is too short. Paste your resume text (or upload a .txt file). Offline mode works best with plain text."
    );
  }

  const candidateName = extractName(text);
  const skills = extractSkills(text);
  const experienceHighlights = extractHighlights(text);
  const years = extractYears(text);
  const focus = ROLE_FOCUS[roleKey(role)] || ROLE_FOCUS.default;

  const potentialGaps: string[] = [];
  const roleSkillsHint: Record<string, string[]> = {
    frontend: ["TypeScript", "testing", "accessibility", "performance"],
    backend: ["system design", "databases", "caching", "security"],
    "software engineer": ["system design", "testing", "cloud", "algorithms"],
    "data analyst": ["SQL", "dashboards", "statistics", "Python"],
    "data scientist": ["modeling", "experiment design", "MLOps"],
    devops: ["Kubernetes", "observability", "IaC", "incident management"],
    "product manager": ["metrics", "user research", "roadmapping"],
    default: ["leadership", "communication", "domain depth"],
  };
  const expected = roleSkillsHint[roleKey(role)] || roleSkillsHint.default;
  for (const e of expected) {
    if (!skills.some((s) => s.toLowerCase().includes(e.toLowerCase().split(" ")[0]))) {
      potentialGaps.push(e);
    }
  }
  if (potentialGaps.length === 0) potentialGaps.push("depth of recent impact metrics", "leadership examples");

  const summaryParts = [
    `${candidateName} appears to be targeting a ${role} role.`,
    skills.length
      ? `Detected skills include ${skills.slice(0, 8).join(", ")}.`
      : `Few explicit technical skills were detected — questions will stay behavioral and project-focused.`,
    years ? `Experience signals suggest around ${years}+ years.` : "",
    experienceHighlights[0]
      ? `Notable resume point: ${experienceHighlights[0].slice(0, 140)}.`
      : "Highlights were limited; interview will dig into projects and problem-solving.",
  ].filter(Boolean);

  const base = {
    candidateName,
    summary: summaryParts.join(" "),
    skills,
    experienceHighlights,
    potentialGaps: potentialGaps.slice(0, 5),
    suggestedFocusAreas: focus.slice(0, 5),
  };

  const questionBank = buildQuestionBank(base, role);
  return {
    ...base,
    firstQuestion: questionBank[0],
    questionBank,
  };
}

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function scoreAnswer(answer: string, analysis: Analysis): {
  score: number;
  strengths: string[];
  weaknesses: string[];
  note: string;
} {
  const words = wordCount(answer);
  const lower = answer.toLowerCase();
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  // Harder bar: start at 4
  let score = 4;

  if (words >= 80) {
    score += 1;
    strengths.push("Answer had substantive depth");
  } else if (words < 25) {
    score -= 2;
    weaknesses.push("Too shallow for a senior bar — expand with constraints, actions, metrics");
  } else if (words < 50) {
    score -= 1;
    weaknesses.push("Needs more concrete technical/behavioral detail");
  }

  if (words > 280) {
    score -= 1;
    weaknesses.push("Too long — tighten to signal, actions, and impact");
  }

  const hasSituation = /\b(when|while|at|project|team|company|during|context|constraint)\b/i.test(answer);
  const hasAction = /\b(i |my |implemented|built|designed|led|fixed|created|improved|decided|owned|migrated|debugged)\b/i.test(answer);
  const hasResult = /\b(\d+%|\d+x|\$\d+|\d+ |result|improved|reduced|increased|impact|latency|throughput|users|revenue|time|p99|error rate)\b/i.test(answer);
  const hasTradeoff = /\b(trade-?off|versus|instead of|chose|rejected|alternative|pros|cons|because)\b/i.test(answer);
  const hasFailure = /\b(fail|failed|bug|incident|outage|mistake|wrong|rollback|root cause)\b/i.test(answer);

  if (hasSituation && hasAction) {
    score += 1;
    strengths.push("Clear ownership with context");
  } else {
    weaknesses.push("Use STAR: Situation → Task → Action → Result with personal ownership");
  }
  if (hasResult) {
    score += 1;
    strengths.push("Quantified or concrete outcomes");
  } else {
    weaknesses.push("Missing metrics (latency, %, users, revenue, time saved)");
  }
  if (hasTradeoff) {
    score += 1;
    strengths.push("Discussed trade-offs / decision rationale");
  } else {
    weaknesses.push("Explain alternatives considered and why you chose this path");
  }
  if (hasFailure) {
    score += 1;
    strengths.push("Acknowledged failure modes or debugging reality");
  }

  const skillHits = analysis.skills.filter((s) => lower.includes(s.toLowerCase()));
  if (skillHits.length) {
    score += 1;
    strengths.push(`Grounded in skills: ${skillHits.slice(0, 3).join(", ")}`);
  } else {
    weaknesses.push("Connect answer explicitly to tools/skills from your resume");
  }

  if (/\b(i don't know|not sure|maybe|whatever|idk|stuff|things)\b/i.test(answer)) {
    score -= 1;
    weaknesses.push("Vague language — replace with precise technical claims");
  }
  if (/\b(we |the team )\b/i.test(answer) && !/\bi \b/i.test(answer)) {
    score -= 1;
    weaknesses.push("Too much 'we' — clarify *your* individual contribution");
  }

  score = Math.max(1, Math.min(10, score));

  const note = [
    `Length: ~${words} words. Hard-bar score: ${score}/10.`,
    strengths[0] ? `+ ${strengths[0]}` : "",
    weaknesses[0] ? `- ${weaknesses[0]}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { score, strengths, weaknesses, note };
}

const REACTIONS = [
  "Noted.",
  "Alright — I'm going to push on that.",
  "Interesting. Let's stress-test it.",
  "I hear you. I need more rigor.",
  "Okay. Digging deeper.",
  "Thanks — now the hard part.",
];

export function startInterviewOffline(analysis: Analysis, role: string): TurnResult {
  const first = analysis.firstQuestion || analysis.questionBank?.[0] || "Walk me through the hardest problem on your resume.";
  const name =
    analysis.candidateName && analysis.candidateName !== "Candidate"
      ? ` ${analysis.candidateName.split(" ")[0]}`
      : "";

  // Keep the opening short — long monologues felt like a giant first chat bubble
  const spokenReply = `Hi${name}. ${role} interview — I'll dig into your resume and push with follow-ups. First question: ${first}`;

  return {
    spokenReply,
    nextQuestion: first,
    note: "Interview started. Q1 delivered.",
    done: false,
    followUp: false,
  };
}

/**
 * Multi-turn engine:
 * - After each answer → always a counter-question (follow-up), then next bank question
 * - Never ends before MIN_MAIN main questions (default 6)
 * - Uses explicit counts from history so it cannot "finish" after one answer
 */
export function nextTurnOffline(opts: {
  analysis: Analysis;
  role: string;
  history: Array<{ role: string; content: string }>;
  message: string;
  action?: "answer" | "end";
}): TurnResult {
  const { analysis, role, history, message, action } = opts;
  const bank =
    analysis.questionBank && analysis.questionBank.length > 0
      ? analysis.questionBank
      : buildQuestionBank(analysis, role);

  const MIN_MAIN = 6;
  const MAX_MAIN = Math.min(Math.max(bank.length, MIN_MAIN), 10);

  // Count completed user answers (each answer is one turn)
  const userAnswers = history.filter((h) => h.role === "user");
  const answerCount = userAnswers.length; // includes current message only if already in history

  // How many follow-ups already asked (heuristic: assistant msgs that look like probes after start)
  const assistantMsgs = history.filter((h) => h.role === "assistant");

  if (action === "end") {
    return {
      spokenReply:
        "Understood — wrapping up now. I'll prepare your strengths and improvement areas.",
      nextQuestion: null,
      note: "Candidate ended the interview early.",
      done: true,
      followUp: false,
    };
  }

  const evaluation = scoreAnswer(message || "", analysis);
  const words = wordCount(message || "");

  // Main questions completed ≈ number of user answers that were NOT answers to a follow-up-only loop.
  // Simpler model: odd answer slots get counter-questions; even advance main bank.
  // Turn 1 answer → follow-up, turn 2 answer → main Q2, turn 3 → follow-up, ...
  // Using answerCount from history (which includes the just-submitted user message).

  const hardFollowUps = [
    "Counter-question: what constraint forced that choice, and what did you explicitly reject?",
    "Counter-question: what was your personal ownership — not the team's?",
    "Counter-question: what broke first in production, and how did you detect it?",
    "Counter-question: give before/after metrics — even rough ranges.",
    "Counter-question: what would a senior peer attack in that design?",
    "Counter-question: if you had half the time, what would you cut and why?",
    "Counter-question: how did you validate correctness under real load or real users?",
    "Counter-question: what would you redo with today's knowledge?",
  ];

  // Determine main question index: how many main questions have already been posed.
  // Start poses main Q index 0. After each main+follow-up pair we advance.
  // assistant count at call time includes all prior assistant turns; start was 1.
  // Map: after k user answers, we have posed roughly ceil(k/2)+1 main questions...
  // Clearer state machine:
  //   answersSoFar = answerCount (history already has this user msg)
  //   If answersSoFar is odd → just finished a main answer → ask follow-up
  //   If answersSoFar is even → just finished a follow-up answer → ask next main (or end)

  const answersSoFar = answerCount;
  const mainQuestionsAsked = Math.ceil(answersSoFar / 2); // after 1 ans: 1 main done; after 2: 1 main+1 follow done; after 3: 2 main...

  // Actually:
  // ans 1 (to main0) → follow0
  // ans 2 (to follow0) → main1
  // ans 3 (to main1) → follow1
  // ans 4 (to follow1) → main2
  // So after odd answers → follow-up; after even → next main or finish

  const wantFollowUp = answersSoFar % 2 === 1;

  if (wantFollowUp) {
    // Always counter-question after a main answer (and after weak follow-up answers we still push)
    const follow = hardFollowUps[(answersSoFar - 1) % hardFollowUps.length];
    const push =
      words < 35 || evaluation.score <= 5
        ? " That answer was thin — be specific."
        : "";
    return {
      spokenReply: `${REACTIONS[(answersSoFar - 1) % REACTIONS.length]}${push} ${follow}`,
      nextQuestion: follow,
      note: evaluation.note + " Counter-question issued.",
      done: false,
      followUp: true,
    };
  }

  // Even answersSoFar → finished a follow-up; move to next main question
  const nextMainIndex = answersSoFar / 2; // after 2 answers, next main is index 1; after 4, index 2
  const mainsCompleted = nextMainIndex; // how many mains fully done (with follow-up)

  if (mainsCompleted >= MAX_MAIN || nextMainIndex >= bank.length) {
    // Only allow finish if we hit MIN_MAIN mains (or bank exhausted after MIN)
    if (mainsCompleted >= MIN_MAIN || nextMainIndex >= bank.length) {
      return {
        spokenReply: `Good — that covers the core loop (${mainsCompleted} topics with follow-ups). I'll prepare your feedback now.`,
        nextQuestion: null,
        note: evaluation.note + " Interview complete.",
        done: true,
        followUp: false,
      };
    }
  }

  // Pick next main question; skip if too similar to anything already asked
  const askedText = assistantMsgs.map((h) => h.content).join("\n");
  let nextQ = bank[nextMainIndex] || bank[Math.min(nextMainIndex, bank.length - 1)];
  for (let i = nextMainIndex; i < bank.length; i++) {
    const candidate = bank[i];
    if (!askedText.includes(candidate.slice(0, 48))) {
      nextQ = candidate;
      break;
    }
  }

  // Safety: never return empty / done early
  if (!nextQ) {
    nextQ =
      "Describe a production decision you owned end-to-end — constraints, trade-offs, and measurable outcome.";
  }

  return {
    spokenReply: `${REACTIONS[answersSoFar % REACTIONS.length]} Next question: ${nextQ}`,
    nextQuestion: nextQ,
    note: evaluation.note + ` Main question index ${nextMainIndex}.`,
    done: false,
    followUp: false,
  };
}

export function feedbackOffline(opts: {
  analysis: Analysis;
  role: string;
  history: Array<{ role: string; content: string }>;
  notesMd?: string;
}): Feedback {
  const { analysis, role, history } = opts;
  const answers = history.filter((h) => h.role === "user").map((h) => h.content);
  const allText = answers.join(" ");
  const totalWords = wordCount(allText);

  const perAnswer = answers.map((a) => scoreAnswer(a, analysis));
  const avg =
    perAnswer.length > 0
      ? perAnswer.reduce((s, x) => s + x.score, 0) / perAnswer.length
      : 4;

  let overallScore = Math.round(avg);
  if (answers.length >= 4) overallScore = Math.min(10, overallScore + 1);
  if (answers.length <= 1) overallScore = Math.max(1, overallScore - 2);
  if (totalWords < 40) overallScore = Math.max(1, overallScore - 2);

  const strengthSet = new Set<string>();
  const improveSet = new Set<string>();

  for (const p of perAnswer) {
    p.strengths.forEach((s) => strengthSet.add(s));
    p.weaknesses.forEach((w) => improveSet.add(w));
  }

  if (analysis.skills.length) {
    strengthSet.add(`Resume shows relevant skills: ${analysis.skills.slice(0, 5).join(", ")}`);
  }
  if (answers.length >= 3) {
    strengthSet.add("Completed multiple interview questions — good engagement");
  }
  if (totalWords >= 120) {
    strengthSet.add("Provided enough spoken detail for the interviewer to evaluate");
  }

  if (improveSet.size === 0) {
    improveSet.add("Practice tighter STAR stories with clearer metrics");
  }
  if (analysis.potentialGaps[0]) {
    improveSet.add(`Build more evidence around: ${analysis.potentialGaps.slice(0, 2).join(", ")}`);
  }
  improveSet.add("Prepare 2–3 project stories with problem, your actions, and measurable results");

  const strengths = Array.from(strengthSet).slice(0, 6);
  const areasToImprove = Array.from(improveSet).slice(0, 6);
  const keyTakeaways = [
    "Write 3 resume-linked stories using STAR (Situation, Task, Action, Result)",
    `Drill deeper on ${analysis.skills[0] || "your core skill"} with one technical example and one trade-off`,
    "Record yourself answering out loud for 60–90 seconds per question",
    analysis.potentialGaps[0]
      ? `Study or build a small project covering ${analysis.potentialGaps[0]}`
      : "Quantify impact on every bullet on your resume",
  ].slice(0, 4);

  const spokenSummary = [
    `Thanks for completing this offline practice interview for the ${role} role.`,
    `Your overall score is ${overallScore} out of 10.`,
    strengths[0] ? `A clear strength: ${strengths[0]}.` : "",
    strengths[1] ? `Also: ${strengths[1]}.` : "",
    areasToImprove[0] ? `One key area to improve: ${areasToImprove[0]}.` : "",
    areasToImprove[1] ? `Also work on: ${areasToImprove[1]}.` : "",
    `Next step: ${keyTakeaways[0]}. Keep practicing — you're building a solid foundation.`,
  ]
    .filter(Boolean)
    .join(" ");

  const detailedFeedback = [
    `This feedback was generated in offline mode (no cloud AI API).`,
    ``,
    `Candidate: ${analysis.candidateName}`,
    `Target role: ${role}`,
    `Questions answered: ${answers.length}`,
    `Approximate answer volume: ${totalWords} words`,
    ``,
    analysis.summary,
    ``,
    `Overall, your performance scores around ${overallScore}/10 based on answer depth, structure, skill references, and completeness.`,
    strengths.length ? `Strengths observed: ${strengths.join("; ")}.` : "",
    areasToImprove.length ? `Improvement focus: ${areasToImprove.join("; ")}.` : "",
    ``,
    `Recommended practice plan: ${keyTakeaways.join(" ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    overallScore,
    strengths,
    areasToImprove,
    keyTakeaways,
    spokenSummary,
    detailedFeedback,
  };
}

/** Extract readable text from uploaded files without cloud AI (PDF/DOCX/TXT). */
export async function extractTextFromUpload(
  file: File | null,
  pastedText: string
): Promise<string> {
  const { extractResumeText } = await import("./resume-parse");
  const result = await extractResumeText({ file, pastedText });
  if (!result.text) {
    throw new Error(
      "Please upload a PDF/DOCX/TXT resume or paste resume text."
    );
  }
  return result.text;
}

export { extractResumeText } from "./resume-parse";
export type { ExtractResult } from "./resume-parse";
