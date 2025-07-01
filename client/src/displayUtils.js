const { exec } = require("child_process");
const { screen } = require("electron");
const util = require("util");

// Log style constants - using simple ASCII for better cross-terminal compatibility
const LOG_STYLES = {
  SECTION: "=".repeat(80),
  SUBSECTION: "-".repeat(60),
  INDENT: "  ",
  DOUBLE_INDENT: "    ",
  BULLET: "* ",
  SUB_BULLET: "- ",
};

function debugLog(...args) {
  if (process.env.IS_PRODUCTION === "false") {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
    console.log(...args);
  }
}

function debugError(...args) {
  if (process.env.IS_PRODUCTION === "false") {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
    console.error(...args);
  }
}

function debugWarn(...args) {
  if (process.env.IS_PRODUCTION === "false") {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
    console.warn(...args);
  }
}

/**
 * Format object for display in console logs
 * Custom implementation to avoid encoding issues with util.inspect
 *
 * @param {Object} obj - Object to format
 * @param {number} indent - Indentation level (used recursively)
 * @returns {string} Formatted object string with proper indentation
 */
function formatObjectForLog(obj, indent = 0) {
  // Handle non-objects
  if (obj === null) return "null";
  if (obj === undefined) return "undefined";
  if (typeof obj !== "object") {
    // For string values, ensure they're properly displayed
    if (typeof obj === "string") {
      return obj.includes(" ") ? `"${obj}"` : obj;
    }
    return String(obj);
  }

  // Special case handling for colorSpace object which has a custom toString()
  if (
    obj.toString &&
    typeof obj.toString === "function" &&
    obj.toString() !== "[object Object]" &&
    obj.toString().includes(":")
  ) {
    return obj.toString();
  }

  // Create indentation strings
  const indentStr = " ".repeat(indent * 2);
  const indentStrInner = " ".repeat((indent + 1) * 2);

  // Handle arrays
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";

    const items = obj
      .map((item) => `${indentStrInner}${formatObjectForLog(item, indent + 1)}`)
      .join(",\n");

    return `[\n${items}\n${indentStr}]`;
  }

  // Handle objects
  const keys = Object.keys(obj).sort();
  if (keys.length === 0) return "{}";

  const entries = keys
    .map((key) => {
      const value = obj[key];
      return `${indentStrInner}${key}: ${formatObjectForLog(
        value,
        indent + 1
      )}`;
    })
    .join(",\n");

  return `{\n${entries}\n${indentStr}}`;
}

/**
 * Format data as a simple ASCII table
 * @param {Array<Object>} data - Array of objects with same structure
 * @returns {string} Formatted table string
 */
function formatTableForLog(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return "[No data]";
  }

  // Get all keys from the objects
  const keys = Array.from(new Set(data.flatMap((obj) => Object.keys(obj))));

  // Determine column widths
  const colWidths = {};
  keys.forEach((key) => {
    colWidths[key] = Math.max(
      key.length,
      ...data.map((obj) => {
        const val = obj[key] !== undefined ? String(obj[key]) : "";
        return val.length;
      })
    );
  });

  // Build header row
  let table = keys.map((key) => key.padEnd(colWidths[key])).join(" | ") + "\n";

  // Add separator
  table += keys.map((key) => "-".repeat(colWidths[key])).join("-+-") + "\n";

  // Add data rows
  data.forEach((obj) => {
    const row = keys
      .map((key) => {
        const val = obj[key] !== undefined ? String(obj[key]) : "";
        return val.padEnd(colWidths[key]);
      })
      .join(" | ");
    table += row + "\n";
  });

  return table;
}

/**
 * Log a section header with clean ASCII formatting
 * @param {string} title - Section title
 */
function logSection(title) {
  debugLog(`\n${LOG_STYLES.SECTION}\n${title}\n${LOG_STYLES.SECTION}`);
}

/**
 * Log a subsection header with clean ASCII formatting
 * @param {string} title - Subsection title
 */
function logSubSection(title) {
  debugLog(`\n${LOG_STYLES.SUBSECTION}\n${title}\n${LOG_STYLES.SUBSECTION}`);
}

/**
 * Gets detailed information about all displays connected to the system
 * Enhances the Electron display info with additional OS-specific details
 * @returns {Object} Comprehensive display information
 */
