import express from "express";
import http from "node:http";

export function createServer(): http.Server {
  const app = express();
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  return http.createServer(app);
}
