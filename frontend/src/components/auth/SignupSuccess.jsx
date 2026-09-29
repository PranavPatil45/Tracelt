import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ArrowRight } from 'lucide-react'
import './SignupSuccess.css'

const REDIRECT_DELAY_MS = 5000

export default function SignupSuccess() {
  const navigate = useNavigate()
  const [secondsLeft, setSecondsLeft] = useState(Math.round(REDIRECT_DELAY_MS / 1000))

  useEffect(() => {
    const redirectTimer = setTimeout(() => {
      // TODO: point this at your real dashboard route once it exists.
      navigate('/dashboard')
    }, REDIRECT_DELAY_MS)

    const tick = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1))
    }, 1000)

    return () => {
      clearTimeout(redirectTimer)
      clearInterval(tick)
    }
  }, [navigate])

  return (
    <div className="signup-success">
      <div className="signup-success__check">
        <Check size={26} strokeWidth={3} />
      </div>

      <h1 className="signup-success__heading">Account created successfully</h1>
      <p className="signup-success__body">
        Welcome to Tracelt. Your campus lost-and-found journey starts here.
      </p>

      <Link className="btn btn-primary signup-success__cta" to="/dashboard">
        Continue to Tracelt <ArrowRight size={16} />
      </Link>

      <span className="signup-success__redirect">
        Redirecting automatically in {secondsLeft}s&hellip;
      </span>
    </div>
  )
}
