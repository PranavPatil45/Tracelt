import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, ArrowRight, Loader2, ShieldCheck, X } from "lucide-react";
import InputField from "./InputField.jsx";
import PasswordInput from "./PasswordInput.jsx";
import GoogleSignInButton from "./GoogleSignInButton.jsx";
import { AuthError } from "../../api/auth.js";
import { useAuth } from "../../context/AuthContext.jsx";
import "./LoginForm.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, linkGoogleWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  // Account linking state (Case C: email already registered)
  const [accountLinking, setAccountLinking] = useState(null); // { email, credential }
  const [linkingPassword, setLinkingPassword] = useState("");
  const [linkingError, setLinkingError] = useState("");
  const [linkingSubmitting, setLinkingSubmitting] = useState(false);

  function validate() {
    const next = {};
    if (!email.trim()) {
      next.email = "Enter your email to continue.";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = "That email address doesn\u2019t look right.";
    }
    if (!password) {
      next.password = "Enter your password to continue.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await login({ email: email.trim(), password, remember });
      if (result?.accessToken) {
        navigate("/dashboard");
      }
    } catch (err) {
      const message =
        err instanceof AuthError
          ? err.message
          : "Something went wrong. Please try again.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSuccess(credential) {
    setFormError("");
    setLinkingError("");
    setGoogleSubmitting(true);
    try {
      const result = await loginWithGoogle({ credential });
      if (result?.accessToken) {
        navigate("/dashboard");
      }
    } catch (err) {
      if (err?.code === "ACCOUNT_LINKING_REQUIRED" || err?.status === 409) {
        const targetEmail = err?.data?.email || err?.data?.detail?.email || email || "";
        setAccountLinking({
          email: targetEmail,
          credential,
        });
        if (targetEmail && !email) {
          setEmail(targetEmail);
        }
        setFormError(
          err.message ||
          "An account with this email already exists. Enter your password to securely link your Google account."
        );
      } else {
        const message =
          err instanceof AuthError
            ? err.message
            : "Google authentication failed. Please try again.";
        setFormError(message);
      }
    } finally {
      setGoogleSubmitting(false);
    }
  }

  async function handleLinkPasswordSubmit(e) {
    e.preventDefault();
    setLinkingError("");
    if (!linkingPassword) {
      setLinkingError("Please enter your password to link your Google account.");
      return;
    }

    setLinkingSubmitting(true);
    try {
      const result = await linkGoogleWithPassword({
        email: accountLinking.email,
        password: linkingPassword,
        credential: accountLinking.credential,
        remember: true,
      });
      if (result?.accessToken) {
        navigate("/dashboard");
      }
    } catch (err) {
      const message =
        err instanceof AuthError
          ? err.message
          : "Could not link account. Please verify your password.";
      setLinkingError(message);
    } finally {
      setLinkingSubmitting(false);
    }
  }

  return (
    <div className="login-card">
      {/* <span className="eyebrow">Account access</span>*/}
      <h1 className="login-card__heading">Welcome back</h1>
      <p className="login-card__subtitle">
        Sign in to continue your Tracelt journey.
      </p>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <InputField
          id="email"
          label="Email"
          type="email"
          icon={Mail}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email)
              setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          placeholder="Enter your email"
          autoComplete="email"
          error={errors.email}
        />

        <PasswordInput
          id="password"
          label="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password)
              setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          placeholder="Enter your password"
          error={errors.password}
        />

        <div className="login-form__row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span className="checkbox__box" aria-hidden="true" />
            Remember me
          </label>
          <Link className="login-form__forgot" to="/forgot-password">
            Forgot password?
          </Link>
        </div>

        {formError && (
          <div className="login-form__error" role="alert">
            {formError}
          </div>
        )}

        {accountLinking && (
          <div className="login-form__linking-card" role="region" aria-label="Account Linking">
            <div className="login-form__linking-header">
              <ShieldCheck size={18} className="login-form__linking-icon" />
              <div className="login-form__linking-text">
                <strong>Link Google Account</strong>
                <p>Enter your password to link <em>{accountLinking.email}</em>.</p>
              </div>
              <button
                type="button"
                className="login-form__linking-close"
                onClick={() => {
                  setAccountLinking(null);
                  setLinkingError("");
                }}
                aria-label="Dismiss linking"
              >
                <X size={16} />
              </button>
            </div>

            <PasswordInput
              id="linkingPassword"
              label="Account Password"
              value={linkingPassword}
              onChange={(e) => {
                setLinkingPassword(e.target.value);
                if (linkingError) setLinkingError("");
              }}
              placeholder="Enter your Tracelt password"
              error={linkingError}
            />

            <button
              type="button"
              className="btn btn-primary login-form__submit"
              disabled={linkingSubmitting}
              onClick={handleLinkPasswordSubmit}
            >
              {linkingSubmitting ? (
                <>
                  <Loader2 size={16} className="spin" /> Verifying &amp; Linking&hellip;
                </>
              ) : (
                <>
                  Verify &amp; Link Google <ArrowRight size={16} className="login-form__submit-arrow" />
                </>
              )}
            </button>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary login-form__submit"
          disabled={submitting || googleSubmitting || linkingSubmitting}
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="spin" /> Signing in&hellip;
            </>
          ) : (
            <>
              Sign In{" "}
              <ArrowRight size={16} className="login-form__submit-arrow" />
            </>
          )}
        </button>

        <div className="login-form__divider">
          <span>OR</span>
        </div>

        <GoogleSignInButton
          mode="continue"
          text="continue_with"
          loading={googleSubmitting}
          disabled={submitting || linkingSubmitting}
          onSuccess={handleGoogleSuccess}
          onError={(err) =>
            setFormError(
              err.message || "Google authentication was cancelled or could not be completed."
            )
          }
        />
      </form>

      <p className="login-card__footer">
        Don&rsquo;t have an account?{" "}
        <Link className="login-card__footer-link" to="/signup">
          Create an account
        </Link>
      </p>
    </div>
  );
}
