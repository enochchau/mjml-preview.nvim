import express from "express";
import mjml2html from "mjml";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import open from "open";
import { attach, Buffer } from "neovim";

const PORT = 5000;
const HOST = "localhost";
const URL = `http://${HOST}:${PORT}`;

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
 * Websocket message schema
 */
type WsMessage = {
  type: "html";
  message: string;
};

// track unattached buffers
const UnattachedBuffers: string[] = [];

// tracks buffer ids to its associated web socket client and nvim buffer
const BufferSockets = new Map<string, { socket: WebSocket; buffer: Buffer }>();

function socketSend(socket: WebSocket, message: WsMessage) {
  return socket.send(JSON.stringify(message));
}

async function buf2Html(buf: Buffer) {
  const lines = await buf.lines;
  const mjml = lines.join("\n");
  const { html } = mjml2html(mjml);
  return html;
}

const nvim = attach({ reader: process.stdin, writer: process.stdout });

nvim.on("notification", async (method: string, args: string[]) => {
  const rpcFn = { method, args } as RPCNotify;
  const bufnr = args[0];
  switch (rpcFn.method) {
    case "open":
      if (!BufferSockets.has(bufnr)) {
        open(URL);
        UnattachedBuffers.push(bufnr);
      }
      break;
    case "write": {
      const bs = BufferSockets.get(bufnr);
      if (bs) {
        const html = await buf2Html(bs.buffer);
        socketSend(bs.socket, { type: "html", message: html });
      }
      break;
    }
    case "close": {
      const bs = BufferSockets.get(bufnr);
      if (bs) {
        bs.socket.close();
        BufferSockets.delete(bufnr);
      }
      break;
    }
  }
});

(async () => {
  const app = express();

  app.use("/", express.static(path.join(__dirname, "public")));

  const wss = new WebSocketServer({
    noServer: true,
    path: "/ws",
  });

  wss.on("connection", async (socket) => {
    socket.on("close", () => {
      BufferSockets.delete(bufnr);
    });

    const bufnr = UnattachedBuffers.pop();
    if (BufferSockets.has(bufnr)) {
      socket.close();
    }

    const buffers = await nvim.buffers;
    const buffer = buffers.find((b) => b.id === parseInt(bufnr));
    if (!buffer) {
      BufferSockets.delete(bufnr);
      socket.close();
    }

    const initialHtml = await buf2Html(buffer);
    socketSend(socket, { type: "html", message: initialHtml });

    BufferSockets.set(bufnr, { socket, buffer });
  });

  const server = app.listen(PORT);

  server.on("upgrade", (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (socket) => {
      wss.emit("connection", socket, req);
    });
  });
})();
