import { Sparkles, Check, ArrowRight, MapPin, Clock, ShieldCheck } from 'lucide-react'
import './MatchCenter.css'

export default function MatchCenter({ match, onReviewMatch }) {
  if (!match) {
    return (
      <section className="match-center-section" aria-label="Possible Matches">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">Algorithmic Correlation</span>
            <h3 className="section-title">Possible Matches</h3>
          </div>
        </div>

        <div className="empty-state-card">
          <div className="empty-state-card__icon">✨</div>
          <h4 className="empty-state-card__title">No Matches</h4>
          <p className="empty-state-card__desc">
            No possible matches yet. Tracelt is keeping an eye out.
          </p>
        </div>
      </section>
    )
  }

  const { userReport, matchedItem, score, reasons } = match

  return (
    <section className="match-center-section" aria-label="Possible Matches">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">Smart Match Engine</span>
          <h3 className="section-title">Possible Matches</h3>
          <p className="section-subtitle">
            High-confidence correlation detected between your report and campus finds.
          </p>
        </div>
      </div>

      <div className="match-card">
        {/* Match Score Badge */}
        <div className="match-card__score-header">
          <div className="match-score-badge">
            <Sparkles size={15} className="match-score-badge__icon" />
            <span className="match-score-badge__value">{score}% MATCH</span>
          </div>
          <span className="match-score-badge__caption">
            Spatial &amp; descriptive criteria verified
          </span>
        </div>

        {/* Visual Side-by-Side Comparison */}
        <div className="match-comparison-grid">
          {/* Left: Your Report */}
          <div className="comparison-side comparison-side--user">
            <span className="comparison-side__label">YOUR LOST ITEM</span>
            <div className="comparison-side__content">
              <div className="comparison-side__icon-box">
                <span className="comparison-side__emoji">{userReport.icon}</span>
              </div>
              <div className="comparison-side__text">
                <h4 className="comparison-side__title">{userReport.title}</h4>
                <div className="comparison-side__meta">
                  <MapPin size={12} className="meta-icon" />
                  <span>{userReport.location}</span>
                </div>
                <div className="comparison-side__meta">
                  <Clock size={12} className="meta-icon" />
                  <span>{userReport.time}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Connector Indicator */}
          <div className="match-connector">
            <div className="match-connector__line" />
            <div className="match-connector__node">
              <ArrowRight size={16} />
            </div>
            <div className="match-connector__line" />
          </div>

          {/* Right: Possible Match */}
          <div className="comparison-side comparison-side--found">
            <span className="comparison-side__label comparison-side__label--cyan">
              POSSIBLE FOUND ITEM
            </span>
            <div className="comparison-side__content">
              <div className="comparison-side__icon-box comparison-side__icon-box--cyan">
                <span className="comparison-side__emoji">{matchedItem.icon}</span>
              </div>
              <div className="comparison-side__text">
                <h4 className="comparison-side__title">{matchedItem.title}</h4>
                <div className="comparison-side__meta">
                  <MapPin size={12} className="meta-icon meta-icon--cyan" />
                  <span>{matchedItem.location}</span>
                </div>
                <div className="comparison-side__meta">
                  <Clock size={12} className="meta-icon" />
                  <span>{matchedItem.time}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Matching Reasons Checklist */}
        <div className="match-reasons">
          <span className="match-reasons__heading">Matching Criteria:</span>
          <ul className="match-reasons__list">
            {reasons.map((reason, idx) => (
              <li key={idx} className="match-reasons__item">
                <div className="match-reasons__check">
                  <Check size={12} strokeWidth={3} />
                </div>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA Footer */}
        <div className="match-card__footer">
          <div className="match-card__security-note">
            <ShieldCheck size={14} className="security-icon" />
            <span>Campus identity verification required prior to recovery handover</span>
          </div>

          <button
            type="button"
            className="btn btn-primary match-card__review-btn"
            onClick={() => onReviewMatch && onReviewMatch(match)}
          >
            <span>Review Match</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </section>
  )
}
