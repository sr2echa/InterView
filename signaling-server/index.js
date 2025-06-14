import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3001 });
// Map: code => { client: ws, viewer: ws }
const sessions = new Map();
// Track active codes for random code generation
const activeCodes = new Set();

// Generate a random 6-digit code that isn't in use
function generateUniqueCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (activeCodes.has(code));
  activeCodes.add(code);
  return code;
}

wss.on("connection", (ws) => {
  console.log("🔌 New WebSocket connection established");
  let clientCode = null;

  // Add ping/pong for connection health monitoring
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (data) => {
    try {
      const { type, code, payload, role } = JSON.parse(data);

      if (type === "getCode") {
        const newCode = generateUniqueCode();
        ws.send(JSON.stringify({ type: "code", payload: newCode }));
        console.log(`🎲 Generated new code: ${newCode}`);
        return;
      }

      if (type === "register") {
        if (!sessions.has(code)) sessions.set(code, {});
        if (role === "client") {
          sessions.get(code).client = ws;
          ws.role = "client";
          ws.code = code;
          clientCode = code;
          console.log(`✅ Client registered with code: ${code}`);
        } else if (role === "viewer") {
          sessions.get(code).viewer = ws;
          ws.role = "viewer";
          ws.code = code;
          console.log(`✅ Viewer registered with code: ${code}`);

          // Immediately notify client that a viewer has connected
          const session = sessions.get(code);
          if (
            session &&
            session.client &&
            session.client.readyState === ws.OPEN
          ) {
            session.client.send(
              JSON.stringify({
                type: "viewerConnected",
                payload: { timestamp: Date.now() },
              })
            );
          }
        }
      } else if (type === "connect") {
        const session = sessions.get(code);
        if (
          session &&
          session.client &&
          session.client.readyState === ws.OPEN
        ) {
          session.client.send(
            JSON.stringify({ type: "connect", payload: null })
          );
          console.log(`🔁 Sent connect request to client for code: ${code}`);
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "No client registered for that code",
            })
          );
          console.warn(`⚠️ No client found for code: ${code}`);
        }
      } else if (type === "signal") {
        const session = sessions.get(code);
        // Route signal to the other peer
        if (
          ws.role === "client" &&
          session &&
          session.viewer &&
          session.viewer.readyState === ws.OPEN
        ) {
          session.viewer.send(JSON.stringify({ type: "signal", payload }));
          console.log(
            `📡 Relayed signal from client to viewer for code: ${code}`
          );
        } else if (
          ws.role === "viewer" &&
          session &&
          session.client &&
          session.client.readyState === ws.OPEN
        ) {
          session.client.send(JSON.stringify({ type: "signal", payload }));
          console.log(
            `📡 Relayed signal from viewer to client for code: ${code}`
          );
        } else {
          console.warn(
            `⚠️ Cannot signal, peer not found or closed for code: ${code}`
          );
        }
      } else if (type === "monitorInfo") {
        // Relay monitor info to viewers
        const session = sessions.get(code);
        if (
          ws.role === "client" &&
          session &&
          session.viewer &&
          session.viewer.readyState === ws.OPEN
        ) {
          session.viewer.send(JSON.stringify({ type: "monitorInfo", payload }));
          console.log(`ℹ️ Relayed monitor info to viewer for code: ${code}`);
        }
      }
    } catch (err) {
      console.error("❌ Invalid message received:", err);
    }
  });

  ws.on("close", () => {
    let codeToCheck = clientCode || ws.code;
    if (codeToCheck) {
      const session = sessions.get(codeToCheck);
      if (session) {
        if (ws.role === "client") {
          session.client = null;
          console.log(`❌ Client disconnected for code: ${codeToCheck}`);
          // Notify viewer that client disconnected
          if (session.viewer && session.viewer.readyState === WebSocket.OPEN) {
            session.viewer.send(
              JSON.stringify({ type: "clientDisconnected", payload: null })
            );
          }
        } else if (ws.role === "viewer") {
          session.viewer = null;
          console.log(`❌ Viewer disconnected for code: ${codeToCheck}`);
          // Notify client that viewer disconnected
          if (session.client && session.client.readyState === WebSocket.OPEN) {
            session.client.send(
              JSON.stringify({ type: "viewerDisconnected", payload: null })
            );
          }
        }

        // Clean up session if both are gone
        if (!session.client && !session.viewer) {
          sessions.delete(codeToCheck);
          activeCodes.delete(codeToCheck);
          console.log(`🧹 Cleaned up session for code: ${codeToCheck}`);
        }
      }
    }
  });
});

// Ping all clients every 30 seconds to check connection
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log("💔 Terminating inactive connection");
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});

console.log("🚀 Signaling server running at ws://localhost:3001");
