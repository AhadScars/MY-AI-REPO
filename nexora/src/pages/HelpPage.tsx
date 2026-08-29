import { Link } from 'react-router-dom';
import { helpTopics } from '../data/content';

export function HelpPage() {
  return (
    <div className="page">
      <div className="container col gap-16">
        <div>
          <div className="kicker">Support</div>
          <h1>Help Centre</h1>
          <p className="muted">Guides for the demo sportsbook. For real-world gambling support, use the responsible gambling page.</p>
        </div>
        <div className="grid-2">
          {helpTopics.map((t) => (
            <article key={t.id} className="card card-pad">
              <h3>{t.title}</h3>
              <p className="muted" style={{ marginTop: 8 }}>
                {t.body}
              </p>
            </article>
          ))}
        </div>
        <div className="card card-pad between wrap gap-12">
          <div>
            <strong>Need a person?</strong>
            <p className="muted">The contact form goes nowhere — this is a prototype inbox.</p>
          </div>
          <Link to="/contact" className="btn btn-primary">
            Contact
          </Link>
        </div>
      </div>
    </div>
  );
}
