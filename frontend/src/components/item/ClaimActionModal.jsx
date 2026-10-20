import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, X, CheckCircle2, AlertCircle, Info, GitCompare, Loader2, ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { submitClaim, submitDirectClaim } from '../../api/claims.js'
import './ClaimActionModal.css'

export default function ClaimActionModal({
  item,
  match,
  matchId: propMatchId,
  isOpen,
  onClose,
  onClaimSuccess,
}) {
  const { user, token } = useAuth()
  const navigate = useNavigate()

  const [verificationDetails, setVerificationDetails] = useState('')
  const [additionalMessage, setAdditionalMessage] = useState('')
  const [requestOtp, setRequestOtp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittedClaim, setSubmittedClaim] = useState(null)
  const [error, setError] = useState('')

  if (!isOpen) return null

  // Resolve match ID and item references
  const effectiveMatchId = match?.id || propMatchId
  const isFound = (item?.type || '').toUpperCase() === 'FOUND' || Boolean(item?.found_date && !item?.lost_date)
  const isLost = (item?.type || '').toUpperCase() === 'LOST' || Boolean(item?.lost_date && !item?.found_date)
  const foundItem = match?.found_item || (isFound ? item : null)
  const lostItem = match?.lost_item || (isLost ? item : null)
  const effectiveFoundItemId = isFound ? item?.id : (match?.found_item?.id || null)

  const foundTitle = foundItem?.title || 'Found Item'
  const lostTitle = lostItem?.title || 'Reported Lost Item'

  async function handleSubmitClaim(e) {
    e.preventDefault()
    const trimmedProof = verificationDetails.trim()
    if (!trimmedProof) {
      setError('Please provide specific identifying proof or verification details.')
      return
    }
    if (trimmedProof.length < 10) {
      setError('Verification details must be at least 10 characters long.')
      return
    }

    // Safety guard: Ensure a direct claim is never submitted for a lost item ID
    if (!effectiveMatchId && isLost) {
      setError('Ownership claims can only be submitted for found items, not lost reports.')
      return
    }

    if (!effectiveMatchId && !effectiveFoundItemId) {
      setError('A valid found item or match pairing is required to submit an ownership claim.')
      return
    }

    // Prevent finder from claiming own found item
    if (!effectiveMatchId && isFound && foundItem?.user_id && user?.id && foundItem.user_id === user.id) {
      setError('You cannot claim an item you reported as found yourself.')
      return
    }

    // Prevent claiming unavailable/closed found items
    if (!effectiveMatchId && isFound && foundItem?.status && !['AVAILABLE', 'ACTIVE'].includes(foundItem.status.toUpperCase())) {
      setError('This found item is no longer available for claiming.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const payload = {
        verification_details: trimmedProof,
        additional_message: additionalMessage.trim() || undefined,
        preferred_handover_method: requestOtp ? 'OTP' : 'DIRECT',
      }
      let newClaim
      if (effectiveMatchId) {
        newClaim = await submitClaim(effectiveMatchId, payload, token)
      } else {
        newClaim = await submitDirectClaim(effectiveFoundItemId, payload, token)
      }
      setSubmittedClaim(newClaim)
      if (onClaimSuccess) {
        onClaimSuccess(newClaim)
      }
    } catch (err) {
      setError(err.message || 'Failed to submit ownership claim. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setSubmittedClaim(null)
    setVerificationDetails('')
    setAdditionalMessage('')
    setError('')
    onClose()
  }

  return (
    <div
      className="claim-modal-backdrop"
      onClick={handleReset}
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-modal-title"
    >
      <div className="claim-modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="claim-modal-header">
          <div>
            <h2 id="claim-modal-title" className="claim-modal-title">
              <ShieldCheck size={20} className="claim-modal-title-icon" />
              <span>Claim Found Item</span>
            </h2>
            <p className="claim-modal-subtitle">
              Verify ownership for &ldquo;{foundTitle}&rdquo;
            </p>
          </div>
          <button
            type="button"
            className="claim-modal-close"
            onClick={handleReset}
            disabled={submitting}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </header>

        {submittedClaim ? (
          <div className="claim-modal-success">
            <div className="claim-modal-success-icon">
              <CheckCircle2 size={44} />
            </div>
            <h3 className="claim-modal-success-title">Claim Submitted Successfully!</h3>
            <p className="claim-modal-success-text">
              Your claim for <strong>{foundTitle}</strong> has been logged (Claim #{submittedClaim.id}) with status{' '}
              <span className="badge badge-warning" style={{ fontWeight: 600 }}>PENDING</span>.
              The finder has been notified to review your evidence and confirm return.
            </p>

            <div className="claim-modal-explainer" style={{ width: '100%', marginBottom: '20px' }}>
              <Info size={18} className="claim-modal-explainer-icon" />
              <div>
                <strong>Next Steps</strong>
                <p>
                  You can monitor this claim or cancel it while it remains Pending under your Claims Hub.
                </p>
              </div>
            </div>

            <div className="claim-modal-success-buttons">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleReset}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  handleReset()
                  navigate('/claims')
                }}
              >
                <span>View My Claims</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitClaim} className="claim-modal-body">
            {match && (
              <div className="claim-modal-match-banner">
                <GitCompare size={16} />
                <span>
                  Correlated Match: <strong>{lostTitle}</strong> ↔ <strong>{foundTitle}</strong> ({match.score}% match)
                </span>
              </div>
            )}

            <div className="claim-modal-explainer">
              <ShieldCheck size={20} className="claim-modal-explainer-icon" />
              <div>
                <strong>Private Ownership Verification</strong>
                <p>
                  To protect campus belongings and prevent false claims, provide details only the rightful owner would know (e.g., serial number, hidden marks, wallpaper, lock code hint, distinctive scratches, keychain tag).
                </p>
              </div>
            </div>

            {error && (
              <div className="claim-modal-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="claim-verification-details">
                Verification Details &amp; Identifying Proof *
              </label>
              <textarea
                id="claim-verification-details"
                rows={4}
                className="form-textarea"
                placeholder="Example: The wallet has a student ID card for John Doe and an expired blue bus pass inside the left sleeve. Small nick on the bottom-right leather seam."
                value={verificationDetails}
                onChange={(e) => setVerificationDetails(e.target.value)}
                maxLength={1000}
                required
                disabled={submitting}
              />
              <div className={`claim-char-count ${verificationDetails.trim().length >= 10 ? 'claim-char-count--valid' : ''}`}>
                {verificationDetails.length}/1000 (min. 10 chars)
              </div>
            </div>

            <div className="form-group" style={{ margin: '14px 0' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '10px 12px', borderRadius: '8px', background: 'rgba(69, 214, 224, 0.05)', border: '1px solid rgba(69, 214, 224, 0.2)' }}>
                <input
                  type="checkbox"
                  checked={requestOtp}
                  onChange={(e) => setRequestOtp(e.target.checked)}
                  disabled={submitting}
                  style={{ marginTop: '3px', cursor: 'pointer' }}
                />
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Request 6-digit OTP Handover Verification
                  </span>
                  <p style={{ margin: '3px 0 0 0', fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Recommended for high-value or sensitive items. A single-use 6-digit code will be required during in-person physical exchange.
                  </p>
                </div>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="claim-additional-message">
                Additional Note to Finder <span style={{ color: '#64748b' }}>(Optional)</span>
              </label>
              <textarea
                id="claim-additional-message"
                rows={2}
                className="form-textarea"
                placeholder="E.g., I am available near Central Library between 2 PM and 5 PM on weekdays for handover."
                value={additionalMessage}
                onChange={(e) => setAdditionalMessage(e.target.value)}
                maxLength={1000}
                disabled={submitting}
              />
            </div>

            <footer className="claim-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleReset}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || verificationDetails.trim().length < 10 || (!effectiveMatchId && isLost)}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Submitting Claim...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Submit Claim Request</span>
                  </>
                )}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  )
}
