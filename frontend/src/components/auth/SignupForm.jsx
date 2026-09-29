import { useState } from "react";
import { Link } from "react-router-dom";
import { User, Mail, ArrowRight, Loader2 } from "lucide-react";
import InputField from "./InputField.jsx";
import PasswordInput from "./PasswordInput.jsx";
import PasswordStrength, { passwordScore } from "./PasswordStrength.jsx";
import CampusSelect from "./CampusSelect.jsx";
import SocialLoginButton from "./SocialLoginButton.jsx";
import SignupSuccess from "./SignupSuccess.jsx";
import { startGoogleLogin, AuthError } from "../../api/auth.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { CAMPUSES, DEPARTMENTS } from "../../data/campuses.js";
import "./LoginForm.css";
import "./SignupForm.css";
import LogoIcon from "./LogoIcon";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupForm() {
  const { signup } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [campus, setCampus] = useState("");
  const [department, setDepartment] = useState("");
  const [agreed, setAgreed] = useState(true);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({}); // Track which fields have been blurred
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Helper to mark a specific field as touched onBlur
  function handleBlur(field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function validate(
    fieldValues = { fullName, email, password, confirmPassword, campus },
  ) {
    const next = {};

    if (!fieldValues.fullName.trim()) next.fullName = "Enter your full name.";

    if (!fieldValues.email.trim()) {
      next.email = "Enter your email to continue.";
    } else if (!EMAIL_PATTERN.test(fieldValues.email.trim())) {
      next.email = "That email address doesn’t look right.";
    }

    if (!fieldValues.password) {
      next.password = "Create a password to continue.";
    } else if (passwordScore(fieldValues.password) < 4) {
      next.password = "Your password doesn’t meet all the requirements yet.";
    }

    if (!fieldValues.confirmPassword) {
      next.confirmPassword = "Confirm your password.";
    } else if (fieldValues.confirmPassword !== fieldValues.password) {
      next.confirmPassword = "Passwords don’t match.";
    }

    if (!fieldValues.campus) next.campus = "Select your campus.";

    return next;
  }

  // Pure validation check without side effects for real-time field errors
  const currentErrors = validate();

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    // Mark all fields as touched on submit so all errors display if invalid
    setTouched({
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true,
      campus: true,
    });

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    if (!agreed) {
      setFormError(
        "Please accept the Terms of Service and Privacy Policy to continue.",
      );
      return;
    }

    setSubmitting(true);
    try {
      await signup({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        campus,
        department,
      });
      setSuccess(true);
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

  if (success) return <SignupSuccess />;

  return (
    <div className="login-card signup-card">
      <h1 className="login-card__heading">Create your account</h1>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <SocialLoginButton provider="google" onClick={startGoogleLogin}>
          Continue with Google
        </SocialLoginButton>

        <div className="login-form__divider">
          <span>OR</span>
        </div>

        <InputField
          id="fullName"
          icon={User}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={() => handleBlur("fullName")}
          placeholder="Enter your full name"
          autoComplete="name"
          error={touched.fullName ? currentErrors.fullName : undefined}
        />

        <InputField
          id="email"
          type="email"
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => handleBlur("email")}
          placeholder="Enter your email"
          autoComplete="email"
          error={touched.email ? currentErrors.email : undefined}
        />

        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => handleBlur("password")}
          placeholder="Create a password"
          autoComplete="new-password"
          error={touched.password ? currentErrors.password : undefined}
        >
          <PasswordStrength value={password} />
        </PasswordInput>

        <PasswordInput
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => handleBlur("confirmPassword")}
          placeholder="Confirm your password"
          autoComplete="new-password"
          error={
            touched.confirmPassword ? currentErrors.confirmPassword : undefined
          }
        />

        <CampusSelect
          id="campus"
          options={CAMPUSES}
          value={campus}
          onChange={setCampus}
          onBlur={() => handleBlur("campus")}
          placeholder="Select your campus"
          error={touched.campus ? currentErrors.campus : undefined}
        />

        <CampusSelect
          id="department"
          options={DEPARTMENTS}
          value={department}
          onChange={setDepartment}
          placeholder="Select your department"
        />

        {formError && (
          <div className="login-form__error" role="alert">
            {formError}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary login-form__submit"
          disabled={submitting || !agreed}
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="spin" /> Creating account&hellip;
            </>
          ) : (
            <>
              Create Account{" "}
              <ArrowRight size={16} className="login-form__submit-arrow" />
            </>
          )}
        </button>
      </form>

      <p className="login-card__footer">
        Already have an account?{" "}
        <Link className="login-card__footer-link" to="/login">
          Sign in
        </Link>
      </p>
    </div>
  );
}
