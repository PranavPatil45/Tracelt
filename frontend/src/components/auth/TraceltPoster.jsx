import { Fragment } from "react";
import {
  FileSearch,
  GitCompare,
  Bell,
  ShieldCheck,
  Heart,
} from "lucide-react";
import "./TraceltPoster.css";
import LogoIcon from "./LogoIcon";
const FEATURES = [
  {
    id: "report",
    icon: FileSearch,
    label: "REPORT",
    description: "Report lost items in seconds.",
  },
  {
    id: "match",
    icon: GitCompare,
    label: "MATCH",
    description: "Automated correlation identifies matching reports.",
  },
  {
    id: "notify",
    icon: Bell,
    label: "NOTIFY",
    description: "Get real-time updates and alerts.",
  },
  {
    id: "return",
    icon: ShieldCheck,
    label: "RETURN",
    description: "Reunite items with their owners safely.",
  },
];


export default function TraceltPoster() {
  return (
    <section
      className="tp-root"
      aria-label="Tracelt campus lost and found portal"
    >
      <div className="tp-bg" aria-hidden="true">
        <span className="tp-arc tp-arc--tr" />
        <span className="tp-arc tp-arc--bl" />
        <span className="tp-dots tp-dots--tl" />
        <span className="tp-dots tp-dots--br" />
      </div>

      <div className="tp-content">
        <div className="tp-brand-row">
          <div className="tp-logo-wrap">
            <LogoIcon width={160} height={200} />
          </div>

          <div className="tp-brand-text">
            <h1 className="tp-wordmark">
              TR<span className="tp-accent-letter">Λ</span>CELT
            </h1>
            <div className="tp-subtitle-row">
              <span className="tp-subtitle-line" />
              <p className="tp-subtitle">Campus Lost &amp; Found Portal</p>
              <span className="tp-subtitle-line" />
            </div>
          </div>
        </div>

        <div className="tp-features">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Fragment key={feature.id}>
                {i > 0 && (
                  <span
                    className="tp-sep"
                    aria-hidden="true"
                  />
                )}
                <div
                  className="tp-feature"
                  style={{ "--tp-delay": `${0.15 + i * 0.09}s` }}
                >
                  <Icon className="tp-feature-icon" strokeWidth={1.6} />
                  <p className="tp-feature-label">{feature.label}</p>
                  <p className="tp-feature-desc">{feature.description}</p>
                </div>
              </Fragment>
            );
          })}
        </div>

        <div className="tp-tagline">
          <Heart className="tp-tagline-icon" strokeWidth={1.6} />
          <span>Every Trace Leads Home.</span>
        </div>
      </div>
    </section>
  );
}
