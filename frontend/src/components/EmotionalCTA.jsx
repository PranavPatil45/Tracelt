import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import './EmotionalCTA.css'

export default function EmotionalCTA() {
  return (
    <section className="section emo-cta">
      <div className="section-inner emo-cta__inner">
        <h2>That missing item might be closer than you think.</h2>
        <p>Report it on Tracelt and give your belongings a better chance of finding their way home across campus.</p>
        <Link className="btn btn-primary" to="/report-lost">
          Report Lost Item <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}
