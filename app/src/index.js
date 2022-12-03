const http = require("http");
const Mustache = require("mustache");
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
  let buffers = await nvim.buffers;
  return buffers.find((b) => b.id === id);
}

/**
 * @param {import("neovim").Buffer} buf - nvim buffer
 */
async function processBuf(buf) {
  const lines = await buf.lines;
  const mjml = lines.join("\n");
  try {
    const { html, errors } = mjml2html(mjml);
    return { html, errors: errors.map((e) => e.formattedMessage) };
  } catch (err) {
    return { errors: [err.message, mjml] };
  }
}

/**
 * @param {string[]} errors
 * @returns {string}
 */
function errorsToHtml(errors) {
  return errors.length > 0
    ? `<h3 style="color:indianred;">Error:</h3>` +
        errors.map((m) => `<p>${m}</p>`).join("")
    : "";
}

/**
 * Convert and send the buffer to the web socket client
 * @param {import("ws").WebSocket} socket - ws client socket
 * @param {import("neovim").Buffer} buf - nvim buffer
 */
async function sendMjmlBuf(socket, buf) {
  const { html, errors } = await processBuf(buf);
  socketSend(socket, {
    type: "data",
    message: { html, errors: errorsToHtml(errors) },
  });
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
  const server = http.createServer(async (req, res) => {
    /** @type {{html: string, errors: string} | undefined} */
    let values;

    if (typeof req.url === "string") {
      let re = /^\/buffer\/([0-9]+)/;
      // server side rendering
      if (typeof req.url === "string") {
        let match = req.url.match(re);
        if (match) {
          req.url = "index.html";
          let bufnr = match[1];
          let buffer = await findBuffer(nvim, bufnr);
          if (buffer) {
            let res = await processBuf(buffer);
            values = { html: res.html, errors: errorsToHtml(res.errors) };
          }
        }
      }
    }

    const r = path.join(__dirname, "public", req.url);
    try {
      let data = await fs.promises.readFile(r);
      if (values) {
        data = data.toString();
        data = Mustache.render(data, values);
      }
      res.writeHead(200);
      res.end(data);
    } catch (err) {
      res.writeHead(404);
      res.end(JSON.stringify(err));
    }
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
