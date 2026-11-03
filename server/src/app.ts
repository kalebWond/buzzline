import express from "express";
import http from "node:http";
import path from "node:path";

export interface ServerOptions {
  /** Directory of the built web app. When set, the server serves it and falls back to its index.html. */
  staticDir?: string;
}

export function createServer(opts: ServerOptions = {}): http.Server {
  const app = express();
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  if (opts.staticDir) {
    const dir = path.resolve(opts.staticDir);
    app.use(express.static(dir, { index: "index.html" }));
    // Client-side routes like /host and /?code=ABCD all load the same page.
    app.get(/^\/(?!api\/|ws$).*/, (_req, res) => {
      res.sendFile(path.join(dir, "index.html"));
    });
  }
  return http.createServer(app);
}
