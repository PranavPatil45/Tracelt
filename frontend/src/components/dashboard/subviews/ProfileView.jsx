import { useState } from 'react'
import { User, Mail, MapPin, GraduationCap, ShieldCheck, Bell, Key, Save, Check } from 'lucide-react'
import './Subviews.css'

export default function ProfileView({ user }) {
  const [notifyMatches, setNotifyMatches] = useState(true)
  const [notifyMessages, setNotifyMessages] = useState(true)
  const [saved, setSaved] = useState(false)

  function handleSavePreferences(e) {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  return (
    <div className="subview-container">
      <div className="subview-header">
        <div>
          <h2 className="subview-title">Campus Profile &amp; Settings</h2>
          <p className="subview-subtitle">
            Manage your verified institutional identity and notification preferences.
          </p>
        </div>
      </div>

      <div className="profile-layout-grid">
        {/* Profile Card */}
        <div className="profile-main-card">
          <div className="profile-main-card__top">
            <div className="profile-avatar-large">{initials}</div>
            <div>
              <h3 className="profile-name">{user?.full_name || 'User'}</h3>
              <span className="profile-verified-badge">
                <ShieldCheck size={13} /> {user?.role ? `${user.role.toUpperCase()} Member` : 'Verified Campus Member'}
              </span>
            </div>
          </div>

          <div className="profile-details-list">
            <div className="profile-detail-row">
              <span className="detail-label">Institutional Email</span>
              <span className="detail-val">{user?.email || 'Not specified'}</span>
            </div>

            <div className="profile-detail-row">
              <span className="detail-label">Campus</span>
              <span className="detail-val">{user?.campus ? `📍 ${user.campus}` : 'Not specified'}</span>
            </div>

            <div className="profile-detail-row">
              <span className="detail-label">Department</span>
              <span className="detail-val">{user?.department || 'Not specified'}</span>
            </div>

            <div className="profile-detail-row">
              <span className="detail-label">Member Status</span>
              <span className="detail-val text-green">Active &bull; Verified via SSO/Password</span>
            </div>
          </div>
        </div>

        {/* Notification & Security Settings */}
        <div className="profile-settings-card">
          <h4 className="settings-title">Notification Preferences</h4>

          <form onSubmit={handleSavePreferences}>
            <div className="settings-toggle-row">
              <div>
                <label className="toggle-label">Match Alerts</label>
                <p className="toggle-desc">Instant notification when AI detects a potential match for your items.</p>
              </div>
              <input
                type="checkbox"
                checked={notifyMatches}
                onChange={(e) => setNotifyMatches(e.target.checked)}
                className="custom-toggle"
              />
            </div>

            <div className="settings-toggle-row">
              <div>
                <label className="toggle-label">Direct Custody Messages</label>
                <p className="toggle-desc">Receive alerts when campus desks message about your claims.</p>
              </div>
              <input
                type="checkbox"
                checked={notifyMessages}
                onChange={(e) => setNotifyMessages(e.target.checked)}
                className="custom-toggle"
              />
            </div>

            <button type="submit" className="btn btn-secondary btn-sm" style={{ marginTop: '16px' }}>
              {saved ? (
                <>
                  <Check size={14} /> Saved
                </>
              ) : (
                <>
                  <Save size={14} /> Save Preferences
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
