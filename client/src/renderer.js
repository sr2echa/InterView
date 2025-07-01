// Global variables for WebRTC and WebSocket connections
let ws;
let peer;
let currentCode = "";
let reconnectInterval;
let allDisplays = [];
let allScreens = [];
let activeStreams = [];
let isConnected = false;
let isUpdatingStreams = false;
let lastLogMessage = "";
let connectionTimeoutId = null;

// Configuration object - will be initialized when DOM is ready
let appConfig = {
  isProduction: true,
  sessionCode: "",
  customWebSocketUrl: "",
  isDirectJoin: false, // Direct join mode enables automatic behaviors
};

// Debug logging utilities - only log when not in production
// Uses ASCII characters for better terminal compatibility
function debugLog(...args) {
  if (!appConfig.isProduction) {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
    console.log(`[${timestamp}] [RENDERER]`, ...args);
  }
}

function debugError(...args) {
  if (!appConfig.isProduction) {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
    console.error(`[${timestamp}] [RENDERER ERROR]`, ...args);
  }
}

function debugWarn(...args) {
  if (!appConfig.isProduction) {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
    console.warn(`[${timestamp}] [RENDERER WARNING]`, ...args);
  }
}

// WebSocket URL based on configuration
function getWebSocketURL() {
  // If custom WebSocket URL is provided, use it
  if (appConfig.customWebSocketUrl) {
    debugLog(`Using custom WebSocket URL: ${appConfig.customWebSocketUrl}`);
    return appConfig.customWebSocketUrl;
  }
  // Otherwise, use production/development defaults
  const url = appConfig.isProduction
    ? "ws://140.245.4.159:13004"
    : "ws://localhost:3004";
  debugLog(
    `Using ${
      appConfig.isProduction ? "production" : "development"
    } WebSocket URL: ${url}`
  );
  return url;
}

// UI elements - will be initialized when DOM is ready
let codeEntryContainer;
let dashboardContainer;
let codeInputs;
let submitBtn;
let disconnectBtn;
let statusDot;
let statusText;
let codeDisplay;
let logContainer;
let monitorList;

// Stat elements - will be initialized when DOM is ready
let totalDisplaysEl;
let activeDisplaysEl;
let internalDisplaysEl;
let externalDisplaysEl;
let activeStreamsEl;
// Variable for Total Displays is already defined above
let inactiveDisplaysEl;

// Title bar controls and logs panel
let minimizeBtn;
let maximizeBtn;
let closeBtn;
let toggleLogsBtn;
let closeLogsBtn;
let logsPanel;

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", initializeApp);

