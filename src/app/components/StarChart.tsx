export function StarChart({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`star-chart ${className}`}
      viewBox="0 0 600 600"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="0.65" opacity="0.3">
        {[95, 160, 225, 278].map((r) => (
          <circle key={r} cx="300" cy="300" r={r} />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d="M300 22V578"
            transform={`rotate(${i * 15} 300 300)`}
          />
        ))}
        <ellipse
          cx="300"
          cy="300"
          rx="278"
          ry="100"
          transform="rotate(-32 300 300)"
        />
      </g>
      <g stroke="currentColor" opacity="0.6">
        <path d="M134 385L206 310L250 325L324 215L399 187L437 257L371 345L250 325" />
        <path d="M206 310L201 214L276 140" strokeDasharray="3 6" />
      </g>
      <g className="star-chart-points" fill="currentColor">
        {[
          [134, 385, 3],
          [206, 310, 4],
          [250, 325, 3],
          [324, 215, 5],
          [399, 187, 3],
          [437, 257, 4],
          [371, 345, 3],
          [201, 214, 2],
          [276, 140, 3],
          [145, 147, 1],
          [450, 395, 2],
          [305, 455, 2],
          [490, 200, 1],
          [90, 290, 2],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} />
        ))}
      </g>
      <g stroke="currentColor">
        <path d="M324 202V228M311 215H337" />
        <circle cx="324" cy="215" r="13" opacity="0.5" />
      </g>
      <g
        fill="currentColor"
        fontFamily="monospace"
        fontSize="9"
        letterSpacing="2"
        opacity="0.65"
      >
        <text x="288" y="12">
          N / 00
        </text>
        <text x="286" y="598">
          S / 180
        </text>
        <text x="346" y="207">
          RENKO
        </text>
        <text x="451" y="260">
          MERRY
        </text>
        <text x="150" y="410">
          HIFUU / OBSERVATION
        </text>
      </g>
    </svg>
  );
}
