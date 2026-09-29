import { ArrowRight } from 'lucide-react'
import './FinalCTA.css'

export default function FinalCTA() {
  return (
    <section className="section final-cta" id="get-started">
      <div className="final-cta__card">
        <div className="final-cta__trace" aria-hidden="true">
          <svg viewBox="0 0 400 60" preserveAspectRatio="none">
            <path
              d="M 0 40 C 60 10, 120 55, 180 25 S 300 10, 400 30"
              fill="none"
              stroke="url(#finalGrad)"
              strokeWidth="1.5"
              strokeDasharray="1 8"
            />
            <defs>
              <linearGradient id="finalGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#45d6e0" />
                <stop offset="100%" stopColor="#8c7bff" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <span className="eyebrow">Get started</span>
        <h2>Ready to find what you lost?</h2>
        <p>Join Tracelt and make lost-and-found easier, smarter, and more connected.</p>

        <div className="final-cta__actions">
          <a className="btn btn-primary" href="#login">
            Get Started <ArrowRight size={16} />
          </a>
          <a className="btn btn-secondary" href="#browse">
            Browse Found Items
          </a>
        </div>
      </div>
    </section>
  )
}
