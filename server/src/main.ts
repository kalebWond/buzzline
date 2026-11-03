import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./app.js";
import { attachWebSocket } from "./ws.js";

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || undefined;
const webDist =
  process.env.WEB_DIST ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
const staticDir = existsSync(path.join(webDist, "index.html")) ? webDist : undefined;

const server = createServer({ staticDir });
attachWebSocket(server);
server.listen(port, host, () => {
  console.log(`buzzline server listening on ${host ?? ""}:${port}`);
  console.log(staticDir ? `serving web app from ${staticDir}` : "web app not built; API and WebSocket only");
});
