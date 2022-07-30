import express from "express";
import mjml2html from "mjml";
import { WebSocketServer } from "ws";
import path from "path";
import open from "open";
import { attach, NeovimClient } from "neovim";

async function getCurrentBuffer(nvim: NeovimClient) {
  const buf = await nvim.buffer;
  const lines = await buf.lines;
  return lines.join("\n");
}

(async () => {
  const nvim = attach({ reader: process.stdin, writer: process.stdout });

  const app = express();
  const PORT = 5000;

  app.use("/", express.static(path.join(__dirname, "public")));

  const wss = new WebSocketServer({
    noServer: true,
    path: "/ws",
  });

  wss.on("connection", (socket) => {
    socket.on("message", async () => {
      const mjml = await getCurrentBuffer(nvim);
      const { html } = mjml2html(mjml);

      socket.send(
        JSON.stringify({
          type: "html",
          message: html,
        })
      );
    });
  });

  const server = app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    open(url);
  });

  server.on("upgrade", (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (socket) => {
      wss.emit("connection", socket, req);
    });
  });
})();
