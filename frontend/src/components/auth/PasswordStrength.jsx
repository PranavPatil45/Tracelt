import { Check } from 'lucide-react'

const RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'number', label: 'One number', test: (v) => /[0-9]/.test(v) },
  { key: 'special', label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
]

export function passwordScore(value) {
  return RULES.filter((rule) => rule.test(value)).length
}

export default function PasswordStrength({ value }) {
  const score = passwordScore(value)
  const level = score <= 1 ? 'weak' : score <= 3 ? 'fair' : 'strong'
  const levelLabel = { weak: 'Weak', fair: 'Fair', strong: 'Strong' }[level]

  if (!value) return null

  return (
    <div className="password-strength">
      <div className="password-strength__meter">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`password-strength__bar ${i < score ? `password-strength__bar--${level}` : ''}`}
          />
        ))}
        <span className={`password-strength__label password-strength__label--${level}`}>
          {levelLabel}
        </span>
      </div>

      <ul className="password-strength__rules">
        {RULES.map((rule) => {
          const met = rule.test(value)
          return (
            <li key={rule.key} className={met ? 'is-met' : ''}>
              <span className="password-strength__check">{met && <Check size={11} strokeWidth={3} />}</span>
              {rule.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
