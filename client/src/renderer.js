// Global variables for WebRTC and WebSocket connections
let ws;
let peer;
let currentCode;
let reconnectInterval;
let allDisplays = [];
let allScreens = [];
let activeStreams = [];
let isConnected = false;

// UI elements
const statusIndicator = document.getElementById("status-indicator");
const connectionStatusText = document.getElementById("connection-status-text");
const logElm = document.getElementById("status-log");
const codeInput = document.getElementById("code-input");
const randomCodeBtn = document.getElementById("random-code-btn");
const connectBtn = document.getElementById("connect-btn");
const monitorCountElm = document.getElementById("monitor-count");
const externalMonitorCountElm = document.getElementById(
  "external-monitor-count"
);
const monitorsListElm = document.getElementById("monitors-list");

// Logging function that updates the status log UI
function logStatus(msg) {
  if (logElm) {
    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const logEntry = document.createElement("div");
    logEntry.innerHTML = `<span style="color:#888">[${timestamp}]</span> ${msg}`;
    logElm.appendChild(logEntry);
    logElm.scrollTop = logElm.scrollHeight;
  }
  console.log(msg);
}

// Set connection status in the UI
function updateConnectionStatus(connected, viewerCount = 0) {
  isConnected = connected;
  statusIndicator.className = `status-indicator ${
    connected ? "connected" : "disconnected"
  }`;

  if (connected) {
    connectionStatusText.textContent = `Connected${
      viewerCount ? ` (${viewerCount} viewer${viewerCount > 1 ? "s" : ""})` : ""
    }`;
    connectBtn.textContent = "Disconnect";
  } else {
    connectionStatusText.textContent = "Disconnected";
    connectBtn.textContent = "Connect";
  }
}

// Get all monitors and display their info
async function updateMonitorInfo() {
  try {
    allDisplays = await window.electronAPI.getDisplays();
    allScreens = await window.electronAPI.getScreens();

    const totalMonitors = allDisplays.length;
    const externalMonitors = allDisplays.filter((d) => !d.internal).length;

    // Update monitor count display
    monitorCountElm.textContent = `Total Monitors: ${totalMonitors}`;
    externalMonitorCountElm.textContent = `External Monitors: ${externalMonitors}`;

    // Clear and rebuild monitors list
    monitorsListElm.innerHTML = "";

    for (const [idx, screen] of allScreens.entries()) {
      const matchingDisplay = allDisplays.find((d) => {
        // Try to match display with screen based on bounds
        const screenName = screen.name || "";
        return screenName.includes(`${d.bounds.width}x${d.bounds.height}`);
      });

      const isInternal = matchingDisplay ? matchingDisplay.internal : false;
      const resolution = matchingDisplay
        ? `${matchingDisplay.bounds.width}x${matchingDisplay.bounds.height}`
        : "Unknown";
      const scale = matchingDisplay ? `${matchingDisplay.scaleFactor}x` : "";

      const monitorItem = document.createElement("div");
      monitorItem.className = "monitor-item";
      monitorItem.innerHTML = `
        <div class="monitor-info">
          <span>Monitor ${idx + 1} (${
        isInternal ? "Internal" : "External"
      })</span>
          <span>${resolution} ${scale}</span>
        </div>
        <video id="preview-${
          screen.id
        }" class="preview-video" autoplay muted playsinline></video>
      `;

      monitorsListElm.appendChild(monitorItem);
    }

    // Send monitor info to the server if connected
    if (ws && ws.readyState === WebSocket.OPEN && currentCode) {
      ws.send(
        JSON.stringify({
          type: "monitorInfo",
          code: currentCode,
          payload: {
            totalMonitors,
            externalMonitors,
            displays: allDisplays.map((d) => ({
              id: d.id,
              internal: d.internal,
              bounds: d.bounds,
              scaleFactor: d.scaleFactor,
            })),
          },
        })
      );
    }

    return { screens: allScreens, displays: allDisplays };
  } catch (err) {
    logStatus(`❌ Error getting display info: ${err.message}`);
    return { screens: [], displays: [] };
  }
}

// Generate a random code
async function generateRandomCode() {
  try {
    const code = await window.electronAPI.generateCode();
    codeInput.value = code;
    logStatus(`🎲 Generated random code: ${code}`);
    return code;
  } catch (err) {
    logStatus(`❌ Failed to generate code: ${err.message}`);
    return null;
  }
}

