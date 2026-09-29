import React from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  FileCheck,
  PackageCheck,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react'
import './RecoveryTimeline.css'

export default function RecoveryTimeline({ timeline = [], currentStatus = '' }) {
  const getStepIcon = (key, status) => {
    if (status === 'completed') {
      return <CheckCircle2 size={16} color="#10b981" />
    }
    if (status === 'current') {
      return <Clock size={16} color="#45d6e0" />
    }

    switch (key) {
      case 'claim_approved':
        return <FileCheck size={14} />
      case 'return_pending':
        return <MessageSquare size={14} />
      case 'item_returned':
        return <PackageCheck size={14} />
      case 'recovery_confirmed':
        return <ShieldCheck size={14} />
      default:
        return <Circle size={14} />
    }
  }

  const formatStepDate = (isoStr) => {
    if (!isoStr) return null
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  return (
    <div className="recovery-timeline-card">
      <div className="timeline-header-row">
        <div>
          <h3 className="timeline-title">Recovery Lifecycle Tracker</h3>
          <p className="timeline-subtitle">Real-time status of physical return and confirmation</p>
        </div>
        <span
          className={`timeline-status-pill ${
            currentStatus === 'RECOVERED'
              ? 'timeline-status-pill--recovered'
              : currentStatus === 'RETURNED'
              ? 'timeline-status-pill--returned'
              : 'timeline-status-pill--pending'
          }`}
        >
          {currentStatus ? currentStatus.replace('_', ' ') : 'IN PROGRESS'}
        </span>
      </div>

      <div className="timeline-steps-list">
        {timeline.map((step, idx) => {
          const isCompleted = step.status === 'completed'
          const isCurrent = step.status === 'current'
          const isUpcoming = step.status === 'upcoming'

          return (
            <div key={step.key || idx} className="timeline-step-item">
              {/* Timeline Icon / Node */}
              <div
                className={`timeline-step-node ${
                  isCompleted
                    ? 'timeline-step-node--completed'
                    : isCurrent
                    ? 'timeline-step-node--current'
                    : 'timeline-step-node--upcoming'
                }`}
              >
                {getStepIcon(step.key, step.status)}
              </div>

              {/* Step Content */}
              <div className="timeline-step-body">
                <div className="timeline-step-top">
                  <span
                    className={`timeline-step-title ${
                      isCurrent
                        ? 'timeline-step-title--current'
                        : isUpcoming
                        ? 'timeline-step-title--upcoming'
                        : ''
                    }`}
                  >
                    {step.title}
                  </span>
                  {step.timestamp && (
                    <span className="timeline-step-date">
                      {formatStepDate(step.timestamp)}
                    </span>
                  )}
                </div>

                <p className="timeline-step-desc">
                  {step.description}
                </p>

                {isCurrent && (
                  <div className="timeline-current-pill">
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan, #45d6e0)', display: 'inline-block' }}></span>
                    Current Stage
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
