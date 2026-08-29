import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useUi } from '../../store/uiStore';
import { ToastStack } from '../ui/Primitives';
import { AgeGate, BottomNav, MobileMenu, NotificationPanel, SearchModal } from './Chrome';
import { Footer } from './Footer';
import { Navbar } from './Navbar';

export function AppShell() {
  const theme = useUi((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Navbar />
      <div className="app-main" id="main">
        <Outlet />
      </div>
      <Footer />
      <BottomNav />
      <SearchModal />
      <NotificationPanel />
      <MobileMenu />
      <AgeGate />
      <ToastStack />
    </>
  );
}
