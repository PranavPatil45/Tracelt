import { Search, PlusCircle, Compass, ArrowRight } from 'lucide-react'
import './QuickActions.css'

export default function QuickActions({
  onReportLost,
  onReportFound,
  onExplore,
}) {
  const actions = [
    {
      id: 'lost',
      title: 'Report Lost Item',
      desc: 'Log details to search and correlate campus reports.',
      icon: Search,
      iconType: 'amber',
      onClick: onReportLost,
    },
    {
      id: 'found',
      title: 'Report Found Item',
      desc: 'Help return found belongings to their verified owners.',
      icon: PlusCircle,
      iconType: 'cyan',
      onClick: onReportFound,
    },
    {
      id: 'explore',
      title: 'Explore Items',
      desc: 'Search active lost & found reports across campus.',
      icon: Compass,
      iconType: 'violet',
      onClick: onExplore,
    },
  ]

  return (
    <section className="quick-actions-section" aria-label="Quick Actions">
      <div className="section-title-row">
        <div>
          <h3 className="section-title">Quick Actions</h3>
          <p className="section-subtitle">Jump straight into reporting or discovering items.</p>
        </div>
      </div>

      <div className="quick-actions-grid">
        {actions.map((act) => {
          const Icon = act.icon
          return (
            <div
              key={act.id}
              className={`quick-action-card quick-action-card--${act.iconType}`}
              onClick={act.onClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') act.onClick && act.onClick()
              }}
            >
              <div className="quick-action-card__top">
                <div className={`quick-action-card__icon quick-action-card__icon--${act.iconType}`}>
                  <Icon size={20} />
                </div>
                <div className="quick-action-card__arrow">
                  <ArrowRight size={16} />
                </div>
              </div>

              <div className="quick-action-card__body">
                <h4 className="quick-action-card__title">{act.title}</h4>
                <p className="quick-action-card__desc">{act.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