function initializeApp() {
  debugLog("Initializing app...");

  // Get configuration from global config object exposed by preload script
  if (window.config) {
    appConfig = window.config;
    debugLog("Configuration loaded:", appConfig);
  } else {
    debugWarn("No configuration found, using defaults");
  }

  // Initialize UI elements
  codeEntryContainer = document.getElementById("code-entry-container");
  dashboardContainer = document.getElementById("dashboard-container");
  codeInputs = document.querySelectorAll(".code-input");
  submitBtn = document.getElementById("submit-btn");
  disconnectBtn = document.getElementById("disconnect-btn");
  statusDot = document.getElementById("status-dot");
  statusText = document.getElementById("status-text");
  codeDisplay = document.getElementById("code-display");
  logContainer = document.getElementById("log-container");
  monitorList = document.getElementById("monitor-list");
  activeStreamsEl = document.getElementById("active-streams");

  // Set up window controls for custom title bar
  setupWindowControls();

  debugLog("UI elements found:", {
    codeEntryContainer: !!codeEntryContainer,
    dashboardContainer: !!dashboardContainer,
    codeInputs: codeInputs.length,
    submitBtn: !!submitBtn,
    disconnectBtn: !!disconnectBtn,
    statusDot: !!statusDot,
    statusText: !!statusText,
    codeDisplay: !!codeDisplay,
    logContainer: !!logContainer,
    monitorList: !!monitorList,
  });

  // Stat elements
  totalDisplaysEl = document.getElementById("total-displays");
  activeDisplaysEl = document.getElementById("active-displays");
  internalDisplaysEl = document.getElementById("internal-displays");
  externalDisplaysEl = document.getElementById("external-displays");
  activeStreamsEl = document.getElementById("active-streams");

  // New stat elements
  // totalDisplaysEl is set earlier  inactiveDisplaysEl = document.getElementById("inactive-displays");

  // Handle direct join mode
  if (appConfig.sessionCode && appConfig.sessionCode.length === 6) {
    debugLog("Direct join mode detected, skipping code entry screen");
    currentCode = appConfig.sessionCode;

    // Hide code entry and show dashboard immediately
    if (codeEntryContainer) {
      codeEntryContainer.style.display = "none";
      codeEntryContainer.classList.add("hidden");
    }

    if (dashboardContainer) {
      dashboardContainer.style.display = "flex";
      dashboardContainer.classList.add("visible");
    }

    // Auto-connect after setup
    setTimeout(() => {
      connectToSession();
    }, 1000);
  } else {
    // Normal mode - show code entry screen
    if (codeEntryContainer) {
      codeEntryContainer.style.display = "flex";
      codeEntryContainer.classList.remove("hidden");
      debugLog("Code entry container made visible");
    }

    // Ensure the dashboard is hidden initially
    if (dashboardContainer) {
      dashboardContainer.style.display = "none";
      dashboardContainer.classList.remove("visible");
      debugLog("Dashboard container hidden");
    }
  }

  setupCodeInputs();
  setupEventListeners();
  logStatus("Application initialized", "success");

  // Enhanced initialization with retry
  const initializeDisplays = async () => {
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        await updateDisplayInfo(true); // Force initial update with full detection

        // Verify we got some display data
        if (allDisplays && allDisplays.length > 0) {
          logStatus(
            `Display initialization successful: ${allDisplays.length} displays detected`,
            "success"
          );
          break;
        }

        attempts++;
        if (attempts < maxAttempts) {
          logStatus(
            `Display initialization attempt ${attempts} failed, retrying...`,
            "warning"
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        attempts++;
        logStatus(
          `Display initialization error (attempt ${attempts}): ${error.message}`,
          "error"
        );
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    if (attempts >= maxAttempts) {
      logStatus("Display initialization failed after all attempts", "error");
    }
  };

  // Start initialization
  initializeDisplays();
}

// Helper function to clear reconnect interval
function clearReconnectInterval() {
  if (reconnectInterval) {
    clearTimeout(reconnectInterval);
    reconnectInterval = null;
  }
}

// Setup code input functionality with paste support
function setupCodeInputs() {
  codeInputs.forEach((input, index) => {
    input.addEventListener("input", (e) => {
      let value = e.target.value.replace(/\D/g, "");
      if (value.length > 1) {
        // Paste event or fast typing
        const chars = value.split("");
        for (let i = 0; i < codeInputs.length; i++) {
          codeInputs[i].value = chars[i] || "";
          codeInputs[i].classList.toggle("filled", !!chars[i]);
        }
        if (chars.length === codeInputs.length) {
          codeInputs[codeInputs.length - 1].focus();
        } else {
          codeInputs[chars.length].focus();
        }
      } else {
        // Single char
        e.target.value = value;
        input.classList.toggle("filled", !!value);
        if (value && index < codeInputs.length - 1) {
          codeInputs[index + 1].focus();
        }
      }
      updateCodeInput();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace") {
        if (!input.value && index > 0) {
          codeInputs[index - 1].focus();
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        codeInputs[index - 1].focus();
      } else if (e.key === "ArrowRight" && index < codeInputs.length - 1) {
        codeInputs[index + 1].focus();
      } else if (e.key === "Enter" && isCodeComplete()) {
        connectToSession();
      }
    });

    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, codeInputs.length);
      for (let i = 0; i < codeInputs.length; i++) {
        codeInputs[i].value = pasted[i] || "";
        codeInputs[i].classList.toggle("filled", !!pasted[i]);
      }
      updateCodeInput();
      if (pasted.length === codeInputs.length) {
        submitBtn.focus();
      } else if (pasted.length > 0) {
        codeInputs[pasted.length].focus();
      }
    });
  });
}

function distributeCode(code) {
  codeInputs.forEach((input, index) => {
    input.value = code[index] || "";
    input.classList.toggle("filled", !!input.value);
  });
  updateCodeInput();

  if (code.length === 6) {
    submitBtn.focus();
  }
}

