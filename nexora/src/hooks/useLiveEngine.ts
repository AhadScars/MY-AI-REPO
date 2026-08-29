import { useEffect } from 'react';
import { mutateLiveTick } from '../data/events';
import { useSlip } from '../store/slipStore';
import { findSelection } from '../data/events';

export function useLiveEngine() {
  useEffect(() => {
    const id = window.setInterval(() => {
      mutateLiveTick();
      const { legs, syncOdds } = useSlip.getState();
      for (const leg of legs) {
        const found = findSelection(leg.selectionId);
        if (found && found.selection.odds !== leg.odds) {
          syncOdds(leg.selectionId, found.selection.odds);
        }
      }
      window.dispatchEvent(new CustomEvent('nexora-tick'));
    }, 3200);
    return () => window.clearInterval(id);
  }, []);
}

export function useTick(versionSink: (n: number) => void) {
  useEffect(() => {
    const onTick = () => versionSink(Date.now());
    window.addEventListener('nexora-tick', onTick);
    return () => window.removeEventListener('nexora-tick', onTick);
  }, [versionSink]);
}
