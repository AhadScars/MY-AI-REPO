import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { combinedOdds, MIN_STAKE, MAX_STAKE, potentialReturn, stakeHint, systemPotential, systemSize } from '../../lib/odds';
import { currency, formatOdds } from '../../lib/format';
import { useAuth } from '../../store/authStore';
import { useSlip } from '../../store/slipStore';
import { useUi } from '../../store/uiStore';
import { Button, Tabs } from '../ui/Primitives';

export function BettingSlip() {
  const mobile = useMedia('(max-width: 1023px)');
  const open = useUi((s) => s.slipOpen);
  const setOpen = useUi((s) => s.setSlipOpen);
  const format = useUi((s) => s.oddsFormat);
  const user = useAuth((s) => s.user);
  const nav = useNavigate();
  const legs = useSlip((s) => s.legs);
  const betType = useSlip((s) => s.betType);
  const stake = useSlip((s) => s.stake);
  const systemFold = useSlip((s) => s.systemFold);
  const placing = useSlip((s) => s.placing);
  const lastReceipt = useSlip((s) => s.lastReceipt);
  const { remove, clear, setBetType, setStake, setSystemFold, acceptOdds, place } = useSlip();
  const changed = legs.some((l) => l.odds !== l.lockedOdds);
  const odds = betType === 'single' ? (legs[0]?.odds ?? 0) : combinedOdds(legs);
  const combos = betType === 'system' ? systemSize(legs.length, systemFold) : 1;
  const totalStake = betType === 'system' ? stake * combos : stake;
  const potential =
    betType === 'system' ? systemPotential(legs, stake, systemFold) : potentialReturn(stake, odds);
  const hint = stakeHint(stake);

  const body = (
    <>
      <div className="between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
        <div>
          <div className="kicker">Bet slip</div>
          <strong>{legs.length} selection{legs.length === 1 ? '' : 's'}</strong>
        </div>
        <div className="center gap-8">
          {legs.length ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
              <Trash2 size={14} /> Clear
            </button>
          ) : null}
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close slip">
            <X size={16} />
          </button>
        </div>
      </div>

      <div style={{ padding: 12 }}>
        <Tabs
          value={betType}
          onChange={(v) => setBetType(v as typeof betType)}
          items={[
            { id: 'single', label: 'Single' },
            { id: 'multi', label: 'Multi' },
            { id: 'system', label: 'System' },
          ]}
        />
      </div>

      <div style={{ overflow: 'auto', flex: 1, padding: '0 12px 12px' }}>
        {lastReceipt ? (
          <div className="card card-pad" style={{ marginBottom: 12, borderColor: 'color-mix(in srgb, var(--accent) 40%, var(--line))' }}>
            <div className="kicker">Placed</div>
            <h3 style={{ margin: '6px 0' }}>Bet {lastReceipt}</h3>
            <p className="muted">This is a simulated wager. No real money was taken.</p>
          </div>
        ) : null}

        {!legs.length ? (
          <div className="empty">
            <h3>Your slip is empty</h3>
            <p>Tap any price to add a selection. Build a single, a multi, or a system.</p>
          </div>
        ) : (
          <div className="col gap-10">
            {legs.map((leg) => (
              <div key={leg.selectionId} className="card card-pad">
                <div className="between">
                  <span className="muted" style={{ fontSize: 12 }}>
                    {leg.live ? 'LIVE · ' : ''}
                    {leg.eventLabel}
                  </span>
                  <button type="button" aria-label="Remove" onClick={() => remove(leg.selectionId)}>
                    <X size={14} />
                  </button>
                </div>
                <div style={{ fontWeight: 750, marginTop: 4 }}>{leg.selectionLabel}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {leg.marketName}
                </div>
                <div className="between" style={{ marginTop: 8 }}>
                  <span className="mono">
                    {formatOdds(leg.odds, format)}
                    {leg.odds !== leg.lockedOdds ? (
                      <span className="faint"> was {formatOdds(leg.lockedOdds, format)}</span>
                    ) : null}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: 14, borderTop: '1px solid var(--line)' }} className="col gap-10">
        {changed ? (
          <div className="notice-bar">
            Prices moved.{' '}
            <button type="button" className="btn btn-sm" onClick={acceptOdds}>
              Accept new odds
            </button>
          </div>
        ) : null}

        {betType === 'system' ? (
          <label className="label">
            System fold
            <select className="select" value={systemFold} onChange={(e) => setSystemFold(Number(e.target.value))}>
              {[2, 3, 4].map((n) => (
                <option key={n} value={n} disabled={legs.length < n}>
                  {n} from {Math.max(legs.length, n)} · {systemSize(Math.max(legs.length, n), n)} bets
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="label">
          Stake {betType === 'system' ? 'per combo' : ''}
          <input
            className="input"
            type="number"
            min={MIN_STAKE}
            max={MAX_STAKE}
            step="1"
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
          />
        </label>
        {hint ? <div className="field-error">{hint}</div> : null}

        <div className="between muted">
          <span>Odds</span>
          <span className="mono">{betType === 'system' ? `${combos} combos` : formatOdds(odds || 1, format)}</span>
        </div>
        <div className="between muted">
          <span>Total stake</span>
          <span className="mono">{currency(totalStake || 0)}</span>
        </div>
        <div className="between">
          <strong>Potential return</strong>
          <strong className="mono" style={{ color: 'var(--accent)' }}>
            {currency(potential || 0)}
          </strong>
        </div>
        <Button
          variant="primary"
          block
          disabled={!legs.length || placing || Boolean(hint) || changed}
          onClick={async () => {
            if (!user) {
              nav('/login', { state: { from: '/' } });
              useUi.getState().pushToast('info', 'Sign in required', 'Use alex@nexora.demo / demo1234');
              return;
            }
            const res = await place();
            if (res.ok) useUi.getState().pushToast('success', 'Bet placed', `Receipt ${res.id} · demo only`);
            else useUi.getState().pushToast('error', 'Could not place bet', res.error);
          }}
        >
          {placing ? 'Placing…' : 'Place bet · demo'}
        </Button>
        <p className="faint" style={{ fontSize: 11, textAlign: 'center' }}>
          Simulated wagering only. 18+ · Play within your limits.
        </p>
      </div>
    </>
  );

  if (mobile) {
    if (!open) return null;
    return <aside className="slip-sheet">{body}</aside>;
  }

  return <aside className={`slip ${open ? 'open' : ''}`}>{body}</aside>;
}

function useMedia(query: string) {
  const [match, setMatch] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatch(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return match;
}
