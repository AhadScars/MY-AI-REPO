import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="page">
      <div className="container card card-pad" style={{ textAlign: 'center' }}>
        <div className="kicker">404</div>
        <h1>That page is off the board</h1>
        <p className="muted">The market you asked for is not in this demo.</p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
