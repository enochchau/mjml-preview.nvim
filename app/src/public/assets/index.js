const WS_URL = "ws://localhost:55476/ws";
const RECONNECT_DELAY = 1000;

/** @type HTMLIFrameElement */
const root = document.getElementById("root");
/** @type HTMLDivElement */
const errorEl = document.getElementById("error");

wsConnect();

/**
 * Connect to the websocket server
 */
function wsConnect() {
  const bufnr = getBufnr();
  const socket = new WebSocket(WS_URL);

  /**
   * send a message on the websocket
   * @param {import('../../index').WsMessage} msg - json message to send
   */
  const send = (msg) => socket.send(JSON.stringify(msg));

  socket.onopen = () => {
    // send the bufnr on open
    send({ type: "start", message: { bufnr } });
  };

  socket.onclose = () => {
    setTimeout(() => {
      console.log("Attempting to reconnect...");
      wsConnect();
    }, RECONNECT_DELAY);
  };

  socket.onmessage = (ev) => {
    /** @type {import("../../index").WsMessage} */
    const data = JSON.parse(ev.data);
    const { message, type } = data;
    switch (type) {
      case "html":
        root.srcdoc = message;
        break;
      case "error":
        errorEl.innerHTML = message.map((m) => `<p>${m}</p>`).join("");
        break;
      case "end":
        window.close();
        break;
    }
  };
}

/**
 * Get the bufnr from the location pathname
 * @returns {string} bufnr
 */
function getBufnr() {
  let [_, subpath, bufnr] = window.location.pathname.split("/");
  if (subpath === "buffer" && bufnr) {
    return bufnr;
  }

  throw new Error("Invalid path");
}
