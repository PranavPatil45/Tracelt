import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  fetchReviewerCaseDetail,
  startReviewOnCase,
  decideReviewerCase,
  returnReviewerCase,
} from '../../api/reviewer.js'
import {
  ArrowLeft,
  FileCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  RotateCcw,
  User,
  MapPin,
  Calendar,
  Lock,
  Layers,
  History,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react'
import './ReviewerPages.css'

export default function ReviewerCaseDetail() {
  const { caseType, caseId } = useParams()
  const { token, user: currentUser } = useAuth()
  const navigate = useNavigate()

  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modals & Actions
  const [activeModal, setActiveModal] = useState(null) // 'APPROVE' | 'REJECT' | 'RESOLVE_DISPUTE' | 'RETURN'
  const [modalAction, setModalAction] = useState('')
  const [rationale, setRationale] = useState('')
  const [handoverOverride, setHandoverOverride] = useState('')
  const [actionError, setActionError] = useState('')
  const [processing, setProcessing] = useState(false)

  const loadCase = useCallback(async () => {
    if (!token || !caseType || !caseId) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchReviewerCaseDetail(token, caseType, caseId)
      setCaseData(data)
      setHandoverOverride(data.handover_method || 'DIRECT')
    } catch (err) {
      console.error('Failed to load case detail:', err)
      setError(err.message || 'Failed to load case review details.')
    } finally {
      setLoading(false)
    }
  }, [token, caseType, caseId])

  useEffect(() => {
    loadCase()
  }, [loadCase])

  // Handlers
  async function handleStartReview() {
    setProcessing(true)
    setActionError('')
    try {
      await startReviewOnCase(token, caseType, caseId)
      await loadCase()
    } catch (err) {
      setActionError(err.message || 'Failed to start review.')
    } finally {
      setProcessing(false)
    }
  }

  function openDecisionModal(action) {
    setActiveModal('DECIDE')
    setModalAction(action)
    setRationale('')
    setActionError('')
  }

  function openDisputeModal(decision) {
    setActiveModal('DISPUTE')
    setModalAction(decision)
    setRationale('')
    setActionError('')
  }

  function openReturnModal() {
    setActiveModal('RETURN')
    setRationale('')
    setActionError('')
  }

  async function handleExecuteDecision() {
    if (!rationale.trim() || rationale.trim().length < 3) {
      setActionError('A substantive rationale (minimum 3 characters) is required.')
      return
    }

    setProcessing(true)
    setActionError('')
    try {
      await decideReviewerCase(token, caseType, caseId, {
        action: modalAction,
        rationale: rationale.trim(),
        handover_method: handoverOverride || undefined,
      })
      setActiveModal(null)
      await loadCase()
    } catch (err) {
      setActionError(err.message || `Failed to ${modalAction.toLowerCase()} case.`)
    } finally {
      setProcessing(false)
    }
  }

  async function handleExecuteReturn() {
    if (!rationale.trim() || rationale.trim().length < 5) {
      setActionError('A detailed reason for returning the case (minimum 5 characters) is required.')
      return
    }

    setProcessing(true)
    setActionError('')
    try {
      await returnReviewerCase(token, caseType, caseId, {
        reason: rationale.trim(),
      })
      setActiveModal(null)
      navigate('/reviewer/cases')
    } catch (err) {
      setActionError(err.message || 'Failed to return case.')
    } finally {
      setProcessing(false)
    }
  }

  if (loading && !caseData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--cyan)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading Case Review Workspace&hellip;</p>
      </div>
    )
  }

  if (error || !caseData) {
    return (
      <div className="reviewer-container">
        <div style={{ padding: '2rem', background: 'var(--bg-surface)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', textAlign: 'center' }}>
          <AlertCircle size={40} style={{ color: 'var(--red)', margin: '0 auto 1rem' }} />
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Unable to Access Case</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error || 'Case not found or access restricted.'}</p>
          <Link to="/reviewer/cases" className="reviewer-filter-btn reviewer-filter-btn--active" style={{ textDecoration: 'none' }}>
            Back to Assigned Cases
          </Link>
        </div>
      </div>
    )
  }

  const isClaim = caseData.case_type === 'CLAIM'
  const isPending = caseData.status === 'PENDING'
  const isUnderReview = caseData.status === 'UNDER_REVIEW'
  const isDisputed = caseData.review_status === 'DISPUTED'
  const isFinalized = ['APPROVED', 'REJECTED', 'CANCELLED'].includes(caseData.status)
  const hasCompeting = caseData.competing_claims && caseData.competing_claims.length > 0

  return (
    <div className="reviewer-container">
      {/* Navigation & Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link
          to="/reviewer/cases"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: '0.85rem',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Cases</span>
        </Link>
      </div>

      <div className="reviewer-header-bar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: '700',
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                background: isClaim ? 'rgba(0, 242, 254, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                color: isClaim ? 'var(--cyan)' : '#a855f7',
              }}
            >
              {caseData.case_type} #{caseData.case_id}
            </span>

            <span className={`badge-status badge-status--${(caseData.status || '').toLowerCase()}`}>
              Status: {caseData.status}
            </span>

            {caseData.review_status && caseData.review_status !== 'NOT_REQUIRED' && (
              <span className={`badge-status badge-status--${(caseData.review_status || '').toLowerCase()}`}>
                Review: {caseData.review_status}
              </span>
            )}

            <span className={caseData.handover_method === 'OTP' ? 'badge-otp' : 'badge-status'}>
              Handover: {caseData.handover_method}
            </span>
          </div>

          <h1>{caseData.found_item?.title || caseData.lost_item?.title || 'Case Review Workspace'}</h1>
          <p>
            Reviewer Investigation Workspace • Created: {new Date(caseData.assigned_at || Date.now()).toLocaleString()}
          </p>
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div style={{ width: '100%', padding: '0.85rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: 'var(--red)', fontSize: '0.88rem' }}>
            {actionError}
          </div>
        )}
      </div>

      {/* Competing Claims Alert */}
      {hasCompeting && (
        <div className="reviewer-urgent-banner">
          <div className="reviewer-urgent-banner__left">
            <span className="reviewer-urgent-banner__badge">COMPETING CLAIMS</span>
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
            <div>
              <span style={{ fontWeight: '600', display: 'block' }}>
                {caseData.competing_claims.length} Other Active Claim{caseData.competing_claims.length > 1 ? 's' : ''} Exist for this Item
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Multiple claimants are asserting ownership. Careful evidence comparison is required before approval.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Alert Banner */}
      {isDisputed && (
        <div className="reviewer-urgent-banner" style={{ background: 'rgba(168, 85, 247, 0.1)', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
          <div className="reviewer-urgent-banner__left">
            <span className="reviewer-urgent-banner__badge" style={{ background: '#a855f7' }}>DISPUTE RAISED</span>
            <ShieldAlert size={18} style={{ color: '#a855f7' }} />
            <div>
              <span style={{ fontWeight: '600', display: 'block' }}>
                Recovery Dispute Raised by {caseData.disputed_by_name || 'Participant'}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Reason: {caseData.dispute_reason || 'Disputed physical condition or identity of item.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="reviewer-detail-grid">
        {/* Left Column: Evidence & Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Ownership Verification Evidence */}
          <div className="reviewer-card">
            <h2 className="reviewer-card__title">
              <Lock size={18} style={{ color: 'var(--cyan)' }} />
              <span>Claimant Ownership Proof & Private Details</span>
            </h2>

            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                VERIFICATION DETAILS SUBMITTED BY CLAIMANT
              </span>
              <div className="evidence-box">
                {caseData.verification_details || 'No additional private verification details provided.'}
              </div>
            </div>

            {caseData.additional_message && (
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  ADDITIONAL MESSAGE TO REVIEWER
                </span>
                <div style={{ background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  {caseData.additional_message}
                </div>
              </div>
            )}
          </div>

          {/* Items Comparison */}
          <div className="reviewer-card">
            <h2 className="reviewer-card__title">
              <Layers size={18} style={{ color: 'var(--cyan)' }} />
              <span>Item Inspection & Participant Records</span>
            </h2>

            <div className="reviewer-items-comparison">
              {/* Found Item Card */}
              {caseData.found_item && (
                <div className="item-mini-card">
                  <span className="item-mini-card__label" style={{ color: 'var(--cyan)' }}>
                    Reported Found Item #{caseData.found_item.id}
                  </span>
                  {caseData.found_item.image_url && (
                    <img
                      src={caseData.found_item.image_url}
                      alt={caseData.found_item.title}
                      style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px' }}
                    />
                  )}
                  <h4 style={{ color: 'var(--text-primary)', margin: 0 }}>{caseData.found_item.title}</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {caseData.found_item.description}
                  </p>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <MapPin size={12} /> {caseData.found_item.location} ({caseData.found_item.campus})
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={12} /> {caseData.found_item.found_date} {caseData.found_item.found_time}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <User size={12} /> Finder: {caseData.finder?.full_name || 'N/A'} ({caseData.finder?.email})
                    </span>
                  </div>
                </div>
              )}

              {/* Lost Item Card */}
              {caseData.lost_item ? (
                <div className="item-mini-card">
                  <span className="item-mini-card__label" style={{ color: '#f59e0b' }}>
                    Reported Lost Item #{caseData.lost_item.id}
                  </span>
                  {caseData.lost_item.image_url && (
                    <img
                      src={caseData.lost_item.image_url}
                      alt={caseData.lost_item.title}
                      style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px' }}
                    />
                  )}
                  <h4 style={{ color: 'var(--text-primary)', margin: 0 }}>{caseData.lost_item.title}</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {caseData.lost_item.description}
                  </p>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <MapPin size={12} /> {caseData.lost_item.location} ({caseData.lost_item.campus})
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={12} /> {caseData.lost_item.lost_date} {caseData.lost_item.lost_time}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <User size={12} /> Claimant: {caseData.claimant?.full_name} ({caseData.claimant?.email})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="item-mini-card">
                  <span className="item-mini-card__label" style={{ color: 'var(--cyan)' }}>
                    Direct Found Item Claim
                  </span>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    This claim was submitted directly on the found item report without a pre-existing lost item match.
                  </p>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <User size={12} /> Claimant: {caseData.claimant?.full_name} ({caseData.claimant?.email})
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Competing Claims List */}
          {hasCompeting && (
            <div className="reviewer-card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)' }}>
              <h2 className="reviewer-card__title">
                <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                <span>Competing Claims on this Found Item</span>
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {caseData.competing_claims.map((comp) => (
                  <div
                    key={comp.id}
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-hair)',
                      borderRadius: '8px',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                        Claim #{comp.id} by {comp.claimant_name} ({comp.claimant_email})
                      </span>
                      <span className={`badge-status badge-status--${comp.status.toLowerCase()}`}>
                        {comp.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                      Proof snippet: "{comp.verification_details_snippet}&hellip;"
                    </p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Submitted: {new Date(comp.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Actions & Meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Review Actions Panel */}
          <div className="reviewer-card">
            <h2 className="reviewer-card__title">
              <FileCheck size={18} style={{ color: 'var(--cyan)' }} />
              <span>Reviewer Decision</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {isPending && (
                <button
                  onClick={handleStartReview}
                  disabled={processing}
                  className="reviewer-filter-btn"
                  style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    borderColor: '#3b82f6',
                    color: '#3b82f6',
                    padding: '0.75rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Eye size={16} />
                  <span>Start Official Review</span>
                </button>
              )}

              {(!isFinalized || isDisputed) && (
                <>
                  {isClaim ? (
                    <>
                      <button
                        onClick={() => openDecisionModal('APPROVE')}
                        disabled={processing}
                        className="reviewer-filter-btn"
                        style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          borderColor: '#10b981',
                          color: '#10b981',
                          padding: '0.75rem',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <CheckCircle2 size={16} />
                        <span>Approve Claim & Authorize Recovery</span>
                      </button>

                      <button
                        onClick={() => openDecisionModal('REJECT')}
                        disabled={processing}
                        className="reviewer-filter-btn"
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          borderColor: '#ef4444',
                          color: '#ef4444',
                          padding: '0.75rem',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <XCircle size={16} />
                        <span>Reject Claim</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => openDisputeModal('APPROVE')}
                        disabled={processing}
                        className="reviewer-filter-btn"
                        style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          borderColor: '#10b981',
                          color: '#10b981',
                          padding: '0.75rem',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <CheckCircle2 size={16} />
                        <span>Resolve Dispute (Authorize Handover)</span>
                      </button>

                      <button
                        onClick={() => openDisputeModal('REJECT')}
                        disabled={processing}
                        className="reviewer-filter-btn"
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          borderColor: '#ef4444',
                          color: '#ef4444',
                          padding: '0.75rem',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <XCircle size={16} />
                        <span>Reject & Cancel Recovery</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={openReturnModal}
                    disabled={processing}
                    className="reviewer-filter-btn"
                    style={{
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      padding: '0.6rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <RotateCcw size={14} />
                    <span>Return Case for Reassignment</span>
                  </button>
                </>
              )}

              {isFinalized && !isDisputed && (
                <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                  <span style={{ fontWeight: '600', color: caseData.status === 'APPROVED' ? '#10b981' : '#ef4444', display: 'block' }}>
                    Case Finalized ({caseData.status})
                  </span>
                  {caseData.review_decision_notes && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      Notes: {caseData.review_decision_notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Handover & Security Info */}
          <div className="reviewer-card">
            <h2 className="reviewer-card__title">
              <Lock size={18} style={{ color: 'var(--cyan)' }} />
              <span>Handover Security</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Verification Mode:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{caseData.handover_method}</strong>
              </div>

              {caseData.handover_method === 'OTP' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Active Code:</span>
                    <strong style={{ color: caseData.has_active_otp ? '#10b981' : 'var(--text-secondary)' }}>
                      {caseData.has_active_otp ? 'Active (Ready for Finder verification)' : 'Not Generated Yet'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Attempts Left:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{caseData.otp_attempts_left} of 5</strong>
                  </div>

                  {caseData.otp_verified_at && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Verified At:</span>
                      <strong style={{ color: '#10b981' }}>{new Date(caseData.otp_verified_at).toLocaleTimeString()}</strong>
                    </div>
                  )}

                  <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Plaintext codes are strictly protected and never displayed in reviewer portals.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Assignment History */}
          <div className="reviewer-card">
            <h2 className="reviewer-card__title">
              <History size={18} style={{ color: 'var(--cyan)' }} />
              <span>Assignment Audit Trail</span>
            </h2>

            {caseData.history && caseData.history.length > 0 ? (
              <div className="history-timeline">
                {caseData.history.map((h) => (
                  <div key={h.id} className="history-entry">
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {h.action}: {h.reviewer_name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      By {h.assigned_by_name || 'System'} • {new Date(h.created_at).toLocaleString()}
                    </span>
                    {h.notes && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        "{h.notes}"
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No assignment events recorded.</span>
            )}
          </div>
        </div>
      </div>

      {/* Decision / Return Modals */}
      {activeModal && (
        <div className="reviewer-modal-overlay">
          <div className="reviewer-modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem' }}>
                {activeModal === 'RETURN'
                  ? 'Return Case for Reassignment'
                  : `${modalAction} Case #${caseData.case_id}`}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {actionError && (
              <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: 'var(--red)', fontSize: '0.85rem' }}>
                {actionError}
              </div>
            )}

            {activeModal === 'DECIDE' && modalAction === 'APPROVE' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Handover Verification Mode:</label>
                <select
                  value={handoverOverride}
                  onChange={(e) => setHandoverOverride(e.target.value)}
                  className="reviewer-search-input"
                  style={{ width: '100%' }}
                >
                  <option value="DIRECT">DIRECT Handover</option>
                  <option value="OTP">OTP Secure Handover</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Approval authorizes recovery tracking and does NOT mark item handed over or recovered.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {activeModal === 'RETURN' ? 'Reason for Reassignment (Mandatory):' : 'Reviewer Rationale & Notes (Mandatory):'}
              </label>
              <textarea
                rows={4}
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder={
                  activeModal === 'RETURN'
                    ? 'State conflict of interest, unavailability, or reason for return...'
                    : 'Provide substantive review justification...'
                }
                className="reviewer-search-input"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setActiveModal(null)}
                className="reviewer-filter-btn"
                disabled={processing}
              >
                Cancel
              </button>

              <button
                onClick={activeModal === 'RETURN' ? handleExecuteReturn : handleExecuteDecision}
                disabled={processing}
                className="reviewer-filter-btn reviewer-filter-btn--active"
                style={{
                  background:
                    modalAction === 'REJECT' || activeModal === 'RETURN'
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(16, 185, 129, 0.2)',
                  borderColor:
                    modalAction === 'REJECT' || activeModal === 'RETURN'
                      ? '#ef4444'
                      : '#10b981',
                  color:
                    modalAction === 'REJECT' || activeModal === 'RETURN'
                      ? '#ef4444'
                      : '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {processing && <Loader2 size={14} className="animate-spin" />}
                <span>
                  {activeModal === 'RETURN'
                    ? 'Confirm Return'
                    : `Confirm ${modalAction}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
