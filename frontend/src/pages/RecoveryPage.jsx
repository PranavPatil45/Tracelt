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
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getRecovery, markReturned, confirmRecovery, RecoveryApiError } from '../api/recovery'
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

  // Action Modals
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnLocation, setReturnLocation] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

  const [showConfirmModal, setShowConfirmModal] = useState(false)

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

  const isClaimant = user?.id === recovery.claimant_id
  const isFinder = user?.id === recovery.finder_id
  const isRecovered = recovery.status === 'RECOVERED'
  const isReturned = recovery.status === 'RETURNED'
  const isPending = recovery.status === 'RETURN_PENDING'

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
                  </div>
                  <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '12px', margin: '4px 0 0 0' }}>
                    Started {new Date(recovery.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="recovery-header-right">
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
                      : 'The claim has been approved! Use the handover chat to agree upon a secure campus exchange location or front desk drop-off.'}
                  </p>
                </div>
              </div>

              {/* Action Trigger in Banner */}
              <div>
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
              {/* Left Column: Timeline & Handover Info */}
              <div className="recovery-left-col">
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
                        {recovery.return_location || 'To be coordinated between parties'}
                      </span>
                    </div>

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
                          to={`/lost-items/${recovery.lost_item.id}`}
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
                          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={12} color="var(--text-muted)" /> {recovery.lost_item.location}
                          </p>
                          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={12} color="var(--text-muted)" /> Lost on {recovery.lost_item.date}
                          </p>
                        </div>
                        {recovery.lost_item.description && (
                          <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            "{recovery.lost_item.description}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Found Item Summary */}
                  {recovery.found_item && (
                    <div className="recovery-item-panel">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="recovery-status-pill recovery-status-pill--recovered" style={{ fontSize: '10.5px' }}>
                          Found Report
                        </span>
                        <Link
                          to={`/found-items/${recovery.found_item.id}`}
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
                          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={12} color="var(--text-muted)" /> {recovery.found_item.location}
                          </p>
                          <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={12} color="var(--text-muted)" /> Found on {recovery.found_item.date}
                          </p>
                        </div>
                        {recovery.found_item.description && (
                          <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            "{recovery.found_item.description}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modal: Mark Item Returned */}
      {showReturnModal && (
        <div className="recovery-modal-backdrop">
          <div className="recovery-modal-card">
            <div className="recovery-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PackageCheck size={18} color="var(--cyan, #45d6e0)" />
                <h3 className="recovery-modal-title">Mark Item as Returned</h3>
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
                <li>The found report will be marked <strong>RETURNED</strong>.</li>
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
