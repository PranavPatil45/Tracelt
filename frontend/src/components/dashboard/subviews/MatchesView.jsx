import { Sparkles } from 'lucide-react'
import MatchCenter from '../MatchCenter.jsx'
import './Subviews.css'

export default function MatchesView({ match, onReviewMatch }) {
  return (
    <div className="subview-container">
      <div className="subview-header">
        <div>
          <h2 className="subview-title">Match Center</h2>
          <p className="subview-subtitle">
            All AI-correlated matches between your reports and verified campus finds.
          </p>
        </div>
      </div>

      <MatchCenter match={match} onReviewMatch={onReviewMatch} />
    </div>
  )
}
