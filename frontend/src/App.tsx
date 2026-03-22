/**
 * Root router — Phase 1 architecture.
 * Three tiers of routes:
 *   1. Public: /login, /register/*, /unauthorized
 *   2. Agency/Admin dashboard (existing Layout): /, /influencers, /campaigns, etc.
 *   3. New protected routes: /admin/*, /brand/*, /manager/* (Role-guarded)
 *   4. Influencer portal: /portal/* (unchanged, still uses portal auth)
 *
 * Existing agency routes are NOT auth-guarded in Phase 1 (backward compat).
 * Role guards are added incrementally in Phase 2+.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Layouts
import Layout from './components/layout/Layout';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

// Agency dashboard pages (existing — unchanged)
import InfluencersPage from './pages/InfluencersPage';
import InfluencerDetailPage from './pages/InfluencerDetailPage';
import InfluencerMediaKitPage from './pages/InfluencerMediaKitPage';
import CampaignsPage from './pages/CampaignsPage';
import CampaignDetailPage from './pages/CampaignDetailPage';
import CampaignKanbanPage from './pages/CampaignKanbanPage';
import CampaignCalendarPage from './pages/CampaignCalendarPage';
import DealTrackerPage from './pages/DealTrackerPage';
import CampaignReportPage from './pages/CampaignReportPage';
import BillingPage from './pages/BillingPage';
import SettingsPage from './pages/SettingsPage';
import DiscoverPage from './pages/DiscoverPage';
import OffersPage from './pages/OffersPage';

// Payments
import PaymentsPage from './pages/PaymentsPage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminIntegrationsPage from './pages/admin/AdminIntegrationsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';
import AdminAgenciesPage from './pages/admin/AdminAgenciesPage';
import AdminBrandsPage from './pages/admin/AdminBrandsPage';

// Manager pages
import ManagerDashboard from './pages/manager/ManagerDashboard';
import ManagerEarningsPage from './pages/manager/ManagerEarningsPage';

// Agency dashboard
import AgencyDashboard from './pages/AgencyDashboard';

// Brand pages
import BrandLayout from './pages/brand/BrandLayout';
import BrandDashboard from './pages/brand/BrandDashboard';
import BrandInfluencersPage from './pages/brand/BrandInfluencersPage';
import BrandCampaignsPage from './pages/brand/BrandCampaignsPage';
import BrandRequestsPage from './pages/brand/BrandRequestsPage';

// Portal (influencer-facing — existing)
import PortalLoginPage from './pages/portal/PortalLoginPage';
import PortalLayout from './pages/portal/PortalLayout';
import PortalDashboard from './pages/portal/PortalDashboard';
import PortalOfferPage from './pages/portal/PortalOfferPage';
import PortalProfilePage from './pages/portal/PortalProfilePage';
import PortalConnectionsPage from './pages/portal/PortalConnectionsPage';
import PortalFanRequestsPage from './pages/portal/PortalFanRequestsPage';

// Fan Access
import FanLoginPage from './pages/fan/FanLoginPage';
import FanLayout from './pages/fan/FanLayout';
import FanDiscoverPage from './pages/fan/FanDiscoverPage';
import FanInfluencerPage from './pages/fan/FanInfluencerPage';
import FanRequestsPage from './pages/fan/FanRequestsPage';
import FanProfilePage from './pages/fan/FanProfilePage';

// Public profile
import PublicProfilePage from './pages/PublicProfilePage';

// Public creator browse
import PublicCreatorsPage from './pages/PublicCreatorsPage';

// Deduplicate
import DeduplicatePage from './pages/DeduplicatePage';

// 404
import NotFoundPage from './pages/NotFoundPage';

// Role guard
import RoleGuard from './components/auth/RoleGuard';

const TOAST_STYLE = {
  fontFamily: 'Space Grotesk, system-ui, sans-serif',
  fontSize: '14px',
  background: '#252525',
  color: '#f0f0f0',
  border: '1px solid #333',
};

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 4000, style: TOAST_STYLE }} />
      <Routes>

        {/* ── Public influencer profile (no auth) ───────────────────────── */}
        <Route path="/p/:id" element={<PublicProfilePage />} />

        {/* ── Public creator browse (no auth) ───────────────────────────── */}
        <Route path="/creators" element={<PublicCreatorsPage />} />

        {/* ── Public auth routes ─────────────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/register" element={<Navigate to="/register/influencer" replace />} />
        <Route path="/register/:role" element={<RegisterPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* ── Portal /portal/login and /portal/register ─────────────────── */}
        <Route path="/portal/login" element={<PortalLoginPage />} />
        <Route path="/portal/register" element={<PortalLoginPage />} />

        {/* ── Influencer portal (existing flow, unchanged) ───────────────── */}
        <Route path="/portal" element={<PortalLayout />}>
          <Route index element={<Navigate to="/portal/dashboard" replace />} />
          <Route path="dashboard"    element={<PortalDashboard />} />
          <Route path="offers/:id"   element={<PortalOfferPage />} />
          <Route path="profile"      element={<PortalProfilePage />} />
          <Route path="connections"  element={<PortalConnectionsPage />} />
          <Route path="fan-requests" element={<PortalFanRequestsPage />} />
        </Route>

        {/* ── Fan Access ─────────────────────────────────────────────────── */}
        <Route path="/fan/login" element={<FanLoginPage />} />
        <Route path="/fan" element={<FanLayout />}>
          <Route index element={<Navigate to="/fan/discover" replace />} />
          <Route path="discover"            element={<FanDiscoverPage />} />
          <Route path="influencers/:id"     element={<FanInfluencerPage />} />
          <Route path="requests"            element={<FanRequestsPage />} />
          <Route path="profile"             element={<FanProfilePage />} />
        </Route>

        {/* ── Admin routes (platform_admin only) ───────────────────────────*/}
        <Route path="/admin" element={
          <RoleGuard roles={['platform_admin']}>
            <Layout />
          </RoleGuard>
        }>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard"    element={<AdminDashboard />} />
          <Route path="integrations" element={<AdminIntegrationsPage />} />
          <Route path="users"       element={<AdminUsersPage />} />
          <Route path="influencers" element={<InfluencersPage />} />
          <Route path="agencies"    element={<AdminAgenciesPage />} />
          <Route path="brands"      element={<AdminBrandsPage />} />
          <Route path="payments"    element={<PaymentsPage />} />
          <Route path="analytics"    element={<AdminAnalyticsPage />} />
          <Route path="deduplicate"  element={<DeduplicatePage />} />
          <Route path="settings"     element={<SettingsPage />} />
        </Route>

        {/* ── Brand routes ─────────────────────────────────────────────────*/}
        <Route path="/brand" element={
          <RoleGuard roles={['brand', 'platform_admin']}>
            <BrandLayout />
          </RoleGuard>
        }>
          <Route index element={<Navigate to="/brand/dashboard" replace />} />
          <Route path="dashboard"   element={<BrandDashboard />} />
          <Route path="discover"    element={<BrandInfluencersPage />} />
          <Route path="influencers" element={<BrandInfluencersPage />} />
          <Route path="requests"    element={<BrandRequestsPage />} />
          <Route path="campaigns"   element={<BrandCampaignsPage />} />
          <Route path="settings"    element={<SettingsPage />} />
        </Route>

        {/* ── Talent Manager routes (skeleton) ─────────────────────────────*/}
        <Route path="/manager" element={
          <RoleGuard roles={['talent_manager', 'platform_admin']}>
            <Layout />
          </RoleGuard>
        }>
          <Route index element={<Navigate to="/manager/dashboard" replace />} />
          <Route path="dashboard" element={<ManagerDashboard />} />
          <Route path="roster"    element={<InfluencersPage />} />
          <Route path="offers"    element={<OffersPage />} />
          <Route path="earnings"  element={<ManagerEarningsPage />} />
        </Route>

        {/* ── Agency / default dashboard (no auth guard in Phase 1) ─────── */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"       element={<AgencyDashboard />} />
          <Route path="influencers"     element={<InfluencersPage />} />
          <Route path="influencers/:id" element={<InfluencerDetailPage />} />
          <Route path="influencers/:id/mediakit" element={<InfluencerMediaKitPage />} />
          <Route path="campaigns"       element={<CampaignsPage />} />
          <Route path="campaigns/:id"   element={<CampaignDetailPage />} />
          <Route path="campaigns/:id/report" element={<CampaignReportPage />} />
          <Route path="pipeline"        element={<CampaignKanbanPage />} />
          <Route path="calendar"        element={<CampaignCalendarPage />} />
          <Route path="deals"           element={<DealTrackerPage />} />
          <Route path="billing"         element={<BillingPage />} />
          <Route path="discover"        element={<DiscoverPage />} />
          <Route path="offers"          element={<OffersPage />} />
          <Route path="payments"        element={<PaymentsPage />} />
          <Route path="deduplicate"     element={<DeduplicatePage />} />
          <Route path="settings"        element={<SettingsPage />} />
          <Route path="creators"        element={<PublicCreatorsPage />} />
        </Route>

        {/* ── 404 catch-all ────────────────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />

      </Routes>
    </BrowserRouter>
  );
}
