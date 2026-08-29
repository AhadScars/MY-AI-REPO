import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import {
  AccountLayout,
  AccountOverview,
  BettingHistoryPage,
  BonusesPage,
  FavoritesPage,
  NotificationsPage,
  ProfilePage,
  SecurityPage,
  TransactionsPage,
} from './pages/AccountPages';
import {
  AdminAudit,
  AdminBets,
  AdminBonuses,
  AdminDashboard,
  AdminEvents,
  AdminKyc,
  AdminLayout,
  AdminLeagues,
  AdminMarkets,
  AdminMoney,
  AdminNotifications,
  AdminOdds,
  AdminPromos,
  AdminReports,
  AdminRg,
  AdminSettings,
  AdminSports,
  AdminTransactions,
  AdminUsers,
} from './pages/AdminPages';
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  TwoFactorPage,
  VerifyEmailPage,
} from './pages/AuthPages';
import { HelpPage } from './pages/HelpPage';
import { HomePage } from './pages/HomePage';
import { AboutPage, ContactPage, LicensingPage, PrivacyPage, SecurityInfoPage, TermsPage } from './pages/LegalPages';
import { NotFoundPage } from './pages/NotFoundPage';
import { ResponsibleGamblingPage } from './pages/ResponsibleGamblingPage';
import { GameRoomPage } from './pages/GameRoomPage';
import { GamesPage } from './pages/GamesPage';
import { WalletPage } from './pages/WalletPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/live" element={<Navigate to="/games" replace />} />
          <Route path="/sports" element={<Navigate to="/games" replace />} />
          <Route path="/sports/:sportId" element={<Navigate to="/games" replace />} />
          <Route path="/event/:eventId" element={<Navigate to="/games" replace />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/games/:roomId" element={<GameRoomPage />} />
          <Route path="/casino" element={<Navigate to="/games" replace />} />
          <Route path="/casino/:gameId" element={<Navigate to="/games" replace />} />
          <Route path="/promotions" element={<Navigate to="/games" replace />} />
          <Route path="/promotions/:promoId" element={<Navigate to="/games" replace />} />
          <Route path="/results" element={<Navigate to="/games" replace />} />
          <Route path="/leaderboards" element={<Navigate to="/games" replace />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/responsible-gambling" element={<ResponsibleGamblingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/security" element={<SecurityInfoPage />} />
          <Route path="/licensing" element={<LicensingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/2fa" element={<TwoFactorPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/account" element={<AccountLayout />}>
            <Route index element={<AccountOverview />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="history" element={<BettingHistoryPage />} />
            <Route path="open" element={<BettingHistoryPage mode="open" />} />
            <Route path="settled" element={<BettingHistoryPage mode="settled" />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="bonuses" element={<BonusesPage />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="security" element={<SecurityPage />} />
          </Route>
          <Route path="/search" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="kyc" element={<AdminKyc />} />
          <Route path="bets" element={<AdminBets />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="deposits" element={<AdminMoney kind="deposit" />} />
          <Route path="withdrawals" element={<AdminMoney kind="withdrawal" />} />
          <Route path="sports" element={<AdminSports />} />
          <Route path="leagues" element={<AdminLeagues />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="markets" element={<AdminMarkets />} />
          <Route path="odds" element={<AdminOdds />} />
          <Route path="promotions" element={<AdminPromos />} />
          <Route path="bonuses" element={<AdminBonuses />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="rg" element={<AdminRg />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
