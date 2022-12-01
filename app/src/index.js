const http = require("http");
const process = require("process");
const fs = require("fs");
const mjml2html = require("mjml");
const { WebSocketServer } = require("ws");
const path = require("path");
const open = require("open");
const { attach, NeovimClient } = require("neovim");

const PORT = 55476;
const HOST = "localhost";
const URL = `http://${HOST}:${PORT}`;
/**
 * Get URL for a bufnr
 * @param {string} bufnr
 */
const getUrl = (bufnr) => URL + "/buffer/" + bufnr;

// tracks buffer ids to its associated web socket client and nvim buffer
/** @type {Map<string, Set<WebSocket>>} */
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
 * Find neovim buffer
 * @param {NeovimClient} nvim
 * @param {string} bufnr
 * @returns {Promise<import("neovim").Buffer | undefined>}
 */
async function findBuffer(nvim, bufnr) {
  let id = parseInt(bufnr);
  return (await nvim.buffers).find((b) => b.id === id);
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
      const bufnr = args[0].toString();
      switch (rpcFn.method) {
        case "open":
          open(getUrl(bufnr));
          break;
        case "write": {
          let buffer = await findBuffer(nvim, bufnr);
          if (buffer) {
            const sockets = BufferSockets.get(bufnr);
            if (sockets) {
              sockets.forEach((socket) => {
                sendMjmlBuf(socket, buffer);
              });
            }
          }
          break;
        }
        case "close": {
          const sockets = BufferSockets.get(bufnr);
          if (sockets) {
            sockets.forEach((socket) => {
              socketSend(socket, { type: "end" });
            });

            sockets.forEach((socket) => socket.close());
            BufferSockets.delete(bufnr);
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
     * @param {{ send: (...args: string[]) => void }} rsp
     */
    async (method, args, resp) => {
      /** @type {import("./").RPCRequest} */
      const rpcFn = { method, args };
      const bufnr = args[0].toString();
      switch (rpcFn.method) {
        case "check_open": {
          const is_open = BufferSockets.get(bufnr)?.size > 0;
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
    let re = /^\/buffer\/[0-9]+/;
    if (req.url === "/" || !req.url || re.test(req.url)) req.url = "index.html";
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
    let bufnr;

    socket.on("message", async (raw) => {
      /** @type import("./").WsMessage */
      let data = JSON.parse(raw.toString());
      if (data.type === "start") {
        bufnr = data.message.bufnr;

        let buffer = await findBuffer(nvim, bufnr);

        if (!buffer) {
          socket.close();
          return;
        }

        let allSockets = BufferSockets.get(bufnr);

        if (!allSockets) {
          BufferSockets.set(bufnr, new Set([socket]));
        } else {
          BufferSockets.set(bufnr, allSockets.add(socket));
        }

        sendMjmlBuf(socket, buffer);
      }
    });

    socket.on("close", () => {
      let sockets = BufferSockets.get(bufnr);
      if (sockets) sockets.delete(socket);
    });
  });

  server.on("upgrade", (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, (socket) => {
      wsServer.emit("connection", socket, req);
    });
  });

  server.listen(PORT);
})();
