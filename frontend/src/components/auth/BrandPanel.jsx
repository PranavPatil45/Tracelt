import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import TraceltPoster from "./TraceltPoster";
import "./BrandPanel.css";
import LogoIcon from "./LogoIcon";

export default function BrandPanel() {
  return (
    <aside className="brand-panel">
      <div className="brand-panel__ambient-grid" aria-hidden="true" />
      <div className="brand-panel__ambient-glow" aria-hidden="true" />

      <div className="brand-panel__content">
        <Link className="brand-panel__logo" to="/" aria-label="Tracelt home">
          <LogoIcon width={40} height={50} />
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
