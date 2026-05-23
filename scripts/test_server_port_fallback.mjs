import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const blocker = createServer((request, response) => {
  response.writeHead(200);
  response.end("busy");
});
const busyPort = await listen(blocker);
const child = spawn(process.execPath, ["scripts/serve_mock_draft.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(busyPort),
    PORT_ATTEMPTS: "2",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";

try {
  const startedPort = await waitForDashboard(child, busyPort);
  assert.equal(startedPort, busyPort + 1, "server should fall back to the next port when preferred port is busy");
  assert.match(stdout, new RegExp(`Preferred port ${busyPort} was busy`));
  console.log(JSON.stringify({
    status: "passed",
    tested: ["preferred port occupied", "fallback port startup", "fallback message"],
    busyPort,
    startedPort,
  }, null, 2));
} finally {
  child.kill();
  await close(blocker);
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(address.port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function waitForDashboard(child, busyPort) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for fallback startup. stdout=${stdout} stderr=${stderr}`));
    }, 5000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const match = stdout.match(/dashboard: http:\/\/127\.0\.0\.1:(\d+)/);
      if (match && stdout.includes(`Preferred port ${busyPort} was busy`)) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited before fallback startup. code=${code} stdout=${stdout} stderr=${stderr}`));
    });
  });
}
