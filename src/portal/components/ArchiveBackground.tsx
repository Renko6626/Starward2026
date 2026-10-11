const recordFragments = ["record", "pulsar", "waveform", "frames", "hydrogen"] as const;

// An irregular, fixed arrangement keeps the hatching stable across renders.
const hatchedCells = [[0, 1], [3, 0], [7, 3], [8, 5], [1, 6], [9, 9], [5, 10], [0, 11]] as const;

export function ArchiveBackground() {
  return <div className="archive-background" aria-hidden="true">
    <div className="archive-grid-layer">
      <svg className="archive-overall-grid" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
        <defs>
          <pattern id="archive-hatching" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M-3 3L3-3M0 12L12 0M9 15L15 9" stroke="#babaae" strokeWidth=".65" />
          </pattern>
          <pattern id="archive-large-grid" width="112" height="112" patternUnits="userSpaceOnUse">
            <path d="M112 0H0V112" stroke="#b9b9ad" strokeWidth=".8" />
          </pattern>
          <pattern id="archive-grid-blocks" width="1120" height="1344" patternUnits="userSpaceOnUse">
            {hatchedCells.map(([x, y]) => <rect key={`${x}-${y}`} x={x * 112} y={y * 112} width="112" height="112" fill="url(#archive-hatching)" />)}
          </pattern>
          <pattern id="archive-mobile-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M80 0H0V80" stroke="#b9b9ad" strokeWidth=".8" />
          </pattern>
          <pattern id="archive-mobile-blocks" width="400" height="640" patternUnits="userSpaceOnUse">
            <rect x="240" y="80" width="80" height="80" fill="url(#archive-hatching)" />
            <rect x="0" y="400" width="80" height="80" fill="url(#archive-hatching)" />
            <rect x="320" y="560" width="80" height="80" fill="url(#archive-hatching)" />
          </pattern>
        </defs>
        <g className="background-grid-desktop">
          <rect width="100%" height="100%" fill="url(#archive-grid-blocks)" />
          <rect width="100%" height="100%" fill="url(#archive-large-grid)" />
        </g>
        <g className="background-grid-mobile">
          <rect width="100%" height="100%" fill="url(#archive-mobile-blocks)" />
          <rect width="100%" height="100%" fill="url(#archive-mobile-grid)" />
        </g>
      </svg>
    </div>
    <div className="archive-record-layer">
      <div className="archive-record-art">
        {recordFragments.map(fragment => <div key={fragment} className={`archive-record-fragment archive-record-${fragment}`}>
          <img src="/images/portal/voyager-cover-explanation.jpg" alt="" width="1795" height="1376" decoding="async" draggable={false} />
        </div>)}
      </div>
    </div>
  </div>;
}
