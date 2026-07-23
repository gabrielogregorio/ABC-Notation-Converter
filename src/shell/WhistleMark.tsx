// The brand mark: a stylised tin whistle - green body, brass fipple and six
// brass tone holes. Feadóg-ish. Uses currentColor-independent fixed hues so it
// reads the same on light and dark paper.
export function WhistleMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`whistle-mark ${className}`}
      viewBox="0 0 128 34"
      role="img"
      aria-label="tin whistle"
      focusable="false"
    >
      <defs>
        <linearGradient id="wm-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2fa564" />
          <stop offset="0.5" stopColor="#1d7a4b" />
          <stop offset="1" stopColor="#155f39" />
        </linearGradient>
        <linearGradient id="wm-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4e3a1" />
          <stop offset="1" stopColor="#b8860b" />
        </linearGradient>
      </defs>
      {/* mouthpiece / fipple */}
      <rect x="1" y="7" width="20" height="20" rx="5" fill="url(#wm-brass)" />
      <rect x="6" y="12.5" width="9" height="4" rx="1.5" fill="#155f39" />
      {/* body tube */}
      <rect x="17" y="10" width="108" height="14" rx="7" fill="url(#wm-body)" />
      <rect x="17" y="11" width="108" height="4" rx="2" fill="#ffffff" opacity="0.18" />
      {/* tone holes */}
      {[40, 54, 68, 86, 100, 114].map((cx) => (
        <circle key={cx} cx={cx} cy="17" r="3.1" fill="url(#wm-brass)" stroke="#8a6508" strokeWidth="0.6" />
      ))}
    </svg>
  );
}
