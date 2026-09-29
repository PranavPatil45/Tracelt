import { ChevronLeft, ChevronRight, Loader2, Inbox } from 'lucide-react'
import './AdminTable.css'

export default function AdminTable({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found matching your filters.',
  page = 1,
  total = 0,
  limit = 20,
  onPageChange,
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const startIdx = (page - 1) * limit + 1
  const endIdx = Math.min(total, page * limit)

  return (
    <div className="admin-table-container">
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={col.key || idx} style={col.style || {}}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                    <Loader2 className="animate-spin" size={20} style={{ color: 'var(--cyan)' }} />
                    <span>Loading data&hellip;</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="admin-table-empty">
                    <Inbox size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                    <p>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rIdx) => (
                <tr key={row.id || rIdx}>
                  {columns.map((col, cIdx) => (
                    <td key={col.key || cIdx} style={col.cellStyle || {}}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {total > 0 && (
        <div className="admin-table-pagination">
          <div>
            Showing <strong>{startIdx}</strong> to <strong>{endIdx}</strong> of{' '}
            <strong>{total}</strong> records
          </div>

          <div className="admin-pagination-btns">
            <button
              className="admin-pg-btn"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange && onPageChange(page - 1)}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              className="admin-pg-btn"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange && onPageChange(page + 1)}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
