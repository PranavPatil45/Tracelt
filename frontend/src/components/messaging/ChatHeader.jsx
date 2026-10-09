import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Package,
  MapPin,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react'
import { getItemImageUrl } from '../../utils/imageUrl.js'

export default function ChatHeader({
  conversation,
  onBack,
  showBackButton = false,
}) {
  if (!conversation) return null

  const other = conversation.other_participant
  const item = conversation.item || conversation.found_item || conversation.lost_item
  const claimStatus = conversation.claim_status

  return (
    <header className="msg-chat-header">
      <div className="msg-header-left">
        {showBackButton && (
          <button
            type="button"
            className="msg-back-btn"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        {/* Thumbnail */}
        <div className="msg-header-avatar">
          {getItemImageUrl(item?.image_url) ? (
            <img
              src={getItemImageUrl(item?.image_url)}
              alt={item?.title}
              className="msg-header-thumb-img"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                if (e.currentTarget.nextElementSibling) {
                  e.currentTarget.nextElementSibling.style.display = 'flex'
                }
              }}
            />
          ) : null}
          <div
            className="msg-header-thumb-placeholder"
            style={{ display: getItemImageUrl(item?.image_url) ? 'none' : 'flex' }}
          >
            <Package size={20} />
          </div>
        </div>

        {/* Context info */}
        <div className="msg-header-info">
          <div className="msg-header-title-row">
            <h3 className="msg-header-title">{item?.title || 'Report Chat'}</h3>
            {claimStatus && (
              <span className={`msg-header-claim-pill msg-header-claim-pill--${claimStatus.toLowerCase()}`}>
                {claimStatus === 'APPROVED' && <CheckCircle2 size={11} />}
                {claimStatus === 'PENDING' && <Clock size={11} />}
                {claimStatus === 'REJECTED' && <XCircle size={11} />}
                Claim: {claimStatus}
              </span>
            )}
            {conversation.is_closed && (
              <span className="msg-closed-pill">Closed</span>
            )}
          </div>

          <div className="msg-header-subrow">
            <span className="msg-header-user">
              {other?.full_name || 'Campus User'}
              <span className={`msg-role-badge msg-role-badge--${(other?.role || 'User').toLowerCase()}`}>
                {other?.role || 'Participant'}
              </span>
            </span>
            <span className="msg-header-sep">&bull;</span>
            <span className="msg-header-campus">{other?.campus || 'Campus'}</span>
            {item?.location && (
              <>
                <span className="msg-header-sep">&bull;</span>
                <span className="msg-header-loc">
                  <MapPin size={11} /> {item.location}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action links */}
      <div className="msg-header-actions">
        {item?.id && (
          <Link
            to={item.item_type === 'FOUND' ? `/found-items/${item.id}` : `/lost-items/${item.id}`}
            className="btn btn-secondary btn-sm msg-header-action-btn"
            title="View full report"
          >
            <Package size={13} />
            <span>View Item</span>
          </Link>
        )}
        <Link
          to="/claims"
          className="btn btn-secondary btn-sm msg-header-action-btn"
          title="View claims overview"
        >
          <ShieldCheck size={13} />
          <span>View Claim</span>
        </Link>
      </div>
    </header>
  )
}
