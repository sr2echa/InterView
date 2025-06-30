const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  screen,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const {
  getDetailedDisplayInfo,
  setupDisplayMonitoring,
} = require("./displayUtils");

// Load environment variables from .env file if it exists
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

let previousDisplayConfig = [];
let mainWindow;

// Parse command line arguments for direct join usage
const args = process.argv.slice(2);
const sessionCodeArg = args.find((arg) => arg.startsWith("--session-code="));
const sessionCode = sessionCodeArg ? sessionCodeArg.split("=")[1] : null;
const isDirectJoin = !!sessionCode; // If session code is provided, we're in direct join mode

// Environment variables
const IS_PRODUCTION = process.env.IS_PRODUCTION === "true";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [
        `--is-production=${IS_PRODUCTION}`,
        `--session-code=${sessionCode || ""}`,
      ],
    },
    autoHideMenuBar: true,
    frame: false,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    title: "InterView Monitor",
    transparent: false,
    roundedCorners: true,
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  setupDisplayMonitoring(mainWindow);

  // Handle automatic close on disconnect for direct join mode
  if (isDirectJoin) {
    mainWindow.webContents.on("ipc-message", (event, channel, ...args) => {
      if (channel === "session-disconnected") {
        app.quit();
      }
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  previousDisplayConfig = getDisplayConfigFingerprint();

  screen.on("display-added", handleDisplayChange);
  screen.on("display-removed", handleDisplayChange);
  screen.on("display-metrics-changed", handleDisplayChange);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function getDisplayConfigFingerprint() {
  const displays = screen.getAllDisplays();
  return displays
    .map(
      (d) =>
        `${d.id}-${d.bounds.width}x${d.bounds.height}-${
          d.internal ? "int" : "ext"
        }`
    )
    .sort()
    .join("|");
}

function handleDisplayChange() {
  const currentConfig = getDisplayConfigFingerprint();

  if (currentConfig !== previousDisplayConfig) {
    console.log("🖥️ Display configuration changed");
    previousDisplayConfig = currentConfig;

    setTimeout(async () => {
      try {
        const displayInfo = await getDetailedDisplayInfo();
        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send("display-configuration-changed", displayInfo);
          }
        });
      } catch (err) {
        console.error("Error getting display info for change event:", err);
        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send("display-configuration-changed");
          }
        });
      }
    }, 500);
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("get-sources", async () => {
  return await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 150, height: 150 },
    fetchWindowIcons: true,
  });
});

ipcMain.handle("get-displays", async () => {
  const displays = screen.getAllDisplays();
  return displays.map((display) => {
    return {
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
      size: display.size,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      touchSupport: display.touchSupport,
      accelerometerSupport: display.accelerometerSupport,
      internal: display.internal,
      monitorCount: screen.getAllDisplays().length,
    };
  });
});

ipcMain.handle("get-processes", async () => {
  return new Promise((resolve, reject) => {
    let command;
    let args = [];

    if (process.platform === "win32") {
      command = "powershell.exe";
      args = [
        "-NoProfile",
        "-Command",
        "Get-Process | Select-Object Id, ProcessName, @{Name='WindowTitle';Expression={$_.MainWindowTitle}}, @{Name='Memory';Expression={[math]::Round($_.WorkingSet64 / 1MB, 2)}}, @{Name='CPU';Expression={$_.CPU}} | Sort-Object -Descending Memory | ConvertTo-Json -Depth 1",
      ];
    } else if (process.platform === "darwin") {
      command = "ps";
      args = ["-axo", "pid,comm,%cpu,%mem", "--sort=-%mem"];
    } else {
      command = "ps";
      args = ["-axo", "pid,comm,%cpu,%mem", "--sort=-%mem"];
    }

    execFile(
      command,
      args,
      { maxBuffer: 1024 * 1024 * 5 },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error getting processes: ${error}`);
          resolve([]);
          return;
        }

        try {
          let processes = [];

          if (process.platform === "win32") {
            try {
              processes = JSON.parse(stdout);
              if (!Array.isArray(processes)) {
                processes = [processes];
              }
            } catch (e) {
              console.error("Failed to parse Windows process JSON:", e);
              processes = [];
            }
          } else {
            const lines = stdout.trim().split("\n").slice(1);
            processes = lines.map((line) => {
              const [pid, comm, cpu, mem] = line.trim().split(/\s+/);
              return {
                Id: parseInt(pid, 10),
                ProcessName: comm,
                CPU: parseFloat(cpu),
                Memory: parseFloat(mem),
              };
            });
          }

          const topProcesses = processes
            .filter((p) => p.Id !== process.pid)
            .slice(0, 100);

          resolve(topProcesses);
        } catch (err) {
          console.error(`Error parsing process list: ${err}`);
          resolve([]);
        }
      }
    );
  });
});

ipcMain.handle("get-detailed-displays", async () => {
  try {
    return await getDetailedDisplayInfo();
  } catch (error) {
    console.error("Error getting detailed display info:", error);
    return {
      total: 0,
      primary: null,
      external: 0,
      internal: 0,
      active: 0,
      inactive: 0,
      displays: [],
    };
  }
});

ipcMain.handle("window-minimize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.handle("window-maximize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle("window-close", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

ipcMain.handle("window-is-maximized", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.isMaximized();
  }
  return false;
});

ipcMain.on("window-minimize", () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on("window-close", () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// Handle session disconnect for automatic close functionality
ipcMain.on("session-disconnected", () => {
  if (isDirectJoin) {
    console.log("Session disconnected, closing app due to direct join mode");
    app.quit();
  }
});
