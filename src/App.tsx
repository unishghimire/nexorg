import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './shared/context/AuthContext';
import { NotificationProvider } from './shared/context/NotificationContext';
import { SiteSettingsProvider } from './shared/context/SiteSettingsContext';
import ErrorBoundary from './shared/components/ErrorBoundary';
import OrgNavbar from './shared/components/OrgNavbar';
import ProtectedRoute from './shared/components/ProtectedRoute';
import ScrollToTop from './shared/components/ScrollToTop';

const OrganizerPanel = lazy(() => import('./features/organizer/views/OrganizerPanel'));
const TournamentAdminPanel = lazy(() => import('./features/admin/views/TournamentAdminPanel'));
const ScrimDetailPage = lazy(() => import('./features/organizer/views/ScrimDetailPage'));
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
            <Route path="/" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <OrganizerPanel />
              </ProtectedRoute>
            } />
            <Route path="/tournament-admin/:id" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <TournamentAdminPanel />
              </ProtectedRoute>
            } />
            <Route path="/organizer/scrim/:id" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                <ScrimDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
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
