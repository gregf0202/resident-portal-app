import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

// The version people see is the one in ResidentPortal.jsx (PLATFORM.version), so
// read it from there rather than keeping a second copy in package.json that would
// quietly drift. Each build also gets a unique id: two builds of the same version
// are still different builds, and the app should notice.
function readVersion() {
  try {
    const src = fs.readFileSync("src/ResidentPortal.jsx", "utf8");
    const m = src.match(/const PLATFORM = \{[^}]*version:\s*"([^"]+)"/);
    return m ? m[1] : "0.0.0";
  } catch {
    return "0.0.0";
  }
}
const VERSION = readVersion();
const BUILD_ID = `${VERSION}+${Date.now().toString(36)}`;

// Publishes /version.json alongside the app. The running app polls it and offers
// a refresh when the build id differs from the one it was built with.
function versionStamp() {
  return {
    name: "nalohub-version-stamp",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version: VERSION, build: BUILD_ID, builtAt: new Date().toISOString() }, null, 2),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionStamp()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __APP_VERSION__: JSON.stringify(VERSION),
  },
});
