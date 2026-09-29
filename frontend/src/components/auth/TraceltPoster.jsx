import { Fragment } from "react";
import {
  FileSearch,
  BrainCircuit,
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
    icon: BrainCircuit,
    label: "MATCH",
    description: "AI-powered matching finds possible matches.",
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

function TraceltLogo() {
  return (
    <svg
      className="tp-logo-mark"
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Tracelt logo"
    >
      <path
        d="M60 8C36 8 18 26 18 49c0 30 42 63 42 63s42-33 42-63C102 26 84 8 60 8Z"
        fill="url(#tp-pin-fill)"
      />
      <path
        d="M60 20C40 20 28 34 28 49c0 21 32 47 32 47s32-26 32-47C92 34 80 20 60 20Z"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4.5"
      />
      <rect x="52" y="34" width="10" height="28" rx="2" fill="var(--text)" />
      <circle
        cx="70"
        cy="66"
        r="15"
        fill="var(--bg)"
        stroke="var(--text)"
        strokeWidth="5"
      />
      <line
        x1="80.5"
        y1="76.5"
        x2="90"
        y2="86"
        stroke="var(--text)"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient
          id="tp-pin-fill"
          x1="18"
          y1="8"
          x2="102"
          y2="112"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#0b2e52" />
          <stop offset="1" stopColor="#061426" />
        </linearGradient>
      </defs>
    </svg>
  );
}

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
              TR<span className="tp-accent-letter">A</span>CELT
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
