import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="brand brand-inline">
          <span className="brand-mark">TO</span>
          <strong>TableOrder</strong>
        </div>
        <div className="row gap">
          <Link to="/login" className="btn btn-ghost">Login</Link>
          <Link to="/register" className="btn btn-primary">Start free</Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Restaurant QR Ordering</p>
          <h1>Table pe QR. Kitchen me order. Ghar se fake order nahi.</h1>
          <p className="lead">
            Owner tables &amp; menu manage kare. Customer QR scan karke order kare.
            <strong> Staff table seat kare</strong> tabhi order open hota hai —
            saved QR se ghar baith ke order block.
          </p>
          <div className="row gap wrap">
            <Link to="/register" className="btn btn-primary btn-lg">Owner dashboard banao</Link>
            <Link to="/login" className="btn btn-secondary btn-lg">Demo login</Link>
          </div>
          <p className="hint">Demo: owner@demo.com / demo1234</p>
        </div>
        <div className="hero-card">
          <div className="flow-step"><span>1</span> Waiter seats table</div>
          <div className="flow-step"><span>2</span> Guest scans QR + name/phone</div>
          <div className="flow-step"><span>3</span> Order → live on dashboard</div>
          <div className="flow-step danger"><span>✓</span> No active seat = no order</div>
        </div>
      </section>
    </div>
  );
}
