import { createServer, type IncomingMessage } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Client } from "pg";
import { WebSocket, WebSocketServer } from "ws";
import { authService } from "./server/auth/service";
import { readSessionToken, sessionCookieName } from "./server/auth/tokens";

const eventPath = "/api/events";
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";

function cookieValue(request: IncomingMessage, name: string): string | undefined {
  const cookie = request.headers.cookie;
  if (!cookie) return undefined;
  return cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function rejectUpgrade(socket: import("node:stream").Duplex, status: number): void {
  socket.write(`HTTP/1.1 ${status} ${status === 401 ? "Unauthorized" : "Forbidden"}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

async function canConnect(request: IncomingMessage): Promise<boolean> {
  if (!sameOrigin(request)) return false;
  const token = cookieValue(request, sessionCookieName);
  if (!token) return false;
  const userId = await readSessionToken(token);
  return Boolean(userId && await authService.findUser(userId));
}

async function main(): Promise<void> {
  const app = next({ dev: process.env.NODE_ENV !== "production", hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const sockets = new Set<WebSocket>();
  const webSocketServer = new WebSocketServer({ noServer: true, clientTracking: false });
  const server = createServer((request, response) => handle(request, response, parse(request.url ?? "/", true)));
  server.on("upgrade", async (request, socket, head) => {
    const pathname = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`).pathname;
    if (pathname !== eventPath) {
      socket.destroy();
      return;
    }
    try {
      if (!await canConnect(request)) return rejectUpgrade(socket, 401);
      webSocketServer.handleUpgrade(request, socket, head, (websocket) => {
        sockets.add(websocket);
        websocket.on("close", () => sockets.delete(websocket));
        websocket.on("error", () => sockets.delete(websocket));
        websocket.send(JSON.stringify({ type: "connection.ready", occurredAt: new Date().toISOString() }));
      });
    } catch (error) {
      console.error("websocket_upgrade_failed", { error: error instanceof Error ? error.name : "unknown_error" });
      rejectUpgrade(socket, 401);
    }
  });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  let listener: Client | undefined;
  let reconnectTimer: NodeJS.Timeout | undefined;
  let stopping = false;
  const scheduleReconnect = (error?: Error) => {
    if (stopping || reconnectTimer) return;
    console.error("websocket_event_listener_failed", { error: error?.name ?? "connection_ended" });
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = undefined;
      try {
        await connectEventListener();
        console.info("websocket_event_listener_reconnected");
      } catch (reconnectError) {
        scheduleReconnect(reconnectError instanceof Error ? reconnectError : undefined);
      }
    }, 1_000);
  };
  const connectEventListener = async (): Promise<void> => {
    const client = new Client({ connectionString: databaseUrl });
    try {
      await client.connect();
      await client.query("LISTEN home_dashboard_events");
    } catch (error) {
      await client.end().catch(() => undefined);
      throw error;
    }
    listener = client;
    client.on("notification", (notification) => {
      if (listener !== client || !notification.payload) return;
      for (const socket of sockets) {
        if (socket.readyState === WebSocket.OPEN) socket.send(notification.payload);
      }
    });
    client.on("error", (error) => {
      if (listener === client) scheduleReconnect(error);
    });
    client.on("end", () => {
      if (listener === client) scheduleReconnect();
    });
  };
  await connectEventListener();

  const heartbeat = setInterval(() => {
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.ping();
    }
  }, 30_000);
  server.listen(port, hostname, () => console.info("websocket_server_started", { path: eventPath, port }));

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, async () => {
      stopping = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(heartbeat);
      for (const socket of sockets) socket.close(1001, "server_shutdown");
      await listener?.end();
      server.close(() => process.exit(0));
    });
  }
}

main().catch((error) => {
  console.error("websocket_server_start_failed", { error: error instanceof Error ? error.name : "unknown_error" });
  process.exitCode = 1;
});