function updateCodeInput() {
  currentCode = Array.from(codeInputs)
    .map((input) => input.value)
    .join("");
  submitBtn.disabled = currentCode.length !== codeInputs.length;
}

function isCodeComplete() {
  return currentCode.length === 6;
}

// Setup event listeners
function setupEventListeners() {
  submitBtn.addEventListener("click", connectToSession);
  disconnectBtn.addEventListener("click", disconnectFromSession);

  // Handle display configuration changes
  if (window.electronAPI) {
    window.electronAPI.onDisplayConfigurationChanged?.((event, displayInfo) => {
      debugLog("Display configuration changed:", displayInfo);

      // If we received display info directly, update the UI right away
      if (displayInfo) {
        debugLog("Received fresh display info with change event:", displayInfo);
        updateDisplayInfoUI(displayInfo);
      }

      handleDisplayConfigurationChange(displayInfo);
    });
  }
}

async function connectToSession() {
  if (!isCodeComplete()) {
    logStatus("Please enter a complete 6-digit code", "error");
    return;
  }

  clearReconnectInterval();
  logStatus("Connecting to session...", "info");
  updateUI("connecting");

  try {
    ws = new WebSocket(getWebSocketURL());

    ws.onopen = async () => {
      logStatus("Connected to signaling server", "success");

      // Get display info to send with registration
      const displayInfo = await window.electronAPI.getDetailedDisplays();

      ws.send(
        JSON.stringify({
          type: "register",
          code: currentCode,
          role: "client",
          payload: {
            clientInfo: {
              timestamp: Date.now(),
              displayInfo: displayInfo,
              userAgent: navigator.userAgent,
              platform: navigator.platform,
            },
          },
        })
      );
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        await handleWebSocketMessage(message);
      } catch (error) {
        debugError("Error handling WebSocket message:", error);
        logStatus(`Message handling error: ${error.message}`, "error");
      }
    };

    ws.onerror = (error) => {
      debugError("WebSocket error:", error);
      logStatus("Connection error", "error");
      updateUI("disconnected");
    };

    ws.onclose = (event) => {
      debugLog("WebSocket closed:", event.code, event.reason);
      logStatus("Disconnected from server", "warning");
      updateUI("disconnected");

      // Auto-reconnect logic
      if (event.code !== 1000) {
        // Not a normal closure
        scheduleReconnect();
      }
    };
  } catch (error) {
    debugError("Connection error:", error);
    logStatus(`Connection failed: ${error.message}`, "error");
    updateUI("disconnected");
  }
}

async function handleWebSocketMessage(message) {
  const { type, payload } = message;

  switch (type) {
    case "registered":
    case "sessionEstablished":
      logStatus("Successfully registered with server", "success");
      isConnected = true;
      updateUI("connected");
      await initializeStreaming();
      // Update display info after connecting
      await updateDisplayInfo(true);
      // Send initial monitor info to server
      if (allDisplays && allDisplays.length > 0) {
        const displayInfo = await window.electronAPI.getDetailedDisplays();
        ws.send(
          JSON.stringify({
            type: "monitorInfo",
            code: currentCode,
            payload: displayInfo,
          })
        );
      }
      // Don't start screen capture yet - wait for viewer to connect
      break;

    case "connect":
      logStatus("Server requesting WebRTC setup", "info");
      if (!peer) {
        await initializeStreaming();
      }
      // Start screen capture when connect is requested
      await startScreenCapture();
      break;

    case "viewerConnected":
      logStatus("Viewer connected - starting screen share", "success");
      await startScreenCapture();
      break;

    case "signal":
      if (peer && payload) {
        await handleWebRTCSignal(payload);
      }
      break;

    case "adminCommand":
      await handleAdminCommand(payload);
      break;

    case "error":
      logStatus(`Server error: ${payload.message}`, "error");
      break;

    default:
      debugLog("Unknown message type:", type);
  }
}

