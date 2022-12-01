/**
 * Types for RPC notify
 */
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
 * Types for RPC request
 */
type RPCRequest = {
  method: "check_open";
  args: [string];
};

/**
 * Websocket message schema
 */
export type WsMessage =
  | {
      type: "data";
      message: {
        html?: string;
        errors: string[];
      }
    }
  | {
      type: "start";
      message: { bufnr: string };
    }
  | {
      type: "end";
    };
