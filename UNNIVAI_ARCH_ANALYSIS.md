# Unnivai 2025: Architectural & Flow Analysis

## 1. Executive Summary
Unnivai 2025 is a high-fidelity React Native-style web application (PWA) focused on immersive, discovery-led tourism. The current MVP demonstrates exceptional frontend polish with complex Framer Motion animations (3D buttons, confetti, transitions) and a solid component architecture.

**Key Strengths:**
*   **Immersive Entry:** The Home page uses advanced 3D transforms and motion to create a "premium" app feel.
*   **Creative Flows:** The "Quick Path" and "Surprise Tour" flows are gamified and engaging, moving beyond standard list views.
*   **Robust Mocking Strategy:** The application uses a smart `dataService` that attempts to fetch from Supabase but gracefully falls back to rich mocked data (Rome/Palermo/Venice), ensuring the demo is always showcase-ready.

**Critical Gaps:**
*   **Authentication UI:** There is no frontend interface (Login/Register) for users to authenticate. The app relies on detected "Guest" state or implicit session limits, making the Dashboards inaccessible for regular users without console intervention.
*   **Functional Limits:** Several filters (MapPage, Trending) are visual-only and do not update the data view.

---

## 2. Core Flow Analysis

### 2.1 Entry Experience (`Home.jsx`)
*   **Role:** Acts as the central hub and "Wow" factor.
*   **Key Elements:**
    *   **3D Action Buttons:** "Tour Live" (Blue), "AI Itinerary" (Purple), "Quick Path" (Yellow). These use 3D rotation on hover to simulate depth.
    *   **Personalized Welcome:** Reads location from `useUserContext` (defaults to Roma) and displays relevant tours.
    *   **Smart Notifications:** Mocked real-time alerts.
*   **Navigation:**
    *   Direct links to all major sub-flows.
    *   Bottom Navigation for persistent access to Home, Explore, Photos, Profile.

### 2.2 AI Itinerary Flow (`AiItinerary.jsx`)
*   **Concept:** A wizard-style prompt for generating custom trips.
*   **Steps:**
    1.  **Preferences:** User inputs text prompt or selects tags (Budget, Duration, etc.).
    2.  **Generation:** Simulates AI processing with a 3-second loader and status messages.
    3.  **Result:** Displays a "Day by Day" timeline of activities.
*   **Integration:**
    *   "Vedi su Mappa" passes the generated route to `MapPage.jsx` via React Router state (partially implemented).
    *   "Prenota" buttons link to a generic `/tour-details` page (not dynamic ID).

### 2.3 Quick Path Flow (`QuickPath.jsx`)
*   **Concept:** A gamified 5-step decision tree for rapid decision making.
*   **Steps:** Environment (Sea/Mountain) -> Activity -> Time -> Duration -> Group.
*   **Payoff:** Ends with a "Confetti" reveal of a specific, matched activity.
*   **UX:** Heavily animated with smooth transitions between steps.

### 2.4 Discovery Flows (`TourLive.jsx` & `Trending.jsx`)
*   **Tour Live:**
    *   Focuses on "Now" urgency.
    *   Distinguishes between "Live Now" (Red) and "Scheduled" (Normal) tours.
    *   Includes a simulated real-time subscription via `dataService`.
*   **Trending:**
    *   Showcases "bestsellers".
    *   **Limitation:** The "Categories" grid (Più Viste, Premium, etc.) is visual-only and **does not filter** the list below.
    *   **Limitation:** Sort chips work, but category filtering is missing UI triggers.

### 2.5 Map Experience (`MapPage.jsx`)
*   **Core:** Uses `UnnivaiMap` (Leaflet wrapper).
*   **Features:**
    *   **Route Overlay:** Can render a connected path if passed via state (from AI Itinerary).
    *   **Interactive Pins:** Clicking a pin opens a Bottom Sheet with details.
*   **Limitation:** The top filter buttons (Cibo, Cultura) and Search Bar are **non-functional** UI elements.

### 2.6 Profile & History (`Profile.jsx`)
*   **State:** Hardcoded to "Marco Rossi" unless `supabase` session is forcefully injected.
*   **Features:**
    *   "Rivivi" section shows past tours (mocked).
    *   "Share" modal simulates social sharing.
*   **Missing:** No "Logout" button or settings configuration.

---

## 3. Technical Architecture

### 3.1 Tech Stack
*   **Frontend Check:** React 18, Vite.
*   **Styling:** TailwindCSS with extensive custom token usage (`terracotta`, `ochre`, `olive`).
*   **Animation:** `framer-motion` used extensively for page transitions and micro-interactions.
*   **Routing:** `react-router-dom` v6 with `RoleGuard` protection.
*   **State:** `@tanstack/react-query` for data fetching; Custom Context (`UserContext`) for global app state (City, Weather, User).

### 3.2 Data Layer (`dataService.js`)
*   **Hybrid Model:** The service is designed to try Supabase first. If it fails or returns empty (common in MVP/Dev), it seamlessly returns high-quality Mock Data.
*   **Resilience:** This architecture ensures the app "always works" for demos, even without a backend connection.

---

## 4. Critical Findings & Limitations

### 🔴 Authentication System
*   **Current State:** The app has **No Login/Register UI**.
*   **Mechanism:** `useUserProfile` hook detects browser session or defaults to "Guest".
*   **Impact:** Users cannot naturally access `DashboardUser`, `DashboardGuide`, or `DashboardBusiness` as `RoleGuard` redirects unauthenticated users to Home, and there is no way to authenticate via UI.

### 🟠 Navigation Dead-Ends
*   **Detailed Views:** Many list items link to a generic `/tour-details` instead of `/tour-details/:id`. While the route exists, the linking logic often drops the ID or the Details page is static.
*   **Filters:** In `Trending.jsx` and `MapPage.jsx`, filter buttons are present but wire-up logic is missing.

### 🟡 Data Consistency
*   **Map Search:** The search input in MapPage is cosmetic.
*   **Profile:** Profile data is isolated in `Profile.jsx` local state, disconnecting it from the global `UserContext` used in the TopBar.

---

## 5. Recommendations for Next Sprint

1.  **Implement Auth UI:** Create a `/login` page and a modal flow to allow users to "Log In" (even if just setting a mock auth state) to unlock Dashboards.
2.  **Wire Up Filters:** Connect the `selectedCategory` state in `Trending.jsx` and `MapPage.jsx` to the visible filter buttons.
3.  **Dynamic Routing:** Ensure all "Book/Details" buttons pass the `tour.id` and that `TourDetails` reads this ID to fetch specific mock content.
