import { useEffect } from 'react';
import { useLayoutStore } from '../stores/layoutStore';

/**
 * Keep panels usable on smaller windows: clamp widths/heights and
 * auto-collapse AI chat when the window is narrow.
 */
export function useResponsiveLayout(): void {
  useEffect(() => {
    let wasNarrow = window.innerWidth < 720;

    const apply = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const state = useLayoutStore.getState();

      // Cap sidebar / AI / bottom to a fraction of the viewport
      const maxSidebar = Math.max(160, Math.min(500, Math.floor(w * 0.4)));
      const maxAi = Math.max(240, Math.min(640, Math.floor(w * 0.45)));
      const maxBottom = Math.max(100, Math.min(600, Math.floor(h * 0.55)));

      if (state.sidebarWidth > maxSidebar) {
        state.setSidebarWidth(maxSidebar);
      }
      if (state.aiPanelWidth > maxAi) {
        state.setAiPanelWidth(maxAi);
      }
      if (state.bottomPanelHeight > maxBottom) {
        state.setBottomPanelHeight(maxBottom);
      }

      const narrow = w < 720;
      // Only auto-hide when crossing into narrow (don't fight the user reopening it)
      if (narrow && !wasNarrow && state.aiPanelVisible) {
        useLayoutStore.setState({ aiPanelVisible: false });
      }
      wasNarrow = narrow;

      if (w < 560 && state.sidebarVisible && state.sidebarWidth > 200) {
        state.setSidebarWidth(180);
      }
    };

    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);
}
