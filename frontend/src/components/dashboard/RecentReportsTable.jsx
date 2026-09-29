import { ArrowRight, MapPin, Calendar, FileText } from 'lucide-react'
import './RecentReportsTable.css'

export default function RecentReportsTable({
  reports = [],
  onViewAll,
  onViewReport,
}) {
  return (
    <section className="recent-reports-section" aria-label="Your Recent Reports">
      <div className="section-title-row">
        <div>
          <h3 className="section-title">Your Recent Reports</h3>
          <p className="section-subtitle">
            Overview of items you logged or turned in.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-ghost section-action-btn"
          onClick={onViewAll}
        >
          <span>View all reports</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-state-card__icon">📋</div>
          <h4 className="empty-state-card__title">No Recent Reports</h4>
          <p className="empty-state-card__desc">
            You haven&rsquo;t submitted any lost or found reports yet.
          </p>
        </div>
      ) : (
        <div className="reports-table-container">
          <table className="reports-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Type</th>
              <th>Location</th>
              <th>Date</th>
              <th>Status</th>
              <th className="reports-table__th-action">Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const isLost = report.type.toLowerCase() === 'lost'

              return (
                <tr key={report.id}>
                  <td>
                    <div className="report-item-cell">
                      <span className="report-item-cell__emoji">{report.icon}</span>
                      <span className="report-item-cell__name">{report.item}</span>
                    </div>
                  </td>

                  <td>
                    <span
                      className={`report-type-badge ${
                        isLost ? 'report-type-badge--lost' : 'report-type-badge--found'
                      }`}
                    >
                      {report.type}
                    </span>
                  </td>

                  <td>
                    <div className="report-meta-cell">
                      <MapPin size={13} className="cell-icon" />
                      <span>{report.location}</span>
                    </div>
                  </td>

                  <td>
                    <div className="report-meta-cell">
                      <Calendar size={13} className="cell-icon" />
                      <span>{report.date}</span>
                    </div>
                  </td>

                  <td>
                    <span className={`report-status-badge report-status-badge--${report.statusColor}`}>
                      <span className="status-badge-dot" />
                      {report.status}
                    </span>
                  </td>

                  <td className="reports-table__td-action">
                    <button
                      type="button"
                      className="reports-view-action"
                      onClick={() => onViewReport && onViewReport(report)}
                    >
                      <span>View</span>
                      <ArrowRight size={12} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Mobile Stacked Cards */}
        <div className="reports-mobile-list">
          {reports.map((report) => {
            const isLost = report.type.toLowerCase() === 'lost'

            return (
              <div key={report.id} className="report-mobile-card">
                <div className="report-mobile-card__header">
                  <div className="report-item-cell">
                    <span className="report-item-cell__emoji">{report.icon}</span>
                    <span className="report-item-cell__name">{report.item}</span>
                  </div>

                  <span
                    className={`report-type-badge ${
                      isLost ? 'report-type-badge--lost' : 'report-type-badge--found'
                    }`}
                  >
                    {report.type}
                  </span>
                </div>

                <div className="report-mobile-card__details">
                  <div className="report-meta-cell">
                    <MapPin size={12} className="cell-icon" />
                    <span>{report.location}</span>
                  </div>
                  <div className="report-meta-cell">
                    <Calendar size={12} className="cell-icon" />
                    <span>{report.date}</span>
                  </div>
                </div>

                <div className="report-mobile-card__footer">
                  <span className={`report-status-badge report-status-badge--${report.statusColor}`}>
                    <span className="status-badge-dot" />
                    {report.status}
                  </span>

                  <button
                    type="button"
                    className="reports-view-action"
                    onClick={() => onViewReport && onViewReport(report)}
                  >
                    <span>View Report</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      )}
    </section>
  )
}
