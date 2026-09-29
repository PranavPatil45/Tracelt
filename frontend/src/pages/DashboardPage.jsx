import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Dashboard Components
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import WelcomeSection from '../components/dashboard/WelcomeSection.jsx'
import StatsCards from '../components/dashboard/StatsCards.jsx'
import ActiveTraces from '../components/dashboard/ActiveTraces.jsx'
import MatchCenter from '../components/dashboard/MatchCenter.jsx'
import CampusActivity from '../components/dashboard/CampusActivity.jsx'
import QuickActions from '../components/dashboard/QuickActions.jsx'
import RecentReportsTable from '../components/dashboard/RecentReportsTable.jsx'
import NotificationsPreview from '../components/dashboard/NotificationsPreview.jsx'
import ReconnectedSection from '../components/dashboard/ReconnectedSection.jsx'
import ReportItemModal from '../components/dashboard/ReportItemModal.jsx'
import MatchDetailModal from '../components/dashboard/MatchDetailModal.jsx'

// Subviews
import ExploreView from '../components/dashboard/subviews/ExploreView.jsx'
import MatchesView from '../components/dashboard/subviews/MatchesView.jsx'
import MessagesView from '../components/dashboard/subviews/MessagesView.jsx'
import MyItemsView from '../components/dashboard/subviews/MyItemsView.jsx'
import ProfileView from '../components/dashboard/subviews/ProfileView.jsx'

// API Layer
import {
  fetchUserStats,
  fetchActiveTraces,
  fetchPossibleMatch,
  fetchCampusActivity,
  fetchRecentReports,
  fetchNotifications,
  fetchReconnectedItems,
  submitReport,
  confirmRecovery,
} from '../api/dashboard.js'
import { getNotificationRoute } from '../api/notifications.js'

import './DashboardPage.css'

const TAB_TITLES = {
  dashboard: 'Dashboard',
  explore: 'Campus Directory',
  'lost-items': 'My Lost Items',
  'found-items': 'My Found Items',
  matches: 'Match Center',
  messages: 'Campus Messages',
  history: 'Recovery History',
  notifications: 'Notifications',
  profile: 'Campus Profile',
  settings: 'Account Settings',
}

