import {
  Search,
  ClipboardList,
  MapPinned,
  ImageUp,
  ShieldCheck,
  Waypoints,
} from 'lucide-react'
import { useReveal } from '../hooks/useReveal'
import './Features.css'

const FEATURES = [
  {
    icon: Search,
    title: 'Smart Search',
    body: 'Quickly search through reported lost and found items with relevant filters.',
  },
  {
    icon: ClipboardList,
    title: 'Detailed Reports',
    body: 'Create detailed reports with descriptions, locations, dates, and images.',
  },
  {
    icon: MapPinned,
    title: 'Location-Based Discovery',
    body: 'Find relevant reports based on exactly where an item was lost or found.',
  },
  {
    icon: ImageUp,
    title: 'Image Support',
    body: 'Upload photos to make identifying an item faster and more accurate.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Communication',
    body: 'A safe, private channel for discussing potential matches with another user.',
  },
  {
    icon: Waypoints,
    title: 'Status Tracking',
    body: 'Follow an item&rsquo;s journey: Lost \u2192 Reported \u2192 Matched \u2192 Recovered.',
  },
]

export default function Features() {
  const [ref, visible] = useReveal(0.1)

  return (
    <section className="section features" id="features">
      <div className="section-inner">
        <div className="section-head">
          <span className="eyebrow">Platform</span>
          <h2>Everything a lost-and-found needs to actually work.</h2>
          <p>Built with the tools people actually use when something goes missing.</p>
        </div>

        <div className={`features__grid reveal ${visible ? 'is-visible' : ''}`} ref={ref}>
          {FEATURES.map((f, i) => (
            <div className="feature-card" key={f.title} style={{ transitionDelay: `${i * 70}ms` }}>
              <div className="feature-card__icon">
                <f.icon size={20} strokeWidth={1.8} />
              </div>
              <h3>{f.title}</h3>
              <p dangerouslySetInnerHTML={{ __html: f.body }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
