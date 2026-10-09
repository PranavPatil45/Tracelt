import { MapPin, Clock, ArrowRight } from "lucide-react";
import ItemThumbnail from "./ItemThumbnail.jsx";
import "./CampusActivity.css";

export default function CampusActivity({
  activities = [],
  campus = "",
  onViewAll,
  onItemClick,
}) {
  const displayCampus = campus?.trim() || "Campus";

  return (
    <section className="campus-activity-section" aria-label="Campus Activity">
      <div className="section-title-row">
        <div>
          <h3 className="section-title">Recent on Your Campus</h3>
          <p className="section-subtitle">
            Recently reported items around your campus.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-ghost section-action-btn"
          onClick={onViewAll}
        >
          <span>View all items</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-state-card__icon-box">
            <MapPin size={28} strokeWidth={1.6} />
          </div>
          <h4 className="empty-state-card__title">No Recent Campus Activity</h4>
          <p className="empty-state-card__desc">
            No lost or found reports recorded yet for{" "}
            {campus ? campus : "your campus"}.
          </p>
        </div>
      ) : (
        <div className="campus-activity-grid">
          {activities.map((item) => {
            const isFound = item.type.toLowerCase() === "found";

            return (
              <div
                key={item.id}
                className={`campus-item-card ${isFound ? "campus-item-card--found" : "campus-item-card--lost"}`}
                onClick={() => onItemClick && onItemClick(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onItemClick && onItemClick(item);
                  }
                }}
              >
                <div className="campus-item-card__top">
                  <div className="campus-item-card__icon-box">
                    <ItemThumbnail
                      src={item.image_url || item.imageUrl}
                      alt={item.title}
                      fallbackIconSize={18}
                    />
                  </div>

                  <span
                    className={`campus-type-pill ${
                      isFound
                        ? "campus-type-pill--found"
                        : "campus-type-pill--lost"
                    }`}
                  >
                    {isFound ? "Found" : "Lost"}
                  </span>
                </div>

                <div className="campus-item-card__body">
                  <h4 className="campus-item-card__title">{item.title}</h4>
                  <div className="campus-item-card__location">
                    <MapPin size={12} className="loc-icon" />
                    <span>{item.location}</span>
                  </div>
                </div>

                <div className="campus-item-card__footer">
                  <span className="campus-item-card__time">
                    <Clock size={11} /> {item.timeAgo}
                  </span>
                  <span className="campus-item-card__action-hint">
                    Details &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
