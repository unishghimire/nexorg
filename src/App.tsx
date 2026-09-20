import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './shared/context/AuthContext';
import { NotificationProvider } from './shared/context/NotificationContext';
import { SiteSettingsProvider } from './shared/context/SiteSettingsContext';
import ErrorBoundary from './shared/components/ErrorBoundary';
import OrgNavbar from './shared/components/OrgNavbar';
import ProtectedRoute from './shared/components/ProtectedRoute';
import ScrollToTop from './shared/components/ScrollToTop';
import Footer from './shared/components/Footer';
import InstallAppPrompt from './shared/components/pwa/InstallAppPrompt';

const OrganizerPanel = lazy(() => import('./features/organizer/views/OrganizerPanel'));
const TournamentManagePortal = lazy(() => import('./features/tournaments/views/TournamentManagePortal'));
const ScrimDetailPage = lazy(() => import('./features/organizer/views/ScrimDetailPage'));
const Profile = lazy(() => import('./features/profile/views/Profile'));
const Login = lazy(() => import('./features/auth/views/Login'));
const Register = lazy(() => import('./features/auth/views/Register'));

const LoadingFallback = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center">
    <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading NexOrg...</p>
  </div>
);

const AppContent = () => {
  return (
    <div id="org-app" className="min-h-[100dvh] bg-dark flex flex-col relative overflow-x-hidden text-white">
      <OrgNavbar />
      <ScrollToTop />
      <main className="flex-grow container mx-auto px-3 sm:px-6 lg:px-8 py-6 relative">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Organization Dashboard & Hub Routes */}
            <Route path="/" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <OrganizerPanel />
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/organizer" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <OrganizerPanel />
              </ProtectedRoute>
            } />

            {/* Tournament Management & Console Routes */}
            <Route path="/tournaments" element={<Navigate to="/?tab=tournaments" replace />} />
            <Route path="/tournaments/:id" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <TournamentManagePortal />
              </ProtectedRoute>
            } />
            <Route path="/tournaments/manage/:id" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <TournamentManagePortal />
              </ProtectedRoute>
            } />
            <Route path="/tournaments/:id/groups" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <TournamentManagePortal />
              </ProtectedRoute>
            } />
            <Route path="/tournaments/:id/matches" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <TournamentManagePortal />
              </ProtectedRoute>
            } />
            <Route path="/tournaments/:id/results" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <TournamentManagePortal />
              </ProtectedRoute>
            } />
            <Route path="/tournament-admin/:id" element={
              <Navigate to="/tournaments/:id" replace />
            } />

            {/* Scrim Management & Console Routes */}
            <Route path="/scrims" element={<Navigate to="/?tab=scrims" replace />} />
            <Route path="/scrims/:id" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <ScrimDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/scrims/manage/:id" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <ScrimDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/organizer/scrim/:id" element={
              <Navigate to="/scrims/:id" replace />
            } />

            {/* Organization Wallet, Profile & Settings Routes */}
            <Route path="/wallet" element={<Navigate to="/?tab=wallet" replace />} />
            <Route path="/settings" element={<Navigate to="/?tab=settings" replace />} />
            <Route path="/profile" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <Profile />
              </ProtectedRoute>
            } />

            {/* Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Wildcard Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <InstallAppPrompt />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <AuthProvider>
          <NotificationProvider>
            <SiteSettingsProvider>
              <Router>
                <AppContent />
              </Router>
            </SiteSettingsProvider>
          </NotificationProvider>
        </AuthProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}
