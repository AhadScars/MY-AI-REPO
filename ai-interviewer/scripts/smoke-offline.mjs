const resume = `
John Smith
john@email.com | github.com/john
Software Engineer

Skills: JavaScript, TypeScript, React, Node.js, Python, Docker, AWS, PostgreSQL

Experience
- Developed a React dashboard that improved reporting speed by 40% for 5k users
- Built Node.js APIs with PostgreSQL and Redis caching
- Led migration to Docker reducing deploy time by 60%

Education
BS Computer Science
`;

const form = new FormData();
form.append("role", "Software Engineer");
form.append("resumeText", resume);
form.append("includeReview", "true");

const base = process.env.BASE || "http://127.0.0.1:3000";

const analyzeRes = await fetch(`${base}/api/analyze`, { method: "POST", body: form });
const analyze = await analyzeRes.json();
if (!analyzeRes.ok) {
  console.error("analyze failed", analyze);
  process.exit(1);
}
console.log("mode:", analyze.mode);
console.log("name:", analyze.analysis.candidateName);
console.log("review score:", analyze.review?.overallScore);
console.log("skills:", analyze.analysis.skills?.slice(0, 6).join(", "));

const startRes = await fetch(`${base}/api/interview`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sessionId: analyze.sessionId,
    action: "start",
    analysis: analyze.analysis,
    history: [],
  }),
});
const start = await startRes.json();
if (!startRes.ok) {
  console.error("start failed", start);
  process.exit(1);
}
console.log("start mode:", start.mode, "reply bytes:", start.spokenReply?.length);

const history = [
  { role: "assistant", content: start.spokenReply },
  {
    role: "user",
    content:
      "I built a React dashboard when reports were slow. I implemented TypeScript UI and caching and cut load time by 40% for 5000 users.",
  },
];

const turnRes = await fetch(`${base}/api/interview`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sessionId: analyze.sessionId,
    action: "answer",
    message: history[1].content,
    analysis: analyze.analysis,
    history,
  }),
});
const turn = await turnRes.json();
if (!turnRes.ok) {
  console.error("turn failed", turn);
  process.exit(1);
}
console.log("turn note:", turn.note?.slice(0, 120));

const fbRes = await fetch(`${base}/api/feedback`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sessionId: analyze.sessionId,
    analysis: analyze.analysis,
    history: [...history, { role: "assistant", content: turn.spokenReply }],
  }),
});
const fb = await fbRes.json();
if (!fbRes.ok) {
  console.error("feedback failed", fb);
  process.exit(1);
}
console.log("feedback score:", fb.feedback.overallScore, "mode:", fb.mode);
console.log("SMOKE OK");
