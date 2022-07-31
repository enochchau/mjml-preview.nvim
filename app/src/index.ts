export {};

const WS_URL = "ws://localhost:55476/ws";

const root = document.getElementById("root");
if (root && root instanceof HTMLIFrameElement) {
  const ws = new WebSocket(WS_URL);
  ws.onclose = () => {
    window.close();
  };
  ws.onmessage = (ev) => {
    const { type, message } = JSON.parse(ev.data);
    if (type === "html") {
      root.srcdoc = message;
    }
  };
}
