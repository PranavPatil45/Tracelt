import { Radar, Sparkles, ArrowRight, MapPin, Clock, AlertCircle } from 'lucide-react'
import './ActiveTraces.css'

export default function ActiveTraces({
  traces = [],
  onViewMatch,
  onViewReport,
  onOpenReportModal,
}) {
  return (
    <section className="active-traces-section" aria-label="Active Traces">
      <div className="section-title-row">
        <div>
          <div className="section-title-row__badge">
            <span className="live-pulse-dot" />
            <span>Real-time Tracing</span>
          </div>
          <h3 className="section-title">Active Traces</h3>
          <p className="section-subtitle">
            Keep track of your ongoing lost-item reports.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-ghost section-action-btn"
          onClick={() => onOpenReportModal && onOpenReportModal('lost')}
        >
          + New Trace
        </button>
      </div>

      {traces.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-state-card__icon">🎒</div>
          <h4 className="empty-state-card__title">No active traces</h4>
          <p className="empty-state-card__desc">
            Report a lost item and Tracelt will start looking for possible matches across your campus.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onOpenReportModal && onOpenReportModal('lost')}
          >
            Report Lost Item
          </button>
        </div>
      ) : (
        <div className="active-traces-list">
          {traces.map((trace) => {
            const hasMatch = Boolean(trace.hasMatch && trace.match)

            return (
              <div
                key={trace.id}
                className={`trace-card ${hasMatch ? 'trace-card--has-match' : ''}`}
              >
                <div className="trace-card__main">
                  <div className="trace-card__icon-box">
                    <span className="trace-card__emoji">{trace.icon}</span>
                    <span className="trace-card__radar-ring" />
                  </div>

                  <div className="trace-card__content">
                    <div className="trace-card__header">
                      <h4 className="trace-card__title">{trace.title}</h4>
                      <span className="trace-card__category">{trace.category}</span>
                    </div>

                    <div className="trace-card__meta">
                      <span className="trace-meta-item">
                        <MapPin size={13} className="trace-meta-item__icon" />
                        <span>Lost at: <strong>{trace.lostLocation}</strong></span>
                      </span>

                      <span className="trace-meta-item">
                        <Clock size={13} className="trace-meta-item__icon" />
                        <span>Reported: {trace.reportedTime}</span>
                      </span>
                    </div>

                    <div className="trace-card__status-bar">
                      <span className="status-pill status-pill--searching">
                        <span className="radar-spinner" />
                        {trace.status}
                      </span>
                      <span className="trace-card__detail-text">{trace.statusDetail}</span>
                    </div>
                  </div>
                </div>

                {/* Match Detection Callout */}
                {hasMatch ? (
                  <div className="trace-match-banner">
                    <div className="trace-match-banner__info">
                      <div className="trace-match-banner__title">
                        <Sparkles size={14} className="sparkle-icon" />
                        <span>Possible match detected</span>
                        <span className="match-percent-tag">{trace.match.score}% match</span>
                      </div>
                      <p className="trace-match-banner__location">
                        Found at {trace.match.location} &bull; {trace.match.foundTime}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary trace-match-banner__btn"
                      onClick={() => onViewMatch && onViewMatch(trace.match)}
                    >
                      <span>View Match</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="trace-card__actions">
                    <button
                      type="button"
                      className="btn btn-secondary trace-card__view-btn"
                      onClick={() => onViewReport && onViewReport(trace)}
                    >
                      <span>View Report</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
