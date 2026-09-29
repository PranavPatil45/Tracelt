import { FileEdit, Users, Link2 } from 'lucide-react'
import { useReveal } from '../hooks/useReveal'
import './Community.css'

const CARDS = [
  {
    icon: FileEdit,
    title: 'Report',
    body: 'Someone loses something and puts the details out to the network.',
  },
  {
    icon: Users,
    title: 'Help',
    body: 'A neighbor spots it, files a found report, and keeps it safe.',
  },
  {
    icon: Link2,
    title: 'Reconnect',
    body: 'Tracelt connects the two, and the item finds its way home.',
  },
]

export default function Community() {
  const [ref, visible] = useReveal(0.15)

  return (
    <section className="section community" id="community">
      <div className="section-inner">
        <div className="section-head community__head">
          <span className="eyebrow">Community</span>
          <h2>A community that helps things find their way home.</h2>
          <p>Tracelt is powered by people looking out for one another, one report at a time.</p>
        </div>

        <div className={`community__grid reveal ${visible ? 'is-visible' : ''}`} ref={ref}>
          {CARDS.map((c, i) => (
            <div className="community-card" key={c.title} style={{ transitionDelay: `${i * 100}ms` }}>
              <div className="community-card__icon">
                <c.icon size={22} strokeWidth={1.7} />
              </div>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              {i < CARDS.length - 1 && <span className="community-card__link" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
