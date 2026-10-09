import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  GitCompare,
  ArrowRight,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  Package,
  Layers,
  Check,
  ChevronRight,
  HeartHandshake,
  MessageSquare,
  Eye,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import Sidebar from "../components/dashboard/Sidebar.jsx";
import DashboardHeader from "../components/dashboard/DashboardHeader.jsx";
import {
  getMatches,
  updateMatchStatus,
  triggerCampusScan,
} from "../api/matches.js";
import { getMyClaims, getIncomingClaims } from "../api/claims.js";
import { createConversationForClaim } from "../api/messaging.js";
import ClaimActionModal from "../components/item/ClaimActionModal.jsx";
import "./MatchesPage.css";

export default function MatchesPage() {
  const {
    user,
    token,
    loading: authLoading,
    logout,
    isAuthenticated,
  } = useAuth();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all"); // 'all' | 'lost' | 'found' | 'reviewed'
  const [matches, setMatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [error, setError] = useState("");
  const [userClaims, setUserClaims] = useState({});
  const [incomingClaims, setIncomingClaims] = useState({});
  const [claimModalMatch, setClaimModalMatch] = useState(null);

  // Route protection
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [authLoading, isAuthenticated, navigate]);

  const loadMatches = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      let typeParam = "all";
      let statusParam = "all";

      if (activeFilter === "lost") typeParam = "lost";
      if (activeFilter === "found") typeParam = "found";
      if (activeFilter === "reviewed") statusParam = "REVIEWED";

      const [result, myClaimsRes, incClaimsRes] = await Promise.allSettled([
        getMatches({ type: typeParam, status: statusParam }, token),
        getMyClaims(undefined, token),
        getIncomingClaims(undefined, token),
      ]);

      if (result.status === "fulfilled") {
        setMatches(result.value.matches || []);
        setTotal(result.value.total || 0);
      } else {
        throw result.reason;
      }

      if (myClaimsRes.status === "fulfilled") {
        const claimsMap = {};
        myClaimsRes.value.claims?.forEach((c) => {
          claimsMap[c.match_id] = c;
        });
        setUserClaims(claimsMap);
      }

      if (incClaimsRes.status === "fulfilled") {
        const incMap = {};
        incClaimsRes.value.claims?.forEach((c) => {
          incMap[c.match_id] = c;
        });
        setIncomingClaims(incMap);
      }
    } catch (err) {
      setError(err.message || "Failed to load matching reports.");
    } finally {
      setLoading(false);
    }
  }, [token, activeFilter]);

  useEffect(() => {
    if (isAuthenticated) {
      loadMatches();
    }
  }, [isAuthenticated, loadMatches]);

  // Handle Mark as Reviewed
  async function handleStatusChange(matchId, newStatus) {
    try {
      const updated = await updateMatchStatus(matchId, newStatus, token);
      setMatches((prev) =>
        prev
          .map((m) => (m.id === matchId ? { ...m, status: updated.status } : m))
          .filter((m) => {
            // If we are on the 'reviewed' tab and it's marked REJECTED, remove it
            if (activeFilter === "reviewed" && newStatus !== "REVIEWED")
              return false;
            // If default view and marked REJECTED, remove it
            if (activeFilter !== "reviewed" && newStatus === "REJECTED")
              return false;
            return true;
          }),
      );
    } catch (err) {
      alert(err.message || "Could not update match status.");
    }
  }

  async function handleContact(claimId) {
    if (!token || !claimId) return;
    try {
      const conv = await createConversationForClaim(claimId, token);
      navigate(`/messages?conversation_id=${conv.id}`);
    } catch (err) {
      alert(err.message || "Failed to open conversation.");
    }
  }

  // Trigger On-demand scan
  async function handleTriggerScan() {
    setScanning(true);
    setScanMessage("");
    try {
      const res = await triggerCampusScan(token);
      setScanMessage(
        `Scan complete: ${res.matches_evaluated} potential pairings evaluated!`,
      );
      await loadMatches();
      setTimeout(() => setScanMessage(""), 4000);
    } catch (err) {
      setScanMessage(err.message || "Scan could not be completed.");
    } finally {
      setScanning(false);
    }
  }

  function getScoreBadgeClass(score) {
    if (score >= 80) return "match-badge--strong";
    return "match-badge--moderate";
  }

  function getScoreLabel(score) {
    if (score >= 80) return "Strong Possible Match";
    return "Possible Match";
  }

  if (authLoading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading__spinner" />
        <p>Loading Tracelt&hellip;</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="dashboard-app">
      <Sidebar
        activeTab="matches"
        setActiveTab={(tab) =>
          navigate(tab === "dashboard" ? "/dashboard" : `/${tab}`)
        }
        user={user}
        logout={logout}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      <div className="dashboard-main-area">
        <DashboardHeader
          activeTabTitle="Match Center"
          user={user}
          logout={logout}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectTab={(tab) =>
            navigate(tab === "dashboard" ? "/dashboard" : `/${tab}`)
          }
        />

        <main className="dashboard-content matches-page-content">
          <div className="matches-page-wrapper">
            {/* Header Title and Actions */}
            <div className="matches-page-header">
              <div>
                <h1 className="matches-page-title">Match Center</h1>
                <p className="matches-page-subtitle">
                  Possible relationships calculated between your lost and found
                  reports on campus.
                </p>
              </div>

              <div className="matches-header-actions">
                <button
                  type="button"
                  className="btn btn-secondary matches-scan-btn"
                  onClick={handleTriggerScan}
                  disabled={scanning}
                  title="Run matching scan across active campus items"
                >
                  <RefreshCw
                    size={15}
                    className={scanning ? "animate-spin" : ""}
                  />
                  <span>
                    {scanning ? "Scanning Campus..." : "Re-scan Matches"}
                  </span>
                </button>
              </div>
            </div>

            {scanMessage && (
              <div className="matches-scan-alert">
                <CheckCircle2 size={16} />
                <span>{scanMessage}</span>
              </div>
            )}

            {/* Filter Navigation Tabs */}
            <div className="matches-tabs-bar">
              <button
                type="button"
                className={`matches-tab-btn ${activeFilter === "all" ? "matches-tab-btn--active" : ""}`}
                onClick={() => setActiveFilter("all")}
              >
                All Matches
              </button>
              <button
                type="button"
                className={`matches-tab-btn ${activeFilter === "lost" ? "matches-tab-btn--active" : ""}`}
                onClick={() => setActiveFilter("lost")}
              >
                My Lost Items
              </button>
              <button
                type="button"
                className={`matches-tab-btn ${activeFilter === "found" ? "matches-tab-btn--active" : ""}`}
                onClick={() => setActiveFilter("found")}
              >
                My Found Items
              </button>
              <button
                type="button"
                className={`matches-tab-btn ${activeFilter === "reviewed" ? "matches-tab-btn--active" : ""}`}
                onClick={() => setActiveFilter("reviewed")}
              >
                Reviewed Matches
              </button>
            </div>

            {/* Content Area */}
            {loading ? (
              <div className="matches-loading-grid">
                {[1, 2].map((n) => (
                  <div key={n} className="match-card-skeleton">
                    <div className="match-skeleton-header" />
                    <div className="match-skeleton-body" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="matches-error-card">
                <AlertCircle size={32} className="matches-error-icon" />
                <h3>Unable to Load Matches</h3>
                <p>{error}</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={loadMatches}
                >
                  Try Again
                </button>
              </div>
            ) : matches.length === 0 ? (
              <div className="matches-empty-card">
                <div className="matches-empty-icon">
                  <GitCompare size={28} />
                </div>
                <h3 className="matches-empty-title">No Possible Matches Yet</h3>
                <p className="matches-empty-desc">
                  Tracelt&rsquo;s automated engine continuously compares newly
                  reported lost and found items using category, location, date,
                  and keyword signals.
                </p>
                <div className="matches-empty-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleTriggerScan}
                  >
                    Scan Now
                  </button>
                  <Link to="/explore" className="btn btn-primary">
                    Explore Campus Reports
                  </Link>
                </div>
              </div>
            ) : (
              <div className="matches-list">
                {matches.map((m) => {
                  const isLostOwner = m.lost_item?.user_id === user.id;
                  const isFoundOwner = m.found_item?.user_id === user.id;
                  const myClaim = userClaims[m.id];
                  const incomingClaim = incomingClaims[m.id];

                  return (
                    <article key={m.id} className="match-card">
                      {/* Top Bar: Confidence Score & Status */}
                      <div className="match-card__score-header">
                        <div className="match-score-group">
                          <div
                            className={`match-score-badge ${getScoreBadgeClass(m.score)}`}
                          >
                            <span className="match-score-value">
                              {m.score}% MATCH
                            </span>
                          </div>
                          <span className="match-confidence-tag">
                            {getScoreLabel(m.score)}
                          </span>

                          {/* Separate Gemini Visual Evidence Badge */}
                          {m.visual_score != null ? (
                            <div
                              className={`match-visual-badge match-visual-badge--${m.visual_verdict || "default"}`}
                              title={
                                m.visual_confidence != null
                                  ? `Gemini Visual Confidence: ${Math.round(m.visual_confidence * 100)}%`
                                  : "Gemini Visual Match"
                              }
                            >
                              <Eye size={13} />
                              <span>
                                VISUAL: {m.visual_score}% (
                                {(m.visual_verdict || "")
                                  .replace("_", " ")
                                  .toUpperCase()}
                                )
                              </span>
                            </div>
                          ) : (
                            <span
                              className="match-visual-badge match-visual-badge--none"
                              title="Item pair not evaluated visually or image not provided"
                            >
                              Visual: Not Analyzed
                            </span>
                          )}
                        </div>

                        <div className="match-header-status-pill">
                          <span
                            className={`status-dot status-dot--${m.status.toLowerCase()}`}
                          />
                          <span>{m.status}</span>
                        </div>
                      </div>

                      {/* Side-by-Side Comparison Grid */}
                      <div className="match-comparison-grid">
                        {/* Left Side: Lost Item */}
                        <div
                          className={`comparison-col ${isLostOwner ? "comparison-col--owner" : ""}`}
                        >
                          <div className="comparison-col__header">
                            <span className="comparison-col__tag comparison-col__tag--lost">
                              {isLostOwner ? "YOUR LOST ITEM" : "LOST REPORT"}
                            </span>
                            <span className="comparison-col__cat">
                              {m.lost_item?.category}
                            </span>
                          </div>

                          <div className="comparison-col__card">
                            <div className="comparison-col__img-box">
                              {m.lost_item?.image_url ? (
                                <img
                                  src={m.lost_item.image_url}
                                  alt={m.lost_item.title}
                                  className="comparison-col__img"
                                />
                              ) : (
                                <div className="comparison-col__no-img">
                                  <Package size={32} />
                                </div>
                              )}
                            </div>

                            <div className="comparison-col__info">
                              <h3 className="comparison-col__title">
                                {m.lost_item?.title}
                              </h3>
                              <div className="comparison-col__specs">
                                <div className="comparison-spec">
                                  <MapPin size={13} />
                                  <span>{m.lost_item?.location}</span>
                                </div>
                                <div className="comparison-spec">
                                  <Calendar size={13} />
                                  <span>Lost: {m.lost_item?.date}</span>
                                </div>
                                {m.lost_item?.time && (
                                  <div className="comparison-spec">
                                    <Clock size={13} />
                                    <span>Time: {m.lost_item?.time}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <Link
                            to={`/lost-items/${m.lost_item?.id}`}
                            className="btn btn-secondary comparison-view-btn"
                          >
                            <span>View Lost Report</span>
                            <ChevronRight size={14} />
                          </Link>
                        </div>

                        {/* Middle Match Connector Node */}
                        <div className="match-connector-col" aria-hidden="true">
                          <div className="match-connector-line" />
                          <div className="match-connector-node">
                            <ArrowRight size={18} />
                          </div>
                          <div className="match-connector-line" />
                        </div>

                        {/* Right Side: Found Item */}
                        <div
                          className={`comparison-col ${isFoundOwner ? "comparison-col--owner" : ""}`}
                        >
                          <div className="comparison-col__header">
                            <span className="comparison-col__tag comparison-col__tag--found">
                              {isFoundOwner
                                ? "YOUR FOUND ITEM"
                                : "POSSIBLE FOUND ITEM"}
                            </span>
                            <span className="comparison-col__cat">
                              {m.found_item?.category}
                            </span>
                          </div>

                          <div className="comparison-col__card">
                            <div className="comparison-col__img-box">
                              {m.found_item?.image_url ? (
                                <img
                                  src={m.found_item.image_url}
                                  alt={m.found_item.title}
                                  className="comparison-col__img"
                                />
                              ) : (
                                <div className="comparison-col__no-img">
                                  <Package size={32} />
                                </div>
                              )}
                            </div>

                            <div className="comparison-col__info">
                              <h3 className="comparison-col__title">
                                {m.found_item?.title}
                              </h3>
                              <div className="comparison-col__specs">
                                <div className="comparison-spec">
                                  <MapPin size={13} />
                                  <span>{m.found_item?.location}</span>
                                </div>
                                <div className="comparison-spec">
                                  <Calendar size={13} />
                                  <span>Found: {m.found_item?.date}</span>
                                </div>
                                {m.found_item?.time && (
                                  <div className="comparison-spec">
                                    <Clock size={13} />
                                    <span>Time: {m.found_item?.time}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <Link
                            to={`/found-items/${m.found_item?.id}`}
                            className="btn btn-secondary comparison-view-btn"
                          >
                            <span>View Found Report</span>
                            <ChevronRight size={14} />
                          </Link>
                        </div>
                      </div>

                      {/* Matching Signals Breakdown */}
                      <div className="match-card__signals-bar">
                        <div className="match-signal-pill">
                          <span className="match-signal-label">Category:</span>
                          <span className="match-signal-score">
                            {m.signals.category}/25
                          </span>
                        </div>
                        <div className="match-signal-pill">
                          <span className="match-signal-label">Location:</span>
                          <span className="match-signal-score">
                            {m.signals.location}/25
                          </span>
                        </div>
                        <div className="match-signal-pill">
                          <span className="match-signal-label">Date:</span>
                          <span className="match-signal-score">
                            {m.signals.date}/20
                          </span>
                        </div>
                        <div className="match-signal-pill">
                          <span className="match-signal-label">Time:</span>
                          <span className="match-signal-score">
                            {m.signals.time}/10
                          </span>
                        </div>
                        <div className="match-signal-pill">
                          <span className="match-signal-label">Keywords:</span>
                          <span className="match-signal-score">
                            {m.signals.description}/20
                          </span>
                        </div>
                      </div>

                      {/* Criteria Explanation Checklist */}
                      {m.reasons && m.reasons.length > 0 && (
                        <div className="match-reasons-box">
                          <span className="match-reasons-title">
                            Algorithmic Correlation Points:
                          </span>
                          <ul className="match-reasons-list">
                            {m.reasons.map((reason, idx) => (
                              <li key={idx} className="match-reasons-item">
                                <Check
                                  size={13}
                                  className="match-reason-check"
                                />
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Gemini AI Visual Evidence */}
                      {m.visual_score != null && (
                        <div className="match-visual-card">
                          <div className="match-visual-card__header">
                            <div className="match-visual-card__title">
                              <Eye
                                size={14}
                                className="visual-sparkle-icon"
                              />
                              <span>Visual Match Analysis</span>
                            </div>
                            <div className="match-visual-card__badges">
                              <span
                                className={`visual-verdict-pill visual-verdict-pill--${m.visual_verdict || "default"}`}
                              >
                                {(m.visual_verdict || "")
                                  .replace("_", " ")
                                  .toUpperCase()}
                              </span>
                              <span className="visual-metric-pill">
                                Visual Similarity:{" "}
                                <strong>{m.visual_score}%</strong>
                              </span>
                              {m.visual_confidence != null && (
                                <span className="visual-metric-pill">
                                  Confidence:{" "}
                                  <strong>
                                    {Math.round(m.visual_confidence * 100)}%
                                  </strong>
                                </span>
                              )}
                            </div>
                          </div>
                          {m.visual_reasons && m.visual_reasons.length > 0 && (
                            <ul className="match-visual-reasons-list">
                              {m.visual_reasons.map((vr, i) => (
                                <li
                                  key={i}
                                  className="match-visual-reason-item"
                                >
                                  <span className="visual-reason-bullet">
                                    &bull;
                                  </span>
                                  <span>{vr}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* Bottom Footer: Verification Note & State Actions */}
                      <div className="match-card__footer">
                        <div className="match-security-notice">
                          <ShieldCheck
                            size={15}
                            className="match-security-icon"
                          />
                          <span>
                            This is an automated possible match. Official
                            handover requires ownership verification.
                          </span>
                        </div>

                        <div className="match-action-buttons">
                          {/* Claim Actions for Lost Item Owner */}
                          {isLostOwner &&
                            (myClaim ? (
                              <div className="match-claim-status-wrap">
                                <span
                                  className={`match-claim-pill match-claim-pill--${myClaim.status.toLowerCase()}`}
                                >
                                  {myClaim.status === "APPROVED" && (
                                    <CheckCircle2 size={13} />
                                  )}
                                  {myClaim.status === "PENDING" && (
                                    <Clock size={13} />
                                  )}
                                  {myClaim.status === "REJECTED" && (
                                    <XCircle size={13} />
                                  )}
                                  <span>Claim: {myClaim.status}</span>
                                </span>
                                {(myClaim.status === "PENDING" ||
                                  myClaim.status === "UNDER_REVIEW" ||
                                  myClaim.status === "APPROVED") && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleContact(myClaim.id)}
                                  >
                                    <MessageSquare size={13} />
                                    <span>Contact Finder</span>
                                  </button>
                                )}
                                <Link
                                  to="/claims"
                                  className="btn btn-secondary btn-sm"
                                >
                                  View in Claims
                                </Link>
                              </div>
                            ) : (
                              m.status !== "REJECTED" && (
                                <button
                                  type="button"
                                  className="btn btn-primary match-claim-btn"
                                  onClick={() => setClaimModalMatch(m)}
                                >
                                  <HeartHandshake size={15} />
                                  <span>This Might Be Mine</span>
                                </button>
                              )
                            ))}

                          {/* Claim Actions for Found Item Owner (Finder) */}
                          {isFoundOwner && incomingClaim && (
                            <div className="match-claim-status-wrap">
                              <span
                                className={`match-claim-pill match-claim-pill--${incomingClaim.status.toLowerCase()}`}
                              >
                                <span>
                                  Incoming Claim: {incomingClaim.status}
                                </span>
                              </span>
                              {(incomingClaim.status === "PENDING" ||
                                incomingClaim.status === "UNDER_REVIEW" ||
                                incomingClaim.status === "APPROVED") && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() =>
                                    handleContact(incomingClaim.id)
                                  }
                                >
                                  <MessageSquare size={13} />
                                  <span>Contact Claimant</span>
                                </button>
                              )}
                              <Link
                                to="/claims"
                                className="btn btn-primary btn-sm"
                              >
                                Review Claim
                              </Link>
                            </div>
                          )}

                          {m.status === "POSSIBLE" ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-ghost match-dismiss-btn"
                                onClick={() =>
                                  handleStatusChange(m.id, "REJECTED")
                                }
                              >
                                <XCircle size={15} />
                                <span>Dismiss</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary match-review-btn"
                                onClick={() =>
                                  handleStatusChange(m.id, "REVIEWED")
                                }
                              >
                                <CheckCircle2 size={15} />
                                <span>Mark Reviewed</span>
                              </button>
                            </>
                          ) : (
                            <span className="match-reviewed-badge">
                              <CheckCircle2 size={14} />
                              <span>Reviewed</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Claim Submission Modal */}
      {claimModalMatch && (
        <ClaimActionModal
          match={claimModalMatch}
          isOpen={Boolean(claimModalMatch)}
          onClose={() => setClaimModalMatch(null)}
          onClaimSuccess={(newClaim) => {
            setUserClaims((prev) => ({
              ...prev,
              [newClaim.match_id]: newClaim,
            }));
            loadMatches();
          }}
        />
      )}
    </div>
  );
}
