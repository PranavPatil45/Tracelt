import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import SocialLoginButton from "./SocialLoginButton.jsx";

const rawClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_ID =
  typeof rawClientId === "string"
    ? rawClientId
        .trim()
        .replace(/^["']|["']$/g, "")
        .trim()
    : "";

export default function GoogleSignInButton({
  onSuccess,
  onError,
  loading = false,
  disabled = false,
  mode = "continue",
}) {
  const containerRef = useRef(null);
  const [gisReady, setGisReady] = useState(false);
  const [gisFailed, setGisFailed] = useState(false);

  const isConfigured = Boolean(
    GOOGLE_CLIENT_ID &&
    GOOGLE_CLIENT_ID !== "your-google-client-id.apps.googleusercontent.com" &&
    !GOOGLE_CLIENT_ID.includes("your-google-client-id"),
  );

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!isConfigured) return;

    let checkInterval = null;
    let attempts = 0;

    function renderGis() {
      if (!window.google?.accounts?.id || !containerRef.current) return;

      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response?.credential) {
              onSuccessRef.current?.(response.credential);
            } else {
              onErrorRef.current?.(
                new Error("No credential returned by Google."),
              );
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        containerRef.current.innerHTML = "";

        // Render standard Google button into the container
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 400, // Large enough to cover the wrapper width
        });

        setGisReady(true);
        setGisFailed(false);
      } catch (err) {
        console.error("GIS render error:", err);
        setGisFailed(true);
      }
    }

    if (window.google?.accounts?.id) {
      renderGis();
    } else {
      checkInterval = setInterval(() => {
        attempts++;
        if (window.google?.accounts?.id) {
          clearInterval(checkInterval);
          renderGis();
        } else if (attempts > 20) {
          clearInterval(checkInterval);
          setGisFailed(true);
        }
      }, 200);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [isConfigured]);

  const buttonText =
    mode === "signup"
      ? "Sign up with Google"
      : mode === "signin"
        ? "Sign in with Google"
        : "Continue with Google";

  if (!isConfigured) {
    return (
      <div className="google-btn-wrapper">
        <SocialLoginButton
          provider="google"
          disabled={disabled}
          onClick={() =>
            alert("Please set VITE_GOOGLE_CLIENT_ID in frontend/.env")
          }
        >
          {buttonText}
        </SocialLoginButton>
        <div className="google-btn-hint">
          <AlertCircle size={12} />
          <span>Config required: VITE_GOOGLE_CLIENT_ID</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="google-btn-wrapper"
      style={{ position: "relative", width: "100%", overflow: "hidden" }}
    >
      {/* 1. Your Custom Styled Visual Button (Behind the invisible Google iframe) */}
      <SocialLoginButton provider="google" disabled={disabled || loading}>
        {loading ? (
          <>
            <Loader2 size={16} className="spin" />
            <span>Authenticating&hellip;</span>
          </>
        ) : (
          <span>{buttonText}</span>
        )}
      </SocialLoginButton>

      {/* 2. The Official Google GIS Iframe Container (Positioned absolutely over your button with 0 opacity) */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: 0, // Invisible, but clickable!
          zIndex: 10,
          cursor: "pointer",
          overflow: "hidden",
          pointerEvents: disabled || loading ? "none" : "auto",
        }}
      />
    </div>
  );
}
