import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useReveal } from '../hooks/useReveal'
import './FAQ.css'

const FAQS = [
  {
    q: 'How do I report a lost item?',
    a: 'Select "Report a Lost Item," then fill in the item name, a short description, where and when you lost it, and a photo if you have one. Your report goes live on Tracelt immediately.',
  },
  {
    q: 'Can I upload images?',
    a: 'Yes. Photos make it much easier for someone to recognize your item, and you can add or update images to any report at any time.',
  },
  {
    q: 'How do I search for found items?',
    a: 'Use the search bar or filters on the Browse Items page to narrow results by category, location, or date, and check any listing that looks like a match.',
  },
  {
    q: 'How does Tracelt match lost and found items?',
    a: 'Tracelt compares details across active reports, like category, location, and description, and surfaces likely matches for you to review and confirm.',
  },
  {
    q: 'Is my personal information secure?',
    a: 'Your contact details stay private until you choose to share them. All communication about a potential match happens through Tracelt\u2019s secure messaging.',
  },
  {
    q: 'How do I contact someone who found my item?',
    a: 'Once a possible match is confirmed, Tracelt opens a private conversation so you can verify details and arrange a safe handoff.',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0)
  const [ref, visible] = useReveal(0.1)

  return (
    <section className="section faq">
      <div className="section-inner">
        <div className="section-head">
          <span className="eyebrow">FAQ</span>
          <h2>Questions, answered.</h2>
          <p>Everything you need to know before you report or browse.</p>
        </div>

        <div className={`faq__list reveal ${visible ? 'is-visible' : ''}`} ref={ref}>
          {FAQS.map((item, i) => {
            const open = openIndex === i
            return (
              <div className={`faq-item ${open ? 'faq-item--open' : ''}`} key={item.q}>
                <button
                  className="faq-item__trigger"
                  onClick={() => setOpenIndex(open ? -1 : i)}
                  aria-expanded={open}
                >
                  <span>{item.q}</span>
                  <Plus size={18} className="faq-item__icon" />
                </button>
                <div className="faq-item__panel">
                  <p>{item.a}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
