import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CityProvider } from './context/CityContext';
import RoleGuard from './components/RoleGuard';
import ErrorBoundary from './components/ErrorBoundary';
import ToastProvider from './components/ToastProvider';
// DVAI-022: APIProvider rimosso dal root — caricato SOLO nelle pagine mappa
// tramite MapAPIWrapper (MapPage, TourBuilder, Explore).

// ⚡️ LAZY LOADING: tutte le pagine sono lazy per ridurre il bundle iniziale
const Landing        = lazy(() => import('./pages/Landing'));
const Login          = lazy(() => import('./pages/Login'));
const Profile        = lazy(() => import('./pages/Profile'));
const TourDetails    = lazy(() => import('./pages/TourDetails'));
const AiItinerary    = lazy(() => import('./pages/AiItinerary'));
const DashboardUser  = lazy(() => import('./pages/DashboardUser'));
const DashboardGuide = lazy(() => import('./pages/DashboardGuide'));
const DashboardBusiness = lazy(() => import('./pages/DashboardBusiness'));
const BecomeGuide    = lazy(() => import('./pages/BecomeGuide'));
const QuickPath      = lazy(() => import('./pages/QuickPath'));
const Notifications  = lazy(() => import('./pages/Notifications'));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'));
const TourLive       = lazy(() => import('./pages/TourLive'));
const SurpriseTour   = lazy(() => import('./pages/SurpriseTour'));
const UpdatePassword = lazy(() => import('./pages/UpdatePassword'));
const Trending       = lazy(() => import('./pages/Trending'));
const Photos         = lazy(() => import('./pages/Photos'));
const GuidePlaceholder = lazy(() => import('./pages/GuidePlaceholder'));
const Onboarding     = lazy(() => import('./pages/Onboarding'));
const NotFound       = lazy(() => import('./pages/NotFound'));

// DVAI-022: Pagine con Google Maps — wrapped con MapAPIWrapper internamente
const MapPage    = lazy(() => import('./pages/MapPage'));
const TourBuilder = lazy(() => import('./pages/guide/TourBuilder'));
const Explore    = lazy(() => import('./pages/Explore'));

// Optimized Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minuti di cache
      refetchOnWindowFocus: false,
    },
  },
});

// DoveVAI Branded Loading
const GlobalLoading = () => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-orange-50 to-white">
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-200">
          <span className="text-3xl">🗺️</span>
        </div>
        <div className="absolute -inset-2 rounded-3xl border-2 border-orange-300/40 animate-ping" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Quicksand, sans-serif' }}>DoveVAI</h2>
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-orange-400"
              style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
    <style>{`@keyframes pulse { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.2); } }`}</style>
  </div>
);

// 🛡️ ROOT DISPATCHER: Instant Redirect Logic
const RootDispatcher = () => {
  const { user, loading, role, isPasswordRecovery } = useAuth();

  if (loading) return <GlobalLoading />;
  if (isPasswordRecovery) return <Navigate to="/update-password" replace />;

  if (user) {
    const onboardingDone = localStorage.getItem('dvai_onboarding_done');
    if (!onboardingDone && role !== 'guide' && role !== 'business') {
      return <Navigate to="/onboarding" replace />;
    }
    if (role === 'guide')    return <Navigate to="/dashboard-guide" replace />;
    if (role === 'business') return <Navigate to="/dashboard-business" replace />;
    return <Navigate to="/dashboard-user" replace />;
  }

  return <Landing />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CityProvider>
          {/* DVAI-039: ToastProvider globale — ascolta eventi dvai:toast */}
          <ToastProvider />
          <Router>
            <ErrorBoundary>
              <Suspense fallback={<GlobalLoading />}>
                <Routes>
                  {/* THE GATEKEEPER */}
                  <Route path="/" element={<RootDispatcher />} />

                  {/* PUBLIC */}
                  <Route path="/login"           element={<Login />} />
                  <Route path="/onboarding"      element={<Onboarding />} />
                  <Route path="/update-password" element={<UpdatePassword />} />
                  <Route path="/explore"         element={<Explore />} />
                  <Route path="/tour-details"    element={<TourDetails />} />
                  <Route path="/tour-details/:id" element={<TourDetails />} />

                  {/* PROTECTED USER ROUTES */}
                  <Route element={<RoleGuard allowedRoles={['explorer', 'user']} />}>
                    <Route path="/dashboard-user"  element={<DashboardUser />} />
                    <Route path="/app/*"           element={<DashboardUser />} />
                    {/* DVAI-026: /home → redirect /dashboard-user */}
                    <Route path="/home"            element={<Navigate to="/dashboard-user" replace />} />
                    <Route path="/photos"          element={<Photos />} />
                    <Route path="/profile"         element={<Profile />} />
                    <Route path="/ai-itinerary"    element={<AiItinerary />} />
                    <Route path="/map"             element={<MapPage />} />
                    <Route path="/quick-path"      element={<QuickPath />} />
                    <Route path="/notifications"   element={<Notifications />} />
                    {/* DVAI-027: /notification-settings ora raggiungibile */}
                    <Route path="/notification-settings" element={<NotificationSettings />} />
                    <Route path="/tour-live"       element={<TourLive />} />
                    <Route path="/surprise-tour"   element={<SurpriseTour />} />
                    <Route path="/trending"        element={<Trending />} />
                    <Route path="/become-guide"    element={<BecomeGuide />} />
                  </Route>

                  {/* GUIDE ROUTES */}
                  <Route element={<RoleGuard allowedRoles={['guide']} />}>
                    <Route path="/dashboard-guide"    element={<DashboardGuide />} />
                    <Route path="/guide/create-tour"  element={<TourBuilder />} />
                    <Route path="/guide/*"            element={<DashboardGuide />} />
                    <Route path="/chat/guide/:id"     element={<GuidePlaceholder type="chat" />} />
                    <Route path="/profile/guide/:id"  element={<GuidePlaceholder type="profile" />} />
                  </Route>

                  {/* BUSINESS ROUTES */}
                  <Route element={<RoleGuard allowedRoles={['business']} />}>
                    <Route path="/dashboard-business" element={<DashboardBusiness />} />
                    <Route path="/business/*"         element={<DashboardBusiness />} />
                  </Route>

                  {/* DVAI-042: Catch-all 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </Router>
        </CityProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
