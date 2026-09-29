import { ArrowRight } from 'lucide-react'
import './EmotionalCTA.css'

export default function EmotionalCTA() {
  return (
    <section className="section emo-cta">
      <div className="emo-cta__glow" aria-hidden="true">
        <span className="emo-cta__point" style={{ top: '20%', left: '18%' }} />
        <span className="emo-cta__point" style={{ top: '65%', left: '30%' }} />
        <span className="emo-cta__point" style={{ top: '35%', left: '72%' }} />
        <span className="emo-cta__point" style={{ top: '75%', left: '82%' }} />
      </div>
      <div className="section-inner emo-cta__inner">
        <h2>That missing item might be closer than you think.</h2>
        <p>Report it on Tracelt and give your belongings a better chance of finding their way home.</p>
        <a className="btn btn-primary" href="#get-started">
          Report Lost Item <ArrowRight size={16} />
        </a>
      </div>
    </section>
  )
}