async function getDetailedDisplayInfo() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  logSection("DISPLAY DETECTION STARTED");

  // Log basic display summary with clean ASCII formatting
  debugLog(`Display Summary:`);
  debugLog(
    `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Total Displays: ${displays.length}`
  );
  debugLog(
    `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Primary Display: ID ${primaryDisplay.id}`
  );
  debugLog(
    `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}External Displays: ${
      displays.filter((d) => !d.internal).length
    }`
  );
  debugLog(
    `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Internal Displays: ${
      displays.filter((d) => d.internal).length
    }`
  );

  // Log detailed display information
  logSubSection("ACTIVE DISPLAY DETAILS");
  displays.forEach((display, index) => {
    const displayType = display.internal ? "Internal" : "External";
    const primaryStatus =
      display.id === primaryDisplay.id ? "PRIMARY" : "Secondary";

    debugLog(`Display #${index + 1} [${primaryStatus}] [${displayType}]:`);
    debugLog(`${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}ID: ${display.id}`);
    debugLog(
      `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Resolution: ${display.bounds.width}x${display.bounds.height}`
    );
    debugLog(
      `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Position: (${display.bounds.x},${display.bounds.y})`
    );
    debugLog(
      `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Scale Factor: ${display.scaleFactor}`
    );
    debugLog(
      `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Rotation: ${display.rotation} degrees`
    );
    debugLog(
      `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Color Depth: ${
        display.colorDepth || 24
      }`
    );
    debugLog(
      `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Color Space: ${
        display.colorSpace || "sRGB"
      }`
    );
  });

  // Prepare display info object
  const displayInfo = {
    // total will be updated after inactive detection (active + inactive)
    primary: primaryDisplay.id,
    external: displays.filter((d) => !d.internal).length,
    internal: displays.filter((d) => d.internal).length,
    active: displays.length,
    inactive: 0, // Will be populated during detection
    displays: displays.map((display) => ({
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      internal: display.internal,
      isPrimary: display.id === primaryDisplay.id,
      size: `${display.bounds.width}x${display.bounds.height}`,
      colorDepth: display.colorDepth || 24,
      colorSpace: display.colorSpace || "sRGB",
    })),
  };

  if (process.platform === "win32") {
    try {
      logSubSection("WINDOWS INACTIVE DISPLAY DETECTION");
      debugLog(`Starting detection process for inactive displays...`);

      await new Promise((resolve) => {
        exec(
          "powershell -Command \"Get-CimInstance -ClassName Win32_PnPEntity | Where-Object { $_.PNPClass -eq 'Monitor' } | Select-Object Name, Status, ConfigManagerErrorCode | Format-Table -AutoSize\"",
          (err, stdout) => {
            if (!err && stdout) {
              logSubSection("PNP MONITOR QUERY RESULTS");

              // Format PnP monitor output for better readability
              const formattedOutput = stdout
                .trim()
                .split("\n")
                .map((line) => `${LOG_STYLES.INDENT}${line}`)
                .join("\n");
              debugLog(formattedOutput);

              const lines = stdout
                .split("\n")
                .filter(
                  (line) =>
                    line.trim() &&
                    !line.includes("---") &&
                    !line.includes("Name")
                );
              let totalPnP = 0;
              let activePnP = 0;

              lines.forEach((line) => {
                if (line.trim()) {
                  totalPnP++;
                  if (line.includes("OK") || line.includes("0")) {
                    activePnP++;
                  }
                }
              });

              debugLog(`\nPnP Monitor Statistics:`);
              debugLog(
                `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Total monitors detected: ${totalPnP}`
              );
              debugLog(
                `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Active monitors: ${activePnP}`
              );
              debugLog(
                `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Inactive monitors: ${
                  totalPnP - activePnP
                }`
              );

              exec(
                'powershell -Command "Get-CimInstance -ClassName Win32_DesktopMonitor | Measure-Object | Select-Object -ExpandProperty Count"',
                (err2, stdout2) => {
                  let wmiCount = 0;
                  if (!err2 && stdout2) {
                    wmiCount = parseInt(stdout2.trim()) || 0;
                    debugLog(`WMI DesktopMonitor Detection:`);
                    debugLog(
                      `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Total monitors: ${wmiCount}`
                    );
                  }

                  exec(
                    'powershell -Command "Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public class DisplayConfig { [DllImport(\\"user32.dll\\")] public static extern int GetDisplayConfigBufferSizes(uint flags, out uint numPathArrayElements, out uint numModeInfoArrayElements); }\'; try { [uint]$pathCount = 0; [uint]$modeCount = 0; $result = [DisplayConfig]::GetDisplayConfigBufferSizes(1, [ref]$pathCount, [ref]$modeCount); Write-Output \\"Paths:$pathCount,Modes:$modeCount,Result:$result\\" } catch { Write-Output \\"Error\\" }"',
                    (err3, stdout3) => {
                      let displayConfigCount = 0;
                      if (!err3 && stdout3 && stdout3.includes("Paths:")) {
                        const match = stdout3.match(/Paths:(\d+)/);
                        if (match) {
                          displayConfigCount = parseInt(match[1]) || 0;
                          debugLog(`DisplayConfig API Detection:`);
                          debugLog(
                            `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Path count: ${displayConfigCount}`
                          );
                          debugLog(
                            `${LOG_STYLES.INDENT}${
                              LOG_STYLES.BULLET
                            }Full output: ${stdout3.trim()}`
                          );
                        }
                      }

                      const electronCount = displays.length;
                      let calculatedInactive = 0;
                      let detectionMethod = "";

                      if (totalPnP > electronCount) {
                        calculatedInactive = totalPnP - electronCount;
                        detectionMethod = "PnP";
                        debugLog(
                          `Inactive displays detected via ${detectionMethod} method:`
                        );
                        debugLog(
                          `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}PnP total (${totalPnP}) - Electron active (${electronCount}) = ${calculatedInactive} inactive`
                        );
                      } else if (wmiCount > electronCount) {
                        calculatedInactive = wmiCount - electronCount;
                        detectionMethod = "WMI";
                        debugLog(
                          `Inactive displays detected via ${detectionMethod} method:`
                        );
                        debugLog(
                          `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}WMI total (${wmiCount}) - Electron active (${electronCount}) = ${calculatedInactive} inactive`
                        );
                      } else if (displayConfigCount > electronCount) {
                        calculatedInactive = displayConfigCount - electronCount;
                        detectionMethod = "DisplayConfig";
                        debugLog(
                          `Inactive displays detected via ${detectionMethod} method:`
                        );
                        debugLog(
                          `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}DisplayConfig paths (${displayConfigCount}) - Electron active (${electronCount}) = ${calculatedInactive} inactive`
                        );
                      }

                      displayInfo.inactive = Math.max(0, calculatedInactive);

                      // Update total to be the sum of active + inactive displays
                      displayInfo.total =
                        displayInfo.active + displayInfo.inactive;

                      debugLog(
                        `Final inactive display count: ${displayInfo.inactive}`
                      );

                      if (displayInfo.inactive > 0) {
                        debugLog(
                          `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Detection method: ${detectionMethod}`
                        );
                        debugLog(
                          `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Total displays (active + inactive): ${displayInfo.total}`
                        );
                      } else {
                        debugLog(
                          `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}No inactive displays detected`
                        );
                      }

                      resolve();
                    }
                  );
                }
              );
            } else {
              debugWarn("PnP query failed, using fallback detection methods");
              if (err) {
                debugError(`Error details: ${err.message}`);
              }
              resolve();
            }
          }
        );
      });
    } catch (err) {
      debugError("Error detecting inactive displays:", err);
    }
  } else if (process.platform === "darwin") {
    try {
      logSubSection("MACOS INACTIVE DISPLAY DETECTION");
      debugLog(`Starting detection process for inactive displays on macOS...`);

      await new Promise((resolve) => {
        exec("system_profiler SPDisplaysDataType", (err, stdout) => {
          if (!err && stdout) {
            // Format system_profiler output for better readability
            debugLog(
              `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Running: system_profiler SPDisplaysDataType`
            );

            const displayEntries = (stdout.match(/Display Type:/g) || [])
              .length;
            const resolutionEntries = (stdout.match(/Resolution:/g) || [])
              .length;

            debugLog(
              `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Display entries found: ${displayEntries}`
            );
            debugLog(
              `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Resolution entries found: ${resolutionEntries}`
            );
            debugLog(
              `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Electron active displays: ${displays.length}`
            );

            if (displayEntries > displays.length) {
              displayInfo.inactive = displayEntries - displays.length;
              // Update total to be the sum of active + inactive displays
              displayInfo.total = displayInfo.active + displayInfo.inactive;

              debugLog(`Inactive displays detected:`);
              debugLog(
                `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}System entries (${displayEntries}) - Electron active (${displays.length}) = ${displayInfo.inactive} inactive`
              );
              debugLog(
                `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Total displays (active + inactive): ${displayInfo.total}`
              );
            } else {
              displayInfo.total = displayInfo.active; // No inactive displays, total = active
              debugLog(`No inactive displays detected`);
            }
          } else {
            debugWarn("system_profiler query failed");
            if (err) {
              debugError(`Error details: ${err.message}`);
            }
          }
          resolve();
        });
      });
    } catch (err) {
      debugError("Error detecting inactive displays on macOS:", err);
    }
  } else if (process.platform === "linux") {
    try {
      logSubSection("LINUX INACTIVE DISPLAY DETECTION");
      debugLog(`Starting detection process for inactive displays on Linux...`);

      await new Promise((resolve) => {
        exec("xrandr --listmonitors && xrandr", (err, stdout) => {
          if (!err && stdout) {
            // Format xrandr output for better readability
            debugLog(
              `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Running: xrandr --listmonitors && xrandr`
            );

            const lines = stdout.split("\n");
            const connectedCount = lines.filter((line) =>
              line.includes(" connected")
            ).length;
            const activeCount = lines.filter(
              (line) => line.includes(" connected") && line.includes("x")
            ).length;

            debugLog(
              `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Connected displays found: ${connectedCount}`
            );
            debugLog(
              `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Active displays found: ${activeCount}`
            );
            debugLog(
              `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Electron active displays: ${displays.length}`
            );

            if (connectedCount > displays.length) {
              displayInfo.inactive = connectedCount - displays.length;
              // Update total to be the sum of active + inactive displays
              displayInfo.total = displayInfo.active + displayInfo.inactive;

              debugLog(`Inactive displays detected:`);
              debugLog(
                `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Connected displays (${connectedCount}) - Electron active (${displays.length}) = ${displayInfo.inactive} inactive`
              );
              debugLog(
                `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Total displays (active + inactive): ${displayInfo.total}`
              );
            } else {
              displayInfo.total = displayInfo.active; // No inactive displays, total = active
              debugLog(`No inactive displays detected`);
            }
          } else {
            debugWarn("xrandr query failed");
            if (err) {
              debugError(`Error details: ${err.message}`);
            }
          }
          resolve();
        });
      });
    } catch (err) {
      debugError("Error detecting inactive displays on Linux:", err);
    }
  }

  // Log final display information with clean ASCII formatting
  logSection("DISPLAY DETECTION COMPLETE");

  // Ensure total is always calculated correctly as active + inactive
  displayInfo.total = displayInfo.active + displayInfo.inactive;

  debugLog(`Final Display Configuration Summary:`);
  debugLog(
    `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Total Displays: ${displayInfo.total}`
  );
  debugLog(
    `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Active Displays: ${displayInfo.active}`
  );
  debugLog(
    `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Inactive Displays: ${displayInfo.inactive}`
  );
  debugLog(
    `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Internal Displays: ${displayInfo.internal}`
  );
  debugLog(
    `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}External Displays: ${displayInfo.external}`
  );
  debugLog(
    `${LOG_STYLES.INDENT}${LOG_STYLES.BULLET}Primary Display ID: ${displayInfo.primary}`
  );

  // Create a tabular representation for displays
  if (displayInfo.displays && displayInfo.displays.length > 0) {
    // Extract simple display properties for tabular display
    const displaySummary = displayInfo.displays.map((d) => ({
      ID: d.id,
      Size: d.size,
      Primary: d.isPrimary ? "Yes" : "No",
      Type: d.internal ? "Internal" : "External",
      Scale: d.scaleFactor,
      Position: `(${d.bounds.x},${d.bounds.y})`,
    }));
    debugLog(`\n`);
    debugLog(formatTableForLog(displaySummary));
  }

  // try {
  //   const logObj = { ...displayInfo };
  //   console.log(formatObjectForLog(logObj));
  // } catch (err) {
  //   console.dir(displayInfo, { depth: null, colors: false });
  // }

  return displayInfo;
}

