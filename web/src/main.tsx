import React from "react";
import { createRoot } from "react-dom/client";
import HostApp from "./host/App";
import PlayerApp from "./player/App";
import "./styles.css";

const isHost = /^\/host(\/|$)/.test(window.location.pathname);
document.documentElement.classList.add(isHost ? "is-host" : "is-player");
document.title = isHost ? "Buzzline · Host" : "Buzzline";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isHost ? <HostApp /> : <PlayerApp />}</React.StrictMode>,
);
