import { Link } from 'react-router-dom'
import { Radar } from 'lucide-react'
import BrandPanel from './BrandPanel.jsx'
import './AuthLayout.css'

export default function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <BrandPanel />

      <section className="auth-page__panel">
        <Link className="auth-page__mobile-logo" to="/" aria-label="Tracelt home">
          <span className="navbar__mark">
            <Radar size={18} strokeWidth={2.2} />
          </span>
          <span className="navbar__word">Tracelt</span>
        </Link>

        {children}
      </section>
    </div>
  )
}
