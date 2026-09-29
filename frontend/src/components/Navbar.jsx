import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Radar, User as UserIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import LogoIcon from "./auth/LogoIcon.jsx";
import "./Navbar.css";

const LINKS = [
  { label: "Home", href: "#home" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Browse Items", href: "#browse" },
  { label: "About", href: "#community" },
];

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}
      id="home"
    >
      <div className="navbar__inner">
        <Link className="navbar__brand" to="/" aria-label="Tracelt home">
          <LogoIcon width={40} height={50} />

          <span className="navbar__word">Tracelt</span>
        </Link>

        <nav className="navbar__links" aria-label="Primary">
          {LINKS.map((link) => (
            <a key={link.label} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="navbar__actions">
          {isAuthenticated ? (
            <>
              <Link className="btn btn-ghost" to="/dashboard">
                <UserIcon size={15} style={{ marginRight: "6px" }} />
                {user?.full_name?.split(" ")[0] || "Dashboard"}
              </Link>
              <button className="btn btn-secondary" onClick={logout}>
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login">
                Log In
              </Link>
              <Link className="btn btn-primary" to="/login">
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          className="navbar__toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="navbar__mobile">
          {LINKS.map((link) => (
            <a key={link.label} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <div className="navbar__mobile-actions">
            {isAuthenticated ? (
              <>
                <Link
                  className="btn btn-primary"
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                >
                  Dashboard ({user?.full_name?.split(" ")[0]})
                </Link>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link
                  className="btn btn-secondary"
                  to="/login"
                  onClick={() => setOpen(false)}
                >
                  Log In
                </Link>
                <Link
                  className="btn btn-primary"
                  to="/login"
                  onClick={() => setOpen(false)}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
