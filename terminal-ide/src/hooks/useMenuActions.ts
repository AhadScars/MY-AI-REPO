import { useEffect } from 'react';
import { requireApi } from '../services/platform';
import { runMenuAction } from '../features/menu/runMenuAction';

export function useMenuActions(): void {
  useEffect(() => {
    const api = requireApi();
    const unsub = api.onMenuAction(({ action }) => {
      runMenuAction(action);
    });
    return unsub;
  }, []);
}
