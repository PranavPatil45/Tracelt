import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, ArrowRight, Loader2 } from 'lucide-react'
import InputField from './InputField.jsx'
import PasswordInput from './PasswordInput.jsx'
import SocialLoginButton from './SocialLoginButton.jsx'
import { startGoogleLogin, AuthError } from '../../api/auth.js'
import { useAuth } from '../../context/AuthContext.jsx'
import './LoginForm.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginForm() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function validate() {
    const next = {}
    if (!email.trim()) {
      next.email = 'Enter your email to continue.'
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = 'That email address doesn\u2019t look right.'
    }
    if (!password) {
      next.password = 'Enter your password to continue.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    if (!validate()) return

    setSubmitting(true)
    try {
      const result = await login({ email: email.trim(), password, remember })
      if (result?.accessToken) {
        navigate('/dashboard')
      }
    } catch (err) {
      const message = err instanceof AuthError ? err.message : 'Something went wrong. Please try again.'
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-card">
      <span className="eyebrow">Account access</span>
      <h1 className="login-card__heading">Welcome back</h1>
      <p className="login-card__subtitle">Sign in to continue your Tracelt journey.</p>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <InputField
          id="email"
          label="Email"
          type="email"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={validate}
          placeholder="Enter your email"
          autoComplete="email"
          error={errors.email}
        />

        <PasswordInput
          id="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={validate}
          placeholder="Enter your password"
          error={errors.password}
        />

        <div className="login-form__row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span className="checkbox__box" aria-hidden="true" />
            Remember me
          </label>
          <Link className="login-form__forgot" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        {formError && (
          <div className="login-form__error" role="alert">
            {formError}
          </div>
        )}

        <button type="submit" className="btn btn-primary login-form__submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 size={16} className="spin" /> Signing in&hellip;
            </>
          ) : (
            <>
              Sign In <ArrowRight size={16} className="login-form__submit-arrow" />
            </>
          )}
        </button>

        <div className="login-form__divider">
          <span>OR</span>
        </div>

        <SocialLoginButton provider="google" onClick={startGoogleLogin}>
          Continue with Google
        </SocialLoginButton>
      </form>

      <p className="login-card__footer">
        Don&rsquo;t have an account?{' '}
        <Link className="login-card__footer-link" to="/signup">
          Create an account
        </Link>
      </p>
    </div>
  )
}
