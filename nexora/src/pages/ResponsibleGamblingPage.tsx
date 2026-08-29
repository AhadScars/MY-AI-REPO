import { useState } from 'react';
import { rgResources } from '../data/content';
import { useAuth } from '../store/authStore';
import { useUi } from '../store/uiStore';
import { Button, Field } from '../components/ui/Primitives';

export function ResponsibleGamblingPage() {
  const user = useAuth((s) => s.user);
  const limits = useAuth((s) => s.limits);
  const setLimits = useAuth((s) => s.setLimits);
  const toast = useUi((s) => s.pushToast);
  const [form, setForm] = useState({
    depositDaily: limits.depositDaily ?? 0,
    stakeMax: limits.stakeMax ?? 0,
    lossDaily: limits.lossDaily ?? 0,
    sessionMinutes: limits.sessionMinutes ?? 0,
    realityCheckMinutes: limits.realityCheckMinutes ?? 60,
  });

  return (
    <div className="page">
      <div className="wide col gap-16">
        <section className="card card-pad" style={{ borderColor: 'color-mix(in srgb, var(--gold) 40%, var(--line))' }}>
          <div className="kicker">Play within limits</div>
          <h1>Responsible gambling</h1>
          <p className="muted" style={{ fontSize: 17, maxWidth: 720 }}>
            Nexora is a demonstration, but the controls are designed as they would appear on a regulated sportsbook. If
            you are struggling with real-world gambling, use the help resources below — not this site.
          </p>
          <div className="flex gap-8 wrap" style={{ marginTop: 12 }}>
            <span className="badge badge-soon">18+ / 21+ where required</span>
            <span className="badge">Not a licensed operator</span>
          </div>
        </section>

        <div className="grid-2">
          <section className="card card-pad col gap-12">
            <h2>Limits</h2>
            <Field label="Daily deposit limit">
              <input className="input" type="number" value={form.depositDaily} onChange={(e) => setForm({ ...form, depositDaily: Number(e.target.value) })} />
            </Field>
            <Field label="Max stake">
              <input className="input" type="number" value={form.stakeMax} onChange={(e) => setForm({ ...form, stakeMax: Number(e.target.value) })} />
            </Field>
            <Field label="Daily loss limit">
              <input className="input" type="number" value={form.lossDaily} onChange={(e) => setForm({ ...form, lossDaily: Number(e.target.value) })} />
            </Field>
            <Field label="Session limit (minutes)">
              <input className="input" type="number" value={form.sessionMinutes} onChange={(e) => setForm({ ...form, sessionMinutes: Number(e.target.value) })} />
            </Field>
            <Field label="Reality check (minutes)">
              <input className="input" type="number" value={form.realityCheckMinutes} onChange={(e) => setForm({ ...form, realityCheckMinutes: Number(e.target.value) })} />
            </Field>
            <Button
              variant="primary"
              onClick={() => {
                setLimits({
                  depositDaily: form.depositDaily || null,
                  stakeMax: form.stakeMax || null,
                  lossDaily: form.lossDaily || null,
                  sessionMinutes: form.sessionMinutes || null,
                  realityCheckMinutes: form.realityCheckMinutes || null,
                });
                toast('success', 'Limits updated', user ? 'Applied to this demo account.' : 'Sign in to persist them on an account.');
              }}
            >
              Save limits
            </Button>
          </section>
          <section className="col gap-12">
            <div className="card card-pad col gap-10">
              <h2>Time-outs</h2>
              <p className="muted">Cooling-off pauses the account. Self-exclusion is a hard stop.</p>
              <Button
                onClick={() => {
                  const until = new Date(Date.now() + 24 * 3600_000).toISOString();
                  setLimits({ coolingOffUntil: until });
                  toast('info', 'Cooling-off started', '24 hours on this demo account.');
                }}
              >
                24-hour cooling-off
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const until = new Date(Date.now() + 180 * 24 * 3600_000).toISOString();
                  setLimits({ selfExcludedUntil: until });
                  toast('warn', 'Self-exclusion set', '6 months. Contact support in a live product.');
                }}
              >
                Self-exclude for 6 months
              </Button>
              {limits.coolingOffUntil ? <p className="muted">Cooling-off until {limits.coolingOffUntil}</p> : null}
              {limits.selfExcludedUntil ? <p className="muted">Self-excluded until {limits.selfExcludedUntil}</p> : null}
            </div>
            <div className="card card-pad col gap-8">
              <h2>Help resources</h2>
              {rgResources.map((r) => (
                <a key={r.name} href={r.href} target="_blank" rel="noreferrer" className="side-link">
                  <div>
                    <strong>{r.name}</strong>
                    <div className="faint">{r.note}</div>
                  </div>
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
