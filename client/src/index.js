// const {
//   app,
//   BrowserWindow,
//   ipcMain,
//   desktopCapturer,
//   dialog,
// } = require("electron");
// const path = require("path");
// const WebSocket = require("ws");

// let mainWindow;
// let ws;
// let peer;
// let code = null;

// function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 1000,
//     height: 700,
//     backgroundColor: "#000000",
//     webPreferences: {
//       preload: path.join(__dirname, "preload.js"),
//       contextIsolation: true,
//     },
//   });

//   mainWindow.loadFile(path.join(__dirname, "index.html"));
// }

// async function askForCode() {
//   const { response, checkboxChecked } = await dialog.showMessageBox({
//     type: "question",
//     buttons: ["OK"],
//     defaultId: 0,
//     title: "Enter Code",
//     message: "Please enter the 6-digit code in the console",
//     detail: "You need to manually input it in the terminal for now.",
//   });

//   const input = await new Promise((resolve) => {
//     process.stdout.write("Enter 6-digit code: ");
//     process.stdin.once("data", (data) => resolve(data.toString().trim()));
//   });

//   return input;
// }

// async function startConnection() {
//   ws = new WebSocket("ws://localhost:3001");

//   ws.on("open", async () => {
//     console.log("🔗 Connected to signaling server");

//     code = await askForCode();

//     ws.send(
//       JSON.stringify({
//         type: "register",
//         code,
//       })
//     );

//     await startStreaming();
//   });

//   ws.on("message", async (data) => {
//     const { type, payload } = JSON.parse(data);

//     if (type === "connect") {
//       const offer = await peer.createOffer();
//       await peer.setLocalDescription(offer);

//       ws.send(
//         JSON.stringify({
//           type: "signal",
//           code,
//           payload: offer,
//         })
//       );
//     }

//     if (type === "signal") {
//       if (payload.type === "answer") {
//         await peer.setRemoteDescription(new RTCSessionDescription(payload));
//       } else if (payload.candidate) {
//         await peer.addIceCandidate(new RTCIceCandidate(payload));
//       }
//     }
//   });
// }

// async function startStreaming() {
//   peer = new RTCPeerConnection({
//     iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//   });

//   const sources = await desktopCapturer.getSources({ types: ["screen"] });

//   for (const source of sources) {
//     const stream = await navigator.mediaDevices.getUserMedia({
//       audio: false,
//       video: {
//         mandatory: {
//           chromeMediaSource: "desktop",
//           chromeMediaSourceId: source.id,
//         },
//       },
//     });

//     stream.getTracks().forEach((track) => {
//       peer.addTrack(track, stream);
//     });
//   }

//   peer.onicecandidate = (event) => {
//     if (event.candidate) {
//       ws.send(
//         JSON.stringify({
//           type: "signal",
//           code,
//           payload: event.candidate,
//         })
//       );
//     }
//   };

//   console.log("🖥️ Streaming screens...");
// }

// app.whenReady().then(() => {
//   createWindow();
//   startConnection();

//   app.on("activate", () => {
//     if (BrowserWindow.getAllWindows().length === 0) createWindow();
//   });
// });

// app.on("window-all-closed", () => {
//   if (process.platform !== "darwin") app.quit();
// });

const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  screen,
} = require("electron");
const path = require("path");
const crypto = require("crypto");

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Get all desktop capturer sources (screens)
ipcMain.handle("get-sources", async () => {
  return await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: 150, height: 150 },
    fetchWindowIcons: true,
  });
});

// Get all system displays with detailed info
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

// Generate a 6-digit code
ipcMain.handle("generate-code", async () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
});
