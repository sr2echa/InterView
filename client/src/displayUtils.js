const { exec } = require("child_process");
const { screen } = require("electron");

async function getDetailedDisplayInfo() {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  console.log("=== Display Detection Debug Info ===");
  console.log("Total displays detected by Electron:", displays.length);
  console.log(
    "Display details:",
    displays.map((d) => ({
      id: d.id,
      bounds: d.bounds,
      internal: d.internal,
      scaleFactor: d.scaleFactor,
    }))
  );

  const displayInfo = {
    total: displays.length,
    primary: primaryDisplay.id,
    external: displays.filter((d) => !d.internal).length,
    internal: displays.filter((d) => d.internal).length,
    active: displays.length,
    inactive: 0,
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
      console.log("=== Inactive Display Detection (Windows) ===");

      await new Promise((resolve) => {
        exec(
          "powershell -Command \"Get-CimInstance -ClassName Win32_PnPEntity | Where-Object { $_.PNPClass -eq 'Monitor' } | Select-Object Name, Status, ConfigManagerErrorCode | Format-Table -AutoSize\"",
          (err, stdout) => {
            if (!err && stdout) {
              console.log("PnP Monitor Query Result:");
              console.log(stdout);

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

              console.log(
                `PnP monitors: ${totalPnP} total, ${activePnP} active`
              );

              exec(
                'powershell -Command "Get-CimInstance -ClassName Win32_DesktopMonitor | Measure-Object | Select-Object -ExpandProperty Count"',
                (err2, stdout2) => {
                  let wmiCount = 0;
                  if (!err2 && stdout2) {
                    wmiCount = parseInt(stdout2.trim()) || 0;
                    console.log(`WMI DesktopMonitor count: ${wmiCount}`);
                  }

                  exec(
                    'powershell -Command "Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public class DisplayConfig { [DllImport(\\"user32.dll\\")] public static extern int GetDisplayConfigBufferSizes(uint flags, out uint numPathArrayElements, out uint numModeInfoArrayElements); }\'; try { [uint]$pathCount = 0; [uint]$modeCount = 0; $result = [DisplayConfig]::GetDisplayConfigBufferSizes(1, [ref]$pathCount, [ref]$modeCount); Write-Output \\"Paths:$pathCount,Modes:$modeCount,Result:$result\\" } catch { Write-Output \\"Error\\" }"',
                    (err3, stdout3) => {
                      let displayConfigCount = 0;
                      if (!err3 && stdout3 && stdout3.includes("Paths:")) {
                        const match = stdout3.match(/Paths:(\d+)/);
                        if (match) {
                          displayConfigCount = parseInt(match[1]) || 0;
                          console.log(
                            `DisplayConfig API paths: ${displayConfigCount}`
                          );
                        }
                      }

                      const electronCount = displays.length;
                      let calculatedInactive = 0;

                      if (totalPnP > electronCount) {
                        calculatedInactive = totalPnP - electronCount;
                        console.log(
                          `Using PnP method: ${totalPnP} - ${electronCount} = ${calculatedInactive} inactive`
                        );
                      } else if (wmiCount > electronCount) {
                        calculatedInactive = wmiCount - electronCount;
                        console.log(
                          `Using WMI method: ${wmiCount} - ${electronCount} = ${calculatedInactive} inactive`
                        );
                      } else if (displayConfigCount > electronCount) {
                        calculatedInactive = displayConfigCount - electronCount;
                        console.log(
                          `Using DisplayConfig method: ${displayConfigCount} - ${electronCount} = ${calculatedInactive} inactive`
                        );
                      }

                      displayInfo.inactive = Math.max(0, calculatedInactive);
                      console.log(
                        `Final inactive count: ${displayInfo.inactive}`
                      );
                      console.log("=== End Inactive Display Detection ===");
                      resolve();
                    }
                  );
                }
              );
            } else {
              console.log("PnP query failed, using fallback method");
              resolve();
            }
          }
        );
      });
    } catch (err) {
      console.error("Error detecting inactive displays:", err);
    }
  } else if (process.platform === "darwin") {
    try {
      await new Promise((resolve) => {
        exec("system_profiler SPDisplaysDataType", (err, stdout) => {
          if (!err && stdout) {
            const displayEntries = (stdout.match(/Display Type:/g) || [])
              .length;
            const resolutionEntries = (stdout.match(/Resolution:/g) || [])
              .length;

            if (displayEntries > displays.length) {
              displayInfo.inactive = displayEntries - displays.length;
              console.log(
                `macOS: Found ${displayEntries} display entries, ${displays.length} active = ${displayInfo.inactive} inactive`
              );
            }
          }
          resolve();
        });
      });
    } catch (err) {
      console.error("Error detecting inactive displays on macOS:", err);
    }
  } else if (process.platform === "linux") {
    try {
      await new Promise((resolve) => {
        exec("xrandr --listmonitors && xrandr", (err, stdout) => {
          if (!err && stdout) {
            const lines = stdout.split("\n");
            const connectedCount = lines.filter((line) =>
              line.includes(" connected")
            ).length;
            const activeCount = lines.filter(
              (line) => line.includes(" connected") && line.includes("x")
            ).length;

            if (connectedCount > displays.length) {
              displayInfo.inactive = connectedCount - displays.length;
              console.log(
                `Linux: Found ${connectedCount} connected, ${displays.length} active = ${displayInfo.inactive} inactive`
              );
            }
          }
          resolve();
        });
      });
    } catch (err) {
      console.error("Error detecting inactive displays on Linux:", err);
    }
  }

  console.log("Final display info:", displayInfo);
  console.log("=== End Display Detection Debug ===");

  return displayInfo;
}

function setupDisplayMonitoring(window) {
  const handleDisplayChange = async () => {
    const displayInfo = await getDetailedDisplayInfo();
    window.webContents.send("display-configuration-changed", displayInfo);
  };

  screen.on("display-added", handleDisplayChange);
  screen.on("display-removed", handleDisplayChange);
  screen.on("display-metrics-changed", handleDisplayChange);

  return getDetailedDisplayInfo();
}

module.exports = {
  getDetailedDisplayInfo,
  setupDisplayMonitoring,
};
