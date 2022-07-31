import express from "express";
import mjml2html from "mjml";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import open from "open";
import { attach, Buffer } from "neovim";

const PORT = 55476;
const HOST = "localhost";
const URL = `http://${HOST}:${PORT}`;

/**
 * Types for RPC notify
 */
type RPCNotify =
  | {
      method: "write";
      args: [string];
    }
  | {
      method: "close";
      args: [string];
    }
  | {
      method: "open";
      args: [string];
    };

/**
 * Types for RPC request
 */
type RPCRequest = {
  method: "check_open";
  args: [string];
};

/**
 * Websocket message schema
 */
type WsMessage =
  | {
      type: "html";
      message: string;
    }
  | {
      type: "error";
      message: string[];
    };

// track unattached buffers
const UnattachedBuffers: string[] = [];

// tracks buffer ids to its associated web socket client and nvim buffer
const BufferSockets = new Map<string, { socket: WebSocket; buffer: Buffer }>();

/**
 * Type safe wrapper for sending ws messages
 * @param socket - web socket client
 * @param message - message
 * @returns
 */
function socketSend(socket: WebSocket, message: WsMessage) {
  return socket.send(JSON.stringify(message));
}

/**
 * Transform a nvim buffer of mjml into html
 * @param buf - buffer
 * @returns html
 */
async function buf2Html(buf: Buffer) {
  const lines = await buf.lines;
  const mjml = lines.join("\n");
  return mjml2html(mjml);
}

/**
 * Convert and send the buffer to the web socket client
 * @param socket - ws client socket
 * @param buf - nvim buffer
 */
async function sendMjmlBuf(socket: WebSocket, buf: Buffer) {
  const { html, errors } = await buf2Html(buf);
  socketSend(socket, { type: "html", message: html });
  if (errors.length > 0) {
    socketSend(socket, {
      type: "error",
      message: errors.map((e) => e.formattedMessage),
    });
  }
}

const nvim = attach({ reader: process.stdin, writer: process.stdout });

nvim.on("notification", async (method: string, args: string[]) => {
  const rpcFn = { method, args } as RPCNotify;
  const bufnr = args[0];
  switch (rpcFn.method) {
    case "open":
      if (!BufferSockets.has(bufnr)) {
        open(URL);
        // push into unattached buffers, this will get picked up when a new ws client connects
        UnattachedBuffers.push(bufnr);
      }
      break;
    case "write": {
      const bs = BufferSockets.get(bufnr);
      if (bs) {
        sendMjmlBuf(bs.socket, bs.buffer);
      }
      break;
    }
    case "close": {
      const bs = BufferSockets.get(bufnr);
      if (bs) {
        bs.socket.close();
      }
      break;
    }
  }
});

nvim.on(
  "request",
  async (
    method: string,
    args: string[],
    resp: { send: (...args: string[]) => void }
  ) => {
    const rpcFn = { method, args } as RPCRequest;
    const bufnr = args[0];
    switch (rpcFn.method) {
      case "check_open": {
        const is_open = BufferSockets.has(bufnr);
        resp.send(is_open.toString());
      }
    }
  }
);

(async () => {
  const app = express();

  app.use("/", express.static(path.join(__dirname, "public")));

  const wsServer = new WebSocketServer({
    noServer: true,
    path: "/ws",
  });

  wsServer.on("connection", async (socket) => {
    socket.on("close", () => {
      // auto-clean up
      BufferSockets.delete(bufnr);
    });

    const bufnr = UnattachedBuffers.pop();
    if (BufferSockets.has(bufnr)) {
      socket.close();
    }

    const buffers = await nvim.buffers;
    const buffer = buffers.find((b) => b.id === parseInt(bufnr));
    if (!buffer) {
      socket.close();
    }
    BufferSockets.set(bufnr, { socket, buffer });
    sendMjmlBuf(socket, buffer);
  });

  const server = app.listen(PORT);

  server.on("upgrade", (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, (socket) => {
      wsServer.emit("connection", socket, req);
    });
  });
})();
