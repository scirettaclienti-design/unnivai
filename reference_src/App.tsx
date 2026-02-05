import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import SimpleProtectedRoute from "@/components/SimpleProtectedRoute";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ExplorePage from "@/pages/explore";
import ProfilePage from "@/pages/profile";
import TourLivePage from "@/pages/tour-live";
import TourDetailsPage from "@/pages/tour-details";
import CreateTourPage from "@/pages/create-tour";
import AIItineraryPage from "@/pages/ai-itinerary";
import QuickPathPage from "@/pages/quick-path";
import SurpriseTourPage from "@/pages/surprise-tour";
import TrendingPage from "@/pages/trending";
import PhotosPage from "@/pages/photos";
import TourMapPage from "@/pages/tour-map";
import InteractiveMapPage from "@/pages/interactive-map";
import NotificationsPage from "@/pages/notifications";  
import NotificationSettingsPage from "@/pages/notification-settings";
import AuthWelcome from "@/pages/auth-welcome";
import RegisterCustomer from "@/pages/register-customer";
import RegisterBusiness from "@/pages/register-business";
import RegisterGuide from "@/pages/register-guide";
import LoginCustomer from "@/pages/login-customer";
import LoginBusiness from "@/pages/login-business";
import LoginGuide from "@/pages/login-guide";
import BusinessDashboard from "@/pages/dashboard-business";
import GuideDashboard from "@/pages/dashboard-guide";

function Router() {
  return (
    <Switch>
      {/* Public routes - no authentication required */}
      <Route path="/auth/welcome" component={AuthWelcome} />
      <Route path="/auth/register/customer" component={RegisterCustomer} />
      <Route path="/auth/register/business" component={RegisterBusiness} />
      <Route path="/auth/register/guide" component={RegisterGuide} />
      <Route path="/auth/login/customer" component={LoginCustomer} />
      <Route path="/auth/login/business" component={LoginBusiness} />
      <Route path="/auth/login/guide" component={LoginGuide} />
      
      {/* Protected routes - require authentication */}
      <Route path="/">
        {() => (
          <SimpleProtectedRoute allowedUserTypes={['customer']}>
            <Home />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/explore">
        {() => (
          <SimpleProtectedRoute allowedUserTypes={['customer']}>
            <ExplorePage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/profile">
        {() => (
          <SimpleProtectedRoute allowedUserTypes={['customer']}>
            <ProfilePage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/tour-live">
        {() => (
          <SimpleProtectedRoute allowedUserTypes={['customer']}>
            <TourLivePage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/tour-details/:id">
        {() => (
          <SimpleProtectedRoute>
            <TourDetailsPage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/tour-details">
        {() => (
          <SimpleProtectedRoute>
            <TourDetailsPage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/create-tour">
        {() => (
          <SimpleProtectedRoute allowedUserTypes={['business', 'guide']}>
            <CreateTourPage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/ai-itinerary">
        {() => (
          <SimpleProtectedRoute allowedUserTypes={['customer']}>
            <AIItineraryPage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/quick-path">
        {() => (
          <SimpleProtectedRoute allowedUserTypes={['customer']}>
            <QuickPathPage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/surprise-tour">
        {() => (
          <SimpleProtectedRoute allowedUserTypes={['customer']}>
            <SurpriseTourPage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/trending">
        {() => (
          <SimpleProtectedRoute allowedUserTypes={['customer']}>
            <TrendingPage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/photos">
        {() => (
          <SimpleProtectedRoute allowedUserTypes={['customer']}>
            <PhotosPage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/tour-map">
        {() => (
          <SimpleProtectedRoute>
            <TourMapPage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/interactive-map">
        {() => (
          <SimpleProtectedRoute>
            <InteractiveMapPage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/notifications">
        {() => (
          <SimpleProtectedRoute>
            <NotificationsPage />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/notification-settings">
        {() => (
          <SimpleProtectedRoute>
            <NotificationSettingsPage />
          </SimpleProtectedRoute>
        )}
      </Route>
      
      {/* Dashboard routes */}
      <Route path="/dashboard/business">
        {() => (
          <SimpleProtectedRoute allowedUserTypes={['business']}>
            <BusinessDashboard />
          </SimpleProtectedRoute>
        )}
      </Route>
      <Route path="/dashboard/guide">
        {() => (
          <SimpleProtectedRoute allowedUserTypes={['guide']}>
            <GuideDashboard />
          </SimpleProtectedRoute>
        )}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
