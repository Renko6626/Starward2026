export function HomeSideGrid() {
  return <div className="home-side-grid" aria-hidden="true">
    <svg width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <defs>
        <clipPath id="home-drafting-left" clipPathUnits="objectBoundingBox">
          <rect width=".5" height="1" />
        </clipPath>
        <pattern id="home-drafting-grid" width="224" height="224" patternUnits="userSpaceOnUse">
          <path d="M224 0H0V224" stroke="#9baab2" strokeWidth=".65" />
        </pattern>
        <pattern id="home-side-hatching" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M-3 3L3-3M0 12L12 0M9 15L15 9" stroke="#babaae" strokeWidth=".65" />
        </pattern>
        <pattern id="home-side-grid" width="112" height="112" patternUnits="userSpaceOnUse">
          <path d="M112 0H0V112" stroke="#b9b9ad" strokeWidth=".8" />
        </pattern>
        <pattern id="home-side-blocks" width="560" height="672" patternUnits="userSpaceOnUse">
          <rect x="112" y="112" width="112" height="112" fill="url(#home-side-hatching)" />
          <rect x="448" y="448" width="112" height="112" fill="url(#home-side-hatching)" />
          <rect y="560" width="112" height="112" fill="url(#home-side-hatching)" />
        </pattern>
      </defs>
      <g clipPath="url(#home-drafting-left)">
        <rect width="50%" height="100%" fill="#080c10" />
        <rect width="50%" height="100%" fill="url(#home-drafting-grid)" opacity=".22" />
        <g stroke="#9baab2" strokeWidth=".65" opacity=".52">
          <path d="M40 224H352M112 80V384M24 784H320M64 672V1008M40 1344H352M160 1232V1512" />
          <path d="M106 218H118M112 218V230M58 778H70M64 778V790M154 1338H166M160 1338V1350" />
        </g>
        <g className="home-drafting-labels">
          <text x="40" y="208">SECTOR B-12</text>
          <text x="88" y="768">FRAME 04</text>
          <text x="40" y="1328">SECTOR B-13</text>
        </g>
      </g>
      <rect x="50%" width="50%" height="100%" fill="url(#home-side-blocks)" />
      <rect x="50%" width="50%" height="100%" fill="url(#home-side-grid)" />
    </svg>
  </div>;
}
