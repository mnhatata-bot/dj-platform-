import next from "next";
import http from "node:http";
const app = next({ dev: false, hostname: "127.0.0.1", port: 3002 });
await app.prepare();
const server = http.createServer(app.getRequestHandler());
await new Promise((resolve) => server.listen(3002, "127.0.0.1", resolve));
process.env.TEST_APP_URL = "http://127.0.0.1:3002";
try {
  await import("./modules-smoke.mjs");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await new Promise((resolve) => server.close(resolve));
  await app.close();
}
