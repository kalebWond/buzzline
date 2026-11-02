import { createServer } from "./app.js";

const port = Number(process.env.PORT) || 4000;
createServer().listen(port, () => {
  console.log(`buzzline server listening on :${port}`);
});
