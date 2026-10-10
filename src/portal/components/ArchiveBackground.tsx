export function ArchiveBackground() {
  return <div className="archive-background" aria-hidden="true"><svg className="archive-overall-grid" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
<defs>
<pattern id="archive-hatching" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M-3 3L3-3M0 12L12 0M9 15L15 9" stroke="#babaae" strokeWidth=".65"/></pattern>
<pattern id="archive-large-grid" width="112" height="112" patternUnits="userSpaceOnUse"><path d="M112 0H0V112" stroke="#b9b9ad" strokeWidth=".8"/></pattern>
<pattern id="archive-grid-blocks" width="560" height="672" patternUnits="userSpaceOnUse"><rect x="112" y="112" width="112" height="112" fill="url(#archive-hatching)"/><rect x="448" y="448" width="112" height="112" fill="url(#archive-hatching)"/><rect x="0" y="560" width="112" height="112" fill="url(#archive-hatching)"/></pattern>
<pattern id="archive-mobile-grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" stroke="#b9b9ad" strokeWidth=".8"/></pattern>
<pattern id="archive-mobile-blocks" width="400" height="640" patternUnits="userSpaceOnUse"><rect x="240" y="80" width="80" height="80" fill="url(#archive-hatching)"/><rect x="0" y="400" width="80" height="80" fill="url(#archive-hatching)"/><rect x="320" y="560" width="80" height="80" fill="url(#archive-hatching)"/></pattern>
</defs>
<g className="background-grid-desktop"><rect width="100%" height="100%" fill="url(#archive-grid-blocks)"/><rect width="100%" height="100%" fill="url(#archive-large-grid)"/></g>
<g className="background-grid-mobile"><rect width="100%" height="100%" fill="url(#archive-mobile-blocks)"/><rect width="100%" height="100%" fill="url(#archive-mobile-grid)"/></g>
</svg>
<svg className="archive-overall-transfer background-grid-desktop" viewBox="0 0 1440 1400" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
<g stroke="#c9c9b9">
<ellipse cx="745" cy="725" rx="525" ry="490" transform="rotate(-24 745 725)" strokeWidth="1.1"/>
<ellipse cx="665" cy="745" rx="343" ry="401" transform="rotate(29 665 745)" strokeWidth="1" strokeDasharray="5 12"/>
<path d="M133 1091C389 1082 717 947 1005 639C1181 451 1281 274 1292 107" strokeWidth="2"/>
<path d="M1005 639C892 452 677 312 419 237M440 264L419 237L453 230" strokeWidth="1.3"/>
<path d="M18 725H1412M745 52V1348" strokeWidth=".6" strokeDasharray="3 15"/>
<rect x="992" y="626" width="26" height="26" strokeWidth="1.1"/>
<path d="M969 639H1041M1005 603V675M345 1040H395V1090H345ZM345 1040L395 1090M395 1040L345 1090" strokeWidth="1"/>
</g>
</svg>
<svg className="archive-overall-transfer background-grid-mobile" viewBox="0 0 390 1480" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
<g stroke="#c9c9b9">
<ellipse cx="195" cy="685" rx="160" ry="440" strokeWidth="1.1"/>
<ellipse cx="191" cy="810" rx="116" ry="315" strokeWidth="1" strokeDasharray="5 12"/>
<path d="M22 1200C176 1120 295 881 318 590C339 336 296 218 236 115" strokeWidth="2"/>
<path d="M318 590C253 483 162 429 42 391M66 392L42 391L53 415" strokeWidth="1.3"/>
<path d="M195 80V1360M12 685H378" strokeWidth=".6" strokeDasharray="3 15"/>
<rect x="306" y="578" width="24" height="24" strokeWidth="1.1"/>
<path d="M292 590H344M318 564V616" strokeWidth="1"/>
</g>
</svg>
</div>;
}
