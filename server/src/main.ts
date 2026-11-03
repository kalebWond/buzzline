import { createServer } from "./app.js";
import { attachWebSocket } from "./ws.js";

const port = Number(process.env.PORT) || 4000;
const server = createServer();
attachWebSocket(server);
server.listen(port, () => {
  console.log(`buzzline server listening on :${port}`);
});
