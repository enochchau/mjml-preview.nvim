import { WsMessage } from "../server/index";

const WS_URL = "ws://localhost:55476/ws";

const root = document.getElementById("root");
const errorEl = document.getElementById("error");
if (
  root &&
  root instanceof HTMLIFrameElement &&
  errorEl &&
  errorEl instanceof HTMLDivElement
) {
  const ws = new WebSocket(WS_URL);
  ws.onclose = () => {
    window.close();
  };
  ws.onmessage = (ev) => {
    const { type, message } = JSON.parse(ev.data) as WsMessage;
    switch (type) {
      case "html":
        root.srcdoc = message;
        break;
      case "error":
        errorEl.innerHTML = message.map((m) => `<p>${m}</p>`).join("");
        break;
    }
  };
}
