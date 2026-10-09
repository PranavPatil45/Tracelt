import { Search, CheckCircle2, GitCompare, HeartHandshake } from "lucide-react";
import "./StatsCards.css";

export default function StatsCards({ stats, onCardClick }) {
  const lostVal = stats?.lost_items ?? stats?.lostItems ?? 0;
  const foundVal = stats?.found_items ?? stats?.foundItems ?? 0;
  const matchVal = stats?.matches ?? 0;
  const recVal = stats?.recovered ?? 0;

  const cards = [
    {
      id: "lost-items",
      title: "Lost Items",
      value: lostVal,
      subtitle: "Active ongoing reports",
      status: `${lostVal} ${lostVal === 1 ? "active trace" : "active traces"}`,
      statusType: "amber",
      icon: Search,
    },
    {
      id: "found-items",
      title: "Found Items",
      value: foundVal,
      subtitle: "Items you reported found",
      status: `${foundVal} in custody`,
      statusType: "cyan",
      icon: CheckCircle2,
    },
    {
      id: "matches",
      title: "Possible Matches",
      value: matchVal,
      subtitle: "Correlated campus matches",
      status:
        matchVal > 0 ? `${matchVal} action required` : "No pending matches",
      statusType: "violet",
      icon: GitCompare,
      highlight: matchVal > 0,
    },
    {
      id: "recovered",
      title: "Recovered",
      value: recVal,
      subtitle: "Successfully reconnected",
      status: recVal > 0 ? `${recVal} reconnected` : "No recoveries yet",
      statusType: "green",
      icon: HeartHandshake,
    },
  ];

  return (
    <section className="stats-cards-grid" aria-label="Personal Statistics">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className={`stat-card stat-card--${card.statusType} ${card.highlight ? "stat-card--highlight" : ""}`}
            onClick={() => onCardClick && onCardClick(card.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                onCardClick && onCardClick(card.id);
              }
            }}
          >
            <div className="stat-card__top">
              <span className="stat-card__title">{card.title}</span>
              <div
                className={`stat-card__icon stat-card__icon--${card.statusType}`}
              >
                <Icon size={16} />
              </div>
            </div>

            <div className="stat-card__body">
              <span className="stat-card__value">{card.value}</span>
              <span className="stat-card__subtitle">{card.subtitle}</span>
            </div>

            <div className="stat-card__bottom">
              <span
                className={`stat-card__badge stat-card__badge--${card.statusType}`}
              >
                {card.status}
              </span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
