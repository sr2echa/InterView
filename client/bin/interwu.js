#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

// Load environment variables from .env file if it exists
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

// Parse command line arguments
const args = process.argv.slice(2);
let sessionCode = null;
let customWebSocketUrl = null;
let showHelp = false;

// Check for help flag
if (args.includes("--help") || args.includes("-h")) {
  showHelp = true;
}

if (showHelp) {
  console.log(`
🎯 InterWu - Remote Interview Monitoring CLI

Usage:
  interwu [session-code] [options]

Arguments:
  session-code    6-digit session code to join directly

Options:
  --local         Use localhost WebSocket (ws://localhost:3004)
  --local=URL     Use custom WebSocket URL
  --local URL     Use custom WebSocket URL
  --help, -h      Show this help message


Note: Custom WebSocket URLs should include the full ws:// or wss:// protocol.
`);
  process.exit(0);
}

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === "--local") {
    // --local flag without value defaults to localhost
    customWebSocketUrl = "ws://localhost:3004";
  } else if (arg.startsWith("--local=")) {
    // --local=url format
    customWebSocketUrl = arg.split("=")[1];
  } else if (
    arg === "--local" &&
    args[i + 1] &&
    !args[i + 1].startsWith("--")
  ) {
    // --local url format (next argument is the URL)
    customWebSocketUrl = args[i + 1];
    i++; // Skip the next argument as it's the URL
  } else if (!arg.startsWith("--") && !sessionCode) {
    // First non-flag argument is the session code
    sessionCode = arg;
  }
}

// Path to the main Electron app
const appPath = path.join(__dirname, "..", "src", "index.js");

// Set environment variables for the app
const env = { ...process.env };

// Set production mode - prioritize .env file, then process.env, then default to true for global installs
env.IS_PRODUCTION = process.env.IS_PRODUCTION || "true";

// Pass the session code directly as command line argument if provided
const electronArgs = [appPath];
if (sessionCode) {
  electronArgs.push(`--session-code=${sessionCode}`);
  console.log(`🎯 Joining session: ${sessionCode}`);
}
if (customWebSocketUrl) {
  electronArgs.push(`--websocket-url=${customWebSocketUrl}`);
  console.log(`🌐 Using WebSocket: ${customWebSocketUrl}`);
}

