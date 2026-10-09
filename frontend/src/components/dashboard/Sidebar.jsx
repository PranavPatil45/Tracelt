import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { getUnreadMessageCount } from "../../api/messaging.js";
import LogoIcon from "../auth/LogoIcon.jsx";
import {
  Radar,
  LayoutDashboard,
  Compass,
  Search,
  CheckCircle2,
  GitCompare,
  ShieldCheck,
  Shield,
  MessageSquare,
  History,
  Bell,
  User,
  Settings,
  LogOut,
  MapPin,
  X,
} from "lucide-react";
import "./Sidebar.css";

export default function Sidebar({
  activeTab,
  setActiveTab,
  user,
  stats,
  logout,
  mobileOpen,
  setMobileOpen,
}) {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [liveStats, setLiveStats] = useState(stats || null);

  useEffect(() => {
    if (stats) {
      setLiveStats((prev) => ({ ...prev, ...stats }));
    }
  }, [stats]);

  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    async function loadStats() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || "/api"}/users/me/dashboard-stats`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setLiveStats(data);
            if (data.unread_messages !== undefined) {
              setUnreadMsgCount(data.unread_messages);
            }
          }
        }
      } catch {
        // Ignore network errors
      }
    }

    loadStats();

    const handleRefresh = () => {
      loadStats();
    };

    window.addEventListener("tracelt:refresh-stats", handleRefresh);

    const interval = setInterval(loadStats, 20000);

    return () => {
      isMounted = false;
      window.removeEventListener("tracelt:refresh-stats", handleRefresh);
      clearInterval(interval);
    };
  }, [token]);

  const lostCount =
    liveStats?.lost_items ??
    liveStats?.lostItems ??
    stats?.lost_items ??
    stats?.lostItems ??
    0;
  const foundCount =
    liveStats?.found_items ??
    liveStats?.foundItems ??
    stats?.found_items ??
    stats?.foundItems ??
    0;
  const matchesCount = liveStats?.matches ?? stats?.matches ?? 0;
  const claimsCount = liveStats?.claims ?? stats?.claims ?? 0;
  const unreadMessages =
    liveStats?.unread_messages ??
    liveStats?.unreadMessages ??
    unreadMsgCount ??
    0;
  const unreadNotifs =
    liveStats?.unread_notifications ?? liveStats?.unreadNotifications ?? 0;

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
    },
    { id: "explore", label: "Explore", icon: Compass, path: "/explore" },
    {
      id: "lost-items",
      label: "My Lost Items",
      icon: Search,
      path: "/lost-items",
      badge: lostCount > 0 ? String(lostCount) : undefined,
    },
    {
      id: "found-items",
      label: "My Found Items",
      icon: CheckCircle2,
      path: "/found-items",
      badge: foundCount > 0 ? String(foundCount) : undefined,
    },
    {
      id: "matches",
      label: "Matches",
      icon: GitCompare,
      path: "/matches",
      badge: matchesCount > 0 ? String(matchesCount) : undefined,
      highlightBadge: true,
    },
    {
      id: "claims",
      label: "Claims",
      icon: ShieldCheck,
      path: "/claims",
      badge: claimsCount > 0 ? String(claimsCount) : undefined,
    },
    {
      id: "messages",
      label: "Messages",
      icon: MessageSquare,
      path: "/messages",
      badge:
        unreadMessages > 0
          ? String(unreadMessages > 9 ? "9+" : unreadMessages)
          : undefined,
      highlightBadge: true,
    },
    { id: "history", label: "History", icon: History, path: "/history" },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      path: "/notifications",
      badge:
        unreadNotifs > 0
          ? String(unreadNotifs > 9 ? "9+" : unreadNotifs)
          : undefined,
      highlightBadge: true,
    },
    ...(user &&
    ["admin", "superadmin", "reviewer"].includes(
      (user.role || "").toLowerCase(),
    )
      ? [
          {
            id: "admin-portal",
            label: "Admin Portal",
            icon: Shield,
            path: "/admin",
            highlightBadge: true,
          },
        ]
      : []),
  ];

  function handleNavClick(item) {
    if (setActiveTab) {
      setActiveTab(item.id);
    }
    if (item.path) {
      navigate(item.path);
    }
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  }

  function handleLogout() {
    if (logout) logout();
    navigate("/");
  }

  const campusName = user?.campus?.trim() ? user.campus : "Campus not set";
  const departmentName = user?.department?.trim() ? user.department : "";

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="dashboard-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`dashboard-sidebar ${mobileOpen ? "dashboard-sidebar--open" : ""}`}
      >
        {/* Brand header */}
        <div className="dashboard-sidebar__brand-container">
          <Link
            to="/"
            className="dashboard-sidebar__brand"
            aria-label="Tracelt Home"
          >
            <LogoIcon width={40} height={50} />
            <div className="dashboard-sidebar__brand-text">
              <span className="dashboard-sidebar__word">Tracelt</span>
              <span className="dashboard-sidebar__tag">Campus Portal</span>
            </div>
          </Link>

          {setMobileOpen && (
            <button
              className="dashboard-sidebar__close-btn"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Primary Navigation */}
        <div className="dashboard-sidebar__scrollable">
          <div className="dashboard-sidebar__nav-group">
            <span className="dashboard-sidebar__section-title">Navigation</span>
            <nav className="dashboard-sidebar__nav">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`dashboard-sidebar__item ${isActive ? "dashboard-sidebar__item--active" : ""}`}
                    onClick={() => handleNavClick(item)}
                  >
                    <Icon size={18} className="dashboard-sidebar__item-icon" />
                    <span className="dashboard-sidebar__item-label">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        className={`dashboard-sidebar__badge ${
                          item.highlightBadge
                            ? "dashboard-sidebar__badge--highlight"
                            : ""
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="dashboard-sidebar__divider" />

          {/* Account Group */}
          <div className="dashboard-sidebar__nav-group">
            <span className="dashboard-sidebar__section-title">Account</span>
            <nav className="dashboard-sidebar__nav">
              <button
                type="button"
                className={`dashboard-sidebar__item ${activeTab === "profile" ? "dashboard-sidebar__item--active" : ""}`}
                onClick={() =>
                  handleNavClick({ id: "profile", path: "/profile" })
                }
              >
                <User size={18} className="dashboard-sidebar__item-icon" />
                <span className="dashboard-sidebar__item-label">Profile</span>
              </button>

              <button
                type="button"
                className={`dashboard-sidebar__item ${activeTab === "settings" ? "dashboard-sidebar__item--active" : ""}`}
                onClick={() =>
                  handleNavClick({ id: "settings", path: "/settings" })
                }
              >
                <Settings size={18} className="dashboard-sidebar__item-icon" />
                <span className="dashboard-sidebar__item-label">Settings</span>
              </button>

              <button
                type="button"
                className="dashboard-sidebar__item dashboard-sidebar__item--logout"
                onClick={handleLogout}
              >
                <LogOut size={18} className="dashboard-sidebar__item-icon" />
                <span className="dashboard-sidebar__item-label">Logout</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Campus Context Footer */}
        <div className="dashboard-sidebar__campus-card">
          <div className="dashboard-sidebar__campus-icon">
            <MapPin size={16} />
          </div>
          <div className="dashboard-sidebar__campus-info">
            <span className="dashboard-sidebar__campus-name" title={campusName}>
              {campusName}
            </span>
            {departmentName && (
              <span
                className="dashboard-sidebar__campus-dept"
                title={departmentName}
              >
                {departmentName}
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
