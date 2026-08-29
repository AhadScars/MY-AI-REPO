import { Link, useParams } from 'react-router-dom';
import { promotions } from '../data/content';
import { formatDate } from '../lib/format';
import { useWallet } from '../store/walletStore';
import { useAuth } from '../store/authStore';
import { useUi } from '../store/uiStore';
import { Button, EmptyState } from '../components/ui/Primitives';

export function PromotionsPage() {
  return (
    <div className="page">
      <div className="wide col gap-16">
        <div>
          <div className="kicker">Marketplace</div>
          <h1>Promotions</h1>
          <p className="muted">Welcome credit, free bets, boosts, cashback and referrals — all demo offers.</p>
        </div>
        <div className="grid-3">
          {promotions.map((p) => (
            <Link key={p.id} to={`/promotions/${p.id}`} className="promo-card">
              <img src={p.image} alt="" />
              <div className="body">
                <span className="badge">{p.eyebrow}</span>
                <h3 style={{ marginTop: 8 }}>{p.title}</h3>
                <p className="muted">{p.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PromotionDetailPage() {
  const { promoId = '' } = useParams();
  const promo = promotions.find((p) => p.id === promoId);
  const user = useAuth((s) => s.user);
  const claimed = useWallet((s) => s.claimed.includes(promoId));
  const claimPromo = useWallet((s) => s.claimPromo);
  const toast = useUi((s) => s.pushToast);

  if (!promo) {
    return (
      <div className="page">
        <div className="container">
          <EmptyState title="Offer not found" body="This promotion is no longer on the board." />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="wide grid-2">
        <div className="promo-card" style={{ minHeight: 360 }}>
          <img src={promo.image} alt="" />
          <div className="body">
            <span className="badge">{promo.eyebrow}</span>
            <h1 style={{ marginTop: 8 }}>{promo.title}</h1>
          </div>
        </div>
        <div className="card card-pad col gap-12">
          <p>{promo.longCopy}</p>
          <div>
            <div className="muted">Eligibility</div>
            <strong>{promo.eligibility}</strong>
          </div>
          <div>
            <div className="muted">Expires</div>
            <strong>{formatDate(promo.expires)}</strong>
          </div>
          <Button
            variant="primary"
            disabled={claimed}
            onClick={() => {
              if (!user) {
                toast('info', 'Sign in to claim');
                return;
              }
              const res = claimPromo(promo.id, promo.category === 'welcome' ? 50 : 25);
              if (res.ok) toast('success', 'Offer claimed', 'Bonus credited to the demo wallet.');
              else toast('error', res.error || 'Could not claim');
            }}
          >
            {claimed ? 'Claimed' : promo.cta}
          </Button>
          <div>
            <h3>Terms</h3>
            <ul className="muted">
              {promo.terms.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
