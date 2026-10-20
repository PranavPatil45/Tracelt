import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ShieldCheck,
  PackageCheck,
  MapPin,
  Clock,
  ArrowLeft,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Calendar,
  X,
  KeyRound,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getRecovery,
  markReturned,
  confirmRecovery,
  generateRecoveryOtp,
  verifyRecoveryOtp,
  disputeRecovery,
  resolveRecoveryDispute,
  requestRecoveryOtp,
  RecoveryApiError,
} from '../api/recovery'
import Sidebar from '../components/dashboard/Sidebar.jsx'
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx'
import RecoveryTimeline from '../components/recovery/RecoveryTimeline'
import { getItemImageUrl } from '../utils/imageUrl.js'
import './RecoveryPage.css'

export default function RecoveryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token, user, logout } = useAuth()

  const [recovery, setRecovery] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Direct Return Modal (for Finder)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnLocation, setReturnLocation] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

  // Request OTP Handover Modal
  const [showRequestOtpModal, setShowRequestOtpModal] = useState(false)
  const [requestOtpLoading, setRequestOtpLoading] = useState(false)
  const [requestOtpError, setRequestOtpError] = useState(null)

  // Confirm Receipt Modal (for Claimant)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // OTP State (for Claimant generation and Finder verification)
  const [otpData, setOtpData] = useState(null)
  const [otpGenerating, setOtpGenerating] = useState(false)
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otpActionError, setOtpActionError] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [showOtpVerifyModal, setShowOtpVerifyModal] = useState(false)
  const [otpInput, setOtpInput] = useState('')
  const [otpVerifyLoading, setOtpVerifyLoading] = useState(false)
  const [otpVerifyError, setOtpVerifyError] = useState(null)

  // Dispute Modal State
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeLoading, setDisputeLoading] = useState(false)
  const [disputeError, setDisputeError] = useState(null)

  // Dispute Resolution Modal (for Staff Reviewers / Admins)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [resolveDecision, setResolveDecision] = useState('APPROVE')
  const [resolveNotes, setResolveNotes] = useState('')
  const [resolveLoading, setResolveLoading] = useState(false)
  const [resolveError, setResolveError] = useState(null)

  const fetchRecovery = async () => {
    if (!id || !token) return
    setLoading(true)
    setError(null)
    try {
      const data = await getRecovery(id, token)
      setRecovery(data)
    } catch (err) {
      setError(err.message || 'Unable to load recovery record.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecovery()
  }, [id, token])

  // Countdown timer for active OTP
  useEffect(() => {
    if (!otpData?.expires_at) {
      setSecondsLeft(null)
      return
    }

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((new Date(otpData.expires_at).getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [otpData?.expires_at])

  const formatTimeRemaining = (seconds) => {
    if (seconds === null || seconds === undefined) return null
    if (seconds <= 0) return 'Expired'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handleMarkReturned = async (e) => {
    e.preventDefault()
    if (!returnLocation.trim()) {
      setActionError('Return location is required.')
      return
    }
    setActionLoading(true)
    setActionError(null)
    try {
      const updated = await markReturned(
        recovery.id,
        {
          return_location: returnLocation.trim(),
          return_notes: returnNotes.trim() || undefined,
        },
        token
      )
      setRecovery(updated)
      setShowReturnModal(false)
    } catch (err) {
      setActionError(err.message || 'Failed to mark item as returned.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRequestOtp = async () => {
    setRequestOtpLoading(true)
    setRequestOtpError(null)
    try {
      const updated = await requestRecoveryOtp(recovery.id, token)
      setRecovery(updated)
      setShowRequestOtpModal(false)
    } catch (err) {
      setRequestOtpError(err.message || 'Failed to request OTP verification.')
    } finally {
      setRequestOtpLoading(false)
    }
  }

  const handleConfirmRecovery = async () => {
    setActionLoading(true)
    setActionError(null)
    try {
      const updated = await confirmRecovery(recovery.id, token)
      setRecovery(updated)
      setShowConfirmModal(false)
    } catch (err) {
      setActionError(err.message || 'Failed to confirm item recovery.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleGenerateOtp = async () => {
    setOtpGenerating(true)
    setActionError(null)
    setOtpActionError(null)
    try {
      const data = await generateRecoveryOtp(recovery.id, token)
      setOtpData(data)
      setRecovery((prev) => ({ ...prev, has_active_otp: true }))
      setShowOtpModal(true)
    } catch (err) {
      const msg = err.message || 'Failed to generate handover OTP.'
      setOtpActionError(msg)
      setActionError(msg)
    } finally {
      setOtpGenerating(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otpInput.trim()) {
      setOtpVerifyError('Please enter the 6-digit OTP code.')
      return
    }
    if (!returnLocation.trim()) {
      setOtpVerifyError('Return location is required.')
      return
    }
    setOtpVerifyLoading(true)
    setOtpVerifyError(null)
    try {
      const updated = await verifyRecoveryOtp(
        recovery.id,
        {
          otp: otpInput.trim(),
          return_location: returnLocation.trim(),
          return_notes: returnNotes.trim() || undefined,
        },
        token
      )
      setRecovery(updated)
      setShowOtpVerifyModal(false)
      setOtpInput('')
    } catch (err) {
      setOtpVerifyError(err.message || 'Failed to verify OTP code.')
    } finally {
      setOtpVerifyLoading(false)
    }
  }

  const handleRaiseDispute = async (e) => {
    e.preventDefault()
    if (!disputeReason.trim()) {
      setDisputeError('Please provide a reason for the dispute.')
      return
    }
    setDisputeLoading(true)
    setDisputeError(null)
    try {
      const updated = await disputeRecovery(
        recovery.id,
        { reason: disputeReason.trim() },
        token
      )
      setRecovery(updated)
      setShowDisputeModal(false)
      setDisputeReason('')
    } catch (err) {
      setDisputeError(err.message || 'Failed to raise dispute.')
    } finally {
      setDisputeLoading(false)
    }
  }

  const handleResolveDispute = async (e) => {
    e.preventDefault()
    setResolveLoading(true)
    setResolveError(null)
    try {
      const updated = await resolveRecoveryDispute(
        recovery.id,
        { decision: resolveDecision, notes: resolveNotes.trim() || undefined },
        token
      )
      setRecovery(updated)
      setShowResolveModal(false)
      setResolveNotes('')
    } catch (err) {
      setResolveError(err.message || 'Failed to resolve dispute.')
    } finally {
      setResolveLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard-app">
        <Sidebar activeTab="history" user={user} logout={logout} />
        <div className="dashboard-main-area">
          <DashboardHeader activeTabTitle="Recovery Tracking" user={user} logout={logout} />
          <main className="dashboard-content recovery-page-content">
            <div className="recovery-loading-wrap">
              <div className="recovery-spinner"></div>
              <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '13.5px', margin: 0 }}>
                Loading recovery details...
              </p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (error || !recovery) {
    return (
      <div className="dashboard-app">
        <Sidebar activeTab="history" user={user} logout={logout} />
        <div className="dashboard-main-area">
          <DashboardHeader activeTabTitle="Recovery Tracking" user={user} logout={logout} />
          <main className="dashboard-content recovery-page-content">
            <div className="recovery-empty-card">
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(244,63,94,0.12)', display: 'grid', placeItems: 'center', color: '#f43f5e' }}>
                <AlertCircle size={28} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Unable to Load Recovery
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                {error || 'Recovery record not found.'}
              </p>
              <button
                onClick={() => navigate('/history')}
                className="recovery-btn-primary"
                style={{ marginTop: '8px' }}
              >
                <ArrowLeft size={16} /> Go to History
              </button>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const claimantId = recovery.claimant_id || recovery.claimant?.id
  const finderId = recovery.finder_id || recovery.finder?.id
  const currentUserId = user?.id ? Number(user.id) : null
  const isClaimant = Boolean(currentUserId && claimantId && currentUserId === Number(claimantId))
  const isFinder = Boolean(currentUserId && finderId && currentUserId === Number(finderId))
  const isStaff = ['admin', 'superadmin', 'administrator', 'reviewer'].includes((user?.role || '').toLowerCase())
  const isRecovered = recovery.status === 'RECOVERED'
  const isReturned = recovery.status === 'RETURNED'
  const isPending = recovery.status === 'RETURN_PENDING'
  const isDisputed = recovery.review_status === 'DISPUTED'
  const isReviewPending = recovery.review_status === 'PENDING'
  const isOtpMode = (recovery.handover_method || '').toUpperCase() === 'OTP'
  const canGenerateOtp = Boolean(
    recovery.can_generate_otp ||
    (isClaimant && isOtpMode && isPending && !isDisputed && !isReviewPending && !recovery.otp_verified_at)
  )

  return (
    <div className="dashboard-app">
      <Sidebar activeTab="history" user={user} logout={logout} />
      <div className="dashboard-main-area">
        <DashboardHeader activeTabTitle={`Recovery #${recovery.id}`} user={user} logout={logout} />
        <main className="dashboard-content recovery-page-content">
          <div className="recovery-page-wrapper">
            {/* Header & Navigation */}
            <div className="recovery-header">
              <div className="recovery-header-left">
                <button
                  onClick={() => navigate(-1)}
                  className="recovery-back-circle"
                  title="Go Back"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <div className="recovery-title-row">
                    <h1 className="recovery-title">Recovery #{recovery.id}</h1>
                    <span
                      className={`recovery-status-pill ${
                        isRecovered
                          ? 'recovery-status-pill--recovered'
                          : isReturned
                          ? 'recovery-status-pill--returned'
                          : 'recovery-status-pill--pending'
                      }`}
                    >
                      {recovery.status.replace('_', ' ')}
                    </span>
                    {recovery.review_status && recovery.review_status !== 'NOT_REQUIRED' && (
                      <span
                        className={`recovery-status-pill ${
                          recovery.review_status === 'APPROVED'
                            ? 'recovery-status-pill--recovered'
                            : recovery.review_status === 'DISPUTED'
                            ? 'recovery-status-pill--pending'
                            : 'recovery-status-pill--returned'
                        }`}
                        style={{
                          background: recovery.review_status === 'DISPUTED' ? 'rgba(244,63,94,0.15)' : undefined,
                          color: recovery.review_status === 'DISPUTED' ? '#f43f5e' : undefined,
                        }}
                      >
                        {recovery.review_status === 'PENDING'
                          ? `Review: ${recovery.review_reason || 'Pending'}`
                          : recovery.review_status === 'DISPUTED'
                          ? 'Disputed'
                          : 'Reviewer Approved'}
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '12px', margin: '4px 0 0 0' }}>
                    Started {new Date(recovery.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    {isOtpMode && ' • Handover Mode: OTP Verification'}
                  </p>
                </div>
              </div>

              <div className="recovery-header-right">
                {recovery.can_raise_dispute && (
                  <button
                    onClick={() => {
                      setDisputeReason('')
                      setDisputeError(null)
                      setShowDisputeModal(true)
                    }}
                    className="recovery-btn-secondary"
                    style={{ color: '#f43f5e', borderColor: 'rgba(244,63,94,0.3)' }}
                  >
                    <AlertCircle size={15} /> Raise Dispute
                  </button>
                )}

                {recovery.conversation_id && (
                  <Link
                    to={`/messages?conversation_id=${recovery.conversation_id}`}
                    className="recovery-btn-secondary"
                  >
                    <MessageSquare size={15} color="var(--cyan, #45d6e0)" />
                    Handover Chat
                  </Link>
                )}

                <Link
                  to="/history"
                  className="recovery-btn-secondary"
                >
                  View History
                </Link>
              </div>
            </div>

            {/* Hybrid Review Alert Banners */}
            {isReviewPending && (
              <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.35)', color: '#eab308', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ShieldCheck size={24} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Staff Reviewer Authorization Required</h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      Trigger: <strong>{recovery.review_reason || 'High Risk / Competing Claims'}</strong>. Physical handover cannot proceed until approved by a campus staff reviewer.
                    </p>
                  </div>
                </div>
                {isStaff && (
                  <button onClick={() => setShowResolveModal(true)} className="recovery-btn-secondary" style={{ borderColor: 'rgba(234,179,8,0.5)', color: '#eab308' }}>
                    Review &amp; Authorize
                  </button>
                )}
              </div>
            )}

            {isDisputed && (
              <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.35)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ShieldAlert size={24} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Recovery Coordination Disputed</h3>
                    <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      Reason: &ldquo;{recovery.dispute_reason}&rdquo;. Handover and confirmation actions are paused until resolved by staff.
                    </p>
                  </div>
                </div>
                {isStaff && (
                  <button onClick={() => setShowResolveModal(true)} className="recovery-btn-secondary" style={{ borderColor: 'rgba(244,63,94,0.5)', color: '#f43f5e' }}>
                    Resolve Dispute
                  </button>
                )}
              </div>
            )}

            {/* Hero Status Banner */}
            <div
              className={`recovery-banner ${
                isRecovered
                  ? 'recovery-banner--recovered'
                  : isReturned
                  ? 'recovery-banner--returned'
                  : 'recovery-banner--pending'
              }`}
            >
              <div className="recovery-banner-left">
                <div
                  className={`recovery-banner-icon ${
                    isRecovered
                      ? 'recovery-banner-icon--recovered'
                      : isReturned
                      ? 'recovery-banner-icon--returned'
                      : 'recovery-banner-icon--pending'
                  }`}
                >
                  {isRecovered ? (
                    <CheckCircle size={24} />
                  ) : isReturned ? (
                    <PackageCheck size={24} />
                  ) : (
                    <Clock size={24} />
                  )}
                </div>
                <div>
                  <h2 className="recovery-banner-title">
                    {isRecovered
                      ? 'Item Officially Recovered'
                      : isReturned
                      ? 'Item Handed Over — Confirmation Awaiting'
                      : 'Return Coordination in Progress'}
                  </h2>
                  <p className="recovery-banner-desc">
                    {isRecovered
                      ? `Receipt was confirmed on ${new Date(recovery.confirmed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}. The lost item has been officially recovered and returned to its owner.`
                      : isReturned
                      ? `Finder marked item returned${recovery.return_location ? ` at ${recovery.return_location}` : ''}. Claimant (${recovery.claimant?.full_name}) please confirm receipt once you inspect the item.`
                      : isOtpMode
                      ? 'Claim approved! The claimant generates a 6-digit secure handover code to provide in person to the finder upon meeting.'
                      : 'The claim has been approved! Use the handover chat to agree upon a secure campus exchange location or front desk drop-off.'}
                  </p>
                </div>
              </div>

              {/* Action Trigger in Banner */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {recovery.can_request_otp && (
                  <button
                    onClick={() => {
                      setRequestOtpError(null)
                      setShowRequestOtpModal(true)
                    }}
                    className="recovery-btn-secondary"
                    style={{ borderColor: 'rgba(69, 214, 224, 0.4)', color: 'var(--cyan, #45d6e0)' }}
                  >
                    <KeyRound size={16} /> Request OTP Handover
                  </button>
                )}

                {canGenerateOtp && (
                  <button
                    onClick={() => {
                      if (otpData?.otp) {
                        setShowOtpModal(true)
                      } else {
                        handleGenerateOtp()
                      }
                    }}
                    disabled={otpGenerating || isDisputed || isReviewPending}
                    className="recovery-btn-primary"
                  >
                    {otpGenerating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Generating Code...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound size={16} />
                        <span>
                          {otpData?.otp
                            ? 'View Handover Code'
                            : recovery.has_active_otp
                            ? 'Regenerate Handover Code'
                            : 'Generate Handover Code'}
                        </span>
                      </>
                    )}
                  </button>
                )}

                {recovery.can_mark_returned && (
                  <button
                    onClick={() => {
                      setReturnLocation(recovery.found_item?.location || '')
                      setShowReturnModal(true)
                    }}
                    className="recovery-btn-primary"
                  >
                    <PackageCheck size={16} /> Mark Item Returned
                  </button>
                )}

                {recovery.can_verify_otp && (
                  <button
                    onClick={() => {
                      setReturnLocation(recovery.found_item?.location || '')
                      setShowOtpVerifyModal(true)
                    }}
                    className="recovery-btn-primary"
                  >
                    <KeyRound size={16} /> Verify Handover OTP
                  </button>
                )}

                {recovery.can_confirm_recovery && (
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="recovery-btn-success"
                  >
                    <CheckCircle size={16} /> Confirm Received
                  </button>
                )}
              </div>
            </div>

            {/* Main Grid: 2 Columns */}
            <div className="recovery-grid">
              {/* Left Column: Timeline, OTP & Handover Info */}
              <div className="recovery-left-col">
                {/* OTP Handover Card */}
                {isOtpMode && !isRecovered && (
                  <div className="recovery-card" style={{ border: '1px solid rgba(69, 214, 224, 0.3)' }}>
                    <h3 className="recovery-card-title">
                      <KeyRound size={16} color="var(--cyan, #45d6e0)" /> Handover Verification Code (OTP)
                    </h3>

                    {recovery.otp_verified_at ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981' }}>
                        <CheckCircle size={20} />
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '13px' }}>
                            Handover OTP Successfully Verified
                          </p>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            Verified on {new Date(recovery.otp_verified_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}.
                            {isClaimant && ' Please inspect your item and confirm receipt above.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {(isClaimant || canGenerateOtp) && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {otpActionError && (
                              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', fontSize: '12px' }}>
                                {otpActionError}
                              </div>
                            )}

                            {otpData?.otp ? (
                              <div style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', textAlign: 'center' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Your Single-Use Verification Code
                                </span>
                                <div style={{ fontSize: '32px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 800, color: 'var(--cyan, #45d6e0)', letterSpacing: '0.15em', margin: '8px 0' }}>
                                  {otpData.otp}
                                </div>
                                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                                  Provide this code to the finder in person when you meet to collect your item.
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '6px' }}>
                                  <span style={{ fontSize: '11.5px', color: secondsLeft === 0 ? '#f43f5e' : '#eab308', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={12} />
                                    {secondsLeft === 0 ? 'Code Expired' : `Valid: ${formatTimeRemaining(secondsLeft)}`}
                                  </span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    • {otpData.attempts_remaining} attempts remaining
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '12px' }}>
                                  <button
                                    type="button"
                                    onClick={handleGenerateOtp}
                                    disabled={otpGenerating || isDisputed || isReviewPending}
                                    className="recovery-btn-secondary"
                                    style={{ fontSize: '12px', padding: '6px 12px' }}
                                  >
                                    <RefreshCw size={13} /> Regenerate Code
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShowOtpModal(true)}
                                    className="recovery-btn-primary"
                                    style={{ fontSize: '12px', padding: '6px 12px' }}
                                  >
                                    <KeyRound size={13} /> View Full Code
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                  This recovery is secured with a 6-digit OTP for physical handover. Generate your code when meeting the finder.
                                </p>
                                <button
                                  onClick={handleGenerateOtp}
                                  disabled={otpGenerating || isDisputed || isReviewPending}
                                  className="recovery-btn-primary"
                                >
                                  {otpGenerating ? (
                                    <>
                                      <Loader2 size={16} className="animate-spin" />
                                      <span>Generating Code...</span>
                                    </>
                                  ) : (
                                    <>
                                      <KeyRound size={16} />
                                      <span>{recovery.has_active_otp ? 'Regenerate Handover Code' : 'Generate Handover Code'}</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {isFinder && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                              This recovery is secured with OTP verification. When you meet the claimant to hand over the item, ask them for their 6-digit code and verify it below.
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span
                                className={`recovery-status-pill ${
                                  recovery.has_active_otp ? 'recovery-status-pill--returned' : 'recovery-status-pill--pending'
                                }`}
                                style={{ fontSize: '11px', padding: '3px 8px' }}
                              >
                                {recovery.has_active_otp ? 'Claimant Code Active' : 'Waiting for Claimant Code'}
                              </span>
                              {recovery.can_verify_otp && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReturnLocation(recovery.found_item?.location || '')
                                    setOtpVerifyError(null)
                                    setShowOtpVerifyModal(true)
                                  }}
                                  className="recovery-btn-primary"
                                  style={{ padding: '7px 14px', fontSize: '12.5px' }}
                                >
                                  <KeyRound size={14} /> Enter &amp; Verify OTP
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <RecoveryTimeline timeline={recovery.timeline} currentStatus={recovery.status} />

                {/* Handover Details Card */}
                <div className="recovery-card">
                  <h3 className="recovery-card-title">
                    <MapPin size={16} color="var(--cyan, #45d6e0)" /> Handover Details
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '11px', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Return Location
                      </span>
                      <span style={{ color: 'var(--text-primary, #ffffff)', fontWeight: 600, marginTop: '2px', display: 'block' }}>
                        {recovery.return_location || 'To be coordinated between participants'}
                      </span>
                    </div>

                    {recovery.can_request_otp && (
                      <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(69, 214, 224, 0.06)', border: '1px solid rgba(69, 214, 224, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <div>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Want OTP Security?
                          </span>
                          <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                            Either participant can upgrade this handover to 6-digit OTP verification.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setRequestOtpError(null)
                            setShowRequestOtpModal(true)
                          }}
                          className="recovery-btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
                        >
                          <KeyRound size={13} /> Require OTP
                        </button>
                      </div>
                    )}

                    {recovery.return_notes && (
                      <div>
                        <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '11px', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Finder's Handover Notes
                        </span>
                        <p style={{ color: 'var(--text-secondary, #94a3b8)', margin: '6px 0 0 0', background: 'rgba(0,0,0,0.25)', padding: '10px 14px', borderRadius: '10px', fontStyle: 'italic', border: '1px solid var(--border-hair)' }}>
                          "{recovery.return_notes}"
                        </p>
                      </div>
                    )}

                    {recovery.otp_verified_at && (
                      <div>
                        <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '11px', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          OTP Verified On
                        </span>
                        <span style={{ color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                          {new Date(recovery.otp_verified_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}

                    {recovery.returned_at && (
                      <div>
                        <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '11px', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Handed Over On
                        </span>
                        <span style={{ color: 'var(--text-secondary, #94a3b8)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(recovery.returned_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}

                    {recovery.confirmed_at && (
                      <div>
                        <span style={{ color: 'var(--text-muted, #64748b)', fontSize: '11px', display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Confirmed By Owner On
                        </span>
                        <span style={{ color: 'var(--text-secondary, #94a3b8)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(recovery.confirmed_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Participants & Item Details */}
              <div className="recovery-right-col">
                {/* Participants Card */}
                <div className="recovery-card">
                  <h3 className="recovery-card-title">Participants</h3>
                  <div className="recovery-participants-grid">
                    {/* Claimant */}
                    <div className="recovery-person-card">
                      <div className="recovery-avatar recovery-avatar--claimant">
                        {recovery.claimant?.full_name?.charAt(0) || 'C'}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="recovery-status-pill recovery-status-pill--pending" style={{ fontSize: '10px', padding: '1px 7px' }}>
                            Claimant (Owner)
                          </span>
                          {isClaimant && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(You)</span>}
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {recovery.claimant?.full_name}
                        </p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {recovery.claimant?.campus}
                        </p>
                      </div>
                    </div>

                    {/* Finder */}
                    <div className="recovery-person-card">
                      <div className="recovery-avatar recovery-avatar--finder">
                        {recovery.finder?.full_name?.charAt(0) || 'F'}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="recovery-status-pill recovery-status-pill--returned" style={{ fontSize: '10px', padding: '1px 7px' }}>
                            Finder
                          </span>
                          {isFinder && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(You)</span>}
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {recovery.finder?.full_name}
                        </p>
                        <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {recovery.finder?.campus}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Side-by-Side Item Reports */}
                <div className="recovery-items-side-grid">
                  {/* Lost Item Summary */}
                  {recovery.lost_item && (
                    <div className="recovery-item-panel">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="recovery-status-pill recovery-status-pill--pending" style={{ fontSize: '10.5px' }}>
                          Lost Report
                        </span>
                        <Link
                          to={{
                            pathname: `/lost-items/${recovery.lost_item.id}`,
                            search: '?from=history',
                          }}
                          state={{ from: 'history' }}
                          style={{ color: 'var(--cyan, #45d6e0)', fontSize: '12px', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          View <ExternalLink size={12} />
                        </Link>
                      </div>

                      {getItemImageUrl(recovery.lost_item.image_url) ? (
                        <img
                          src={getItemImageUrl(recovery.lost_item.image_url)}
                          alt={recovery.lost_item.title}
                          className="recovery-item-img"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display = 'grid'
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="recovery-item-placeholder"
                        style={{ display: getItemImageUrl(recovery.lost_item.image_url) ? 'none' : 'grid' }}
                      >
                        No photo attached
                      </div>

                      <div>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {recovery.lost_item.title}
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span><strong>Category:</strong> {recovery.lost_item.category}</span>
                          <span><strong>Location:</strong> {recovery.lost_item.location}</span>
                          <span><strong>Date Lost:</strong> {recovery.lost_item.date}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Found Item Summary */}
                  {recovery.found_item && (
                    <div className="recovery-item-panel">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="recovery-status-pill recovery-status-pill--returned" style={{ fontSize: '10.5px' }}>
                          Found Report
                        </span>
                        <Link
                          to={{
                            pathname: `/found-items/${recovery.found_item.id}`,
                            search: '?from=history',
                          }}
                          state={{ from: 'history' }}
                          style={{ color: 'var(--cyan, #45d6e0)', fontSize: '12px', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          View <ExternalLink size={12} />
                        </Link>
                      </div>

                      {getItemImageUrl(recovery.found_item.image_url) ? (
                        <img
                          src={getItemImageUrl(recovery.found_item.image_url)}
                          alt={recovery.found_item.title}
                          className="recovery-item-img"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            if (e.currentTarget.nextElementSibling) {
                              e.currentTarget.nextElementSibling.style.display = 'grid'
                            }
                          }}
                        />
                      ) : null}
                      <div
                        className="recovery-item-placeholder"
                        style={{ display: getItemImageUrl(recovery.found_item.image_url) ? 'none' : 'grid' }}
                      >
                        No photo attached
                      </div>

                      <div>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {recovery.found_item.title}
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span><strong>Category:</strong> {recovery.found_item.category}</span>
                          <span><strong>Found Location:</strong> {recovery.found_item.location}</span>
                          <span><strong>Date Found:</strong> {recovery.found_item.date}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modal: Direct Return */}
      {showReturnModal && (
        <div className="recovery-modal-backdrop">
          <div className="recovery-modal-card">
            <div className="recovery-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PackageCheck size={18} color="var(--cyan, #45d6e0)" />
                <h3 className="recovery-modal-title">Mark Item Handed Over</h3>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleMarkReturned} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {actionError && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', fontSize: '12px' }}>
                  {actionError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Handover / Drop-off Location <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <input
                  type="text"
                  value={returnLocation}
                  onChange={(e) => setReturnLocation(e.target.value)}
                  placeholder="e.g. Student Center Front Desk, Hall B"
                  maxLength={255}
                  required
                  className="recovery-input"
                />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Where was the item handed over or securely dropped off?
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Handover Notes / Instructions (Optional)
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="e.g. Left with Officer Adams at Desk 3 under claimant's name."
                  maxLength={1000}
                  rows={3}
                  className="recovery-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="recovery-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="recovery-btn-primary"
                >
                  {actionLoading ? 'Saving...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View / Generate OTP (Claimant) */}
      {showOtpModal && (
        <div className="recovery-modal-backdrop">
          <div className="recovery-modal-card">
            <div className="recovery-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={18} color="var(--cyan, #45d6e0)" />
                <h3 className="recovery-modal-title">Handover Verification Code</h3>
              </div>
              <button
                onClick={() => setShowOtpModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {otpActionError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', fontSize: '12px' }}>
                {otpActionError}
              </div>
            )}

            {otpData?.otp ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '20px', background: 'rgba(0,0,0,0.35)', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(69, 214, 224, 0.25)' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                    Your Single-Use Verification Code
                  </span>
                  <div style={{ fontSize: '36px', fontFamily: 'var(--font-mono, monospace)', fontWeight: 800, color: 'var(--cyan, #45d6e0)', letterSpacing: '0.25em', margin: '12px 0' }}>
                    {otpData.otp}
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Provide this 6-digit code in person to the finder when you meet to collect your item.
                  </p>
                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '12px' }}>
                    <span style={{ color: secondsLeft === 0 ? '#f43f5e' : '#eab308', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                      <Clock size={13} />
                      {secondsLeft === 0 ? 'Code Expired' : `Valid: ${formatTimeRemaining(secondsLeft)}`}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {otpData.attempts_remaining || 5} attempts remaining
                    </span>
                  </div>
                </div>

                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <p style={{ fontWeight: 700, margin: '0 0 4px 0', color: '#eab308' }}>Handover Safety Notice:</p>
                  <p style={{ margin: 0, lineHeight: 1.4 }}>
                    Do <strong>NOT</strong> share this code via chat, email, or phone prior to meeting. Inspect your item physically before giving this code to the finder.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}>
                  <button
                    type="button"
                    onClick={handleGenerateOtp}
                    disabled={otpGenerating || isDisputed || isReviewPending}
                    className="recovery-btn-secondary"
                  >
                    {otpGenerating ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Regenerating...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        <span>Regenerate Code</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="recovery-btn-primary"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  This recovery is configured for secure OTP verification. Click below to generate your 6-digit code.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="recovery-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateOtp}
                    disabled={otpGenerating || isDisputed || isReviewPending}
                    className="recovery-btn-primary"
                  >
                    {otpGenerating ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound size={16} />
                        <span>Generate Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Verify OTP (Finder) */}
      {showOtpVerifyModal && (
        <div className="recovery-modal-backdrop">
          <div className="recovery-modal-card">
            <div className="recovery-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={18} color="var(--cyan, #45d6e0)" />
                <h3 className="recovery-modal-title">Verify Handover OTP</h3>
              </div>
              <button
                onClick={() => setShowOtpVerifyModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {otpVerifyError && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', fontSize: '12px' }}>
                  {otpVerifyError}
                </div>
              )}

              {!recovery.has_active_otp && (
                <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.35)', color: '#eab308', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13.5px' }}>
                    <KeyRound size={18} />
                    <span>No Active Handover Code Found</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    The claimant ({recovery.claimant?.full_name || 'Claimant'}) has not yet generated their 6-digit code (or their previous code expired).
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                    Please ask the claimant to open <strong>Recovery #{recovery.id}</strong> on their device and click <strong>Generate Handover Code</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      setOtpVerifyError(null)
                      await fetchRecovery()
                    }}
                    className="recovery-btn-secondary"
                    style={{ alignSelf: 'flex-start', marginTop: '4px', fontSize: '12px', padding: '5px 12px' }}
                  >
                    <RefreshCw size={12} /> Check If Code Is Ready
                  </button>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Claimant's 6-Digit Handover Code <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <input
                  type="text"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={recovery.has_active_otp ? "e.g. 482910" : "Awaiting claimant code..."}
                  maxLength={6}
                  disabled={!recovery.has_active_otp || otpVerifyLoading}
                  required
                  className="recovery-input"
                  style={{ fontSize: '20px', fontFamily: 'monospace', letterSpacing: '0.2em', textAlign: 'center', opacity: recovery.has_active_otp ? 1 : 0.5 }}
                />
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {recovery.has_active_otp
                    ? "Enter the 6-digit code shown on the claimant's screen."
                    : "This field will unlock automatically once the claimant generates their code."}
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Handover Location <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <input
                  type="text"
                  value={returnLocation}
                  onChange={(e) => setReturnLocation(e.target.value)}
                  placeholder="e.g. Campus Library Entrance"
                  maxLength={255}
                  required
                  className="recovery-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Notes (Optional)
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Handover notes..."
                  maxLength={1000}
                  rows={2}
                  className="recovery-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowOtpVerifyModal(false)}
                  className="recovery-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={otpVerifyLoading || otpInput.length !== 6 || !recovery.has_active_otp}
                  className="recovery-btn-primary"
                >
                  {otpVerifyLoading ? 'Verifying...' : 'Verify & Hand Over'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Raise Dispute */}
      {showDisputeModal && (
        <div className="recovery-modal-backdrop">
          <div className="recovery-modal-card">
            <div className="recovery-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} color="#f43f5e" />
                <h3 className="recovery-modal-title" style={{ color: '#f43f5e' }}>Raise Recovery Dispute</h3>
              </div>
              <button
                onClick={() => setShowDisputeModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRaiseDispute} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {disputeError && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', fontSize: '12px' }}>
                  {disputeError}
                </div>
              )}

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Raising a dispute immediately halts handover verification and notifies staff reviewers to investigate.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Dispute Reason <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Explain why this recovery is disputed (e.g. damaged item, claimant not recognized, missing pieces)..."
                  maxLength={1000}
                  rows={4}
                  required
                  className="recovery-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="recovery-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeLoading || !disputeReason.trim()}
                  className="recovery-btn-primary"
                  style={{ background: '#f43f5e', borderColor: '#f43f5e' }}
                >
                  {disputeLoading ? 'Submitting...' : 'Raise Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Resolve Dispute (Staff / Admin) */}
      {showResolveModal && (
        <div className="recovery-modal-backdrop">
          <div className="recovery-modal-card">
            <div className="recovery-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="var(--cyan, #45d6e0)" />
                <h3 className="recovery-modal-title">Staff Review &amp; Resolution</h3>
              </div>
              <button
                onClick={() => setShowResolveModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResolveDispute} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {resolveError && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', fontSize: '12px' }}>
                  {resolveError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Staff Resolution Decision <span style={{ color: '#f43f5e' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setResolveDecision('APPROVE')}
                    className={`recovery-btn-secondary ${resolveDecision === 'APPROVE' ? 'recovery-btn-success' : ''}`}
                    style={{ flex: 1, padding: '10px' }}
                  >
                    <CheckCircle size={16} /> Authorize &amp; Unblock
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveDecision('REJECT')}
                    className={`recovery-btn-secondary ${resolveDecision === 'REJECT' ? 'recovery-btn-primary' : ''}`}
                    style={{ flex: 1, padding: '10px', background: resolveDecision === 'REJECT' ? '#f43f5e' : undefined }}
                  >
                    <X size={16} /> Reject &amp; Cancel Claim
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Resolution Notes
                </label>
                <textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="Staff investigation notes and decision explanation..."
                  maxLength={1000}
                  rows={3}
                  className="recovery-input"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="recovery-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolveLoading}
                  className="recovery-btn-primary"
                >
                  {resolveLoading ? 'Saving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Request OTP Verification */}
      {showRequestOtpModal && (
        <div className="recovery-modal-backdrop">
          <div className="recovery-modal-card">
            <div className="recovery-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={18} color="var(--cyan, #45d6e0)" />
                <h3 className="recovery-modal-title">Upgrade to OTP Verification</h3>
              </div>
              <button
                onClick={() => setShowRequestOtpModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {requestOtpError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', fontSize: '12px' }}>
                {requestOtpError}
              </div>
            )}

            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to require OTP verification for this handover?
            </p>

            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(69, 214, 224, 0.08)', border: '1px solid rgba(69, 214, 224, 0.25)', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <p style={{ fontWeight: 700, margin: 0, color: 'var(--cyan, #45d6e0)' }}>How OTP Handover Works:</p>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <li>The claimant generates a single-use 6-digit code upon meeting.</li>
                <li>The finder enters and verifies the code on their device.</li>
                <li>Direct return without OTP verification will be disabled.</li>
                <li>Once enabled, OTP verification cannot be downgraded back to direct handover.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
              <button
                type="button"
                onClick={() => setShowRequestOtpModal(false)}
                className="recovery-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={requestOtpLoading}
                onClick={handleRequestOtp}
                className="recovery-btn-primary"
              >
                {requestOtpLoading ? 'Enabling...' : 'Yes, Require OTP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Recovery */}
      {showConfirmModal && (
        <div className="recovery-modal-backdrop">
          <div className="recovery-modal-card">
            <div className="recovery-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} color="#10b981" />
                <h3 className="recovery-modal-title">Confirm Item Receipt</h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', fontSize: '12px' }}>
                {actionError}
              </div>
            )}

            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Have you physically received and verified your lost item?
            </p>

            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', fontSize: '12px', color: '#34d399', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <p style={{ fontWeight: 700, margin: 0 }}>By confirming this action:</p>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <li>Your lost item will be officially marked <strong>RECOVERED</strong>.</li>
                <li>The found report will be marked <strong>RECOVERED</strong>.</li>
                <li>The recovery will be permanently saved to your History.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="recovery-btn-secondary"
              >
                Not Yet
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmRecovery}
                className="recovery-btn-success"
              >
                {actionLoading ? 'Confirming...' : 'Yes, I Received It'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