// Function to try spawning electron with shell option for Windows
function tryElectron(electronCmd, args, useShell = false) {
  return new Promise((resolve, reject) => {
    console.log(`Attempting to launch: ${electronCmd} ${args.join(" ")}`);
    const child = spawn(electronCmd, args, {
      env,
      stdio: "inherit",
      detached: false,
      shell: useShell,
    });

    child.on("close", (code) => {
      resolve(code);
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

// Function to find electron executable
function findElectronExecutable() {
  const platform = os.platform();
  const possiblePaths = [];

  // Local installation paths
  if (platform === "win32") {
    possiblePaths.push(
      path.join(
        __dirname,
        "..",
        "node_modules",
        "electron",
        "dist",
        "electron.exe"
      ),
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "electron",
        "dist",
        "electron.exe"
      ), // Global pnpm structure
      path.join(__dirname, "..", "..", "electron", "dist", "electron.exe")
    );
  } else if (platform === "darwin") {
    possiblePaths.push(
      path.join(
        __dirname,
        "..",
        "node_modules",
        "electron",
        "dist",
        "Electron.app",
        "Contents",
        "MacOS",
        "Electron"
      ),
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "electron",
        "dist",
        "Electron.app",
        "Contents",
        "MacOS",
        "Electron"
      ),
      path.join(
        __dirname,
        "..",
        "..",
        "electron",
        "dist",
        "Electron.app",
        "Contents",
        "MacOS",
        "Electron"
      )
    );
  } else {
    possiblePaths.push(
      path.join(
        __dirname,
        "..",
        "node_modules",
        "electron",
        "dist",
        "electron"
      ),
      path.join(__dirname, "..", "..", "..", "electron", "dist", "electron"),
      path.join(__dirname, "..", "..", "electron", "dist", "electron")
    );
  }

  // Check which path exists
  for (const electronPath of possiblePaths) {
    if (fs.existsSync(electronPath)) {
      console.log(`Found Electron at: ${electronPath}`);
      return electronPath;
    }
  }

  return null;
}

// Function to find bundled electron in global package
function findGlobalElectronInPackage() {
  const platform = os.platform();
  const possiblePaths = [];

  // Look for electron bundled with the interwu package
  if (platform === "win32") {
    possiblePaths.push(
      path.join(
        __dirname,
        "..",
        "node_modules",
        "electron",
        "dist",
        "electron.exe"
      )
    );
  } else if (platform === "darwin") {
    possiblePaths.push(
      path.join(
        __dirname,
        "..",
        "node_modules",
        "electron",
        "dist",
        "Electron.app",
        "Contents",
        "MacOS",
        "Electron"
      )
    );
  } else {
    possiblePaths.push(
      path.join(__dirname, "..", "node_modules", "electron", "dist", "electron")
    );
  }

  // Check which path exists
  for (const electronPath of possiblePaths) {
    if (fs.existsSync(electronPath)) {
      console.log(`Found bundled Electron at: ${electronPath}`);
      return electronPath;
    }
  }

  return null;
}

// Function to find bundled electron in global package
function findGlobalElectronInPackage() {
  const platform = os.platform();
  const possiblePaths = [];

  // Look for electron bundled with the interwu package
  if (platform === "win32") {
    possiblePaths.push(
      path.join(
        __dirname,
        "..",
        "node_modules",
        "electron",
        "dist",
        "electron.exe"
      )
    );
  } else if (platform === "darwin") {
    possiblePaths.push(
      path.join(
        __dirname,
        "..",
        "node_modules",
        "electron",
        "dist",
        "Electron.app",
        "Contents",
        "MacOS",
        "Electron"
      )
    );
  } else {
    possiblePaths.push(
      path.join(__dirname, "..", "node_modules", "electron", "dist", "electron")
    );
  }

  // Check which path exists
  for (const electronPath of possiblePaths) {
    if (fs.existsSync(electronPath)) {
      console.log(`Found bundled Electron at: ${electronPath}`);
      return electronPath;
    }
  }

  return null;
}

// Main execution
async function main() {
  // Try to find electron executable
  const electronPath = findElectronExecutable();

  if (electronPath) {
    try {
      console.log("Using local Electron installation...");
      const exitCode = await tryElectron(electronPath, electronArgs, false);
      process.exit(exitCode);
    } catch (err) {
      console.error("Failed to start with local Electron:", err.message);
    }
  }

  // Try globally installed electron
  try {
    console.log("Trying to use globally installed Electron...");
    const exitCode = await tryElectron("electron", electronArgs, false);
    process.exit(exitCode);
  } catch (fallbackErr) {
    console.error("Failed to start with global Electron:", fallbackErr.message);

    // Try npx electron as fallback
    try {
      console.log("Trying npx electron as fallback...");
      const exitCode = await tryElectron(
        "npx",
        ["electron", ...electronArgs],
        true
      );
      process.exit(exitCode);
    } catch (npxErr) {
      console.error("Failed with npx electron:", npxErr.message);

      // Try finding bundled electron in the global package
      try {
        console.log("Trying bundled Electron in global package...");
        const globalElectronPath = findGlobalElectronInPackage();
        if (globalElectronPath) {
          const exitCode = await tryElectron(
            globalElectronPath,
            electronArgs,
            false
          );
          process.exit(exitCode);
        }
        throw new Error("No bundled Electron found");
      } catch (bundledErr) {
        console.error("\n❌ All Electron launch methods failed.");
        console.error("\n🔧 To fix this issue, try one of the following:");
        console.error("  1. Install Electron globally:");
        console.error("     npm install -g electron@latest");
        console.error("  2. Clear npm cache and try again:");
        console.error("     npm cache clean --force");
        console.error("     npx interwu [code]");
        console.error("  3. Use local installation:");
        console.error("     npm install interwu");
        console.error("     npx interwu [code]");
        console.error(
          "\n📝 Note: If using pnpm, replace 'npm' with 'pnpm' in the commands above."
        );
        process.exit(1);
      }
    }
  }
}

// Handle SIGINT (Ctrl+C)
process.on("SIGINT", () => {
  process.exit(0);
});

// Handle SIGTERM
process.on("SIGTERM", () => {
  process.exit(0);
});

main();