// WebRTC
async function handleWebRTCSignal(signal) {
  try {
    if (signal.type === "answer") {
      // Viewer is responding to our offer
      await peer.setRemoteDescription(new RTCSessionDescription(signal));
      logStatus("WebRTC answer received from viewer", "success");
    } else if (signal.candidate) {
      // Handle ICE candidates from viewer
      await peer.addIceCandidate(new RTCIceCandidate(signal));
      logStatus("ICE candidate added", "info");
    } else if (signal.type === "offer") {
      // This shouldn't happen in our flow, but handle gracefully
      logStatus(
        "Unexpected offer received - client should send offers",
        "warning"
      );
      await peer.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      ws.send(
        JSON.stringify({
          type: "signal",
          code: currentCode,
          payload: answer,
        })
      );
    } else {
      debugLog("Unknown signal type:", signal.type);
    }
  } catch (error) {
    debugError("WebRTC signaling error:", error);
    logStatus(`WebRTC error: ${error.message}`, "error");
  }
}

// Handle admin commands
async function handleAdminCommand(payload) {
  const { command } = payload;

  switch (command) {
    case "forceRefreshStreams":
      logStatus("Refreshing streams per viewer request", "info");
      await refreshScreenCapture();
      break;

    case "disconnect":
      logStatus("Disconnected by viewer", "warning");
      disconnectFromSession();
      break;

    default:
      debugLog("Unknown admin command:", command);
  }
}

// Initialize WebRTC peer connection
async function initializeStreaming() {
  try {
    if (peer) {
      // Clean up existing peer connection
      peer.close();
    }

    peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
    });

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

    peer.onconnectionstatechange = () => {
      debugLog("Peer connection state:", peer.connectionState);
      logStatus(`WebRTC: ${peer.connectionState}`, "info");

      if (peer.connectionState === "connected") {
        logStatus("WebRTC connection established successfully", "success");
      } else if (peer.connectionState === "failed") {
        logStatus("WebRTC connection failed", "error");
      } else if (peer.connectionState === "disconnected") {
        logStatus("WebRTC connection disconnected", "warning");
      }
    };

    logStatus("WebRTC peer connection initialized", "success");
  } catch (error) {
    debugError("Error initializing WebRTC:", error);
    logStatus(`WebRTC initialization failed: ${error.message}`, "error");
  }
}

// Start screen capture and add to peer connection
async function startScreenCapture() {
  try {
    // Get all available screens and detailed display info to ensure we capture everything
    let sources = await window.electronAPI.getScreens();
    const displayInfo = await window.electronAPI.getDetailedDisplays();

    const expectedDisplayCount = displayInfo.total || 0;
    logStatus(
      `Found ${sources.length} screen sources (Expected: ${expectedDisplayCount})`,
      "info"
    );

    // If we found fewer sources than expected displays, retry once
    if (sources.length < expectedDisplayCount) {
      logStatus("Detected missing sources, retrying capture...", "warning");
      await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay
      sources = await window.electronAPI.getScreens();
      logStatus(`Re-scan found ${sources.length} screen sources`, "info");
    }

    // Make sure we have a clean state for the peer connection
    const currentSenders = peer.getSenders();
    if (currentSenders.length > 0) {
      logStatus(
        `Cleaning up ${currentSenders.length} existing tracks before capture`,
        "info"
      );
      currentSenders.forEach((sender) => {
        if (sender.track) {
          try {
            peer.removeTrack(sender);
          } catch (err) {
            debugWarn("Error removing track during cleanup:", err);
          }
        }
      });
    }

    // Clear existing streams
    activeStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          debugWarn("Error stopping track:", err);
        }
      });
    });

    activeStreams = [];

    // Track IDs we've seen to prevent duplicates
    const capturedScreenIds = new Set();

    // Capture each screen
    for (const source of sources) {
      try {
        // Skip if we've already captured this screen ID (prevents duplicates)
        if (capturedScreenIds.has(source.id)) {
          logStatus(`Skipping duplicate screen ID: ${source.id}`, "warning");
          continue;
        }

        capturedScreenIds.add(source.id);

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: source.id,
              minWidth: 1280,
              maxWidth: 1920,
              minHeight: 720,
              maxHeight: 1080,
            },
          },
        });

        // Add stream to peer connection
        stream.getTracks().forEach((track) => {
          // Add metadata to track for debugging and management
          track.screenId = source.id;
          track.screenName = source.name;

          try {
            peer.addTrack(track, stream);
            logStatus(`Added track for screen "${source.name}"`, "success");
          } catch (err) {
            debugError(`Error adding track for screen ${source.name}:`, err);
            track.stop(); // Clean up the track if we couldn't add it
          }
        });

        activeStreams.push(stream);
        logStatus(`Screen "${source.name}" capture started`, "success");
      } catch (error) {
        debugError(`Error capturing screen ${source.name}:`, error);
        logStatus(`Failed to capture screen: ${source.name}`, "error");
      }
    }

    // Send offer to viewer
    const offer = await peer.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
      voiceActivityDetection: false,
      iceRestart: true, // Force ICE restart to ensure a clean connection
    });

    await peer.setLocalDescription(offer);

    ws.send(
      JSON.stringify({
        type: "signal",
        code: currentCode,
        payload: offer,
      })
    );

    logStatus(
      `Screen sharing started (${activeStreams.length} screens)`,
      "success"
    );

    // Update UI counters
    const activeStreamsEl = document.getElementById("active-streams");
    if (activeStreamsEl) activeStreamsEl.textContent = activeStreams.length;

    await updateDisplayInfo();
  } catch (error) {
    debugError("Error starting screen capture:", error);
    logStatus(`Screen capture failed: ${error.message}`, "error");
  }
}

