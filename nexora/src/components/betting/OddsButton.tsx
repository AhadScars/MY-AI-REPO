import type { EventItem, Market, Selection } from '../../types';
import { formatOdds } from '../../lib/format';
import { useSlip } from '../../store/slipStore';
import { useUi } from '../../store/uiStore';
import { useAuth } from '../../store/authStore';

export function OddsButton({
  event,
  market,
  selection,
}: {
  event: EventItem;
  market: Market;
  selection: Selection;
}) {
  const format = useUi((s) => s.oddsFormat);
  const on = useSlip((s) => s.legs.some((l) => l.selectionId === selection.id));
  const addFrom = useSlip((s) => s.addFrom);
  const dir =
    selection.previousOdds && selection.odds > selection.previousOdds
      ? 'up'
      : selection.previousOdds && selection.odds < selection.previousOdds
        ? 'down'
        : '';

  return (
    <button
      type="button"
      className={`odds ${on ? 'on' : ''} ${dir}`}
      disabled={selection.suspended || event.status === 'finished'}
      aria-pressed={on}
      aria-label={`${selection.label} at ${formatOdds(selection.odds, format)}`}
      onClick={() => {
        addFrom(event, market, selection);
        if (!useAuth.getState().user) {
          useUi.getState().pushToast('info', 'Added to slip', 'Sign in to place a demo bet.');
        }
      }}
    >
      {formatOdds(selection.odds, format)}
    </button>
  );
}
