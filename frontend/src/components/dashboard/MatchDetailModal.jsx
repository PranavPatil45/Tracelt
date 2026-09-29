import { useState, useEffect } from 'react'
import { X, Sparkles, MapPin, Clock, ShieldCheck, Check, MessageSquare, ArrowRight } from 'lucide-react'
import './MatchDetailModal.css'

export default function MatchDetailModal({
  isOpen,
  match,
  onClose,
  onConfirmRecovery,
  onOpenMessage,
}) {
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    setConfirmed(false)
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !match) return null

  const { userReport, matchedItem, score, reasons } = match

  function handleClaim() {
    setConfirmed(true)
    if (onConfirmRecovery) {
      onConfirmRecovery(match)
    }
  }

  return (
    <div className="match-modal-backdrop" onClick={onClose}>
      <div
        className="match-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-modal-title"
      >
        <div className="match-modal__header">
          <div className="match-modal__badge">
            <Sparkles size={15} />
            <span>High Confidence Match &bull; {score}%</span>
          </div>

          <button
            type="button"
            className="match-modal__close-btn"
            onClick={onClose}
            aria-label="Close match review"
          >
            <X size={20} />
          </button>
        </div>

        <h3 id="match-modal-title" className="match-modal__title">
          Review Match Details
        </h3>
        <p className="match-modal__subtitle">
          Compare your report criteria with the found item logged on campus.
        </p>

        {confirmed ? (
          <div className="match-modal__confirmed-screen">
            <div className="confirmed-icon">
              <Check size={28} strokeWidth={3} />
            </div>
            <h4>Verification Request Sent!</h4>
            <p>
              The custody desk at <strong>{matchedItem.location}</strong> has been alerted. Please bring your institutional student ID card to claim your item.
            </p>
            <div className="pickup-pass">
              <span className="pickup-pass__label">CAMPUS CLAIM CODE</span>
              <span className="pickup-pass__code">TRC-8924-ENG</span>
            </div>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Side-by-side comparison */}
            <div className="match-modal__comparison">
              {/* User Report */}
              <div className="match-modal__col">
                <div className="col-header col-header--user">
                  <span>YOUR REPORT</span>
                </div>
                <div className="col-body">
                  <div className="item-title-row">
                    <span className="item-emoji">{userReport.icon}</span>
                    <h5 className="item-title">{userReport.title}</h5>
                  </div>
                  <div className="item-field">
                    <label>Reported Lost At</label>
                    <span>{userReport.location}</span>
                  </div>
                  <div className="item-field">
                    <label>Reported Time</label>
                    <span>{userReport.time}</span>
                  </div>
                  <div className="item-field">
                    <label>Description</label>
                    <p>{userReport.description}</p>
                  </div>
                  {userReport.tags && (
                    <div className="item-tags">
                      {userReport.tags.map((t) => (
                        <span key={t} className="item-tag">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Matched Found Item */}
              <div className="match-modal__col">
                <div className="col-header col-header--found">
                  <span>FOUND ITEM IN CUSTODY</span>
                </div>
                <div className="col-body">
                  <div className="item-title-row">
                    <span className="item-emoji">{matchedItem.icon}</span>
                    <h5 className="item-title">{matchedItem.title}</h5>
                  </div>
                  <div className="item-field">
                    <label>Found Location</label>
                    <span>{matchedItem.location}</span>
                  </div>
                  <div className="item-field">
                    <label>Logged At</label>
                    <span>{matchedItem.time}</span>
                  </div>
                  <div className="item-field">
                    <label>Custodian Notes</label>
                    <p>{matchedItem.description}</p>
                  </div>
                  <div className="item-field">
                    <label>Current Status</label>
                    <span className="status-highlight">{matchedItem.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Checklist reasons */}
            <div className="match-modal__reasons">
              <span className="reasons-heading">Algorithmic Correlation Points:</span>
              <div className="reasons-tags">
                {reasons.map((r, i) => (
                  <span key={i} className="reason-pill">
                    <Check size={11} className="check-icon" /> {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Verification Steps Note */}
            <div className="match-modal__notice">
              <ShieldCheck size={16} className="notice-icon" />
              <span>
                To prevent false claims, campus staff will verify your student ID and verify matching details during handover.
              </span>
            </div>

            {/* Action buttons */}
            <div className="match-modal__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onOpenMessage && onOpenMessage(matchedItem)}
              >
                <MessageSquare size={15} /> Message Custodian
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleClaim}
              >
                <span>Confirm This Is My Item</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
