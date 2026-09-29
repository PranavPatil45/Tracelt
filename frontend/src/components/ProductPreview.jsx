import { Search, SlidersHorizontal, MapPin, Clock } from 'lucide-react'
import { useReveal } from '../hooks/useReveal'
import './ProductPreview.css'

const ITEMS = [
  { title: 'Black Backpack', status: 'lost', location: 'Near College Road', time: '2 days ago' },
  { title: 'Blue Wallet', status: 'found', location: 'Near City Center', time: '1 day ago' },
  { title: 'Wireless Earbuds', status: 'lost', location: 'Near Railway Station', time: '5 hours ago' },
  { title: 'Silver Bicycle', status: 'found', location: 'Near Central Park', time: '3 hours ago' },
  { title: 'House Keys, 3-ring', status: 'matched', location: 'Near Oak Avenue', time: '6 hours ago' },
]

const FILTERS = ['All Categories', 'Electronics', 'Bags', 'Documents', 'Pets']
const STATUS_LABEL = { lost: 'Lost', found: 'Found', matched: 'Matched' }

export default function ProductPreview() {
  const [ref, visible] = useReveal(0.1)

  return (
    <section className="section preview" id="browse">
      <div className="section-inner">
        <div className="section-head">
          <span className="eyebrow">Product preview</span>
          <h2>See what&rsquo;s moving through Tracelt right now.</h2>
          <p>A live look at recent reports across the network.</p>
        </div>

        <div className={`dashboard reveal ${visible ? 'is-visible' : ''}`} ref={ref}>
          <div className="dashboard__toolbar">
            <div className="dashboard__search">
              <Search size={16} />
              <span>Search lost or found items&hellip;</span>
            </div>
            <button className="dashboard__filter-btn" type="button">
              <SlidersHorizontal size={15} /> Filters
            </button>
          </div>

          <div className="dashboard__chips">
            {FILTERS.map((f, i) => (
              <span key={f} className={`chip ${i === 0 ? 'chip--active' : ''}`}>{f}</span>
            ))}
            <span className="chip chip--location"><MapPin size={12} /> Near me</span>
          </div>

          <div className="dashboard__body">
            <div className="dashboard__list">
              {ITEMS.map((item) => (
                <div className="item-row" key={item.title}>
                  <div className="item-row__thumb" />
                  <div className="item-row__info">
                    <span className="item-row__title">{item.title}</span>
                    <span className="item-row__meta">
                      <MapPin size={12} /> {item.location}
                      <span className="dot" />
                      <Clock size={12} /> {item.time}
                    </span>
                  </div>
                  <span className={`status-badge status-badge--${item.status}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>
              ))}
            </div>

            <div className="dashboard__map" aria-hidden="true">
              <div className="mini-map">
                <div className="mini-map__grid" />
                <span className="mini-map__pin mini-map__pin--violet" style={{ top: '30%', left: '38%' }} />
                <span className="mini-map__pin mini-map__pin--cyan" style={{ top: '58%', left: '62%' }} />
                <span className="mini-map__pin mini-map__pin--amber" style={{ top: '68%', left: '28%' }} />
                <span className="mini-map__pin mini-map__pin--cyan" style={{ top: '20%', left: '70%' }} />
              </div>
              <span className="dashboard__map-label">Live activity near you</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
