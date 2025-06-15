const { contextBridge, ipcRenderer } = require("electron");

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
