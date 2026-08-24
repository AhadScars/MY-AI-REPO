import { getSession } from "@/lib/auth";
import { ButtonLink, Logo } from "@/components/ui";
import { HeroPreview } from "@/components/hero-preview";

const FEATURES = [
  {
    title: "Resume-Powered Questions",
    body: "Every question is grounded in your experience, projects, and claims — not a generic bank.",
  },
  {
    title: "Realistic AI Interview",
    body: "The interviewer listens, follows up, and raises the difficulty when your answers stay shallow.",
  },
  {
    title: "Intelligent Evaluation",
    body: "Each answer is scored on depth, ownership, communication, and job-relevant skill — privately, until the end.",
  },
  {
    title: "Professional Interview Report",
    body: "Walk away with a recruiter-style assessment, question-by-question notes, and a 7-day plan.",
  },
];

const STEPS = [
  { n: "01", title: "Upload your resume", body: "We extract your experience so the interview is about your work." },
  { n: "02", title: "Configure the room", body: "Pick the role, difficulty, style, and length. Add a target company if you want." },
  { n: "03", title: "Sit the interview", body: "Answer one question at a time. Expect follow-ups. Use voice or text." },
  { n: "04", title: "Study the report", body: "See scores, evidence-based feedback, and a plan you can actually follow." },
];

export default async function LandingPage() {
  const user = await getSession();

  return (
    <div className="min-h-full bg-background">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-border/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex" aria-label="Marketing">
            <a href="#features" className="hover:text-navy">
              Product
            </a>
            <a href="#how-it-works" className="hover:text-navy">
              How it works
            </a>
            <a href="#report" className="hover:text-navy">
              The report
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <ButtonLink href="/dashboard" size="sm">
                Open dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm">
                  Log in
                </ButtonLink>
                <ButtonLink href="/signup" size="sm">
                  Start mock interview
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        <section className="hero-grid border-b border-border">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div>
              <p className="text-sm font-medium tracking-wide text-primary">AI mock interviews for serious candidates</p>
              <h1 className="mt-4 font-serif text-4xl leading-tight text-navy sm:text-6xl">
                Practice Smarter.
                <br />
                Interview Better.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                Upload your resume, face a realistic AI interview tailored to your experience, and
                receive detailed feedback on your strengths, weaknesses, communication, technical
                skills, and interview readiness.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={user ? "/interview/new" : "/signup"} size="lg">
                  Start Mock Interview
                </ButtonLink>
                <ButtonLink href="#how-it-works" variant="outline" size="lg">
                  How It Works
                </ButtonLink>
              </div>
            </div>
            <HeroPreview />
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="font-serif text-3xl text-navy">Built like a real interview loop</h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Prepwise is not a chatbot wrapper. It is a structured interview room with a recruiter-grade
            debrief at the end.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-border bg-white p-6 shadow-card">
                <h3 className="text-lg font-semibold text-navy">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="border-y border-border bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="font-serif text-3xl text-navy">How it works</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-4">
              {STEPS.map((step) => (
                <div key={step.n}>
                  <div className="font-mono text-sm text-primary">{step.n}</div>
                  <h3 className="mt-2 font-semibold text-navy">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="report" className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-serif text-3xl text-navy">A report you can take seriously</h2>
              <p className="mt-4 text-slate-600 leading-7">
                After the interview you get an overall score, category breakdowns, evidence-based
                strengths and weaknesses, a question-by-question review, resume consistency notes, and
                a 7-day improvement plan. Download it as a professional PDF.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-6 shadow-card">
              <div className="text-xs uppercase tracking-wide text-slate-400">Overall</div>
              <div className="mt-1 font-serif text-5xl text-navy">82</div>
              <div className="mt-4 space-y-3">
                {[
                  ["Technical", 86],
                  ["Problem solving", 88],
                  ["Communication", 79],
                  ["Confidence", 81],
                ].map(([label, score]) => (
                  <div key={String(label)}>
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>{label}</span>
                      <span>{score}</span>
                    </div>
                    <div className="progress-bar">
                      <span style={{ width: `${score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center">
          <Logo />
          <p>© {new Date().getFullYear()} Prepwise. Practice with purpose.</p>
        </div>
      </footer>
    </div>
  );
}
