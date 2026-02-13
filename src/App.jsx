import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import RoleGuard from './components/RoleGuard';
import ErrorBoundary from './components/ErrorBoundary';

// ⚡️ LAZY LOADING: Performance Optimization for heavy bundles
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const Profile = lazy(() => import('./pages/Profile'));
const Explore = lazy(() => import('./pages/Explore'));
const TourDetails = lazy(() => import('./pages/TourDetails'));
const AiItinerary = lazy(() => import('./pages/AiItinerary'));
const MapPage = lazy(() => import('./pages/MapPage'));
const DashboardUser = lazy(() => import('./pages/DashboardUser'));
const DashboardGuide = lazy(() => import('./pages/DashboardGuide'));
const DashboardBusiness = lazy(() => import('./pages/DashboardBusiness'));
const BecomeGuide = lazy(() => import('./pages/BecomeGuide'));
const TourBuilder = lazy(() => import('./pages/guide/TourBuilder'));
const QuickPath = lazy(() => import('./pages/QuickPath'));
const Notifications = lazy(() => import('./pages/Notifications'));
const TourLive = lazy(() => import('./pages/TourLive'));
const SurpriseTour = lazy(() => import('./pages/SurpriseTour'));
const Trending = lazy(() => import('./pages/Trending'));
const Photos = lazy(() => import('./pages/Photos'));
const GuidePlaceholder = lazy(() => import('./pages/GuidePlaceholder'));

// Optimized Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      refetchOnWindowFocus: false, // Prevent infinite loops
    },
  },
});

// Minimal Loading Component
const GlobalLoading = () => (
  <div className="flex items-center justify-center min-h-screen bg-white">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 font-medium animate-pulse">Caricamento Unnivai...</p>
    </div>
  </div>
);

// 🛡️ ROOT DISPATCHER: Handles "Instant Redirect" Logic
const RootDispatcher = () => {
  const { user, loading, role } = useAuth();

  // 1. Block until Auth Checked
  if (loading) return <GlobalLoading />;

  // 2. Immediate Redirect if Logged In
  if (user) {
    if (role === 'guide') return <Navigate to="/dashboard-guide" replace />;
    if (role === 'business') return <Navigate to="/dashboard-business" replace />;
    return <Navigate to="/dashboard-user" replace />;
  }

  // 3. Show Landing if Guest
  return <Landing />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <ErrorBoundary>
            <Suspense fallback={<GlobalLoading />}>
              <Routes>
                {/* THE GATEKEEPER */}
                <Route path="/" element={<RootDispatcher />} />

                {/* PUBLIC */}
                <Route path="/login" element={<Login />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/tour-details" element={<TourDetails />} />
                <Route path="/tour-details/:id" element={<TourDetails />} />

                {/* PROTECTED USER ROUTES */}
                <Route element={<RoleGuard allowedRoles={['explorer', 'user']} />}>
                  <Route path="/dashboard-user" element={<DashboardUser />} />
                  <Route path="/app/*" element={<DashboardUser />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/photos" element={<Photos />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/ai-itinerary" element={<AiItinerary />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/quick-path" element={<QuickPath />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/tour-live" element={<TourLive />} />
                  <Route path="/surprise-tour" element={<SurpriseTour />} />
                  <Route path="/trending" element={<Trending />} />
                  <Route path="/become-guide" element={<BecomeGuide />} />
                </Route>

                {/* GUIDE ROUTES */}
                <Route element={<RoleGuard allowedRoles={['guide']} />}>
                  <Route path="/dashboard-guide" element={<DashboardGuide />} />
                  <Route path="/guide/create-tour" element={<TourBuilder />} />
                  <Route path="/guide/*" element={<DashboardGuide />} />
                  <Route path="/chat/guide/:id" element={<GuidePlaceholder type="chat" />} />
                  <Route path="/profile/guide/:id" element={<GuidePlaceholder type="profile" />} />
                </Route>

                {/* BUSINESS ROUTES */}
                <Route element={<RoleGuard allowedRoles={['business']} />}>
                  <Route path="/dashboard-business" element={<DashboardBusiness />} />
                  <Route path="/business/*" element={<DashboardBusiness />} />
                </Route>

              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
