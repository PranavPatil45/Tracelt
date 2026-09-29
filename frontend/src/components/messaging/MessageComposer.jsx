import { useState } from 'react'
import { Send, Lock, AlertCircle, Loader2 } from 'lucide-react'

export default function MessageComposer({
  onSendMessage,
  sending = false,
  isClosed = false,
  closeReason = '',
}) {
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  const trimmed = content.trim()
  const charCount = content.length
  const isOverLimit = charCount > 2000
  const canSend = trimmed.length > 0 && !isOverLimit && !sending && !isClosed

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    if (!canSend) return

    setError('')
    try {
      await onSendMessage(trimmed)
      setContent('')
    } catch (err) {
      setError(err.message || 'Failed to send message.')
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (isClosed) {
    return (
      <div className="msg-composer-closed">
        <Lock size={16} className="msg-composer-lock-icon" />
        <span className="msg-composer-closed-text">
          Messaging is disabled for this conversation ({closeReason || 'Closed'}).
        </span>
      </div>
    )
  }

  return (
    <div className="msg-composer-wrap">
      {error && (
        <div className="msg-composer-error" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button
            type="button"
            className="msg-composer-retry"
            onClick={handleSubmit}
          >
            Retry
          </button>
        </div>
      )}

      <form className="msg-composer-form" onSubmit={handleSubmit}>
        <div className="msg-composer-input-box">
          <textarea
            className="msg-composer-textarea"
            placeholder="Type a message to coordinate handover (e.g. 'Can we meet at the library?')..."
            rows={2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={2000}
            disabled={sending}
          />

          <div className="msg-composer-meta">
            <span
              className={`msg-char-counter ${
                isOverLimit ? 'msg-char-counter--danger' : charCount > 1800 ? 'msg-char-counter--warn' : ''
              }`}
            >
              {charCount} / 2000
            </span>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary msg-send-btn"
          disabled={!canSend}
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 size={16} className="msg-spinner" />
          ) : (
            <>
              <Send size={15} />
              <span>Send</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
