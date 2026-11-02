import React from "react";
import { createRoot } from "react-dom/client";
import HostApp from "./host/App";
import PlayerApp from "./player/App";

const isHost = /^\/host(\/|$)/.test(window.location.pathname);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isHost ? <HostApp /> : <PlayerApp />}</React.StrictMode>,
);