function getTabFromPath(pathname) {
  const clean = pathname.replace(/^\//, '').toLowerCase()
  if (!clean || clean === 'dashboard') return 'dashboard'
  if (clean === 'explore') return 'explore'
  if (clean === 'lost-items') return 'lost-items'
  if (clean === 'found-items') return 'found-items'
  if (clean === 'matches') return 'matches'
  if (clean === 'messages') return 'messages'
  if (clean === 'history') return 'history'
  if (clean === 'notifications') return 'notifications'
  if (clean === 'profile') return 'profile'
  if (clean === 'settings') return 'settings'
  return 'dashboard'
}

export default function DashboardPage() {
  const { user, token, loading, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Routing and Tab State
  const [activeTab, setActiveTab] = useState(() => getTabFromPath(location.pathname))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Data State
  const [stats, setStats] = useState(null)
  const [traces, setTraces] = useState([])
  const [possibleMatch, setPossibleMatch] = useState(null)
  const [activities, setActivities] = useState([])
  const [reports, setReports] = useState([])
  const [notifications, setNotifications] = useState([])
  const [reconnected, setReconnected] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  // Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportModalType, setReportModalType] = useState('lost') // 'lost' | 'found'
  const [matchModalOpen, setMatchModalOpen] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)

  // Sync tab with URL changes
  useEffect(() => {
    const tab = getTabFromPath(location.pathname)
    setActiveTab(tab)
  }, [location.pathname])

  // Route Protection: redirect to /login if unauthenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login')
    }
  }, [loading, isAuthenticated, navigate])

  // Hydrate dashboard data
  const loadDashboardData = useCallback(async () => {
    setDataLoading(true)
    try {
      const [
        statsData,
        tracesData,
        matchData,
        activityData,
        reportsData,
        notifsData,
        reconnectedData,
      ] = await Promise.all([
        fetchUserStats(token),
        fetchActiveTraces(token),
        fetchPossibleMatch(token),
        fetchCampusActivity(token, user?.campus),
        fetchRecentReports(token),
        fetchNotifications(token),
        fetchReconnectedItems(token),
      ])

      setStats(statsData)
      setTraces(tracesData)
      setPossibleMatch(matchData)
      setActivities(activityData)
      setReports(reportsData)
      setNotifications(notifsData)
      setReconnected(reconnectedData)
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setDataLoading(false)
    }
  }, [token, user?.campus])

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData()
    }
  }, [isAuthenticated, loadDashboardData])

  // Tab navigation handler
  function handleSelectTab(tabId) {
    setActiveTab(tabId)
    setMobileMenuOpen(false)
    if (tabId === 'explore') {
      navigate('/explore')
      return
    }
    if (tabId === 'found-items') {
      navigate('/my-found-items')
      return
    }
    if (tabId === 'lost-items') {
      navigate('/my-lost-items')
      return
    }
    if (tabId === 'history') {
      navigate('/history')
      return
    }
    const targetPath = tabId === 'dashboard' ? '/dashboard' : `/${tabId}`
    if (location.pathname !== targetPath) {
      navigate(targetPath)
    }
  }

  // Open Report
  function handleOpenReport(type = 'lost') {
    if (type === 'lost') {
      navigate('/report-lost')
    } else if (type === 'found') {
      navigate('/report-found')
    } else {
      setReportModalType(type)
      setReportModalOpen(true)
    }
  }

  // Submit Report
  async function handleSubmitReport(newReport) {
    try {
      await submitReport(newReport, token)
      // Refresh local data state
      await loadDashboardData()
    } catch (err) {
      console.error('Failed to submit report:', err)
    }
  }

  // Open Match Review Modal
  function handleReviewMatch(match) {
    setSelectedMatch(match || possibleMatch)
    setMatchModalOpen(true)
  }

  // Confirm recovery handover
  async function handleConfirmRecovery(match) {
    try {
      await confirmRecovery(match, token)
      await loadDashboardData()
    } catch (err) {
      console.error('Failed to confirm recovery:', err)
    }
  }

  // Notification action handler
  function handleNotificationAction(notif) {
    if (notif.rawNotification) {
      navigate(getNotificationRoute(notif.rawNotification))
      return
    }
    if (notif.type === 'match') {
      navigate('/matches')
    } else if (notif.type === 'message') {
      navigate('/claims')
    } else if (notif.type === 'recovery') {
      navigate('/lost-items')
    }
  }

  // Show loading screen while verifying session
  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__spinner" />
        <p>Loading your Tracelt dashboard&hellip;</p>
      </div>
    )
  }

  // If not authenticated, the useEffect hook will redirect to /login
  if (!user) {
    return null
  }

  const campusName = user?.campus?.trim() ? user.campus : ''
  const activeTabTitle = TAB_TITLES[activeTab] || 'Dashboard'

  return (
    <div className="dashboard-app">
      {/* Fixed Desktop Sidebar & Mobile Off-canvas Drawer */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        user={user}
        stats={stats}
        logout={logout}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Content Area */}
      <div className="dashboard-main-area">
        {/* Sticky Top Header */}
        <DashboardHeader
          activeTabTitle={activeTabTitle}
          user={user}
          logout={logout}
          notifications={notifications}
          onOpenNotifications={() => handleSelectTab('notifications')}
          onOpenReportModal={handleOpenReport}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectTab={handleSelectTab}
        />

        {/* Dynamic Content Views */}
        <main className="dashboard-content">
          {activeTab === 'dashboard' && (
            <div className="dashboard-subview-wrapper">
              {/* Welcome Banner */}
              <WelcomeSection
                user={user}
                onOpenReportModal={handleOpenReport}
              />

              {/* Statistics Cards */}
              <StatsCards
                stats={stats}
                onCardClick={(cardId) => {
                  if (cardId === 'lost-items') handleSelectTab('lost-items')
                  else if (cardId === 'found-items') handleSelectTab('found-items')
                  else if (cardId === 'matches') handleSelectTab('matches')
                  else if (cardId === 'recovered') navigate('/history')
                }}
              />

              {/* Active Traces — Main Lost Items Tracking Feature */}
              <ActiveTraces
                traces={traces}
                onViewMatch={handleReviewMatch}
                onViewReport={() => handleSelectTab('lost-items')}
                onOpenReportModal={handleOpenReport}
              />

              {/* 2-Column Grid: Campus Activity (Left) + Match Center (Right) */}
              <div className="dashboard-2col-grid">
                <CampusActivity
                  activities={activities}
                  campus={campusName}
                  onViewAll={() => handleSelectTab('explore')}
                  onItemClick={() => handleSelectTab('explore')}
                />

                <MatchCenter
                  match={possibleMatch}
                  onReviewMatch={handleReviewMatch}
                />
              </div>

              {/* Quick Actions */}
              <QuickActions
                onReportLost={() => handleOpenReport('lost')}
                onReportFound={() => handleOpenReport('found')}
                onExplore={() => handleSelectTab('explore')}
              />

              {/* Recent Reports Table / Mobile Cards */}
              <RecentReportsTable
                reports={reports}
                onViewAll={() => handleSelectTab('lost-items')}
                onViewReport={() => handleSelectTab('lost-items')}
              />

              {/* Notifications Preview */}
              <NotificationsPreview
                notifications={notifications}
                onActionClick={handleNotificationAction}
                onViewAll={() => handleSelectTab('notifications')}
              />

              {/* Reconnected Items Section */}
              <ReconnectedSection
                items={reconnected}
                onViewDetails={() => handleSelectTab('dashboard')}
              />
            </div>
          )}

          {activeTab === 'explore' && (
            <div className="dashboard-subview-wrapper">
              <ExploreView
                activities={activities}
                campus={campusName}
                onOpenReportModal={handleOpenReport}
              />
            </div>
          )}

          {activeTab === 'lost-items' && (
            <div className="dashboard-subview-wrapper">
              <MyItemsView
                initialType="lost"
                reports={reports}
                onOpenReportModal={handleOpenReport}
              />
            </div>
          )}

          {activeTab === 'found-items' && (
            <div className="dashboard-subview-wrapper">
              <MyItemsView
                initialType="found"
                reports={reports}
                onOpenReportModal={handleOpenReport}
              />
            </div>
          )}

          {activeTab === 'matches' && (
            <div className="dashboard-subview-wrapper">
              <MatchesView
                match={possibleMatch}
                onReviewMatch={handleReviewMatch}
              />
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="dashboard-subview-wrapper">
              <MessagesView user={user} />
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="dashboard-subview-wrapper">
              <NotificationsPreview
                notifications={notifications}
                onActionClick={handleNotificationAction}
                onViewAll={() => {}}
              />
            </div>
          )}

          {(activeTab === 'profile' || activeTab === 'settings') && (
            <div className="dashboard-subview-wrapper">
              <ProfileView user={user} />
            </div>
          )}
        </main>
      </div>

      {/* Report Modal */}
      <ReportItemModal
        isOpen={reportModalOpen}
        initialType={reportModalType}
        campus={campusName}
        onClose={() => setReportModalOpen(false)}
        onSubmitReport={handleSubmitReport}
      />

      {/* Match Review Modal */}
      <MatchDetailModal
        isOpen={matchModalOpen}
        match={selectedMatch || possibleMatch}
        onClose={() => setMatchModalOpen(false)}
        onConfirmRecovery={handleConfirmRecovery}
        onOpenMessage={() => {
          setMatchModalOpen(false)
          handleSelectTab('messages')
        }}
      />
    </div>
  )
}
