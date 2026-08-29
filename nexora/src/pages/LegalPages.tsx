import { legalBlocks } from '../data/content';
import { Button, Field } from '../components/ui/Primitives';
import { useState } from 'react';
import { useUi } from '../store/uiStore';

function Legal({ block }: { block: { title: string; lead: string; body: string[] } }) {
  return (
    <div className="page">
      <div className="container col gap-16">
        <div>
          <div className="kicker">Nexora</div>
          <h1>{block.title}</h1>
          <p className="muted" style={{ fontSize: 18 }}>
            {block.lead}
          </p>
        </div>
        {block.body.map((p) => (
          <p key={p} className="muted">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}

export function AboutPage() {
  return <Legal block={legalBlocks.about} />;
}
export function TermsPage() {
  return <Legal block={legalBlocks.terms} />;
}
export function PrivacyPage() {
  return <Legal block={legalBlocks.privacy} />;
}
export function LicensingPage() {
  return <Legal block={legalBlocks.licensing} />;
}

export function SecurityInfoPage() {
  return (
    <div className="page">
      <div className="container col gap-16">
        <h1>Security</h1>
        <p className="muted">
          A live operator would describe encryption in transit, credential hashing, session controls, device management
          and SOC practices here. This prototype stores session state in localStorage only.
        </p>
        <div className="grid-2">
          <article className="card card-pad">
            <h3>Authentication</h3>
            <p className="muted">Password + optional 2FA. Sessions persist locally so the demo survives a refresh.</p>
          </article>
          <article className="card card-pad">
            <h3>Payments</h3>
            <p className="muted">No card data leaves the browser. Saved methods are fixtures.</p>
          </article>
        </div>
      </div>
    </div>
  );
}

export function ContactPage() {
  const toast = useUi((s) => s.pushToast);
  const [sent, setSent] = useState(false);
  return (
    <div className="page">
      <div className="container col gap-16">
        <h1>Contact</h1>
        {sent ? (
          <div className="card card-pad">Message captured locally. No inbox is connected.</div>
        ) : (
          <form
            className="card card-pad col gap-12"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
              toast('success', 'Message recorded');
            }}
          >
            <Field label="Name">
              <input className="input" required />
            </Field>
            <Field label="Email">
              <input className="input" type="email" required />
            </Field>
            <Field label="Topic">
              <select className="select">
                <option>Account</option>
                <option>Settlements</option>
                <option>Responsible gambling</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Message">
              <textarea className="textarea" required />
            </Field>
            <Button variant="primary" type="submit">
              Send
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
