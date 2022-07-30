import express from "express";
import mjml2html from "mjml";
import { WebSocketServer } from "ws";
import path from "path";
import open from "open";
import { attach, Buffer } from "neovim";

async function buf2Html(buf: Buffer) {
  const lines = await buf.lines;
  const mjml = lines.join("\n");
  const { html } = mjml2html(mjml);
  return html;
}

(async () => {
  const nvim = attach({ reader: process.stdin, writer: process.stdout });
  const buf = await nvim.buffer;

  const app = express();
  const PORT = 5000;

  app.use("/", express.static(path.join(__dirname, "public")));

  const wss = new WebSocketServer({
    noServer: true,
    path: "/ws",
  });

  wss.on("connection", (socket) => {
    const sendBuffer = async () => {
      const message = await buf2Html(buf);
      socket.send(
        JSON.stringify({
          type: "html",
          message,
        })
      );
    };

    setInterval(() => {
      sendBuffer();
    }, 1000);
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
