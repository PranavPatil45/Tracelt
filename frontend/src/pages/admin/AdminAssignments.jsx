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
  RefreshCw,
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

  // Auto-Assign
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

  async function handleAutoAssign() {
    setAutoAssigning(true);
    setError("");
    setSuccessMessage("");
    try {
      const res = await autoAssignAdminCases(token, {
        campus: currentAdmin?.campus,
      });
      setSuccessMessage(
        res.message || `Successfully assigned ${res.assigned_count} cases.`,
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
    // Check conflict
    if (
      revId === assignModalCase.claimant_id ||
      revId === assignModalCase.finder_id
    ) {
      setModalError(
        "Conflict of interest: Selected reviewer cannot be assigned to review an item they reported or claimed.",
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
        `Successfully assigned ${assignModalCase.case_type} #${assignModalCase.case_id}.`,
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
      <div
        className="admin-page__header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.5rem",
        }}
      >
        <div>
          <h1 className="admin-page__title">Reviewer Assignment Desk</h1>
          <p className="admin-page__subtitle" style={{ padding: "5px" }}>
            Manage reviewer capacity, unassigned review queues, and
            conflict-free case distributions.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={loadData}
            className="admin-btn admin-btn--secondary"
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={handleAutoAssign}
            disabled={autoAssigning || unassignedCases.length === 0}
            className="admin-btn admin-btn--primary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--cyan)",
              color: "#000",
              fontWeight: "600",
            }}
          >
            {autoAssigning ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Zap size={16} />
            )}
            <span>Auto-Assign Queue ({unassignedCases.length})</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div
          style={{
            padding: "0.85rem 1rem",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            color: "var(--red)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div
          style={{
            padding: "0.85rem 1rem",
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "8px",
            color: "#10b981",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: "1px solid var(--border-hair)",
          paddingBottom: "0.5rem",
          marginBottom: "1.25rem",
          padding: "10px",
        }}
      >
        <button
          onClick={() => setActiveTab("UNASSIGNED")}
          className={`admin-filter-pill ${activeTab === "UNASSIGNED" ? "admin-filter-pill--active" : ""}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            backgroundColor: "#77a9d9", // Light blue background from the image
            color: "#000000", // Dark text color
            border: "none",
            borderRadius: "6px", // Rounded corners
            padding: "0.5rem 1rem", // Adjust padding for pill height/width
            fontSize: "0.95rem",
            fontWeight: "500",
            cursor: "pointer",
          }}
        >
          <Clock size={15} />
          <span>Unassigned Queue</span>
          <span
            style={{
              padding: "0.1rem 0.4rem",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.1)",
              fontSize: "0.75rem",
            }}
          >
            {unassignedCases.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("REVIEWERS")}
          className={`admin-filter-pill ${activeTab === "REVIEWERS" ? "admin-filter-pill--active" : ""}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            backgroundColor: "#8aa9c6", // Light blue background from the image
            color: "#000000", // Dark text color
            border: "none",
            borderRadius: "6px", // Rounded corners
            padding: "0.5rem 1rem", // Adjust padding for pill height/width
            fontSize: "0.95rem",
            fontWeight: "500",
            cursor: "pointer",
          }}
        >
          <UserCheck size={15} />
          <span>Reviewer Workloads & Capacity</span>
          <span
            style={{
              padding: "0.1rem 0.4rem",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.1)",
              fontSize: "0.75rem",
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
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "3rem",
              }}
            >
              <Loader2
                className="animate-spin"
                size={32}
                style={{ color: "var(--cyan)" }}
              />
            </div>
          ) : unassignedCases.length === 0 ? (
            <div
              className="admin-card"
              style={{ textAlign: "center", padding: "3.5rem 1rem" }}
            >
              <CheckCircle2
                size={44}
                style={{
                  color: "#10b981",
                  margin: "0 auto 1rem",
                  opacity: 0.8,
                }}
              />
              <h3
                style={{ color: "var(--text-primary)", marginBottom: "0.5rem" }}
              >
                All Cases Assigned
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                There are currently no unassigned review-required claims or
                disputed recoveries.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
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
                      padding: "1rem 1.25rem",
                      gap: "1rem",
                      flexWrap: "wrap",
                      borderLeft: isUrgent
                        ? "3px solid #ef4444"
                        : "3px solid var(--border-hair)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.35rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: "700",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "4px",
                            background: isClaim
                              ? "rgba(0, 242, 254, 0.1)"
                              : "rgba(168, 85, 247, 0.1)",
                            color: isClaim ? "var(--cyan)" : "#a855f7",
                          }}
                        >
                          {c.case_type} #{c.case_id}
                        </span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
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
                              padding: "0.15rem 0.45rem",
                              borderRadius: "4px",
                            }}
                          >
                            {c.is_competing ? "COMPETING" : "URGENT"}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          Reason: {c.review_reason || "Requires Review"}
                        </span>
                      </div>

                      <h4
                        style={{
                          color: "var(--text-primary)",
                          margin: 0,
                          fontSize: "1rem",
                          fontWeight: "600",
                        }}
                      >
                        {c.item_title}
                      </h4>

                      <div
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--text-secondary)",
                          marginTop: "0.3rem",
                        }}
                      >
                        <span>
                          Claimant:{" "}
                          <strong style={{ color: "var(--text-primary)" }}>
                            {c.claimant_name}
                          </strong>
                        </span>
                        {c.finder_name && (
                          <span style={{ marginLeft: "1rem" }}>
                            Finder:{" "}
                            <strong style={{ color: "var(--text-primary)" }}>
                              {c.finder_name}
                            </strong>
                          </span>
                        )}
                        <span
                          style={{
                            marginLeft: "1rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          Submitted:{" "}
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => openAssignModal(c)}
                      className="admin-btn admin-btn--primary"
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

      {/* Tab 2: Reviewer Workloads */}
      {activeTab === "REVIEWERS" && (
        <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
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
                  background: "var(--bg-elevated)",
                  borderBottom: "1px solid var(--border-hair)",
                  color: "var(--text-muted)",
                }}
              >
                <th style={{ padding: "0.85rem 1rem" }}>Reviewer</th>
                <th style={{ padding: "0.85rem 1rem" }}>Role & Campus</th>
                <th style={{ padding: "0.85rem 1rem" }}>Active Workload</th>
                <th style={{ padding: "0.85rem 1rem" }}>Pending</th>
                <th style={{ padding: "0.85rem 1rem" }}>Under Review</th>
                <th style={{ padding: "0.85rem 1rem" }}>Resolved</th>
                <th style={{ padding: "0.85rem 1rem" }}>Last Assigned</th>
              </tr>
            </thead>
            <tbody>
              {reviewers.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: "1px solid var(--border-hair)" }}
                >
                  <td style={{ padding: "0.85rem 1rem" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: "rgba(0, 242, 254, 0.1)",
                          color: "var(--cyan)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "600",
                          fontSize: "0.8rem",
                        }}
                      >
                        {r.full_name?.substring(0, 2).toUpperCase()}
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
                        display: "block",
                        fontWeight: "500",
                        color: "var(--text-primary)",
                      }}
                    >
                      {r.role}
                    </span>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {r.campus}
                    </span>
                  </td>

                  <td style={{ padding: "0.85rem 1rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.6rem",
                        borderRadius: "12px",
                        fontWeight: "700",
                        fontSize: "0.82rem",
                        background:
                          r.active_assigned_count > 3
                            ? "rgba(239, 68, 68, 0.15)"
                            : "rgba(16, 185, 129, 0.15)",
                        color:
                          r.active_assigned_count > 3 ? "#ef4444" : "#10b981",
                      }}
                    >
                      {r.active_assigned_count} Active
                    </span>
                  </td>

                  <td
                    style={{
                      padding: "0.85rem 1rem",
                      color: "#f59e0b",
                      fontWeight: "600",
                    }}
                  >
                    {r.pending_count}
                  </td>

                  <td
                    style={{
                      padding: "0.85rem 1rem",
                      color: "#3b82f6",
                      fontWeight: "600",
                    }}
                  >
                    {r.under_review_count}
                  </td>

                  <td style={{ padding: "0.85rem 1rem", color: "#10b981" }}>
                    {r.resolved_count}
                  </td>

                  <td
                    style={{
                      padding: "0.85rem 1rem",
                      color: "var(--text-muted)",
                      fontSize: "0.8rem",
                    }}
                  >
                    {r.last_assigned_at
                      ? new Date(r.last_assigned_at).toLocaleDateString()
                      : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Assignment Modal */}
      {assignModalCase && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-hair)",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "500px",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "var(--text-primary)",
                  fontSize: "1.15rem",
                }}
              >
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
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                background: "var(--bg-elevated)",
                padding: "0.85rem",
                borderRadius: "8px",
                fontSize: "0.85rem",
              }}
            >
              <span
                style={{
                  color: "var(--text-primary)",
                  fontWeight: "600",
                  display: "block",
                }}
              >
                Item: {assignModalCase.item_title}
              </span>
              <span
                style={{
                  color: "var(--text-secondary)",
                  display: "block",
                  marginTop: "0.2rem",
                }}
              >
                Claimant ID: {assignModalCase.claimant_id} (
                {assignModalCase.claimant_name})
              </span>
              {assignModalCase.finder_id && (
                <span
                  style={{ color: "var(--text-secondary)", display: "block" }}
                >
                  Finder ID: {assignModalCase.finder_id} (
                  {assignModalCase.finder_name})
                </span>
              )}
            </div>

            {modalError && (
              <div
                style={{
                  padding: "0.75rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "6px",
                  color: "var(--red)",
                  fontSize: "0.85rem",
                }}
              >
                {modalError}
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
              }}
            >
              <label
                style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}
              >
                Select Eligible Reviewer:
              </label>
              <select
                value={selectedReviewerId}
                onChange={(e) => {
                  setSelectedReviewerId(e.target.value);
                  setModalError("");
                }}
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-hair)",
                  color: "var(--text-primary)",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "8px",
                  fontSize: "0.88rem",
                  outline: "none",
                }}
              >
                <option value="">-- Choose Reviewer --</option>
                {reviewers.map((r) => {
                  const hasConflict =
                    r.id === assignModalCase.claimant_id ||
                    r.id === assignModalCase.finder_id;
                  return (
                    <option key={r.id} value={r.id} disabled={hasConflict}>
                      {r.full_name} ({r.role}) - {r.active_assigned_count}{" "}
                      active cases{" "}
                      {hasConflict ? "• [CONFLICT OF INTEREST]" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
              }}
            >
              <label
                style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}
              >
                Assignment Notes / Instructions (Optional):
              </label>
              <textarea
                rows={3}
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                placeholder="Specific instructions or review guidance..."
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-hair)",
                  color: "var(--text-primary)",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "8px",
                  fontSize: "0.88rem",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
                marginTop: "0.5rem",
              }}
            >
              <button
                onClick={() => setAssignModalCase(null)}
                className="admin-btn admin-btn--secondary"
                disabled={processing}
              >
                Cancel
              </button>

              <button
                onClick={handleExecuteManualAssign}
                disabled={processing || !selectedReviewerId}
                className="admin-btn admin-btn--primary"
                style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                {processing && <Loader2 size={14} className="animate-spin" />}
                <span>Confirm Assignment</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
