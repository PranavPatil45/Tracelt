import { ArrowRight, Search, MapPin, ScanLine } from 'lucide-react'
import './Hero.css'

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero__inner">
        <div className="hero__copy">
          <span className="eyebrow">Smart lost &amp; found network</span>
          <h1 className="hero__heading">
            Lost something?
            <br />
            <span className="hero__heading-accent">Let&rsquo;s trace it back.</span>
          </h1>
          <p className="hero__sub">
            Tracelt makes it easier to report lost belongings, discover found items,
            and reconnect people with what matters to them.
          </p>
          <div className="hero__ctas">
            <a className="btn btn-primary" href="#get-started">
              Report a Lost Item <ArrowRight size={16} />
            </a>
            <a className="btn btn-secondary" href="#browse">
              Browse Found Items
            </a>
          </div>
          <div className="hero__trust">
            <ScanLine size={15} />
            <span>Built to make lost-and-found simple.</span>
          </div>
        </div>

        <div className="hero__visual" role="img" aria-label="Illustration of an item being traced from lost, to a possible match, to found">
          <TraceVisual />
        </div>
      </div>
    </section>
  )
}

function TraceVisual() {
  return (
    <div className="hero-trace-card">
      <div className="hero-trace-card__grid" />

      <svg viewBox="0 0 520 460" className="hero-trace-card__svg" aria-hidden="true">
        <defs>
          <linearGradient id="pathGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#45d6e0" />
            <stop offset="100%" stopColor="#8c7bff" />
          </linearGradient>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* traced path: lost -> possible match -> found */}
        <path
          d="M 88 340 C 150 260, 190 300, 236 232 S 340 150, 420 96"
          fill="none"
          stroke="url(#pathGrad)"
          strokeWidth="2"
          strokeDasharray="1 9"
          strokeLinecap="round"
          className="trace-path"
        />
        <path
          d="M 88 340 C 150 260, 190 300, 236 232 S 340 150, 420 96"
          fill="none"
          stroke="url(#pathGrad)"
          strokeWidth="1.5"
          opacity="0.35"
        />

        {/* traveling signal dot */}
        <circle r="4" fill="#45d6e0" filter="url(#glow)">
          <animateMotion
            dur="4.5s"
            repeatCount="indefinite"
            path="M 88 340 C 150 260, 190 300, 236 232 S 340 150, 420 96"
          />
        </circle>

        {/* lost pin */}
        <g transform="translate(88 340)">
          <circle r="22" fill="rgba(140,123,255,0.12)" className="pulse-ring" />
          <circle r="6" fill="#8c7bff" />
        </g>

        {/* possible match pin */}
        <g transform="translate(236 232)">
          <circle r="18" fill="rgba(240,181,99,0.12)" />
          <circle r="5" fill="#f0b563" />
        </g>

        {/* found pin */}
        <g transform="translate(420 96)">
          <circle r="24" fill="rgba(69,214,224,0.14)" className="pulse-ring pulse-ring--delay" />
          <circle r="6" fill="#45d6e0" />
        </g>
      </svg>

      <div className="trace-chip trace-chip--lost">
        <MapPin size={13} />
        <div>
          <span className="trace-chip__label">Lost</span>
          <span className="trace-chip__coord">19.24°N 73.15°E</span>
        </div>
      </div>

      <div className="trace-chip trace-chip--match">
        <span className="trace-chip__dot" />
        <div>
          <span className="trace-chip__label">Possible match</span>
          <span className="trace-chip__coord">2 miles away</span>
        </div>
      </div>

      <div className="trace-chip trace-chip--found">
        <Search size={13} />
        <div>
          <span className="trace-chip__label">Found</span>
          <span className="trace-chip__coord">Verified 09:41</span>
        </div>
      </div>

      <div className="item-float">
        <div className="item-float__thumb" />
        <div className="item-float__body">
          <span className="item-float__title">Black Backpack</span>
          <span className="item-float__meta">Status &middot; Matched</span>
        </div>
        <span className="item-float__badge">92%</span>
      </div>
    </div>
  )
}
