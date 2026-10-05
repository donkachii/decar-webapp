/**
 * Line-drawn saloon seen from above, front at the top. Left on the drawing is
 * the car's left (driver's side in Nigeria). viewBox is 300 x 440 so the
 * damage-selector grid can sit on it in percentages.
 */
export function CarTopView({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 440"
      aria-hidden
      className={className}
      fill="none"
      stroke="var(--color-navy)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform="translate(0 20)">
        {/* wheels */}
        <g fill="var(--color-navy)" stroke="none">
          <rect x="57" y="74" width="10" height="38" rx="3" />
          <rect x="233" y="74" width="10" height="38" rx="3" />
          <rect x="57" y="290" width="10" height="38" rx="3" />
          <rect x="233" y="290" width="10" height="38" rx="3" />
        </g>
        {/* body */}
        <path
          d="M96 16 C 78 18 70 30 69 50 L 66 120 L 66 300 L 69 352 C 70 372 80 384 98 385 L 202 385 C 220 384 230 372 231 352 L 234 300 L 234 120 L 231 50 C 230 30 222 18 204 16 Z"
          strokeWidth={2.5}
        />
        {/* front: bumper line, grill, headlights, hood creases */}
        <path d="M76 34 C 120 24 180 24 224 34" />
        <rect x="128" y="21" width="44" height="9" rx="3" />
        <path d="M74 46 L 112 37 L 110 51 L 75 59 Z" />
        <path d="M226 46 L 188 37 L 190 51 L 225 59 Z" />
        <path d="M110 62 C 112 86 112 106 108 124" stroke="var(--color-primer)" />
        <path d="M190 62 C 188 86 188 106 192 124" stroke="var(--color-primer)" />
        {/* glass and roof */}
        <path d="M80 132 C 120 121 180 121 220 132 L 208 168 C 170 161 130 161 92 168 Z" />
        <path d="M92 168 L 208 168 L 208 272 L 92 272 Z" />
        <path d="M92 272 C 130 280 170 280 208 272 L 216 302 C 172 310 128 310 84 302 Z" />
        {/* doors: seams and handles */}
        <path d="M66 150 L 82 150 M66 218 L 82 218 M66 284 L 82 284" />
        <path d="M234 150 L 218 150 M234 218 L 218 218 M234 284 L 218 284" />
        <path d="M70 196 L 70 206 M70 262 L 70 272 M230 196 L 230 206 M230 262 L 230 272" stroke="var(--color-primer)" strokeWidth={3} />
        {/* mirrors */}
        <path d="M67 140 L 48 134 C 42 134 40 141 43 147 L 66 152" />
        <path d="M233 140 L 252 134 C 258 134 260 141 257 147 L 234 152" />
        {/* rear: boot line, backlights, bumper */}
        <path d="M86 358 C 128 365 172 365 214 358" stroke="var(--color-primer)" />
        <path d="M72 348 L 101 357 L 99 370 L 74 366 Z" />
        <path d="M228 348 L 199 357 L 201 370 L 226 366 Z" />
        <path d="M78 376 C 120 385 180 385 222 376" />
      </g>
    </svg>
  );
}