/**
 * Sets up monitoring of display configuration changes
 * Attaches event listeners to Electron's screen events
 * @param {BrowserWindow} window - The main Electron window
 * @returns {Promise<Object>} Initial display configuration
 */
function setupDisplayMonitoring(window) {
  debugLog(`Setting up display configuration monitoring...`);

  // Define the change handler
  const handleDisplayChange = async (event) => {
    debugLog(
      `Display configuration change detected: ${event || "unknown event"}`
    );
    const displayInfo = await getDetailedDisplayInfo();
    debugLog(`Notifying renderer process of display configuration change`);
    window.webContents.send("display-configuration-changed", displayInfo);
  };

  // Attach event listeners
  debugLog(`Attaching screen event listeners for display changes`);
  screen.on("display-added", () => handleDisplayChange("display-added"));
  screen.on("display-removed", () => handleDisplayChange("display-removed"));
  screen.on("display-metrics-changed", () =>
    handleDisplayChange("display-metrics-changed")
  );

  // Get and return the initial display info
  debugLog(`Getting initial display configuration...`);
  return getDetailedDisplayInfo();
}

/**
 * Module exports for display utilities
 */
module.exports = {
  // Main display utility functions
  getDetailedDisplayInfo,
  setupDisplayMonitoring,

  // Logging utilities for use in other modules
  debugLog,
  debugError,
  debugWarn,
  logSection,
  logSubSection,

  // Formatting utilities for better console output
  formatObjectForLog,
  formatTableForLog,
};
