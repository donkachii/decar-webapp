import type { ExpoConfig } from "expo/config";

// Google sign-in on iOS needs the iOS OAuth client's reversed ID as a URL
// scheme. Without an iOS client ID the plugin is left out (it would otherwise
// look for Firebase files) and the app hides Google sign-in on iOS.
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const iosUrlScheme = iosClientId
  ? `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, "")}`
  : null;

// Bay and wine from the design tokens (src/theme.ts). The icon and splash
// images come from frontend/scripts/brand-assets.mjs (`pnpm brand` there).
const BAY = "#ECEEF0";
const WINE = "#4E1526";

const config: ExpoConfig = {
  name: "De Car Revolutionist",
  slug: "decar",
  version: "1.0.0",
  owner: "don_kachi",
  description: "Genuine Belgium and new Japanese body parts from Zuba Market, checked for fit before they leave the shop.",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  // decar://part/<SKU> opens a product, like /part/<SKU> on the website.
  scheme: "decar",
  userInterfaceStyle: "light",
  platforms: ["ios", "android"],
  backgroundColor: BAY,
  ios: {
    bundleIdentifier: "com.decarrevolutionist.shop",
    supportsTablet: false,
  },
  android: {
    package: "com.decarrevolutionist.shop",
    adaptiveIcon: {
      backgroundColor: WINE,
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    [
      "expo-splash-screen",
      { backgroundColor: WINE, image: "./assets/images/splash-icon.png", imageWidth: 240 },
    ],
    ...(iosUrlScheme ? [["@react-native-google-signin/google-signin", { iosUrlScheme }] as [string, object]] : []),
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: { projectId: "a57d39a9-3ec3-4a38-b8d1-59e98aa6e4a2" },
  },
};

export default config;
