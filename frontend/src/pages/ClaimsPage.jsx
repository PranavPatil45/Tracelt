import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Package,
  Calendar,
  MapPin,
  ArrowRight,
  User,
  MessageSquare,
  FileText,
  HelpCircle,
  X,
  Loader2,
  ChevronRight,
  Info,
  PackageCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import { getMyClaims, getIncomingClaims, reviewClaim, cancelClaim, disputeClaim } from '../api/claims.js'
import { createConversationForClaim } from '../api/messaging.js'
import { getClaimRecovery } from '../api/recovery.js'
import './ClaimsPage.css'

export default function ClaimsPage() {
  const { user, token, loading: authLoading, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('submitted') // 'submitted' (My Claims) | 'incoming' (To Review)
  const [statusFilter, setStatusFilter] = useState('all')

  const [claims, setClaims] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Tab Badge Counters
  const [submittedCount, setSubmittedCount] = useState(0)
  const [incomingPendingCount, setIncomingPendingCount] = useState(0)

  // Review Modal State (for Finder)
  const [reviewModalClaim, setReviewModalClaim] = useState(null)
  const [reviewAction, setReviewAction] = useState('APPROVE') // 'APPROVE' | 'REJECT' | 'UNDER_REVIEW' | 'REQUEST_REVIEW'
  const [handoverMethod, setHandoverMethod] = useState('DIRECT') // 'DIRECT' | 'OTP'
  const [requiresReviewer, setRequiresReviewer] = useState(false)
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')

  // Dispute Modal State
  const [disputeModalClaim, setDisputeModalClaim] = useState(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeSubmitting, setDisputeSubmitting] = useState(false)
  const [disputeError, setDisputeError] = useState('')

  // Cancel Modal State (for Claimant)
  const [cancelModalClaim, setCancelModalClaim] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  // Route protection
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [authLoading, isAuthenticated, navigate])

  // Fetch counts for badges
  const loadCounts = useCallback(async () => {
    if (!token) return
    try {
      const [subRes, incRes] = await Promise.allSettled([
        getMyClaims(undefined, token),
        getIncomingClaims('PENDING', token),
      ])
      if (subRes.status === 'fulfilled') {
        setSubmittedCount(subRes.value.total || 0)
      }
      if (incRes.status === 'fulfilled') {
        setIncomingPendingCount(incRes.value.total || 0)
      }
    } catch {
      // Non-blocking
    }
  }, [token])

  // Fetch claims list for active tab & filter
  const loadClaims = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const filterParam = statusFilter === 'all' ? undefined : statusFilter
      if (activeTab === 'submitted') {
        const result = await getMyClaims(filterParam, token)
        setClaims(result.claims || [])
        setTotal(result.total || 0)
      } else {
        const result = await getIncomingClaims(filterParam, token)
        setClaims(result.claims || [])
        setTotal(result.total || 0)
      }
    } catch (err) {
      setError(err.message || 'Failed to load claims.')
    } finally {
      setLoading(false)
    }
  }, [token, activeTab, statusFilter])

  useEffect(() => {
    if (isAuthenticated) {
      loadClaims()
      loadCounts()
    }
  }, [isAuthenticated, loadClaims, loadCounts])

  // Open or create conversation and navigate to Messages
  async function handleContact(claimId) {
    if (!token || !claimId) return
    try {
      const conv = await createConversationForClaim(claimId, token)
      navigate(`/messages?conversation_id=${conv.id}`)
    } catch (err) {
      alert(err.message || 'Failed to open conversation.')
    }
  }

  // Handle Submit Review (Finder)
  async function handleSubmitReview(e) {
    e.preventDefault()
    if (!reviewModalClaim) return

    setReviewSubmitting(true)
    setReviewError('')
    try {
      const isMandatory = reviewModalClaim.is_mandatory_review || reviewModalClaim.review_status === 'PENDING'
      const finalAction = (isMandatory || requiresReviewer) && reviewAction === 'APPROVE' ? 'REQUEST_REVIEW' : reviewAction

      const payload = {
        action: finalAction,
        reviewer_notes: reviewerNotes.trim() || undefined,
        requires_reviewer: requiresReviewer || isMandatory,
        handover_method: handoverMethod,
      }
      const updated = await reviewClaim(reviewModalClaim.id, payload, token)
      setClaims((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      )
      setReviewModalClaim(null)
      setReviewerNotes('')
      setRequiresReviewer(false)
      loadCounts()
    } catch (err) {
      setReviewError(err.message || 'Failed to submit review. Please try again.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  // Handle Dispute Claim
  async function handleConfirmDispute(e) {
    e.preventDefault()
    if (!disputeModalClaim || !disputeReason.trim()) return

    setDisputeSubmitting(true)
    setDisputeError('')
    try {
      const updated = await disputeClaim(disputeModalClaim.id, { reason: disputeReason.trim() }, token)
      setClaims((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      )
      setDisputeModalClaim(null)
      setDisputeReason('')
      loadCounts()
    } catch (err) {
      setDisputeError(err.message || 'Failed to submit dispute.')
    } finally {
      setDisputeSubmitting(false)
    }
  }

  // Handle Cancel Claim (Claimant)
  async function handleConfirmCancel() {
    if (!cancelModalClaim) return
    setCancelling(true)
    setCancelError('')
    try {
      const updated = await cancelClaim(cancelModalClaim.id, token)
      setClaims((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      )
      setCancelModalClaim(null)
      loadCounts()
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel claim.')
    } finally {
      setCancelling(false)
    }
  }

  if (authLoading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__spinner" />
        <p>Loading Tracelt&hellip;</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="dashboard-app">
      <Sidebar
        activeTab="claims"
        setActiveTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        user={user}
        logout={logout}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      <div className="dashboard-main-area">
        <DashboardHeader
          activeTabTitle="Claims &amp; Verification"
          user={user}
          logout={logout}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectTab={(tab) => navigate(tab === 'dashboard' ? '/dashboard' : `/${tab}`)}
        />

        <main className="dashboard-content claims-page-content">
          <div className="claims-page-wrapper">
            {/* Header Title and Context */}
            <div className="claims-header">
              <div>
                <div className="claims-pill">
                  <ShieldCheck size={13} />
                  <span>Verified Custody Chain</span>
                </div>
                <h1 className="claims-title">Claims &amp; Verification Hub</h1>
                <p className="claims-subtitle">
                  Verify ownership evidence, review incoming claims on found items, and track recovered property across campus.
                </p>
              </div>

              <div className="claims-header-stats">
                <div className="claims-stat-bubble">
                  <span className="claims-stat-bubble__num">{submittedCount}</span>
                  <span className="claims-stat-bubble__label">My Claims</span>
                </div>
                <div className="claims-stat-bubble">
                  <span className="claims-stat-bubble__num" style={{ color: incomingPendingCount > 0 ? '#facc15' : '#f8fafc' }}>
                    {incomingPendingCount}
                  </span>
                  <span className="claims-stat-bubble__label">Awaiting Review</span>
                </div>
              </div>
            </div>

            {/* Primary Navigation Tabs */}
            <div className="claims-main-tabs">
              <button
                type="button"
                className={`claims-main-tab-btn ${activeTab === 'submitted' ? 'claims-main-tab-btn--active' : ''}`}
                onClick={() => {
                  setActiveTab('submitted')
                  setStatusFilter('all')
                }}
              >
                <span>My Claims (Sent)</span>
                <span className="claims-tab-count-badge">{submittedCount}</span>
              </button>

              <button
                type="button"
                className={`claims-main-tab-btn ${activeTab === 'incoming' ? 'claims-main-tab-btn--active' : ''}`}
                onClick={() => {
                  setActiveTab('incoming')
                  setStatusFilter('all')
                }}
              >
                <span>Claims to Review (Incoming)</span>
                {incomingPendingCount > 0 && (
                  <span className="claims-tab-count-badge claims-tab-count-badge--alert">
                    {incomingPendingCount} action needed
                  </span>
                )}
              </button>
            </div>

            {/* Status Filter Bar */}
            <div className="claims-filters-bar">
              {['all', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`claims-filter-pill ${statusFilter === st ? 'claims-filter-pill--active' : ''}`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st === 'all' ? 'All Statuses' : st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Main Content Area */}
            {loading ? (
              <div className="claims-list">
                {[1, 2].map((n) => (
                  <div key={n} className="claim-skeleton" />
                ))}
              </div>
            ) : error ? (
              <div className="claims-empty-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <AlertCircle size={36} color="#f87171" />
                <h3 className="claims-empty-title">Unable to Load Claims</h3>
                <p className="claims-empty-desc">{error}</p>
                <button type="button" className="btn btn-secondary" onClick={loadClaims}>
                  Retry
                </button>
              </div>
            ) : claims.length === 0 ? (
              <div className="claims-empty-card">
                <div className="claims-empty-icon">
                  <ShieldCheck size={28} />
                </div>
                <h3 className="claims-empty-title">
                  {activeTab === 'submitted' ? 'No Claims Submitted Yet' : 'No Incoming Claims to Review'}
                </h3>
                <p className="claims-empty-desc">
                  {activeTab === 'submitted'
                    ? 'When you find a possible match for your lost item in the Match Center, click "This Might Be Mine" to submit a verification request.'
                    : 'When another user identifies an item you found and submits ownership proof, their claim will appear here for your review.'}
                </p>
                <div style={{ marginTop: '8px' }}>
                  <Link to="/matches" className="btn btn-primary">
                    Go to Match Center
                  </Link>
                </div>
              </div>
            ) : (
              <div className="claims-list">
                {claims.map((claim) => {
                  const isFinder = activeTab === 'incoming'
                  const isPending = claim.status === 'PENDING'
                  const isUnderReview = claim.status === 'UNDER_REVIEW'
                  const isApproved = claim.status === 'APPROVED'
                  const isRejected = claim.status === 'REJECTED'
                  const isCancelled = claim.status === 'CANCELLED'

                  return (
                    <article key={claim.id} className="claim-card">
                      {/* Card Header: Claim ID, Date, Status */}
                      <div className="claim-card__top">
                        <div className="claim-card__id-group">
                          <span className="claim-card__id">CLAIM #{claim.id}</span>
                          <span className="claim-card__date">
                            <Clock size={13} />
                            {new Date(claim.created_at).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>

                        <div className="claim-badge-wrap">
                          <span className={`claim-badge claim-badge--${claim.status.toLowerCase()}`}>
                            {isApproved && <CheckCircle2 size={13} />}
                            {isPending && <Clock size={13} />}
                            {isRejected && <XCircle size={13} />}
                            <span>{claim.status.replace('_', ' ')}</span>
                          </span>

                          {claim.review_status && claim.review_status !== 'NOT_REQUIRED' && (
                            <span
                              className={`claim-badge ${
                                claim.review_status === 'APPROVED'
                                  ? 'claim-badge--approved'
                                  : claim.review_status === 'DISPUTED'
                                  ? 'claim-badge--rejected'
                                  : 'claim-badge--under_review'
                              }`}
                              style={{ marginLeft: '6px' }}
                              title={claim.review_reason || 'Reviewer Intervention'}
                            >
                              <ShieldCheck size={13} />
                              <span>
                                {claim.review_status === 'PENDING'
                                  ? `Review: ${claim.review_reason || 'Pending'}`
                                  : claim.review_status === 'DISPUTED'
                                  ? 'Disputed'
                                  : 'Reviewer Approved'}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Paired Items Overview */}
                      <div className="claim-items-pair">
                        {/* Lost Item (Claimant's) or Direct Claim indicator */}
                        {claim.lost_item ? (
                          <Link
                            to={{
                              pathname: `/lost-items/${claim.lost_item.id}`,
                              search: '?from=claims',
                            }}
                            state={{ from: 'claims' }}
                            className="claim-item-node"
                            title="View Lost Item report"
                          >
                            {claim.lost_item.image_url ? (
                              <img
                                src={claim.lost_item.image_url}
                                alt={claim.lost_item.title}
                                className="claim-item-img"
                              />
                            ) : (
                              <div className="claim-item-placeholder">
                                <Package size={22} />
                              </div>
                            )}
                            <div className="claim-item-info">
                              <span className="claim-item-role-tag">
                                {isFinder ? "Claimant's Lost Report" : 'Your Lost Report'}
                              </span>
                              <h4 className="claim-item-title">{claim.lost_item.title}</h4>
                              <span className="claim-item-meta">
                                <MapPin size={11} />
                                {claim.lost_item.location}
                              </span>
                            </div>
                          </Link>
                        ) : (
                          <div className="claim-item-node" style={{ cursor: 'default' }}>
                            <div className="claim-item-placeholder">
                              <ShieldCheck size={22} />
                            </div>
                            <div className="claim-item-info">
                              <span className="claim-item-role-tag">
                                Direct Claim
                              </span>
                              <h4 className="claim-item-title">Discovered on Campus</h4>
                              <span className="claim-item-meta">
                                Direct Verification
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Middle Match Score */}
                        <div className="claim-items-connector">
                          <ArrowRight size={16} />
                          {claim.match_score !== undefined && claim.match_score !== null ? (
                            <span className="claim-match-score-badge">
                              {claim.match_score}% MATCH
                            </span>
                          ) : (
                            <span className="claim-match-score-badge" style={{ background: '#334155', color: '#94a3b8' }}>
                              DIRECT
                            </span>
                          )}
                        </div>

                        {/* Found Item (Finder's) */}
                        <Link
                          to={{
                            pathname: `/found-items/${claim.found_item?.id}`,
                            search: '?from=claims',
                          }}
                          state={{ from: 'claims' }}
                          className="claim-item-node"
                          title="View Found Item report"
                        >
                          {claim.found_item?.image_url ? (
                            <img
                              src={claim.found_item.image_url}
                              alt={claim.found_item.title}
                              className="claim-item-img"
                            />
                          ) : (
                            <div className="claim-item-placeholder">
                              <Package size={22} />
                            </div>
                          )}
                          <div className="claim-item-info">
                            <span className="claim-item-role-tag claim-item-role-tag--found">
                              {isFinder ? 'Your Found Report' : 'Target Found Report'}
                            </span>
                            <h4 className="claim-item-title">{claim.found_item?.title}</h4>
                            <span className="claim-item-meta">
                              <MapPin size={11} />
                              {claim.found_item?.location}
                            </span>
                          </div>
                        </Link>
                      </div>

                      {/* Verification Details Box */}
                      <div className="claim-evidence-box">
                        <div className="claim-evidence-header">
                          <FileText size={15} />
                          <span>Submitted Verification Evidence</span>
                        </div>
                        <p className="claim-evidence-text">{claim.verification_details}</p>
                        {claim.additional_message && (
                          <div className="claim-extra-message">
                            <strong>Note to Finder:</strong> {claim.additional_message}
                          </div>
                        )}
                      </div>

                      {/* Reviewer Notes Box (if reviewed) */}
                      {claim.reviewer_notes && (
                        <div
                          className={`claim-review-notes-box claim-review-notes-box--${claim.status.toLowerCase()}`}
                        >
                          <div className="claim-review-header">
                            <MessageSquare size={13} />
                            <span>Finder&rsquo;s Review Notes</span>
                          </div>
                          <div>{claim.reviewer_notes}</div>
                        </div>
                      )}

                      {/* Footer Actions & Metadata */}
                      <div className="claim-card__footer">
                        {isFinder ? (
                          <div className="claimant-profile-tag">
                            <User size={14} />
                            <span>
                              Claimed by <strong>{claim.claimant?.full_name || 'Student'}</strong> &bull; {claim.claimant?.campus || 'Campus'}
                            </span>
                          </div>
                        ) : (
                          <div className="claim-card__meta-status">
                            <Info size={14} />
                            <span>
                              {isPending && 'Awaiting finder review. You may cancel if needed.'}
                              {isUnderReview && 'Finder is currently verifying your details.'}
                              {isApproved && 'Claim approved! Physical handover in progress.'}
                              {isRejected && 'Verification was not accepted by the finder.'}
                              {isCancelled && 'You cancelled this claim.'}
                            </span>
                          </div>
                        )}

                        <div className="claim-actions-group">
                          {/* Contact Finder / Claimant Button */}
                          {(isPending || isUnderReview || isApproved) && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleContact(claim.id)}
                            >
                              <MessageSquare size={14} />
                              <span>{isFinder ? 'Contact Claimant' : 'Contact Finder'}</span>
                            </button>
                          )}

                          {/* Approved: View Recovery Lifecycle */}
                          {isApproved && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={async () => {
                                try {
                                  const rec = await getClaimRecovery(claim.id, token)
                                  if (rec?.id) {
                                    navigate(`/recovery/${rec.id}`)
                                    return
                                  }
                                } catch {
                                  // Fallback to history
                                }
                                navigate('/history')
                              }}
                            >
                              <PackageCheck size={14} />
                              <span>View Recovery</span>
                            </button>
                          )}

                          {/* Dispute Action (Claimant or Finder) */}
                          {(isPending || isUnderReview || isApproved) && claim.review_status !== 'DISPUTED' && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ color: '#f43f5e', borderColor: 'rgba(244,63,94,0.3)' }}
                              onClick={() => {
                                setDisputeModalClaim(claim)
                                setDisputeReason('')
                                setDisputeError('')
                              }}
                            >
                              <AlertCircle size={14} />
                              <span>Dispute</span>
                            </button>
                          )}

                          {/* Claimant Actions */}
                          {!isFinder && isPending && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setCancelModalClaim(claim)}
                            >
                              <XCircle size={14} />
                              <span>Cancel Claim</span>
                            </button>
                          )}

                          {/* Finder Actions */}
                          {isFinder && (isPending || isUnderReview) && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setReviewModalClaim(claim)
                                const isMandatory = claim.is_mandatory_review || claim.review_status === 'PENDING'
                                setReviewAction(isMandatory ? 'REQUEST_REVIEW' : 'APPROVE')
                                setRequiresReviewer(isMandatory)
                                setHandoverMethod(claim.is_mandatory_otp ? 'OTP' : (claim.handover_method || 'DIRECT'))
                                setReviewerNotes('')
                                setReviewError('')
                              }}
                            >
                              <ShieldCheck size={14} />
                              <span>Review Claim</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Review Claim Modal (Finder) */}
      {reviewModalClaim && (
        <div
          className="claim-modal-backdrop"
          onClick={() => setReviewModalClaim(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="claim-modal-card" onClick={(e) => e.stopPropagation()}>
            <header className="claim-modal-header">
              <div>
                <h2 className="claim-modal-title">
                  <ShieldCheck size={20} className="claim-modal-title-icon" />
                  <span>Review Ownership Claim</span>
                </h2>
                <p className="claim-modal-subtitle">
                  Claim #{reviewModalClaim.id} for &ldquo;{reviewModalClaim.found_item?.title}&rdquo;
                </p>
              </div>
              <button
                type="button"
                className="claim-modal-close"
                onClick={() => setReviewModalClaim(null)}
                disabled={reviewSubmitting}
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSubmitReview} className="claim-modal-body">
              {reviewError && (
                <div className="claim-modal-error">
                  <AlertCircle size={16} />
                  <span>{reviewError}</span>
                </div>
              )}

              {/* Mandatory Review Notice */}
              {(reviewModalClaim.is_mandatory_review || reviewModalClaim.review_status === 'PENDING') && (
                <div style={{ background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '12px 14px', borderRadius: '8px', color: '#eab308', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <ShieldCheck size={16} />
                    <span>Reviewer Intervention Required</span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    This item has been flagged for staff Reviewer authorization ({reviewModalClaim.review_reason || 'High Risk / Competing Claims'}). Routine direct approval is blocked. You may request staff assistance to review and authorize handover.
                  </p>
                </div>
              )}

              {/* Evidence Review Display */}
              <div className="claim-evidence-box">
                <div className="claim-evidence-header">
                  <FileText size={15} />
                  <span>Claimant&rsquo;s Stated Proof</span>
                </div>
                <p className="claim-evidence-text">{reviewModalClaim.verification_details}</p>
                {reviewModalClaim.additional_message && (
                  <div className="claim-extra-message">
                    <strong>Claimant Note:</strong> {reviewModalClaim.additional_message}
                  </div>
                )}
              </div>

              {/* Decision Choice */}
              <div className="form-group">
                <label className="form-label">Review Decision *</label>
                <div className="review-modal-choice-grid">
                  {!(reviewModalClaim.is_mandatory_review || reviewModalClaim.review_status === 'PENDING') && (
                    <button
                      type="button"
                      className={`review-choice-btn ${reviewAction === 'APPROVE' && !requiresReviewer ? 'review-choice-btn--approve-active' : ''}`}
                      onClick={() => {
                        setReviewAction('APPROVE')
                        setRequiresReviewer(false)
                      }}
                      disabled={reviewSubmitting}
                    >
                      <CheckCircle2 size={22} />
                      <span className="review-choice-title">Direct Approval</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className={`review-choice-btn ${requiresReviewer || reviewAction === 'REQUEST_REVIEW' ? 'review-choice-btn--review-active' : ''}`}
                    onClick={() => {
                      setReviewAction('REQUEST_REVIEW')
                      setRequiresReviewer(true)
                    }}
                    disabled={reviewSubmitting}
                  >
                    <ShieldCheck size={22} />
                    <span className="review-choice-title">Request Reviewer</span>
                  </button>

                  <button
                    type="button"
                    className={`review-choice-btn ${reviewAction === 'UNDER_REVIEW' && !requiresReviewer ? 'review-choice-btn--review-active' : ''}`}
                    onClick={() => {
                      setReviewAction('UNDER_REVIEW')
                      setRequiresReviewer(false)
                    }}
                    disabled={reviewSubmitting}
                  >
                    <Clock size={22} />
                    <span className="review-choice-title">Under Review</span>
                  </button>

                  <button
                    type="button"
                    className={`review-choice-btn ${reviewAction === 'REJECT' ? 'review-choice-btn--reject-active' : ''}`}
                    onClick={() => {
                      setReviewAction('REJECT')
                      setRequiresReviewer(false)
                    }}
                    disabled={reviewSubmitting}
                  >
                    <XCircle size={22} />
                    <span className="review-choice-title">Reject Claim</span>
                  </button>
                </div>
              </div>

              {/* Handover Verification Method Choice (when approving directly) */}
              {reviewAction === 'APPROVE' && !requiresReviewer && !(reviewModalClaim.is_mandatory_review || reviewModalClaim.review_status === 'PENDING') && (
                <div className="form-group" style={{ background: 'var(--bg-elevated-2)', padding: '12px 14px', borderRadius: '8px' }}>
                  <label className="form-label" style={{ marginBottom: '8px' }}>Handover Verification Method</label>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="handover_method"
                        value="DIRECT"
                        checked={handoverMethod === 'DIRECT' && !reviewModalClaim.is_mandatory_otp}
                        disabled={reviewModalClaim.is_mandatory_otp}
                        onChange={() => setHandoverMethod('DIRECT')}
                      />
                      <span>Direct Confirmation (In-person)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="handover_method"
                        value="OTP"
                        checked={handoverMethod === 'OTP' || reviewModalClaim.is_mandatory_otp}
                        onChange={() => setHandoverMethod('OTP')}
                      />
                      <span>OTP Verification (6-Digit Code)</span>
                    </label>
                  </div>
                  {reviewModalClaim.is_mandatory_otp && (
                    <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#eab308' }}>
                      * High-risk items require secure OTP verification.
                    </p>
                  )}
                </div>
              )}

              {/* Impact Notice */}
              <div className="review-modal-explanation">
                {reviewAction === 'APPROVE' && !requiresReviewer && (
                  <span>
                    <strong>Approval Impact:</strong> The found item will be marked as <strong>CLAIMED</strong> and physical handover coordination will begin ({handoverMethod === 'OTP' ? 'OTP Verification required' : 'Direct Confirmation'}).
                  </span>
                )}
                {(requiresReviewer || reviewAction === 'REQUEST_REVIEW') && (
                  <span>
                    <strong>Reviewer Assistance Impact:</strong> The claim will be forwarded to campus staff reviewers for mediation. You will be notified once reviewed.
                  </span>
                )}
                {reviewAction === 'UNDER_REVIEW' && !requiresReviewer && (
                  <span>
                    <strong>Under Review Impact:</strong> The claimant will be notified that you are cross-checking details. The item remains available.
                  </span>
                )}
                {reviewAction === 'REJECT' && (
                  <span>
                    <strong>Rejection Impact:</strong> The claim will be marked <strong>REJECTED</strong>. The items will remain available for future matches.
                  </span>
                )}
              </div>

              {/* Reviewer Notes Input */}
              <div className="form-group">
                <label className="form-label" htmlFor="reviewer-notes">
                  Notes / Feedback to Claimant {reviewAction === 'REJECT' ? '*' : '(Optional)'}
                </label>
                <textarea
                  id="reviewer-notes"
                  rows={3}
                  className="form-textarea"
                  placeholder={
                    reviewAction === 'APPROVE'
                      ? 'E.g., Proof verified! You can collect the item from the engineering building reception.'
                      : reviewAction === 'REJECT'
                      ? 'E.g., The lock screen wallpaper described does not match the actual item.'
                      : 'E.g., Checking serial number with campus administration desk...'
                  }
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  maxLength={1000}
                  disabled={reviewSubmitting}
                  required={reviewAction === 'REJECT'}
                />
              </div>

              <footer className="claim-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleContact(reviewModalClaim.id)}
                  disabled={reviewSubmitting}
                >
                  <MessageSquare size={14} />
                  <span>Message Claimant</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReviewModalClaim(null)}
                  disabled={reviewSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn ${reviewAction === 'REJECT' ? 'btn-danger' : 'btn-primary'}`}
                  disabled={reviewSubmitting || (reviewAction === 'REJECT' && !reviewerNotes.trim())}
                >
                  {reviewSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving Decision...</span>
                    </>
                  ) : (
                    <span>Confirm Decision</span>
                  )}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Dispute Claim Modal */}
      {disputeModalClaim && (
        <div
          className="claim-modal-backdrop"
          onClick={() => setDisputeModalClaim(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="claim-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <header className="claim-modal-header">
              <h2 className="claim-modal-title" style={{ color: '#f43f5e' }}>
                <AlertCircle size={20} className="claim-modal-title-icon" />
                <span>Raise Dispute on Claim #{disputeModalClaim.id}</span>
              </h2>
              <button
                type="button"
                className="claim-modal-close"
                onClick={() => setDisputeModalClaim(null)}
                disabled={disputeSubmitting}
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleConfirmDispute} className="claim-modal-body">
              {disputeError && (
                <div className="claim-modal-error">
                  <AlertCircle size={16} />
                  <span>{disputeError}</span>
                </div>
              )}

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Raising a dispute pauses all routine handover steps and refers the claim to a campus staff reviewer for investigation.
              </p>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label" htmlFor="dispute-reason">
                  Reason for Dispute *
                </label>
                <textarea
                  id="dispute-reason"
                  rows={4}
                  className="form-textarea"
                  placeholder="Explain why this claim or evidence is disputed (e.g. conflicting item serial number, suspected false claim, claimant did not show up, etc.)..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  maxLength={1000}
                  disabled={disputeSubmitting}
                  required
                />
              </div>

              <footer className="claim-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDisputeModalClaim(null)}
                  disabled={disputeSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={disputeSubmitting || !disputeReason.trim()}
                >
                  {disputeSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Submitting Dispute...</span>
                    </>
                  ) : (
                    <span>Submit Dispute</span>
                  )}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Claim Dialog (Claimant) */}
      {cancelModalClaim && (
        <div
          className="claim-modal-backdrop"
          onClick={() => setCancelModalClaim(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="claim-modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <header className="claim-modal-header">
              <h2 className="claim-modal-title">Cancel Claim #{cancelModalClaim.id}?</h2>
              <button
                type="button"
                className="claim-modal-close"
                onClick={() => setCancelModalClaim(null)}
                disabled={cancelling}
              >
                <X size={20} />
              </button>
            </header>

            <div className="claim-modal-body">
              {cancelError && (
                <div className="claim-modal-error">
                  <AlertCircle size={16} />
                  <span>{cancelError}</span>
                </div>
              )}
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                Are you sure you want to cancel your claim for &ldquo;{cancelModalClaim.found_item?.title}&rdquo;?
                This will withdraw your verification details.
              </p>

              <footer className="claim-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCancelModalClaim(null)}
                  disabled={cancelling}
                >
                  Keep Claim
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmCancel}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel Claim'}
                </button>
              </footer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
