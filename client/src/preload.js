const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getScreens: () => ipcRenderer.invoke("get-sources"),
  getDisplays: () => ipcRenderer.invoke("get-displays"),
  generateCode: () => ipcRenderer.invoke("generate-code"),
});