// Refresh screen capture
async function refreshScreenCapture() {
  if (peer && isConnected) {
    if (isUpdatingStreams) {
      logStatus("Stream refresh already in progress, please wait", "warning");
      return;
    }

    isUpdatingStreams = true;
    logStatus("Refreshing screen capture...", "info");

    try {
      // Notify the viewer that streams are about to be refreshed
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "displayConfigChanged",
            code: currentCode,
            payload: {
              isRefreshing: true,
              timestamp: Date.now(),
              refreshType: "auto",
            },
          })
        );
      }

      cleanupMediaResources();

      await new Promise((resolve) => setTimeout(resolve, 500));

      await startScreenCapture();

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "displayConfigChanged",
            code: currentCode,
            payload: {
              isRefreshing: false,
              timestamp: Date.now(),
              newStreamCount: activeStreams.length,
            },
          })
        );
      }

      logStatus(
        `Screen capture refreshed successfully (${activeStreams.length} streams)`,
        "success"
      );
    } catch (error) {
      debugError("Error refreshing screen capture:", error);
      logStatus(`Failed to refresh screen capture: ${error.message}`, "error");

      // Notify viewer of error
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "displayConfigChanged",
            code: currentCode,
            payload: {
              isRefreshing: false,
              error: error.message,
              timestamp: Date.now(),
            },
          })
        );
      }
    } finally {
      isUpdatingStreams = false;
    }
  } else {
    logStatus("Cannot refresh - not connected", "warning");
  }
}

// Disconnect from session
function disconnectFromSession() {
  clearReconnectInterval();
  cleanupMediaResources();
  isConnected = false;
  if (peer) {
    peer.close();
    peer = null;
  }
  if (ws) {
    ws.close(1000, "User disconnected");
    ws = null;
  }

  // Reset UI
  updateUI("disconnected");
  logStatus("Disconnected from session", "info");

  // Handle automatic close for direct join mode (automatically close when session disconnects)
  if (appConfig.isDirectJoin && window.notifySessionDisconnect) {
    window.notifySessionDisconnect();
  }
}

// Schedule reconnection
function scheduleReconnect() {
  if (reconnectInterval) return;

  logStatus("Attempting to reconnect in 5 seconds...", "warning");
  reconnectInterval = setTimeout(() => {
    reconnectInterval = null;
    if (currentCode) {
      connectToSession();
    }
  }, 5000);
}

