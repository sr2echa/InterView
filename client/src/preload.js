const { contextBridge, ipcRenderer } = require("electron");

// Get configuration from command line arguments
const args = process.argv;
const isProduction =
  args.find((arg) => arg.startsWith("--is-production="))?.split("=")[1] ===
  "true";
const sessionCode =
  args.find((arg) => arg.startsWith("--session-code="))?.split("=")[1] || "";
const customWebSocketUrl =
  args.find((arg) => arg.startsWith("--websocket-url="))?.split("=")[1] || "";

// Determine if we're in direct join mode (session code is provided)
const isDirectJoin = !!sessionCode;

contextBridge.exposeInMainWorld("electronAPI", {
  getScreens: () => ipcRenderer.invoke("get-sources"),
  getDisplays: () => ipcRenderer.invoke("get-displays"),
  getDetailedDisplays: () => ipcRenderer.invoke("get-detailed-displays"),
  generateCode: () => ipcRenderer.invoke("generate-code"),
  getProcesses: () => ipcRenderer.invoke("get-processes"),

  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  maximizeWindow: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),
  isWindowMaximized: () => ipcRenderer.invoke("window-is-maximized"),

  onDisplayConfigurationChanged: (callback) => {
    ipcRenderer.on("display-configuration-changed", callback);
  },

  removeDisplayChangeListener: () => {
    ipcRenderer.removeAllListeners("display-configuration-changed");
  },
});

// Expose configuration globally for the renderer
contextBridge.exposeInMainWorld("config", {
  isProduction,
  sessionCode,
  customWebSocketUrl,
  isDirectJoin, // Indicates if we should skip code entry and join directly
});

// Expose method to notify main process of session disconnect
contextBridge.exposeInMainWorld("notifySessionDisconnect", () => {
  ipcRenderer.send("session-disconnected");
});
