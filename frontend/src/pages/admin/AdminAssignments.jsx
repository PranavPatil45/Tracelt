import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  fetchAdminReviewers,
  fetchAdminUnassignedCases,
  assignAdminClaim,
  assignAdminRecovery,
  autoAssignAdminCases,
} from "../../api/admin.js";
import {
  UserCheck,
  Zap,
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  User,
  Shield,
  ShieldAlert,
  RefreshCw,
  FileCheck2,
  Tag,
  Calendar,
} from "lucide-react";
import "./AdminPages.css";

export default function AdminAssignments() {
  const { token, user: currentAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState("UNASSIGNED"); // 'UNASSIGNED' | 'REVIEWERS'
  const [reviewers, setReviewers] = useState([]);
  const [unassignedCases, setUnassignedCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Assignment Modal
  const [assignModalCase, setAssignModalCase] = useState(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [modalError, setModalError] = useState("");

  // Auto-Assign Modal
  const [showAutoAssignConfirm, setShowAutoAssignConfirm] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const [revData, unassignedData] = await Promise.all([
        fetchAdminReviewers(token, currentAdmin?.campus),
        fetchAdminUnassignedCases(token, currentAdmin?.campus),
      ]);
      setReviewers(revData.reviewers || []);
      setUnassignedCases(unassignedData.cases || []);
    } catch (err) {
      console.error("Failed to load assignment data:", err);
      setError(err.message || "Failed to load reviewer assignment data.");
    } finally {
      setLoading(false);
    }
  }, [token, currentAdmin?.campus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Metric Computations
  const awaitingCount = unassignedCases.length;
  const inReviewCount = reviewers.reduce(
    (acc, r) => acc + (r.active_assigned_count || 0),
    0
  );
  const availableReviewersCount = reviewers.length;
  const capacityAlertsCount = reviewers.filter(
    (r) => (r.active_assigned_count || 0) >= 3
  ).length;

  async function handleExecuteAutoAssign() {
    setAutoAssigning(true);
    setError("");
    setSuccessMessage("");
    setShowAutoAssignConfirm(false);
    try {
      const res = await autoAssignAdminCases(token, {
        campus: currentAdmin?.campus,
      });
      setSuccessMessage(
        res.message || `Successfully assigned ${res.assigned_count} cases.`
      );
      await loadData();
    } catch (err) {
      setError(err.message || "Auto-assignment failed.");
    } finally {
      setAutoAssigning(false);
    }
  }

  function openAssignModal(c) {
    setAssignModalCase(c);
    setSelectedReviewerId("");
    setAssignmentNotes("");
    setModalError("");
  }

  async function handleExecuteManualAssign() {
    if (!selectedReviewerId) {
      setModalError("Please select an eligible reviewer.");
      return;
    }

    const revId = parseInt(selectedReviewerId, 10);
    // Explicit conflict-of-interest check
    if (
      revId === assignModalCase.claimant_id ||
      revId === assignModalCase.finder_id
    ) {
      setModalError(
        "Conflict of interest: Selected reviewer cannot be assigned to review an item they reported or claimed."
      );
      return;
    }

    setProcessing(true);
    setModalError("");
    try {
      if (assignModalCase.case_type === "CLAIM") {
        await assignAdminClaim(token, assignModalCase.case_id, {
          reviewer_id: revId,
          notes: assignmentNotes.trim() || undefined,
        });
      } else {
        await assignAdminRecovery(token, assignModalCase.case_id, {
          reviewer_id: revId,
          notes: assignmentNotes.trim() || undefined,
        });
      }
      setAssignModalCase(null);
      setSuccessMessage(
        `Successfully assigned ${assignModalCase.case_type} #${assignModalCase.case_id}.`
      );
      await loadData();
    } catch (err) {
      setModalError(err.message || "Failed to assign reviewer.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="admin-page">
      {/* Top Header */}
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h2>Reviewer Assignment</h2>
          <p>
            Assign reviewers, balance workloads, and monitor pending cases.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={loadData}
            className="admin-btn admin-btn-secondary"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowAutoAssignConfirm(true)}
            disabled={autoAssigning || unassignedCases.length === 0}
            className="admin-btn admin-btn-primary"
          >
            {autoAssigning ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Zap size={15} />
            )}
            <span>Auto-Assign Queue ({unassignedCases.length})</span>
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div
          style={{
            padding: "0.85rem 1.15rem",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "var(--radius-sm, 6px)",
            color: "var(--red, #ef4444)",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            marginBottom: "1.25rem",
            fontSize: "0.88rem",
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div
          style={{
            padding: "0.85rem 1.15rem",
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "var(--radius-sm, 6px)",
            color: "#22c55e",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            marginBottom: "1.25rem",
            fontSize: "0.88rem",
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Awaiting Assignment</span>
            <div
              className="admin-stat-icon"
              style={{
                background: "rgba(245, 158, 11, 0.12)",
                color: "var(--amber, #f59e0b)",
              }}
            >
              <Clock size={18} />
            </div>
          </div>
          <span className="admin-stat-value">
            {loading ? "—" : awaitingCount.toLocaleString()}
          </span>
          <span className="admin-stat-subtext">Unassigned review queue</span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Assigned / In Review</span>
            <div
              className="admin-stat-icon"
              style={{
                background: "rgba(69, 214, 224, 0.12)",
                color: "var(--cyan)",
              }}
            >
              <Layers size={18} />
            </div>
          </div>
          <span className="admin-stat-value">
            {loading ? "—" : inReviewCount.toLocaleString()}
          </span>
          <span className="admin-stat-subtext">Active cases with reviewers</span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Available Reviewers</span>
            <div
              className="admin-stat-icon"
              style={{
                background: "rgba(140, 123, 255, 0.12)",
                color: "var(--violet)",
              }}
            >
              <UserCheck size={18} />
            </div>
          </div>
          <span className="admin-stat-value">
            {loading ? "—" : availableReviewersCount.toLocaleString()}
          </span>
          <span className="admin-stat-subtext">Active staff & reviewers</span>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-top">
            <span>Capacity Alerts</span>
            <div
              className="admin-stat-icon"
              style={{
                background:
                  capacityAlertsCount > 0
                    ? "rgba(239, 68, 68, 0.12)"
                    : "rgba(34, 197, 94, 0.12)",
                color: capacityAlertsCount > 0 ? "#ef4444" : "#22c55e",
              }}
            >
              <ShieldAlert size={18} />
            </div>
          </div>
          <span className="admin-stat-value">
            {loading ? "—" : capacityAlertsCount.toLocaleString()}
          </span>
          <span className="admin-stat-subtext">
            {capacityAlertsCount > 0
              ? `${capacityAlertsCount} reviewer(s) at high load (≥3)`
              : "Workloads balanced across team"}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.6rem",
          borderBottom: "1px solid var(--border-hair)",
          paddingBottom: "0.85rem",
          marginBottom: "1.5rem",
        }}
      >
        <button
          onClick={() => setActiveTab("UNASSIGNED")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.45rem",
            background:
              activeTab === "UNASSIGNED"
                ? "rgba(69, 214, 224, 0.12)"
                : "var(--bg-elevated)",
            color:
              activeTab === "UNASSIGNED"
                ? "var(--cyan)"
                : "var(--text-secondary)",
            border:
              activeTab === "UNASSIGNED"
                ? "1px solid rgba(69, 214, 224, 0.4)"
                : "1px solid var(--border-hair)",
            borderRadius: "var(--radius-sm, 6px)",
            padding: "0.5rem 1rem",
            fontSize: "0.88rem",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <Clock size={15} />
          <span>Unassigned Queue</span>
          <span
            style={{
              padding: "0.12rem 0.45rem",
              borderRadius: "999px",
              background:
                activeTab === "UNASSIGNED"
                  ? "rgba(69, 214, 224, 0.25)"
                  : "var(--bg-elevated-2)",
              color:
                activeTab === "UNASSIGNED" ? "var(--cyan)" : "var(--text-muted)",
              fontSize: "0.75rem",
              fontWeight: "700",
            }}
          >
            {unassignedCases.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("REVIEWERS")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.45rem",
            background:
              activeTab === "REVIEWERS"
                ? "rgba(69, 214, 224, 0.12)"
                : "var(--bg-elevated)",
            color:
              activeTab === "REVIEWERS"
                ? "var(--cyan)"
                : "var(--text-secondary)",
            border:
              activeTab === "REVIEWERS"
                ? "1px solid rgba(69, 214, 224, 0.4)"
                : "1px solid var(--border-hair)",
            borderRadius: "var(--radius-sm, 6px)",
            padding: "0.5rem 1rem",
            fontSize: "0.88rem",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <UserCheck size={15} />
          <span>Reviewer Workloads & Capacity</span>
          <span
            style={{
              padding: "0.12rem 0.45rem",
              borderRadius: "999px",
              background:
                activeTab === "REVIEWERS"
                  ? "rgba(69, 214, 224, 0.25)"
                  : "var(--bg-elevated-2)",
              color:
                activeTab === "REVIEWERS" ? "var(--cyan)" : "var(--text-muted)",
              fontSize: "0.75rem",
              fontWeight: "700",
            }}
          >
            {reviewers.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Unassigned Queue */}
      {activeTab === "UNASSIGNED" && (
        <div>
          {loading ? (
            <div
              className="admin-card"
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "3.5rem 1rem",
                gap: "0.75rem",
                color: "var(--text-muted)",
              }}
            >
              <Loader2 className="animate-spin" size={24} style={{ color: "var(--cyan)" }} />
              <span>Loading unassigned review cases...</span>
            </div>
          ) : unassignedCases.length === 0 ? (
            <div
              className="admin-card"
              style={{
                textAlign: "center",
                padding: "2.5rem 1.5rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "rgba(34, 197, 94, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#22c55e",
                  marginBottom: "0.25rem",
                }}
              >
                <CheckCircle2 size={26} />
              </div>
              <h3
                style={{
                  color: "var(--text-primary)",
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: "700",
                }}
              >
                No cases awaiting assignment
              </h3>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.88rem",
                  maxWidth: "480px",
                  margin: 0,
                }}
              >
                All review-required claims and disputed recoveries have been
                assigned to active campus reviewers.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
              }}
            >
              {unassignedCases.map((c) => {
                const isClaim = c.case_type === "CLAIM";
                const isUrgent = c.is_urgent || c.is_competing;
                return (
                  <div
                    key={`${c.case_type}-${c.case_id}`}
                    className="admin-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "1.1rem 1.35rem",
                      gap: "1.25rem",
                      flexWrap: "wrap",
                      borderLeft: isUrgent
                        ? "3px solid #ef4444"
                        : "3px solid var(--cyan)",
                    }}
                  >
                    <div style={{ flex: "1 1 320px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.4rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: "700",
                            padding: "0.18rem 0.55rem",
                            borderRadius: "4px",
                            background: isClaim
                              ? "rgba(69, 214, 224, 0.12)"
                              : "rgba(140, 123, 255, 0.12)",
                            color: isClaim ? "var(--cyan)" : "var(--violet)",
                          }}
                        >
                          {c.case_type} #{c.case_id}
                        </span>

                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "4px",
                            background: "var(--bg-elevated-2)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {c.item_category}
                        </span>

                        {isUrgent && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: "700",
                              background: "rgba(239, 68, 68, 0.15)",
                              color: "#ef4444",
                              padding: "0.15rem 0.5rem",
                              borderRadius: "4px",
                            }}
                          >
                            {c.is_competing
                              ? "COMPETING CLAIMS"
                              : c.review_status === "DISPUTED"
                              ? "DISPUTED RECOVERY"
                              : "URGENT"}
                          </span>
                        )}

                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          Review: {c.review_reason || "Requires Review"}
                        </span>
                      </div>

                      <h4
                        style={{
                          color: "var(--text-primary)",
                          margin: 0,
                          fontSize: "1.05rem",
                          fontWeight: "700",
                        }}
                      >
                        {c.item_title}
                      </h4>

                      <div
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--text-secondary)",
                          marginTop: "0.35rem",
                          display: "flex",
                          gap: "1.25rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <span>
                          Claimant:{" "}
                          <strong style={{ color: "var(--text-primary)" }}>
                            {c.claimant_name}
                          </strong>
                        </span>

                        {c.finder_name && (
                          <span>
                            Finder:{" "}
                            <strong style={{ color: "var(--text-primary)" }}>
                              {c.finder_name}
                            </strong>
                          </span>
                        )}

                        <span style={{ color: "var(--text-muted)" }}>
                          Submitted:{" "}
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => openAssignModal(c)}
                      className="admin-btn admin-btn-primary"
                      style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                    >
                      Assign Reviewer
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Reviewer Workloads & Capacity */}
      {activeTab === "REVIEWERS" && (
        <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid var(--border-hair)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3 className="admin-card__title" style={{ margin: 0 }}>
              <UserCheck size={18} style={{ color: "var(--cyan)" }} />
              Reviewer Roster & Active Caseloads
            </h3>
            <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
              {reviewers.length} eligible reviewer(s)
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "0.88rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--bg-elevated-2)",
                    borderBottom: "1px solid var(--border-hair)",
                    color: "var(--text-muted)",
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <th style={{ padding: "0.85rem 1.25rem" }}>Reviewer</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Role & Campus</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Active Caseload</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Pending</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Under Review</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Resolved</th>
                  <th style={{ padding: "0.85rem 1.25rem" }}>Last Assigned</th>
                </tr>
              </thead>
              <tbody>
                {reviewers.map((r) => {
                  const isHighLoad = (r.active_assigned_count || 0) >= 3;
                  return (
                    <tr
                      key={r.id}
                      style={{ borderBottom: "1px solid var(--border-hair)" }}
                    >
                      <td style={{ padding: "0.85rem 1.25rem" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.65rem",
                          }}
                        >
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "50%",
                              background: "rgba(69, 214, 224, 0.12)",
                              color: "var(--cyan)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "700",
                              fontSize: "0.8rem",
                              flexShrink: 0,
                            }}
                          >
                            {r.full_name?.substring(0, 2).toUpperCase() || "RV"}
                          </div>
                          <div>
                            <span
                              style={{
                                fontWeight: "600",
                                color: "var(--text-primary)",
                                display: "block",
                              }}
                            >
                              {r.full_name}
                            </span>
                            <span
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              {r.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "4px",
                            background: "var(--bg-elevated-2)",
                            fontSize: "0.78rem",
                            fontWeight: "600",
                            color: "var(--text-primary)",
                          }}
                        >
                          {r.role}
                        </span>
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-muted)",
                            display: "block",
                            marginTop: "0.2rem",
                          }}
                        >
                          {r.campus}
                        </span>
                      </td>

                      <td style={{ padding: "0.85rem 1rem" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.2rem 0.65rem",
                            borderRadius: "999px",
                            fontWeight: "700",
                            fontSize: "0.8rem",
                            background: isHighLoad
                              ? "rgba(239, 68, 68, 0.15)"
                              : r.active_assigned_count > 0
                              ? "rgba(69, 214, 224, 0.12)"
                              : "rgba(34, 197, 94, 0.12)",
                            color: isHighLoad
                              ? "#ef4444"
                              : r.active_assigned_count > 0
                              ? "var(--cyan)"
                              : "#22c55e",
                          }}
                        >
                          {r.active_assigned_count} Active{" "}
                          {isHighLoad ? "(High)" : ""}
                        </span>
                      </td>

                      <td
                        style={{
                          padding: "0.85rem 1rem",
                          color: "var(--amber, #f59e0b)",
                          fontWeight: "600",
                        }}
                      >
                        {r.pending_count}
                      </td>

                      <td
                        style={{
                          padding: "0.85rem 1rem",
                          color: "var(--cyan)",
                          fontWeight: "600",
                        }}
                      >
                        {r.under_review_count}
                      </td>

                      <td
                        style={{
                          padding: "0.85rem 1rem",
                          color: "#22c55e",
                          fontWeight: "600",
                        }}
                      >
                        {r.resolved_count}
                      </td>

                      <td
                        style={{
                          padding: "0.85rem 1.25rem",
                          color: "var(--text-muted)",
                          fontSize: "0.82rem",
                        }}
                      >
                        {r.last_assigned_at
                          ? new Date(r.last_assigned_at).toLocaleDateString()
                          : "Never"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Assignment Modal */}
      {assignModalCase && (
        <div className="admin-modal-overlay">
          <div className="admin-modal" style={{ maxWidth: "520px" }}>
            <div className="admin-modal-header">
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700" }}>
                Assign Reviewer to {assignModalCase.case_type} #
                {assignModalCase.case_id}
              </h3>
              <button
                onClick={() => setAssignModalCase(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body" style={{ gap: "1rem" }}>
              {/* Item Preview */}
              <div
                style={{
                  background: "var(--bg-elevated-2)",
                  padding: "0.85rem 1rem",
                  borderRadius: "var(--radius-sm, 6px)",
                  fontSize: "0.85rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.3rem",
                  border: "1px solid var(--border-hair)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-primary)", fontWeight: "700" }}>
                    {assignModalCase.item_title}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                    {assignModalCase.item_category}
                  </span>
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                  <span>Claimant: {assignModalCase.claimant_name} (ID: {assignModalCase.claimant_id})</span>
                  {assignModalCase.finder_name && (
                    <span style={{ marginLeft: "1rem" }}>
                      Finder: {assignModalCase.finder_name} (ID: {assignModalCase.finder_id})
                    </span>
                  )}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                  Reason: {assignModalCase.review_reason || "Requires Review"}
                </div>
              </div>

              {modalError && (
                <div
                  style={{
                    padding: "0.75rem 1rem",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "6px",
                    color: "var(--red, #ef4444)",
                    fontSize: "0.85rem",
                  }}
                >
                  {modalError}
                </div>
              )}

              {/* Reviewer Selection */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>
                  Select Eligible Reviewer:
                </label>
                <select
                  value={selectedReviewerId}
                  onChange={(e) => {
                    setSelectedReviewerId(e.target.value);
                    setModalError("");
                  }}
                  className="admin-select"
                  style={{ width: "100%", padding: "0.65rem 0.85rem" }}
                >
                  <option value="">-- Choose Reviewer --</option>
                  {reviewers.map((r) => {
                    const isClaimant = r.id === assignModalCase.claimant_id;
                    const isFinder = r.id === assignModalCase.finder_id;
                    const hasConflict = isClaimant || isFinder;
                    const conflictTag = isClaimant
                      ? "• [CONFLICT: CLAIMANT]"
                      : isFinder
                      ? "• [CONFLICT: FINDER]"
                      : "";
                    return (
                      <option key={r.id} value={r.id} disabled={hasConflict}>
                        {r.full_name} ({r.role}) — {r.active_assigned_count} active case(s) {conflictTag}
                      </option>
                    );
                  })}
                </select>
                <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                  Reviewers who are parties to this case are automatically excluded.
                </span>
              </div>

              {/* Notes */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: "600" }}>
                  Assignment Instructions (Optional):
                </label>
                <textarea
                  rows={3}
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Specific review instructions or verification guidance..."
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-hair)",
                    color: "var(--text-primary)",
                    padding: "0.65rem 0.85rem",
                    borderRadius: "var(--radius-sm, 6px)",
                    fontSize: "0.88rem",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                onClick={() => setAssignModalCase(null)}
                className="admin-btn admin-btn-secondary"
                disabled={processing}
              >
                Cancel
              </button>

              <button
                onClick={handleExecuteManualAssign}
                disabled={processing || !selectedReviewerId}
                className="admin-btn admin-btn-primary"
              >
                {processing && <Loader2 size={14} className="animate-spin" />}
                <span>Confirm Assignment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Assign Confirmation Modal */}
      {showAutoAssignConfirm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal" style={{ maxWidth: "460px" }}>
            <div className="admin-modal-header">
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "700" }}>
                Confirm Auto-Assignment
              </h3>
              <button
                onClick={() => setShowAutoAssignConfirm(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body" style={{ gap: "0.85rem" }}>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                You are about to automatically distribute{" "}
                <strong style={{ color: "var(--cyan)" }}>
                  {unassignedCases.length} unassigned case(s)
                </strong>{" "}
                across eligible reviewers.
              </p>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.5 }}>
                The algorithm automatically assigns cases to the least-loaded eligible reviewers on your campus while strictly enforcing conflict-of-interest safeguards.
              </p>
            </div>

            <div className="admin-modal-footer">
              <button
                onClick={() => setShowAutoAssignConfirm(false)}
                className="admin-btn admin-btn-secondary"
                disabled={autoAssigning}
              >
                Cancel
              </button>

              <button
                onClick={handleExecuteAutoAssign}
                disabled={autoAssigning}
                className="admin-btn admin-btn-primary"
              >
                {autoAssigning ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Zap size={14} />
                )}
                <span>Execute Auto-Assign</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