// Update UI based on connection state
function updateUI(state) {
  debugLog(`Updating UI to state: ${state}`);

  switch (state) {
    case "connecting":
      statusDot.className = "status-dot connecting";
      statusText.textContent = "Connecting...";
      submitBtn.disabled = true;
      break;

    case "connected":
      debugLog("Switching to dashboard view");
      codeEntryContainer.classList.add("hidden");
      codeEntryContainer.style.display = "none";
      dashboardContainer.style.display = "flex";
      dashboardContainer.classList.add("visible");
      statusDot.className = "status-dot connected";
      statusText.textContent = "Connected";
      codeDisplay.textContent = currentCode;
      isConnected = true;
      // Update active streams counter
      const activeStreamsEl = document.getElementById("active-streams");
      if (activeStreamsEl) activeStreamsEl.textContent = activeStreams.length;
      debugLog("Dashboard should now be visible");
      break;

    case "disconnected":
      debugLog("Switching to code entry view");
      codeEntryContainer.style.display = "flex";
      codeEntryContainer.classList.remove("hidden");
      dashboardContainer.style.display = "none";
      dashboardContainer.classList.remove("visible");
      statusDot.className = "status-dot";
      statusText.textContent = "Disconnected";
      submitBtn.disabled = !isCodeComplete();
      isConnected = false;
      // Reset counters
      const activeStreamsElReset = document.getElementById("active-streams");
      if (activeStreamsElReset) activeStreamsElReset.textContent = "0";
      debugLog("Code entry should now be visible");
      break;
  }
}

// Update display information
async function updateDisplayInfo(forceUpdate = false) {
  try {
    const displays = await window.electronAPI.getDetailedDisplays();

    // Log detailed display info for debugging
    debugLog("Display Info:", JSON.stringify(displays, null, 2));

    // Update the UI with the fresh display information
    updateDisplayInfoUI(displays);

    // Send display info to viewer if connected
    if (ws && ws.readyState === WebSocket.OPEN && isConnected) {
      // Add any additional diagnostic information for the viewer
      const enhancedDisplayInfo = Object.assign({}, displays, {
        pnpInfo: {
          totalWithInactive: (displays.inactive || 0) + displays.total,
          lastUpdated: new Date().toISOString(),
        },
      });

      // Send updated display info to the viewer
      ws.send(
        JSON.stringify({
          type: "monitorInfo",
          code: currentCode,
          payload: enhancedDisplayInfo,
        })
      );

      // Also regularly send process information if connected
      try {
        const processInfo = {
          processes: await window.electronAPI.getProcesses(),
          timestamp: Date.now(),
        };

        ws.send(
          JSON.stringify({
            type: "processInfo",
            code: currentCode,
            payload: processInfo,
          })
        );
      } catch (error) {
        debugError("Error getting process info:", error);
      }
    }

    return displays;
  } catch (error) {
    debugError("Error updating display info:", error);
    logStatus(`Display update error: ${error.message}`, "error");
    return null;
  }
}

// Update only the UI with display information
function updateDisplayInfoUI(displays) {
  if (!displays) return;

  debugLog("Updating display info UI:", JSON.stringify(displays, null, 2));

  // Update stats
  if (totalDisplaysEl) {
    // Calculate total displays (detected + inactive)
    const totalDisplays = (displays.inactive || 0) + displays.total;
    totalDisplaysEl.textContent = totalDisplays;
    debugLog(
      `Updated Total Displays UI: ${totalDisplays} (${
        displays.total
      } active + ${displays.inactive || 0} inactive)`
    );
  }
  if (activeDisplaysEl) activeDisplaysEl.textContent = displays.active || 0;
  if (internalDisplaysEl)
    internalDisplaysEl.textContent = displays.internal || 0;
  if (externalDisplaysEl)
    externalDisplaysEl.textContent = displays.external || 0;
  if (inactiveDisplaysEl)
    inactiveDisplaysEl.textContent = displays.inactive || 0;

  // Update monitor list
  updateMonitorList(displays);

  // Store the display data for future use
  allDisplays = displays.displays || [];
}

