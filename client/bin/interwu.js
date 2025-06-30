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
const sessionCode = args[0];

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
}

// Function to try spawning electron with shell option for Windows
function tryElectron(electronCmd, args, useShell = false) {
  return new Promise((resolve, reject) => {
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

// Main execution
async function main() {
  const platform = os.platform();

  // Try direct electron executable first
  let electronPath;
  if (platform === "win32") {
    electronPath = path.join(
      __dirname,
      "..",
      "node_modules",
      "electron",
      "dist",
      "electron.exe"
    );
  } else if (platform === "darwin") {
    electronPath = path.join(
      __dirname,
      "..",
      "node_modules",
      "electron",
      "dist",
      "Electron.app",
      "Contents",
      "MacOS",
      "Electron"
    );
  } else {
    electronPath = path.join(
      __dirname,
      "..",
      "node_modules",
      "electron",
      "dist",
      "electron"
    );
  }

  try {
    // Try local electron executable
    const exitCode = await tryElectron(electronPath, electronArgs, false);
    process.exit(exitCode);
  } catch (err) {
    console.error("Failed to start InterWu:", err.message);

    try {
      console.log("Trying to use globally installed Electron...");
      const exitCode = await tryElectron("electron", electronArgs, false);
      process.exit(exitCode);
    } catch (fallbackErr) {
      console.error(
        "Failed to start with global Electron. Please ensure Electron is installed."
      );
      console.error("Run: npm install -g electron");
      process.exit(1);
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
