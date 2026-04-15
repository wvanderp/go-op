import { createGameServer } from "./index.js";

const PORT = Number(process.env.PORT) || 9000;

const server = createGameServer(PORT);

server.start();
console.log(`[go-op] Game server listening on ws://localhost:${PORT}`);

process.on("SIGINT", () => {
  console.log("\n[go-op] Shutting down…");
  server.stop();
  process.exit(0);
});
