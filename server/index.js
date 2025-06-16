import { WebSocketServer, WebSocket } from "ws";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Configuration constants
const CONFIG = {
  MAX_BUFFER: 1024 * 1024 * 10, // 10MB buffer
  PROCESS_TIMEOUT: 10000, // 10 seconds timeout
  DETECTION_INTERVAL: 30000, // 30 seconds between scans
};

// Enhanced Windows process detection
async function getWindowsProcessList() {
  const commands = [
    {
      cmd: 'powershell -NonInteractive -NoProfile -Command "Get-Process | Select-Object Name"',
      parse: (output) =>
        output
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
    },
    {
      cmd: "wmic process get caption",
      parse: (output) =>
        output
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && line !== "Caption"),
    },
    {
      cmd: "tasklist /FO TABLE /NH",
      parse: (output) =>
        output
          .split("\n")
          .map((line) => line.split(/\s+/)[0])
          .filter(Boolean),
    },
  ];

  for (const { cmd, parse } of commands) {
    try {
      const { stdout } = await execAsync(cmd, {
        maxBuffer: CONFIG.MAX_BUFFER,
        timeout: CONFIG.PROCESS_TIMEOUT,
        windowsHide: true,
      });

      if (!stdout) continue;

      const processes = parse(stdout);
      if (processes.length > 0) {
        return processes.map((p) => p.toLowerCase());
      }
    } catch (error) {
      console.error(`Command failed: ${cmd}`);
      continue;
    }
  }

  // If all commands fail, use a basic fallback
  try {
    const { stdout } = await execAsync("tasklist", {
      maxBuffer: CONFIG.MAX_BUFFER,
      timeout: CONFIG.PROCESS_TIMEOUT,
      windowsHide: true,
    });
    console.log("Fallback tasklist:", stdout);
    return stdout
      .split("\n")
      .map((line) => line.split(/\s+/)[0])
      .filter(Boolean)
      .map((p) => p.toLowerCase());
  } catch (error) {
    throw new Error("All process detection methods failed");
  }
}

// --- SIMPLE CLIENT-VIEWER SESSION MODEL ---

const wss = new WebSocketServer({ port: process.env.PORT || 3004 });
// Map: code => { client: ws, viewer: ws, info: {} }
const sessions = new Map();
const activeCodes = new Set();
const pendingCodes = new Map(); // code => { createdAt, viewerWs }
// Connection tracking for debugging
const connections = new Map(); // id => { ws, connected: timestamp }

// Generate a random 6-digit code that isn't in use
function generateUniqueCode() {
  let code;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    attempts++;

    if (attempts >= maxAttempts) {
      console.log(
        "Warning: Many code generation attempts. Active codes count:",
        activeCodes.size
      );
      code = Math.floor(200000 + Math.random() * 700000).toString();
      break;
    }
  } while (activeCodes.has(code));

  activeCodes.add(code);
  return code;
}

// Cleanup pending codes that are older than 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of pendingCodes.entries()) {
    if (now - data.createdAt > 30 * 60 * 1000) {
      console.log(`🧹 Removing expired pending code: ${code}`);
      pendingCodes.delete(code);
    }
  }
}, 60000); // Check every minute

let nextConnectionId = 1;

