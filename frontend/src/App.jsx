import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ReportLostItem from "./pages/ReportLostItem.jsx";
import MyLostItems from "./pages/MyLostItems.jsx";
import LostItemDetails from "./pages/LostItemDetails.jsx";
import ReportFoundItem from "./pages/ReportFoundItem.jsx";
import MyFoundItems from "./pages/MyFoundItems.jsx";
import FoundItemDetails from "./pages/FoundItemDetails.jsx";
import ExplorePage from "./pages/ExplorePage.jsx";
import ItemDetailsPage from "./pages/ItemDetailsPage.jsx";
import MatchesPage from "./pages/MatchesPage.jsx";
import ClaimsPage from "./pages/ClaimsPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import MessagesPage from "./pages/MessagesPage.jsx";
import RecoveryPage from "./pages/RecoveryPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import { DynamicFavicon } from "../DynamicFavicon.jsx";

// Admin Portal
import AdminProtectedRoute from "./components/admin/AdminProtectedRoute.jsx";
import AdminLayout from "./components/admin/AdminLayout.jsx";
import AdminOverview from "./pages/admin/AdminOverview.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminLostItems from "./pages/admin/AdminLostItems.jsx";
import AdminFoundItems from "./pages/admin/AdminFoundItems.jsx";
import AdminMatches from "./pages/admin/AdminMatches.jsx";
import AdminClaims from "./pages/admin/AdminClaims.jsx";
import AdminRecoveries from "./pages/admin/AdminRecoveries.jsx";
import AdminReports from "./pages/admin/AdminReports.jsx";
import AdminSettings from "./pages/admin/AdminSettings.jsx";

export default function App() {
  return (
    <AuthProvider>
      <DynamicFavicon />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/report-lost" element={<ReportLostItem />} />
          <Route path="/my-lost-items" element={<MyLostItems />} />
          <Route path="/lost-items" element={<MyLostItems />} />
          <Route path="/lost-items/:id" element={<ItemDetailsPage initialType="LOST" />} />
          <Route path="/report-found" element={<ReportFoundItem />} />
          <Route path="/my-found-items" element={<MyFoundItems />} />
          <Route path="/found-items" element={<MyFoundItems />} />
          <Route path="/found-items/:id" element={<ItemDetailsPage initialType="FOUND" />} />
          <Route path="/items/:type/:id" element={<ItemDetailsPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/claims" element={<ClaimsPage />} />
          <Route path="/recovery/:id" element={<RecoveryPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:conversationId" element={<MessagesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<DashboardPage />} />
          <Route path="/settings" element={<DashboardPage />} />

          {/* Admin Management Portal */}
          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <AdminLayout />
              </AdminProtectedRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="lost-items" element={<AdminLostItems />} />
            <Route path="found-items" element={<AdminFoundItems />} />
            <Route path="matches" element={<AdminMatches />} />
            <Route path="claims" element={<AdminClaims />} />
            <Route path="recoveries" element={<AdminRecoveries />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
