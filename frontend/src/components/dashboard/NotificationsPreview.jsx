import { Target, MessageSquare, CheckCircle2, ArrowRight } from 'lucide-react'
import './NotificationsPreview.css'

export default function NotificationsPreview({
  notifications = [],
  onActionClick,
  onViewAll,
}) {
  function getIcon(type) {
    switch (type) {
      case 'match':
        return <Target size={16} className="notif-icon notif-icon--match" />
      case 'message':
        return <MessageSquare size={16} className="notif-icon notif-icon--msg" />
      case 'recovery':
        return <CheckCircle2 size={16} className="notif-icon notif-icon--rec" />
      default:
        return <Target size={16} className="notif-icon" />
    }
  }

  return (
    <section className="notifications-preview-section" aria-label="Notifications Preview">
      <div className="section-title-row">
        <div>
          <h3 className="section-title">Updates &amp; Alerts</h3>
          <p className="section-subtitle">Real-time status changes and campus responses.</p>
        </div>

        <button
          type="button"
          className="btn btn-ghost section-action-btn"
          onClick={onViewAll}
        >
          <span>All alerts</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-state-card__icon">🔔</div>
          <h4 className="empty-state-card__title">No Notifications</h4>
          <p className="empty-state-card__desc">You&rsquo;re all caught up.</p>
        </div>
      ) : (
        <div className="notifications-preview-list">
          {notifications.map((item) => (
            <div
              key={item.id}
              className={`notif-preview-item ${item.unread ? 'notif-preview-item--unread' : ''}`}
            >
              <div className="notif-preview-item__icon-wrap">
                {getIcon(item.type)}
              </div>

              <div className="notif-preview-item__content">
                <div className="notif-preview-item__title-row">
                  <h4 className="notif-preview-item__title">{item.title}</h4>
                  <span className="notif-preview-item__time">{item.time}</span>
                </div>
                <p className="notif-preview-item__desc">{item.description}</p>
              </div>

              <button
                type="button"
                className="notif-preview-item__action-btn"
                onClick={() => onActionClick && onActionClick(item)}
              >
                <span>{item.actionText}</span>
                <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
