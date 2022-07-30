import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import open from "open";
import { attach } from "neovim";

(async () => {
  const nvim = attach({ reader: process.stdin, writer: process.stdout });

  nvim.command("vsp");

  const app = express();
  const PORT = 5000;

  app.use("/", express.static(path.join(__dirname, "public")));

  const wss = new WebSocketServer({
    noServer: true,
    path: "/ws",
  });

  wss.on("connection", (socket) => {
    let i = 0;
    socket.on("message", (message) => {
      i++;
      socket.send(
        JSON.stringify({
          type: "html",
          message: `<h1>${i}</h1>`,
        })
      );
      socket.send(
        JSON.stringify({
          type: "log",
          message,
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
