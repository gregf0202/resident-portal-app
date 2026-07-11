import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import DemoApp from "./ResidentPortal.jsx";
import "./styles.css";

// Demo mode: same codebase, no Supabase, seeded SeaHaven sandbox data.
// Set VITE_DEMO_MODE=true in the Netlify site that serves demo.nalohub.com —
// every feature shipped to the app then lands in the demo automatically.
const DEMO = String(import.meta.env.VITE_DEMO_MODE || "").toLowerCase() === "true";

createRoot(document.getElementById("root")).render(DEMO ? <DemoApp /> : <App />);
