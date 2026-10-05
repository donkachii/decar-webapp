import type { DimensionValue } from "react-native";

import type { Zone } from "@/lib/domain";

// Grid cells over the 300 x 440 drawing: columns 0–32–68–100%, rows 0–30–70–100%.
// The same areas as the website's damage selector and position diagram.
export const ZONE_AREA: Record<Zone, { left: DimensionValue; top: DimensionValue; width: DimensionValue; height: DimensionValue }> = {
  "front-left": { left: "0%", top: "0%", width: "32%", height: "30%" },
  front: { left: "32%", top: "0%", width: "36%", height: "30%" },
  "front-right": { left: "68%", top: "0%", width: "32%", height: "30%" },
  left: { left: "0%", top: "30%", width: "32%", height: "40%" },
  right: { left: "68%", top: "30%", width: "32%", height: "40%" },
  "rear-left": { left: "0%", top: "70%", width: "32%", height: "30%" },
  rear: { left: "32%", top: "70%", width: "36%", height: "30%" },
  "rear-right": { left: "68%", top: "70%", width: "32%", height: "30%" },
};

export const DRAWING_RATIO = 440 / 300;
