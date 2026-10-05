// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// src/lib/domain.ts re-exports the website's pure domain modules (types,
// labels, fit and side rules, delivery fees) from ../frontend/lib, so both
// shops show the same words and apply the same rules. Metro must watch it.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../frontend/lib")];

module.exports = config;
