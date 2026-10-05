import Svg, { G, Path, Rect } from "react-native-svg";

import { color } from "@/theme";

/**
 * Line-drawn saloon seen from above, front at the top: the website's
 * components/car-top-view.tsx. Left on the drawing is the car's left (driver's
 * side in Nigeria). viewBox is 300 x 440 so the damage-selector grid can sit
 * on it in percentages.
 */
export function CarTopView({ width, height }: { width: number; height: number }) {
  const line = { stroke: color.navy, strokeWidth: 2, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const faint = { ...line, stroke: color.primer };
  return (
    <Svg viewBox="0 0 300 440" width={width} height={height}>
      <G transform="translate(0 20)">
        {/* wheels */}
        <G fill={color.navy}>
          <Rect x="57" y="74" width="10" height="38" rx="3" />
          <Rect x="233" y="74" width="10" height="38" rx="3" />
          <Rect x="57" y="290" width="10" height="38" rx="3" />
          <Rect x="233" y="290" width="10" height="38" rx="3" />
        </G>
        {/* body */}
        <Path
          {...line}
          strokeWidth={2.5}
          d="M96 16 C 78 18 70 30 69 50 L 66 120 L 66 300 L 69 352 C 70 372 80 384 98 385 L 202 385 C 220 384 230 372 231 352 L 234 300 L 234 120 L 231 50 C 230 30 222 18 204 16 Z"
        />
        {/* front: bumper line, grill, headlights, hood creases */}
        <Path {...line} d="M76 34 C 120 24 180 24 224 34" />
        <Rect {...line} x="128" y="21" width="44" height="9" rx="3" />
        <Path {...line} d="M74 46 L 112 37 L 110 51 L 75 59 Z" />
        <Path {...line} d="M226 46 L 188 37 L 190 51 L 225 59 Z" />
        <Path {...faint} d="M110 62 C 112 86 112 106 108 124" />
        <Path {...faint} d="M190 62 C 188 86 188 106 192 124" />
        {/* glass and roof */}
        <Path {...line} d="M80 132 C 120 121 180 121 220 132 L 208 168 C 170 161 130 161 92 168 Z" />
        <Path {...line} d="M92 168 L 208 168 L 208 272 L 92 272 Z" />
        <Path {...line} d="M92 272 C 130 280 170 280 208 272 L 216 302 C 172 310 128 310 84 302 Z" />
        {/* doors: seams and handles */}
        <Path {...line} d="M66 150 L 82 150 M66 218 L 82 218 M66 284 L 82 284" />
        <Path {...line} d="M234 150 L 218 150 M234 218 L 218 218 M234 284 L 218 284" />
        <Path {...faint} strokeWidth={3} d="M70 196 L 70 206 M70 262 L 70 272 M230 196 L 230 206 M230 262 L 230 272" />
        {/* mirrors */}
        <Path {...line} d="M67 140 L 48 134 C 42 134 40 141 43 147 L 66 152" />
        <Path {...line} d="M233 140 L 252 134 C 258 134 260 141 257 147 L 234 152" />
        {/* rear: boot line, backlights, bumper */}
        <Path {...faint} d="M86 358 C 128 365 172 365 214 358" />
        <Path {...line} d="M72 348 L 101 357 L 99 370 L 74 366 Z" />
        <Path {...line} d="M228 348 L 199 357 L 201 370 L 226 366 Z" />
        <Path {...line} d="M78 376 C 120 385 180 385 222 376" />
      </G>
    </Svg>
  );
}
