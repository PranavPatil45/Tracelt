import { FileText, ShieldCheck, Clock, RefreshCw } from 'lucide-react'

export default function ReportInformation({ item }) {
  function formatTimestamp(ts) {
    if (!ts) return 'N/A'
    try {
      const dt = new Date(ts)
      return dt.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return String(ts)
    }
  }

  return (
    <section className="item-report-info-card" aria-labelledby="report-info-heading">
      <div className="item-report-info-header">
        <FileText size={16} className="item-report-info-icon" />
        <h2 id="report-info-heading" className="item-report-info-title">
          Report Information
        </h2>
      </div>

      <div className="item-report-info-rows">
        <div className="item-report-row">
          <span className="item-report-key">Report ID</span>
          <span className="item-report-val">#{item.id}</span>
        </div>

        <div className="item-report-row">
          <span className="item-report-key">Report Type</span>
          <span className="item-report-val">{item.type}</span>
        </div>

        <div className="item-report-row">
          <span className="item-report-key">Report Status</span>
          <span className="item-report-val item-report-val--highlight">{item.status}</span>
        </div>

        <div className="item-report-row">
          <span className="item-report-key">Reported On</span>
          <span className="item-report-val">
            <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
            {formatTimestamp(item.created_at)}
          </span>
        </div>

        {item.updated_at && (
          <div className="item-report-row">
            <span className="item-report-key">Last Updated</span>
            <span className="item-report-val">
              <RefreshCw size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
              {formatTimestamp(item.updated_at)}
            </span>
          </div>
        )}

        <div className="item-report-row">
          <span className="item-report-key">Campus Scope</span>
          <span className="item-report-val">{item.campus || 'Main Campus'}</span>
        </div>
      </div>

      <div className="item-privacy-note">
        <ShieldCheck size={14} className="item-privacy-icon" />
        <span>
          User identity is protected. Contact and verification occur strictly through authenticated Tracelt protocols.
        </span>
      </div>
    </section>
  )
}