wss.on("connection", (ws) => {
  console.log("🔌 New WebSocket connection established");
  ws.id = `conn-${nextConnectionId++}`;
  ws.sessionCode = null;

  // Track connection for debugging
  connections.set(ws.id, {
    ws,
    connected: Date.now(),
  });

  // Handle connection close
  ws.on("close", (code, reason) => {
    console.log(
      `🔌 WebSocket closed: ${ws.id}, Code: ${code}, Reason: ${
        reason || "None provided"
      }`
    );
    connections.delete(ws.id);

    // Clean up session if this connection was part of one
    const sessionCode = ws.sessionCode;
    if (sessionCode && sessions.has(sessionCode)) {
      const session = sessions.get(sessionCode);

      if (ws.role === "client" && session.client === ws) {
        session.client = null;
        console.log(`🔌 Client disconnected from session ${sessionCode}`);

        // Notify viewer if present
        if (session.viewer && session.viewer.readyState === WebSocket.OPEN) {
          session.viewer.send(
            JSON.stringify({
              type: "clientDisconnected",
              payload: { timestamp: Date.now(), code: sessionCode },
            })
          );
        }
      } else if (ws.role === "viewer" && session.viewer === ws) {
        session.viewer = null;
        console.log(`🔌 Viewer disconnected from session ${sessionCode}`);

        // Notify client if present
        if (session.client && session.client.readyState === WebSocket.OPEN) {
          session.client.send(
            JSON.stringify({
              type: "viewerDisconnected",
              payload: { timestamp: Date.now(), code: sessionCode },
            })
          );
        }
      }

      // Clean up session if both client and viewer are gone
      if (!session.client && !session.viewer) {
        sessions.delete(sessionCode);
        activeCodes.delete(sessionCode);
        console.log(`🧹 Cleaned up empty session ${sessionCode}`);
      }
    }
  });
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);
      console.log("Received message:", message.type, "from", ws.id);
      const { type, code, payload, role } = message;

      // Web viewer requesting a new code
      if (type === "requestCode") {
        const newCode = generateUniqueCode();
        pendingCodes.set(newCode, {
          createdAt: Date.now(),
          viewerWs: ws,
        });
        ws.sessionCode = newCode;
        ws.role = "viewer";
        ws.send(
          JSON.stringify({
            type: "codeAssigned",
            payload: { code: newCode },
          })
        );
        console.log(`🎲 Generated new code for viewer: ${newCode}`);
        return;
      } // Client registering with a code
      if (type === "register" && role === "client") {
        console.log(`🔍 Client attempting to register with code: ${code}`);

        // Check if this is a code that a viewer is waiting for
        if (pendingCodes.has(code)) {
          const pendingData = pendingCodes.get(code);
          const viewerWs = pendingData.viewerWs;

          console.log(`✅ Found pending code ${code} with waiting viewer`); // Create a new session for this code
          sessions.set(code, {
            client: ws,
            viewer: viewerWs,
            info: {
              createdAt: Date.now(),
              monitorInfo: null,
              clientInfo: payload?.clientInfo || {},
            },
          });

          pendingCodes.delete(code);
          activeCodes.add(code);
          ws.role = "client";
          ws.sessionCode = code;
          viewerWs.role = "viewer";
          viewerWs.sessionCode = code;

          console.log(`✅ Client registered with code: ${code}`);

          // Send immediate confirmation to client first
          ws.send(
            JSON.stringify({
              type: "sessionEstablished",
              payload: { timestamp: Date.now() },
            })
          );

          console.log(
            `📤 Session establishment sent to client for code: ${code}`
          );

          // Notify the viewer that a client has connected with a delay to ensure stability
          setTimeout(() => {
            if (viewerWs && viewerWs.readyState === WebSocket.OPEN) {
              console.log(
                `🔔 Notifying viewer that client connected for code: ${code}`
              );
              viewerWs.send(
                JSON.stringify({
                  type: "clientConnected",
                  payload: {
                    timestamp: Date.now(),
                    code,
                    clientInfo: payload?.clientInfo || {},
                  },
                })
              );
            }

            // Then tell the client to start WebRTC with more delay for stability
            setTimeout(() => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                console.log(
                  `🔄 Sending connect signal to client for code: ${code}`
                );
                ws.send(
                  JSON.stringify({
                    type: "connect",
                    payload: {
                      timestamp: Date.now(),
                      message: "Start WebRTC connection",
                    },
                  })
                );
              }
            }, 1000); // Wait 1 second before telling client to start WebRTC
          }, 1500); // Wait 1.5 seconds before notifying viewer        } else if (activeCodes.has(code) && sessions.has(code)) {
          // This is a valid code and session already exists
          const session = sessions.get(code);

          // Check if client is reconnecting
          if (!session.client || session.client.readyState !== WebSocket.OPEN) {
            // Update the client connection
            session.client = ws;
            ws.role = "client";
            ws.sessionCode = code;

            console.log(`✅ Client reconnected with code: ${code}`);
            ws.send(
              JSON.stringify({
                type: "sessionEstablished",
                payload: { timestamp: Date.now(), reconnect: true },
              })
            );

            // Notify reconnection
            if (
              session.viewer &&
              session.viewer.readyState === WebSocket.OPEN
            ) {
              session.viewer.send(
                JSON.stringify({
                  type: "clientReconnected",
                  payload: { timestamp: Date.now() },
                })
              );
            }

            // Tell client to start WebRTC after a brief delay
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: "connect",
                    payload: {
                      message: "Restart WebRTC connection",
                      timestamp: Date.now(),
                    },
                  })
                );
              }
            }, 1000);
          } else if (session.client === ws) {
            // Same client reconnecting - just acknowledge
            console.log(`✅ Client session refreshed for code: ${code}`);
            ws.send(
              JSON.stringify({
                type: "sessionEstablished",
                payload: { timestamp: Date.now(), refresh: true },
              })
            );
          } else {
            // Different client trying to use same code - reject
            ws.send(
              JSON.stringify({
                type: "error",
                payload: {
                  message: "Session already has an active client",
                },
              })
            );
            setTimeout(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.close(1000, "Session already in use");
              }
            }, 500);
          }
        } else {
          // Invalid code
          ws.send(
            JSON.stringify({
              type: "error",
              payload: {
                message: "Invalid code or no viewer waiting for this code",
              },
            })
          );
          // immediate disconnect if error
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.close(1000, "Invalid code");
            }
          }, 500);
        }
      }

      // Viewer registering with a code
      else if (type === "register" && role === "viewer") {
        if (!pendingCodes.has(code) && !sessions.has(code)) {
          pendingCodes.set(code, {
            createdAt: Date.now(),
            viewerWs: ws,
          });
          ws.sessionCode = code;
          ws.role = "viewer";
        } else if (sessions.has(code)) {
          // Only allow one viewer per session
          const session = sessions.get(code);
          if (session.viewer && session.viewer !== ws) {
            // Reject additional viewers
            ws.send(
              JSON.stringify({
                type: "error",
                payload: { message: "Session already has a viewer connected" },
              })
            );
            return;
          }
          session.viewer = ws;
          ws.sessionCode = code;
          ws.role = "viewer";
          // Send current monitor info if available
          if (session.info && session.info.monitorInfo) {
            ws.send(
              JSON.stringify({
                type: "monitorInfo",
                payload: session.info.monitorInfo,
              })
            );
          }
          // Notify client if connected
          if (session.client && session.client.readyState === WebSocket.OPEN) {
            console.log(
              `🔔 Notifying client that viewer connected for code: ${code}`
            );
            session.client.send(
              JSON.stringify({
                type: "viewerConnected",
                payload: { timestamp: Date.now() },
              })
            );
          }
        } else if (pendingCodes.has(code)) {
          const pendingData = pendingCodes.get(code);
          pendingData.viewerWs = ws;
          ws.sessionCode = code;
          ws.role = "viewer";
        }
      } // Handle WebRTC signaling
      else if (type === "signal") {
        const session = code && sessions.get(code);
        console.log(
          `📡 Received signal message from ${ws.role} for code: ${code}`
        );

        if (
          ws.role === "client" &&
          session &&
          session.viewer &&
          session.viewer.readyState === WebSocket.OPEN
        ) {
          console.log("Forwarding signal from client to viewer");
          // Add debug info about the type of signal
          const signalType =
            payload && payload.type
              ? payload.type
              : payload && payload.candidate
              ? "ICE candidate"
              : "Unknown";
          console.log(`Signal type being forwarded: ${signalType}`);

          // Add a small delay to prevent signal races
          setTimeout(() => {
            if (session.viewer.readyState === WebSocket.OPEN) {
              session.viewer.send(
                JSON.stringify({
                  type: "signal",
                  payload,
                  timestamp: Date.now(),
                })
              );
            }
          }, 50);
        } else if (
          ws.role === "viewer" &&
          session &&
          session.client &&
          session.client.readyState === WebSocket.OPEN
        ) {
          console.log("Forwarding signal from viewer to client");
          // Add debug info about the type of signal
          const signalType =
            payload && payload.type
              ? payload.type
              : payload && payload.candidate
              ? "ICE candidate"
              : "Unknown";
          console.log(`Signal type being forwarded: ${signalType}`);

          // prevent signal races
          setTimeout(() => {
            if (session.client.readyState === WebSocket.OPEN) {
              session.client.send(
                JSON.stringify({
                  type: "signal",
                  payload,
                  timestamp: Date.now(),
                })
              );
            }
          }, 50);
        } else {
          console.log(
            `⚠️ Cannot relay signal: session state issue for ${code}`
          );
          console.log(
            `Role: ${
              ws.role
            }, Session exists: ${!!session}, Client connected: ${
              session && !!session.client
            }, Viewer connected: ${session && !!session.viewer}`
          );
        }
      }

      // connect
      else if (type === "connect") {
        const session = code && sessions.get(code);

        if (ws.role === "viewer" && session && session.client) {
          console.log(
            `🔄 Forwarding connect request to client for code: ${code}`
          );
          if (session.client.readyState === WebSocket.OPEN) {
            session.client.send(
              JSON.stringify({ type: "connect", payload: null })
            );
          } else {
            console.log(`⚠️ Client for code ${code} not connected or ready`);
          }
        }
      }

      // Handle display configuration changes
      else if (type === "displayConfigChanged") {
        const session = code && sessions.get(code);

        if (
          ws.role === "client" &&
          session &&
          session.viewer &&
          session.viewer.readyState === WebSocket.OPEN
        ) {
          session.viewer.send(
            JSON.stringify({ type: "displayConfigChanged", payload })
          );
        }
      }

      // Handle monitor info updates
      else if (type === "monitorInfo") {
        const session = code && sessions.get(code);

        if (ws.role === "client" && session) {
          console.log(`📊 Received monitor info from client for code: ${code}`);
          session.info.monitorInfo = payload;
          if (session.viewer && session.viewer.readyState === WebSocket.OPEN) {
            session.viewer.send(
              JSON.stringify({ type: "monitorInfo", payload })
            );
          }
        }
      }

      // Handle process info updates
      else if (type === "processInfo") {
        const session = code && sessions.get(code);

        if (ws.role === "client" && session) {
          session.info.processInfo = payload;
          if (session.viewer && session.viewer.readyState === WebSocket.OPEN) {
            session.viewer.send(
              JSON.stringify({ type: "processInfo", payload })
            );
          }
        }
      } // Handle administrative commands from viewer to client
      else if (type === "adminCommand" && ws.role === "viewer") {
        const session = code && sessions.get(code);
        console.log(
          `Received admin command: ${payload?.command} for code: ${code}`
        );

        if (payload?.command === "disconnect") {
          if (
            session &&
            session.client &&
            session.client.readyState === WebSocket.OPEN
          ) {
            console.log(
              `🔌 Sending disconnect command to client for code: ${code}`
            );
            session.client.send(
              JSON.stringify({
                type: "adminCommand",
                payload,
              })
            );
          }

          // Notify the viewer that the disconnect request was processed
          ws.send(
            JSON.stringify({
              type: "adminCommandResponse",
              payload: {
                command: "disconnect",
                success: true,
                message: "Disconnect request sent to client",
              },
            })
          );
        } else if (
          session &&
          session.client &&
          session.client.readyState === WebSocket.OPEN
        ) {
          // For other commands, just forward them to the client
          session.client.send(
            JSON.stringify({
              type: "adminCommand",
              payload,
            })
          );
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              payload: {
                message: "Client not connected",
              },
            })
          );
        }
      }
    } catch (err) {
      console.error(
        "❌ Invalid message received from",
        ws.id,
        ":",
        err.message
      );
      console.error("Raw data:", data.toString());
      // Send error response to client
      try {
        ws.send(
          JSON.stringify({
            type: "error",
            payload: { message: "Invalid message format" },
          })
        );
      } catch (sendErr) {
        console.error("Failed to send error response:", sendErr.message);
      }
    }
  });

  ws.on("close", () => {
    const code = ws.sessionCode;
    if (code) {
      // Check if this was a pending code that never got claimed
      if (pendingCodes.has(code) && pendingCodes.get(code).viewerWs === ws) {
        pendingCodes.delete(code);
      }

      // Check if this was part of an active session
      const session = sessions.get(code);
      if (session) {
        if (ws.role === "client" && session.client === ws) {
          session.client = null;
          // Notify viewer that client disconnected
          if (session.viewer && session.viewer.readyState === WebSocket.OPEN) {
            session.viewer.send(
              JSON.stringify({
                type: "clientDisconnected",
                payload: {
                  timestamp: Date.now(),
                },
              })
            );
          }
        } else if (ws.role === "viewer" && session.viewer === ws) {
          session.viewer = null;
        }

        // Clean up session if client is gone and no viewer remains
        if (!session.client && !session.viewer) {
          sessions.delete(code);
          activeCodes.delete(code);
        }
      }
    }
  });
});

wss.on("close", () => {
  console.log("🔌 WebSocket server closing");
});

console.log(
  `🚀 Signaling server running at ws://localhost:${process.env.PORT}`
);
