import React from 'react';

/**
 * Conduit logo component.
 *
 * Props:
 *   size        — icon height in px (default 36)
 *   variant     — 'color' (default) | 'white' | 'ghost'
 *                   color : gradient badge + white rails + blue nodes
 *                   white : frosted/transparent badge + white rails + blue nodes (on dark header)
 *                   ghost : icon only, transparent bg (rare use)
 *   showWordmark — show "Conduit" text beside icon (default true)
 *   subtitle    — optional sub-label beneath wordmark (e.g. "Field Service CRM")
 *   wordmarkColor — CSS color for the wordmark text (default auto based on variant)
 */
export default function Logo({
  size = 36,
  variant = 'color',
  showWordmark = true,
  subtitle,
  wordmarkColor,
}) {
  const rx = Math.round(size * 0.225); // border-radius scales with size

  // Badge fill
  const badgeFill = variant === 'white'
    ? 'rgba(255,255,255,0.12)'
    : 'url(#conduit-grad)';

  // Rail/arc stroke color
  const strokeColor = '#ffffff';

  // Node fill
  const nodeColor = '#60a5fa';

  // Rail geometry (scales off 40×40 viewBox)
  // top rail: y=14, bottom rail: y=26, arc x=23
  // node cx=9, cy=14/26, r=3.5

  // Wordmark color
  const wc = wordmarkColor
    ? wordmarkColor
    : variant === 'color'
      ? '#0f172a'   // dark text on light bg
      : '#ffffff';  // white text on dark bg

  const subtitleColor = variant === 'color'
    ? 'rgba(100,116,139,1)'
    : 'rgba(255,255,255,0.45)';

  const wordmarkSize = size * 0.5;
  const subtitleSize = size * 0.3;
  const gap = Math.round(size * 0.25);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: gap }}>
      {/* Icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="conduit-grad"
            x1="0" y1="0" x2="40" y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>

        {/* Badge background */}
        <rect width="40" height="40" rx={rx} fill={badgeFill} />

        {/* Top rail */}
        <line
          x1="9" y1="14" x2="23" y2="14"
          stroke={strokeColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Bottom rail */}
        <line
          x1="9" y1="26" x2="23" y2="26"
          stroke={strokeColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Right arc connector */}
        <path
          d="M23 14 A6 6 0 0 1 23 26"
          fill="none"
          stroke={strokeColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Entry nodes */}
        <circle cx="9" cy="14" r="3.5" fill={nodeColor} />
        <circle cx="9" cy="26" r="3.5" fill={nodeColor} />
      </svg>

      {/* Wordmark + optional subtitle */}
      {showWordmark && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            fontWeight: 800,
            fontSize: wordmarkSize,
            letterSpacing: '-0.02em',
            color: wc,
            lineHeight: 1.1,
          }}>
            Conduit
          </span>
          {subtitle && (
            <span style={{
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              fontWeight: 500,
              fontSize: subtitleSize,
              letterSpacing: '0.04em',
              color: subtitleColor,
              marginTop: 3,
              textTransform: 'uppercase',
            }}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
