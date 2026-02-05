import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Explore from './pages/Explore';
import Photos from './pages/Photos';
import TourDetails from './pages/TourDetails';
import AiItinerary from './pages/AiItinerary';
import QuickPath from './pages/QuickPath';
import Notifications from './pages/Notifications';
import TourLive from './pages/TourLive';
import SurpriseTour from './pages/SurpriseTour';
import Trending from './pages/Trending';
import MapPage from './pages/MapPage';
import BecomeGuide from './pages/BecomeGuide';
import GuidePlaceholder from './pages/GuidePlaceholder';
import DashboardUser from './pages/DashboardUser';
import DashboardGuide from './pages/DashboardGuide';
import DashboardBusiness from './pages/DashboardBusiness';
import RoleGuard from './components/RoleGuard';

// Create a client
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/photos" element={<Photos />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/tour-details" element={<TourDetails />} />
          <Route path="/tour-details/:id" element={<TourDetails />} />
          <Route path="/ai-itinerary" element={<AiItinerary />} />
          <Route path="/quick-path" element={<QuickPath />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/tour-live" element={<TourLive />} />
          <Route path="/surprise-tour" element={<SurpriseTour />} />
          <Route path="/trending" element={<Trending />} />
          <Route path="/interactive-map" element={<MapPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/become-guide" element={<BecomeGuide />} />
          <Route path="/chat/guide/:id" element={<GuidePlaceholder type="chat" />} />
          <Route path="/profile/guide/:id" element={<GuidePlaceholder type="profile" />} />

          {/* Role-Based Dashboards */}
          <Route element={<RoleGuard allowedRoles={['user']} />}>
            <Route path="/dashboard-user" element={<DashboardUser />} />
          </Route>

          <Route element={<RoleGuard allowedRoles={['guide']} />}>
            <Route path="/dashboard-guide" element={<DashboardGuide />} />
          </Route>

          <Route element={<RoleGuard allowedRoles={['business']} />}>
            <Route path="/dashboard-business" element={<DashboardBusiness />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