// Update monitor list in UI
function updateMonitorList(displays) {
  if (!monitorList) return;

  monitorList.innerHTML = "";

  displays.displays.forEach((display, index) => {
    const monitorItem = document.createElement("div");
    monitorItem.className = "monitor-item";

    const isActive = activeStreams.length > index;
    const displayType = display.internal ? "internal" : "external";
    const statusClass = isActive ? "active" : "inactive";

    // Create monitor header with status
    const headerEl = document.createElement("div");
    headerEl.className = "monitor-header";

    const statusEl = document.createElement("div");
    statusEl.className = `status-pill ${isActive ? "streaming" : "inactive"}`;
    statusEl.textContent = isActive ? "Streaming" : "Inactive";
    headerEl.appendChild(statusEl);

    monitorItem.appendChild(headerEl);

    // Create placeholder for the monitor preview
    const placeholder = document.createElement("div");
    placeholder.className = "monitor-placeholder";

    // Add monitor screenshot or placeholder indicator if available
    if (isActive && activeStreams[index]) {
      const videoEl = document.createElement("video");
      videoEl.className = "monitor-thumbnail";
      videoEl.autoplay = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.srcObject = activeStreams[index];
      placeholder.appendChild(videoEl);
    } else {
      // Add monitor icon for placeholder
      const monitorIconSvg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      monitorIconSvg.setAttribute("viewBox", "0 0 24 24");
      monitorIconSvg.setAttribute("width", "64");
      monitorIconSvg.setAttribute("height", "64");
      monitorIconSvg.setAttribute("fill", "none");
      monitorIconSvg.setAttribute("stroke", "currentColor");
      monitorIconSvg.setAttribute("stroke-width", "1");
      monitorIconSvg.setAttribute("stroke-linecap", "round");
      monitorIconSvg.setAttribute("stroke-linejoin", "round");
      monitorIconSvg.style.opacity = "0.2";

      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.setAttribute(
        "d",
        "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
      );
      monitorIconSvg.appendChild(path);

      placeholder.appendChild(monitorIconSvg);
    }

    monitorItem.appendChild(placeholder);

    // Add badge for monitor type
    const badge = document.createElement("div");
    badge.className = `monitor-badge ${displayType}`;
    badge.textContent = display.internal ? "Internal" : "External";
    if (display.isPrimary) {
      badge.textContent += " (Primary)";
      badge.classList.add("primary");
    }
    monitorItem.appendChild(badge);

    // Add monitor info overlay with improved details
    const infoEl = document.createElement("div");
    infoEl.className = "monitor-info";

    const nameEl = document.createElement("div");
    nameEl.className = "monitor-name";
    nameEl.textContent = `Display ${display.id} ${
      display.isPrimary ? "(Primary)" : ""
    }`;

    const resolutionEl = document.createElement("div");
    resolutionEl.className = "monitor-resolution";
    resolutionEl.textContent = `${display.size} · ${display.scaleFactor}x`;

    // Add additional technical details
    const detailsEl = document.createElement("div");
    detailsEl.className = "monitor-details";
    detailsEl.innerHTML = `
      <div>Position: ${display.bounds.x},${display.bounds.y}</div>
      <div>Color: ${display.colorDepth}bit</div>
    `;

    infoEl.appendChild(nameEl);
    infoEl.appendChild(resolutionEl);
    infoEl.appendChild(detailsEl);
    monitorItem.appendChild(infoEl);

    monitorList.appendChild(monitorItem);
  });
}

// Handle display configuration changes
function handleDisplayConfigurationChange(receivedDisplayInfo) {
  logStatus("Display configuration changed", "info");

  // Notify the viewer that display configuration has changed even before refreshing
  if (isConnected && ws && ws.readyState === WebSocket.OPEN) {
    logStatus("Notifying viewer of display configuration change", "info");
    ws.send(
      JSON.stringify({
        type: "displayConfigChanged",
        code: currentCode,
        payload: {
          timestamp: Date.now(),
          displayChangeDetected: true,
        },
      })
    );

    // If we already have fresh display info, send it to the viewer
    if (receivedDisplayInfo) {
      // Add any additional diagnostic information for the viewer
      const enhancedDisplayInfo = Object.assign({}, receivedDisplayInfo, {
        pnpInfo: {
          totalWithInactive:
            (receivedDisplayInfo.inactive || 0) + receivedDisplayInfo.total,
          lastUpdated: new Date().toISOString(),
        },
      });

      ws.send(
        JSON.stringify({
          type: "monitorInfo",
          code: currentCode,
          payload: enhancedDisplayInfo,
        })
      );
    }
  }

  // Wait a bit longer for the display configuration to stabilize
  setTimeout(async () => {
    await updateDisplayInfo(true);

    // If connected and streaming, automatically refresh the screen capture
    if (isConnected && peer && ws && ws.readyState === WebSocket.OPEN) {
      logStatus("Auto-refreshing streams due to display change", "info");

      // Use a debounced refresh to avoid multiple refreshes in quick succession
      if (window.refreshDebounceTimer) {
        clearTimeout(window.refreshDebounceTimer);
      }

      window.refreshDebounceTimer = setTimeout(async () => {
        // Force a fresh display info update before refreshing screens
        const freshDisplayInfo = await window.electronAPI.getDetailedDisplays();

        // Send the updated display info separately to ensure viewer has latest data
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "monitorInfo",
              code: currentCode,
              payload: freshDisplayInfo,
            })
          );
        }

        // Then refresh the screen capture
        await refreshScreenCapture();
        delete window.refreshDebounceTimer;
      }, 1000);
    }
  }, 1500); // Wait a bit longer (1.5s instead of 1s) for the display changes to settle
}

