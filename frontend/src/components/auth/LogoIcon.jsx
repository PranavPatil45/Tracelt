import React from "react";

const LogoIcon = ({ size = 500, className = "", ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="bgPinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0a2e5c" />
          <stop offset="100%" stopColor="#031329" />
        </linearGradient>

        <linearGradient id="cyanPinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00d2ff" />
          <stop offset="100%" stopColor="#0088cc" />
        </linearGradient>

        <linearGradient id="whiteLetterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d6dadf" />
        </linearGradient>

        <linearGradient id="magGlassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#e1e6eb" />
          <stop offset="100%" stopColor="#b0b8c2" />
        </linearGradient>

        <linearGradient id="handleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00b4d8" />
          <stop offset="100%" stopColor="#006699" />
        </linearGradient>

        <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="0"
            dy="10"
            stdDeviation="12"
            floodColor="#000000"
            floodOpacity="0.5"
          />
        </filter>

        <filter id="glassShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="4"
            dy="8"
            stdDeviation="6"
            floodColor="#000000"
            floodOpacity="0.4"
          />
        </filter>
      </defs>

      <g filter="url(#dropShadow)">
        <path
          d="M 250,30 C 140,30 65,115 65,225 C 65,310 160,400 250,470 C 340,400 435,310 435,225 C 435,115 360,30 250,30 Z"
          fill="url(#bgPinGrad)"
        />
        <path
          d="M 250,70 C 165,70 105,135 105,220 C 105,285 180,360 250,420 C 320,360 395,285 395,220 C 395,135 335,70 250,70 Z"
          fill="url(#cyanPinGrad)"
        />
        <path
          d="M 250,115 C 190,115 145,160 145,220 C 145,265 200,325 250,370 C 300,325 355,265 355,220 C 355,160 310,115 250,115 Z"
          fill="url(#bgPinGrad)"
        />
        <path
          d="M 180,145 H 320 V 195 H 272 V 330 L 250,350 L 228,330 V 195 H 180 Z"
          fill="url(#whiteLetterGrad)"
        />

        <g filter="url(#glassShadow)">
          <rect
            x="365"
            y="355"
            width="22"
            height="60"
            rx="11"
            transform="rotate(-45 365 355)"
            fill="url(#handleGrad)"
          />
          <circle cx="330" cy="305" r="72" fill="url(#magGlassGrad)" />
          <circle cx="330" cy="305" r="48" fill="#061c38" />
          <circle
            cx="330"
            cy="305"
            r="48"
            fill="none"
            stroke="url(#whiteLetterGrad)"
            strokeWidth="1"
            opacity="0.3"
          />
        </g>
      </g>
    </svg>
  );
};

export default LogoIcon;
