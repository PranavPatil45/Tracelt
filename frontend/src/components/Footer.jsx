import { Radar, Twitter, Instagram, Linkedin } from 'lucide-react'
import './Footer.css'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Home', href: '#home' },
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Features', href: '#features' },
      { label: 'Browse Items', href: '#browse' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#community' },
      { label: 'Contact', href: '#contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '#privacy' },
      { label: 'Terms of Service', href: '#terms' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__top">
          <div className="footer__brand">
            <a className="navbar__brand footer__brand-link" href="#home">
              <span className="navbar__mark">
                <Radar size={18} strokeWidth={2.2} />
              </span>
              <span className="navbar__word">Tracelt</span>
            </a>
            <p className="footer__tagline">Lost something? Let&rsquo;s trace it back.</p>
            <div className="footer__social">
              <a href="#twitter" aria-label="Tracelt on Twitter"><Twitter size={16} /></a>
              <a href="#instagram" aria-label="Tracelt on Instagram"><Instagram size={16} /></a>
              <a href="#linkedin" aria-label="Tracelt on LinkedIn"><Linkedin size={16} /></a>
            </div>
          </div>

          <div className="footer__columns">
            {COLUMNS.map((col) => (
              <div className="footer__column" key={col.title}>
                <span className="footer__column-title">{col.title}</span>
                {col.links.map((link) => (
                  <a key={link.label} href={link.href}>{link.label}</a>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="footer__bottom">
          <span>&copy; 2026 Tracelt. All rights reserved.</span>
        </div>
      </div>
    </footer>
  )
}