// Main function to start the connection
async function startConnection() {
  // Don't allow new connections if we're already connected
  if (ws && ws.readyState === WebSocket.OPEN) {
    logStatus("Already connected!");
    return;
  }

  const code = codeInput.value.trim();
  if (code.length !== 6) {
    logStatus("❌ Please enter a 6-digit code");
    return;
  }

  currentCode = code;

  // Update display info before connecting
  const { screens, displays } = await updateMonitorInfo();
  if (screens.length === 0) {
    logStatus("❌ No screens detected");
    return;
  }

  logStatus(
    `🖥️ Detected ${screens.length} screen(s): ${screens
      .map((s, i) => `Monitor ${i + 1}`)
      .join(", ")}`
  );

  // Clear existing streams
  activeStreams = [];

  try {
    // Capture streams for all screens
    for (const [idx, screen] of screens.entries()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: screen.id,
              minWidth: 1280,
              maxWidth: 1920,
              minHeight: 720,
              maxHeight: 1080,
            },
          },
        });

        activeStreams.push({ id: screen.id, index: idx, stream });

        // Show preview
        const videoEl = document.getElementById(`preview-${screen.id}`);
        if (videoEl) videoEl.srcObject = stream;

        logStatus(`✅ Captured screen ${idx + 1}`);
      } catch (err) {
        logStatus(`⚠️ Failed to capture screen ${idx + 1}: ${err.message}`);
      }
    }

    if (activeStreams.length === 0) {
      logStatus("❌ Failed to capture any screens");
      return;
    }

    // Connect to signaling server
    ws = new WebSocket("ws://localhost:3001");

    ws.onopen = () => {
      logStatus("🔌 Connected to signaling server");

      // Register with server
      ws.send(
        JSON.stringify({
          type: "register",
          code: currentCode,
          role: "client",
        })
      );

      // Update UI
      updateConnectionStatus(true);

      // Send monitor info
      ws.send(
        JSON.stringify({
          type: "monitorInfo",
          code: currentCode,
          payload: {
            totalMonitors: displays.length,
            externalMonitors: displays.filter((d) => !d.internal).length,
            displays: displays.map((d) => ({
              id: d.id,
              internal: d.internal,
              bounds: d.bounds,
              scaleFactor: d.scaleFactor,
            })),
          },
        })
      );
    };

    // Create WebRTC peer connection with STUN servers
    peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
      iceCandidatePoolSize: 10,
    });

    // Add all tracks from all streams
    for (const { stream, index } of activeStreams) {
      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
        logStatus(`🎥 Added ${track.kind} track from monitor ${index + 1}`);
      });
    }

    // WebRTC connection state handlers
    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;
      logStatus(`🔄 ICE connection state: ${state}`);

      if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed"
      ) {
        logStatus("⚠️ WebRTC connection issue detected");
      }
    };

    peer.onconnectionstatechange = () => {
      logStatus(`📊 Connection state: ${peer.connectionState}`);
    };

    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "signal",
            code: currentCode,
            payload: event.candidate,
          })
        );
      }
    };

    // Message handler for signaling server
    ws.onmessage = async (msg) => {
      try {
        const { type, payload } = JSON.parse(msg.data);

        if (type === "connect") {
          logStatus("🔗 Viewer connected, creating offer...");

          try {
            const offer = await peer.createOffer({
              offerToReceiveAudio: false,
              offerToReceiveVideo: false,
            });

            await peer.setLocalDescription(offer);

            ws.send(
              JSON.stringify({
                type: "signal",
                code: currentCode,
                payload: peer.localDescription,
              })
            );

            logStatus("📤 Sent offer to viewer");
          } catch (err) {
            logStatus(`❌ Error creating offer: ${err.message}`);
          }
        } else if (type === "signal") {
          try {
            if (payload.type === "answer") {
              await peer.setRemoteDescription(
                new RTCSessionDescription(payload)
              );
              logStatus("✅ Received and set remote answer");
            } else if (payload.candidate) {
              if (peer.remoteDescription) {
                await peer.addIceCandidate(new RTCIceCandidate(payload));
              }
            }
          } catch (err) {
            logStatus(`❌ Error handling signal: ${err.message}`);
          }
        } else if (type === "viewerConnected") {
          logStatus("🔗 Viewer connected to the session");
          updateConnectionStatus(true, 1);
        } else if (type === "viewerDisconnected") {
          logStatus("👋 Viewer disconnected from the session");
          updateConnectionStatus(true, 0);
        } else if (type === "error") {
          logStatus(`⚠️ Error: ${payload.message || "Unknown error"}`);
        }
      } catch (err) {
        logStatus(`❌ Error parsing message: ${err.message}`);
      }
    };

    // Handle WebSocket errors and closure
    ws.onerror = (error) => {
      logStatus(`⚠️ WebSocket error`);
      updateConnectionStatus(false);
    };

    ws.onclose = () => {
      logStatus("🔌 Disconnected from server");
      updateConnectionStatus(false);

      // Try to reconnect after a delay
      if (currentCode) {
        logStatus("🔄 Will attempt to reconnect in 5 seconds...");
        clearInterval(reconnectInterval);
        reconnectInterval = setTimeout(() => {
          logStatus("🔄 Attempting to reconnect...");
          startConnection();
        }, 5000);
      }
    };
  } catch (err) {
    logStatus(`❌ Error: ${err.message}`);
    updateConnectionStatus(false);
  }
}

// Disconnect function
function disconnect() {
  // Close streams
  for (const { stream } of activeStreams) {
    stream.getTracks().forEach((track) => track.stop());
  }
  activeStreams = [];

  // Close WebRTC connection
  if (peer) {
    peer.close();
    peer = null;
  }

  // Close WebSocket connection
  if (ws) {
    ws.close();
    ws = null;
  }

  clearInterval(reconnectInterval);
  currentCode = null;
  updateConnectionStatus(false);
  logStatus("🔌 Disconnected");

  // Clear video previews
  const videos = document.querySelectorAll("video");
  videos.forEach((video) => {
    video.srcObject = null;
  });

  // Refresh monitor list
  updateMonitorInfo();
}

// Initialize the app
window.addEventListener("DOMContentLoaded", async () => {
  logStatus("🚀 InterView Monitor started");
  await updateMonitorInfo();

  // Set up event listeners
  randomCodeBtn.addEventListener("click", generateRandomCode);

  connectBtn.addEventListener("click", () => {
    if (isConnected) {
      disconnect();
    } else {
      startConnection();
    }
  });

  // Generate initial code
  generateRandomCode();

  // Refresh monitor info every 5 seconds while running
  setInterval(updateMonitorInfo, 5000);
});
