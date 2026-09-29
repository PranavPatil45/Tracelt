import { FileText, SearchCheck, Sparkles, HandHeart } from 'lucide-react'
import { useReveal } from '../hooks/useReveal'
import './HowItWorks.css'

const STEPS = [
  {
    n: '01',
    icon: FileText,
    title: 'Report',
    lede: 'Tell us what you lost.',
    body: 'Add the item name, a short description, where and when it went missing, and a photo if you have one.',
  },
  {
    n: '02',
    icon: SearchCheck,
    title: 'Discover',
    lede: 'Search through found items.',
    body: 'Browse and filter belongings other people have found, sorted by location, category, and date.',
  },
  {
    n: '03',
    icon: Sparkles,
    title: 'Match',
    lede: 'Find a possible match.',
    body: 'Tracelt surfaces likely matches between lost and found reports so nothing slips through.',
  },
  {
    n: '04',
    icon: HandHeart,
    title: 'Reconnect',
    lede: 'Get your belongings back.',
    body: 'Message the person who found your item through a safe channel and arrange the handoff.',
  },
]

export default function HowItWorks() {
  const [ref, visible] = useReveal(0.15)

  return (
    <section className="section how" id="how-it-works">
      <div className="section-inner">
        <div className="section-head">
          <span className="eyebrow">The process</span>
          <h2>From lost to reconnected, in four traceable steps.</h2>
          <p>Every report moves through the same transparent path, so you always know where things stand.</p>
        </div>

        <div className={`how__rail reveal ${visible ? 'is-visible' : ''}`} ref={ref}>
          {STEPS.map((step, i) => (
            <div className="how__step" key={step.n} style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="how__step-top">
                <span className="how__num">{step.n}</span>
                <step.icon size={20} strokeWidth={1.8} />
              </div>
              <h3>{step.lede}</h3>
              <span className="how__title">{step.title}</span>
              <p>{step.body}</p>
            </div>
          ))}
          <div className="how__line" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