// Log status messages
function logStatus(message, type = "info") {
  debugLog(`[${type.toUpperCase()}] ${message}`);

  if (logContainer) {
    const logEntry = document.createElement("div");
    logEntry.className = `log-entry ${type}`;

    const timestamp = new Date().toLocaleTimeString();

    const timestampEl = document.createElement("span");
    timestampEl.className = "log-timestamp";
    timestampEl.textContent = timestamp;

    const messageEl = document.createElement("span");
    messageEl.className = "log-message";
    messageEl.textContent = message;

    logEntry.appendChild(timestampEl);
    logEntry.appendChild(messageEl);

    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;

    // Keep only last 100 log entries
    while (logContainer.children.length > 100) {
      logContainer.removeChild(logContainer.firstChild);
    }
  }

  lastLogMessage = message;
}

// Title bar controls and logs panel
function setupWindowControls() {
  // Title bar controls
  minimizeBtn = document.getElementById("minimize-btn");
  maximizeBtn = document.getElementById("maximize-btn");
  closeBtn = document.getElementById("close-btn");

  // Logs panel controls
  toggleLogsBtn = document.getElementById("toggle-logs-btn");
  closeLogsBtn = document.getElementById("close-logs-btn");
  logsPanel = document.getElementById("logs-panel");

  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", () => {
      window.electronAPI.minimizeWindow();
    });
  }

  if (maximizeBtn) {
    maximizeBtn.addEventListener("click", () => {
      window.electronAPI.maximizeWindow();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      window.electronAPI.closeWindow();
    });
  }

  if (toggleLogsBtn) {
    toggleLogsBtn.addEventListener("click", toggleLogsPanel);
  }

  if (closeLogsBtn) {
    closeLogsBtn.addEventListener("click", toggleLogsPanel);
  }

  debugLog("Window controls setup complete");
}

function toggleLogsPanel() {
  if (logsPanel) {
    logsPanel.classList.toggle("visible");

    if (logsPanel.classList.contains("visible")) {
      toggleLogsBtn.querySelector("span").textContent = "Hide Logs";
      toggleLogsBtn.querySelector("svg").innerHTML =
        '<path d="M5 12h14M12 5v14"></path>';
    } else {
      toggleLogsBtn.querySelector("span").textContent = "Show Logs";
      toggleLogsBtn.querySelector("svg").innerHTML =
        '<path d="M12 5v14M5 12h14"></path>';
    }
  }
}

function cleanupMediaResources() {
  debugLog("Cleaning up media resources");

  // Clean up all senders if peer exists
  if (peer) {
    const senders = peer.getSenders();
    debugLog(`Removing ${senders.length} senders from peer connection`);

    senders.forEach((sender) => {
      if (sender.track) {
        try {
          debugLog(`Stopping track: ${sender.track.id} (${sender.track.kind})`);
          sender.track.stop();
          peer.removeTrack(sender);
        } catch (err) {
          debugWarn("Error cleaning up sender:", err);
        }
      }
    });
  }

  // Clean up all streams
  debugLog(`Stopping ${activeStreams.length} active streams`);
  activeStreams.forEach((stream) => {
    const tracks = stream.getTracks();
    debugLog(`Stopping ${tracks.length} tracks for stream ${stream.id}`);

    tracks.forEach((track) => {
      try {
        debugLog(`Stopping track: ${track.id} (${track.kind})`);
        track.stop();
      } catch (err) {
        debugWarn("Error stopping track:", err);
      }
    });
  });

  // Clear the array
  activeStreams = [];

  // Update UI
  const activeStreamsEl = document.getElementById("active-streams");
  if (activeStreamsEl) activeStreamsEl.textContent = "0";
}
