const http = require("http");
const process = require("process");
const fs = require("fs");
const mjml2html = require("mjml");
const { WebSocketServer } = require("ws");
const path = require("path");
const open = require("open");
const { attach } = require("neovim");

const PORT = 55476;
const HOST = "localhost";
const URL = `http://${HOST}:${PORT}`;

// track unattached buffers
/** @type {string[]} */
const UnattachedBuffers = [];

// tracks buffer ids to its associated web socket client and nvim buffer
/** @type {Map<string, {socket: WebSocket, buffer: import("neovim").Buffer}>} */
const BufferSockets = new Map();

/**
 * Type safe wrapper for sending ws messages
 * @param {import("ws").WebSocket} socket - web socket client
 * @param {import("./").WsMessage} message - message
 * @returns
 */
function socketSend(socket, message) {
  return socket.send(JSON.stringify(message));
}

/**
 * Convert and send the buffer to the web socket client
 * @param {import("ws").WebSocket} socket - ws client socket
 * @param {import("neovim").Buffer} buf - nvim buffer
 */
async function sendMjmlBuf(socket, buf) {
  const lines = await buf.lines;
  const mjml = lines.join("\n");
  try {
    const { html, errors } = mjml2html(mjml);
    socketSend(socket, { type: "html", message: html });
    socketSend(socket, {
      type: "error",
      message: errors.map((e) => e.formattedMessage),
    });
  } catch (err) {
    if (err instanceof Error) {
      socketSend(socket, {
        type: "error",
        message: [err.message, mjml],
      });
    }
  }
}

function setupNvim() {
  const nvim = attach({ reader: process.stdin, writer: process.stdout });

  nvim.on(
    "notification",
    /**
     * @param {string} method
     * @param {string[]} args
     */
    async (method, args) => {
      /** @type {import("./").RPCNotify} */
      const rpcFn = { method, args };
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
    }
  );

  nvim.on(
    "request",
    /**
     * @param {string} method
     * @param {string[]} args
     * @param {{send: (...args: string[]) => void }} rsp
     */
    async (method, args, resp) => {
      /** @type {import("./").RPCRequest} */
      const rpcFn = { method, args };
      const bufnr = args[0];
      switch (rpcFn.method) {
        case "check_open": {
          const is_open = BufferSockets.has(bufnr);
          resp.send(is_open.toString());
        }
      }
    }
  );
  return nvim;
}

(async () => {
  const nvim = setupNvim();

  // static file server
  const server = http.createServer((req, res) => {
    if (req.url === "/" || !req.url) req.url = "index.html";
    const r = path.join(__dirname, "public", req.url);
    fs.readFile(r, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end(JSON.stringify(err));
        return;
      }
      res.writeHead(200);
      res.end(data);
    });
  });

  const wsServer = new WebSocketServer({
    noServer: true,
    path: "/ws",
  });

  wsServer.on("connection", async (socket) => {
    const bufnr = UnattachedBuffers.pop();
    if (!bufnr) return;

    socket.on("close", () => {
      // auto-clean up
      BufferSockets.delete(bufnr);
    });

    if (BufferSockets.has(bufnr)) {
      socket.close();
    }

    const buffers = await nvim.buffers;
    const buffer = buffers.find((b) => b.id === parseInt(bufnr));
    if (!buffer) {
      socket.close();
      return;
    }
    BufferSockets.set(bufnr, { socket, buffer });
    sendMjmlBuf(socket, buffer);
  });

  server.on("upgrade", (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, (socket) => {
      wsServer.emit("connection", socket, req);
    });
  });

  server.listen(PORT);
})();
