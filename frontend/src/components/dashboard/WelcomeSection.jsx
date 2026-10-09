import { PlusCircle, Search, MapPin, GraduationCap } from "lucide-react";
import "./WelcomeSection.css";

export default function WelcomeSection({ user, onOpenReportModal }) {
  // Determine greeting based on current local hour
  const currentHour = new Date().getHours();
  let greetingTime = "morning";
  if (currentHour >= 12 && currentHour < 17) {
    greetingTime = "afternoon";
  } else if (currentHour >= 17 || currentHour < 5) {
    greetingTime = "evening";
  }

  // Display user's name gracefully
  const fullName = user?.full_name || user?.name || "Student";
  const firstName = fullName.split(" ")[0];

  const campus = user?.campus;
  const department = user?.department;

  return (
    <section className="welcome-section">
      <div className="welcome-section__content">
        <h2 className="welcome-section__title">
          Good {greetingTime}, {firstName}
        </h2>
        <p className="welcome-section__subtitle">
          Here&rsquo;s what&rsquo;s happening with your campus lost &amp; found activity.
        </p>
        {(campus || department) && (
          <div className="welcome-section__meta">
            {campus && (
              <span className="welcome-meta-item">
                <MapPin size={13} className="meta-icon" />
                {campus}
              </span>
            )}
            {department && (
              <span className="welcome-meta-item">
                <GraduationCap size={13} className="meta-icon" />
                {department}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="welcome-section__actions">
        <button
          type="button"
          className="btn btn-primary welcome-section__btn-lost"
          onClick={() => onOpenReportModal && onOpenReportModal("lost")}
        >
          <Search size={15} strokeWidth={2} />
          <span>Report Lost Item</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary welcome-section__btn-found"
          onClick={() => onOpenReportModal && onOpenReportModal("found")}
        >
          <PlusCircle size={15} strokeWidth={2} />
          <span>Report Found Item</span>
        </button>
      </div>
    </section>
  );
}
