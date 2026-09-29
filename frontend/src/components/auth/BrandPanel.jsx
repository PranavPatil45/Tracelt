import { Link } from "react-router-dom";
import {
  Radar,
  Target,
  Handshake,
  Search,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import TraceltPoster from "./TraceltPoster";
import "./BrandPanel.css";
import LogoIcon from "./LogoIcon";
const FEATURES = [
  {
    id: "report",
    label: "Report",
    text: "Tell us what you lost.",
    Icon: ClipboardList,
  },
  {
    id: "discover",
    label: "Discover",
    text: "Browse found items.",
    Icon: Search,
  },
  { id: "match", label: "Match", text: "Find possible matches.", Icon: Target },
  {
    id: "reconnect",
    label: "Reconnect",
    text: "Get your belongings back.",
    Icon: Handshake,
  },
];

export default function BrandPanel() {
  return (
    <aside className="brand-panel">
      <div className="brand-panel__ambient-grid" aria-hidden="true" />
      <div className="brand-panel__ambient-glow" aria-hidden="true" />

      <div className="brand-panel__content">
        <Link className="brand-panel__logo" to="/" aria-label="Tracelt home">
          <span className="navbar__mark">
            <Radar size={18} strokeWidth={2.2} />
          </span>
          <span className="navbar__word">Tracelt</span>
        </Link>

        <div className="brand-panel__hero">
          <h1 className="brand-panel__heading">
            Lost something?
            <br />
            Let&rsquo;s{" "}
            <span className="brand-panel__heading-accent">trace it back.</span>
          </h1>
          <p className="brand-panel__subtext">
            Report lost belongings, discover found items, and reconnect with
            what matters.
          </p>
        </div>

        {/*  <ul className="brand-panel__features">
          {FEATURES.map(({ id, label, text, Icon }) => (
            <li key={id} className="brand-panel__feature">
              <span className="brand-panel__feature-icon">
                <Icon size={14} strokeWidth={2.2} />
              </span>
              <span className="brand-panel__feature-copy">
                <span className="brand-panel__feature-label">{label}</span>
                <span className="brand-panel__feature-text">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        */}

        <div className="brand-panel__poster">
          <TraceltPoster />
        </div>

        <div className="brand-panel__trust">
          <span className="brand-panel__trust-icon">
            <ShieldCheck size={16} strokeWidth={2.2} />
          </span>
          <span className="brand-panel__trust-copy">
            <span className="brand-panel__trust-title">
              A safer way to find what&rsquo;s lost.
            </span>
            <span className="brand-panel__trust-text">
              Built with privacy and secure communication in mind.
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}
