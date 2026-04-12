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
import RevenuePage from './pages/admin/RevenuePage';

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
import PortalLoyaltyPage from './pages/portal/PortalLoyaltyPage';

// Fan Access
import FanLoginPage from './pages/fan/FanLoginPage';
import FanLayout from './pages/fan/FanLayout';
import FanDiscoverPage from './pages/fan/FanDiscoverPage';
import FanInfluencerPage from './pages/fan/FanInfluencerPage';
import FanRequestsPage from './pages/fan/FanRequestsPage';
import FanDeliveryPage from './pages/fan/FanDeliveryPage';
import FanProfilePage from './pages/fan/FanProfilePage';

// Public profile
import PublicProfilePage from './pages/PublicProfilePage';

// Public creator browse
import PublicCreatorsPage from './pages/PublicCreatorsPage';

// Deduplicate
import DeduplicatePage from './pages/DeduplicatePage';

// Audience Intelligence
import IntelligencePage from './pages/IntelligencePage';

// Outreach Pipeline
import OutreachPage from './pages/OutreachPage';

// AI Agent
import AgentPage from './pages/AgentPage';

// Live partner dashboard
import LiveDashboard from './pages/LiveDashboard';

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
          <Route path="loyalty"      element={<PortalLoyaltyPage />} />
        </Route>

        {/* ── Fan Access ─────────────────────────────────────────────────── */}
        <Route path="/fan/login" element={<FanLoginPage />} />
        {/* Public delivery page — no auth required */}
        <Route path="/fan/delivery/:token" element={<FanDeliveryPage />} />
        <Route path="/fan" element={<FanLayout />}>
          <Route index element={<Navigate to="/fan/discover" replace />} />
          <Route path="discover"            element={<FanDiscoverPage />} />
          <Route path="influencers/:id"     element={<FanInfluencerPage />} />
          <Route path="requests"            element={<FanRequestsPage />} />
          <Route path="profile"             element={<FanProfilePage />} />
        </Route>

        {/* ── Admin routes (platform_admin + viewer) ────────────────────────*/}
        <Route path="/admin" element={
          <RoleGuard roles={['platform_admin', 'viewer']}>
            <Layout />
          </RoleGuard>
        }>
          {/* viewer lands on analytics; admin lands on dashboard */}
          <Route index element={
            <RoleGuard roles={['platform_admin']} redirectTo="/admin/analytics">
              <Navigate to="/admin/dashboard" replace />
            </RoleGuard>
          } />
          {/* platform_admin only — write/sensitive pages */}
          <Route path="dashboard"    element={<RoleGuard roles={['platform_admin']} redirectTo="/admin/analytics"><AdminDashboard /></RoleGuard>} />
          <Route path="integrations" element={<RoleGuard roles={['platform_admin']} redirectTo="/admin/analytics"><AdminIntegrationsPage /></RoleGuard>} />
          <Route path="users"        element={<RoleGuard roles={['platform_admin']} redirectTo="/admin/analytics"><AdminUsersPage /></RoleGuard>} />
          <Route path="agencies"     element={<RoleGuard roles={['platform_admin']} redirectTo="/admin/analytics"><AdminAgenciesPage /></RoleGuard>} />
          <Route path="brands"       element={<RoleGuard roles={['platform_admin']} redirectTo="/admin/analytics"><AdminBrandsPage /></RoleGuard>} />
          <Route path="payments"     element={<RoleGuard roles={['platform_admin']} redirectTo="/admin/analytics"><PaymentsPage /></RoleGuard>} />
          <Route path="deduplicate"  element={<RoleGuard roles={['platform_admin']} redirectTo="/admin/analytics"><DeduplicatePage /></RoleGuard>} />
          <Route path="settings"     element={<RoleGuard roles={['platform_admin']} redirectTo="/admin/analytics"><SettingsPage /></RoleGuard>} />
          {/* platform_admin + viewer — read-only pages */}
          <Route path="analytics"    element={<AdminAnalyticsPage />} />
          <Route path="influencers"  element={<InfluencersPage />} />
          <Route path="campaigns"    element={<CampaignsPage />} />
          <Route path="revenue"      element={<RevenuePage />} />
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

        {/* ── Agency / default dashboard ────────────────────────────────── */}
        <Route path="/" element={
          <RoleGuard>
            <Layout />
          </RoleGuard>
        }>
          <Route index element={<Navigate to="/login" replace />} />
          <Route path="dashboard"       element={<AgencyDashboard />} />
          <Route path="influencers"     element={<InfluencersPage />} />
          <Route path="influencers/:id" element={<InfluencerDetailPage />} />
          <Route path="influencers/:id/mediakit"      element={<InfluencerMediaKitPage />} />
          <Route path="intelligence/:id"             element={<IntelligencePage />} />
          <Route path="outreach"                     element={<OutreachPage />} />
          <Route path="agent"                        element={<AgentPage />} />
          <Route path="campaigns"       element={<CampaignsPage />} />
          <Route path="campaigns/:id"   element={<CampaignDetailPage />} />
          <Route path="campaigns/:id/report" element={<CampaignReportPage />} />
          <Route path="pipeline"        element={<CampaignKanbanPage />} />
          <Route path="calendar"        element={<CampaignCalendarPage />} />
          <Route path="deals"           element={<DealTrackerPage />} />
          <Route path="billing"         element={<BillingPage />} />
          <Route path="revenue"         element={<RevenuePage />} />
          <Route path="discover"        element={<DiscoverPage />} />
          <Route path="offers"          element={<OffersPage />} />
          <Route path="payments"        element={<PaymentsPage />} />
          <Route path="deduplicate"     element={<DeduplicatePage />} />
          <Route path="settings"        element={<SettingsPage />} />
          <Route path="creators"        element={<PublicCreatorsPage />} />
        </Route>

        {/* ── Live partner/investor dashboard ─────────────────────────────── */}
        <Route path="/live" element={
          <RoleGuard roles={['platform_admin', 'viewer']}>
            <LiveDashboard />
          </RoleGuard>
        } />

        {/* ── 404 catch-all ────────────────────────────────────────────────── */}
        <Route path="*" element={<NotFoundPage />} />

      </Routes>
    </BrowserRouter>
  );
}
