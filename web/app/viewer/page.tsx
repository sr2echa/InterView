"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ProcessInfo = {
  timestamp: number;
  processes: Array<{
    Id: number;
    ProcessName: string;
    WindowTitle?: string;
    Memory?: number;
    CPU?: number;
  }>;
};

type MonitorInfo = {
  total: number;
  primary: number | null;
  external: number;
  internal: number;
  active: number;
  inactive: number;
  timestamp: number;
  pnpInfo?: {
    totalWithInactive: number;
    lastUpdated: string;
  };
  displays: Array<{
    id: number;
    bounds: {
      width: number;
      height: number;
      x: number;
      y: number;
    };
    workArea?: {
      width: number;
      height: number;
      x: number;
      y: number;
    };
    scaleFactor: number;
    rotation?: number;
    internal: boolean;
    isPrimary: boolean;
    size: string;
    colorDepth: number;
    colorSpace: string;
  }>;
};

export default function ViewerPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const socketRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const copiedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [serverAddress, setServerAddress] = useState("ws://localhost:3004");
  // State
  const [status, setStatus] = useState("Initializing...");
  const [streams, setStreams] = useState<MediaStream[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [monitorInfo, setMonitorInfo] = useState<MonitorInfo | null>(null);
  const [processInfo, setProcessInfo] = useState<ProcessInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"screens" | "processes">(
    "screens"
  );
  const [isCopied, setIsCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!code) {
      setStatus("❌ No code provided");
      setErrorMessage(
        "Missing 6-digit code. Please go back and enter a valid code."
      );
      const redirectTimer = setTimeout(() => {
        window.location.href = "/";
      }, 3000);
      return () => clearTimeout(redirectTimer);
    }

    let isMounted = true;
    let peer: RTCPeerConnection | null = null;
    let socket: WebSocket | null = null;
    function cleanup() {
      isMounted = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      if (peerRef.current) peerRef.current.close();
      if (socketRef.current) socketRef.current.close();
      setStreams((prev) => {
        prev.forEach((stream) =>
          stream.getTracks().forEach((track) => track.stop())
        );
        return [];
      });
      setIsRefreshing(false);
    }

    function setupConnection() {
      setStatus("Connecting to signaling server...");
      socket = new WebSocket(serverAddress);
      // Ensure trailing slash removal
      socket = new WebSocket(serverAddress.replace(/\/$/, ""));
      socketRef.current = socket;

      socket.onopen = () => {
        if (!isMounted) return;
        setStatus("Connected to server");
        console.log("Sending registration for code:", code);
        socket!.send(
          JSON.stringify({ type: "register", code, role: "viewer" })
        );
        // Wait a bit before sending connect to ensure registration is processed
        setTimeout(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            console.log("Sending connect request for code:", code);
            socket.send(JSON.stringify({ type: "connect", code }));
          }
        }, 500);
      };

      socket.onerror = (error) => {
        if (!isMounted) return;
        console.error("WebSocket error:", error);
        setStatus("Connection error");
        setIsConnected(false);
        scheduleReconnect();
      };

      socket.onclose = (event) => {
        if (!isMounted) return;
        console.log("WebSocket closed with code:", event.code);
        setStatus("Disconnected from server");
        setIsConnected(false);
        scheduleReconnect();
      };
      peer = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });
      peerRef.current = peer;
      peer.ontrack = (event) => {
        if (!isMounted) return;
        console.log("Received track event:", event);
        setStatus("Track received");
        setIsConnected(true);

        if (event.streams && event.streams.length > 0) {
          const newStream = event.streams[0];
          console.log(
            `Received stream with ID: ${newStream.id}, tracks: ${
              newStream.getTracks().length
            }`
          );

          // Only add new stream if it has active video tracks
          if (newStream.getVideoTracks().length > 0) {
            const videoTrack = newStream.getVideoTracks()[0];

            // Add event listener to handle ended tracks
            videoTrack.onended = () => {
              console.log(`Track ended for stream ${newStream.id}`);
              // Remove the stream when its track ends
              setStreams((prevStreams) =>
                prevStreams.filter((s) => s.id !== newStream.id)
              );
            };

            setStreams((prev) => {
              // Check if this stream ID already exists
              const existingStreamIndex = prev.findIndex(
                (stream) => stream.id === newStream.id
              );

              if (existingStreamIndex >= 0) {
                // Replace the existing stream
                const updatedStreams = [...prev];

                // Stop tracks on the old stream
                updatedStreams[existingStreamIndex]
                  .getTracks()
                  .forEach((track) => {
                    try {
                      track.stop();
                    } catch (err) {
                      console.warn("Error stopping old track:", err);
                    }
                  });

                // Replace with new stream
                updatedStreams[existingStreamIndex] = newStream;
                console.log(
                  `Replaced existing stream at index ${existingStreamIndex}`
                );
                return updatedStreams;
              } else {
                // Add as a new stream only if we don't already have too many
                const maxExpectedStreams = 10; // Reasonable limit

                // Check for stale streams with inactive tracks and remove them
                const filteredStreams = prev.filter((stream) => {
                  const hasActiveVideoTracks = stream
                    .getVideoTracks()
                    .some((track) => track.readyState === "live");

                  if (!hasActiveVideoTracks) {
                    console.log(
                      `Removing stale stream ${stream.id} with inactive tracks`
                    );
                    stream.getTracks().forEach((track) => track.stop());
                    return false;
                  }
                  return true;
                });

                if (filteredStreams.length < maxExpectedStreams) {
                  console.log(
                    `Adding new stream, total will be: ${
                      filteredStreams.length + 1
                    }`
                  );
                  return [...filteredStreams, newStream];
                } else {
                  console.warn(
                    `Stream limit reached (${maxExpectedStreams}), ignoring new stream`
                  );
                  // Stop the new stream since we're not using it
                  newStream.getTracks().forEach((track) => track.stop());
                  return filteredStreams;
                }
              }
            });
          } else {
            console.warn("Ignoring stream with no video tracks");
            // Stop the stream since it's not useful
            newStream.getTracks().forEach((track) => track.stop());
          }
        }
      };

      peer.onicecandidate = (event) => {
        if (!isMounted) return;
        if (event.candidate && socketRef.current) {
          socketRef.current.send(
            JSON.stringify({ type: "signal", code, payload: event.candidate })
          );
        }
      };

      peer.onconnectionstatechange = () => {
        if (!isMounted) return;
        setStatus(`Connection: ${peer!.connectionState}`);
        setIsConnected(peer!.connectionState === "connected");
      };
      socket.onmessage = async (event) => {
        if (!isMounted) return;
        try {
          const message = JSON.parse(event.data);
          console.log("WebSocket message received:", message);

          if (message.type === "viewerCount") {
            setStatus(`Connected with ${message.payload.count} viewer(s)`);
          } else if (message.type === "clientConnected") {
            setStatus("Client connected - requesting connection");
            socket!.send(JSON.stringify({ type: "connect", code }));
          } else if (message.type === "signal") {
            const payload = message.payload;
            if (payload.type === "offer") {
              await peer!.setRemoteDescription(
                new RTCSessionDescription(payload)
              );
              const answer = await peer!.createAnswer();
              await peer!.setLocalDescription(answer);
              socket!.send(
                JSON.stringify({
                  type: "signal",
                  code,
                  payload: peer!.localDescription,
                })
              );
              setStatus("Sent answer");
            } else if (payload.candidate) {
              await peer!.addIceCandidate(new RTCIceCandidate(payload));
            }
          } else if (message.type === "monitorInfo") {
            console.log("Monitor info received:", message.payload);
            // Ensure we update with the latest monitor info
            setMonitorInfo((prevInfo) => {
              const newInfo = message.payload;
              // Log the change for debugging purposes
              if (prevInfo) {
                console.log(
                  `Monitor info update: Total displays changed from ${prevInfo.total} to ${newInfo.total}`
                );
                console.log(
                  `Inactive displays changed from ${
                    prevInfo.inactive || 0
                  } to ${newInfo.inactive || 0}`
                );
              }
              return newInfo;
            });
            setErrorMessage("");
          } else if (message.type === "processInfo") {
            console.log("Process info received:", message.payload);
            setProcessInfo(message.payload);
            setErrorMessage("");
          } else if (message.type === "displayConfigChanged") {
            console.log("Display config changed:", message.payload);

            if (message.payload?.isRefreshing) {
              setIsRefreshing(true);

              // Set timeout for refresh operation
              if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
              }
              refreshTimeoutRef.current = setTimeout(() => {
                console.warn("Refresh timeout reached");
                setIsRefreshing(false);
                setStatus("Refresh timeout - please try again");
                setErrorMessage(
                  "Stream refresh took too long and was cancelled"
                );
              }, 30000); // 30 second timeout

              if (message.payload.refreshType === "manual") {
                setStatus("Refreshing streams...");
              } else {
                setStatus("Display configuration changed - refreshing...");
              }

              // Clear existing streams when refresh starts to avoid ghost screens
              setStreams((prevStreams) => {
                console.log(
                  `Clearing ${prevStreams.length} existing streams for refresh`
                );
                prevStreams.forEach((stream) => {
                  try {
                    stream.getTracks().forEach((track) => {
                      // Add an event to ensure tracks are properly marked as ended
                      track.dispatchEvent(new Event("ended"));
                      track.stop();
                    });
                  } catch (err) {
                    console.warn("Error stopping tracks during cleanup:", err);
                  }
                });
                return [];
              });
            } else if (message.payload?.displayChangeDetected) {
              // This is just a notification that displays changed, but refresh hasn't started yet
              setStatus("Display configuration changing...");
            } else {
              // Refresh completed
              setIsRefreshing(false);

              // Clear refresh timeout
              if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
                refreshTimeoutRef.current = null;
              }

              if (message.payload?.error) {
                setStatus(`Stream refresh failed: ${message.payload.error}`);
                setErrorMessage(`Refresh error: ${message.payload.error}`);
              } else {
                const streamCount = message.payload?.newStreamCount || 0;
                setStatus(`Stream refresh completed (${streamCount} streams)`);
                setErrorMessage(""); // Clear any previous errors
                setLastRefresh(new Date());

                // Clean up any stale streams after a short delay
                // This helps catch any ghost screens that weren't properly removed
                setTimeout(() => {
                  setStreams((prevStreams) => {
                    // Filter out streams with inactive tracks
                    const validStreams = prevStreams.filter((stream) => {
                      const hasActiveVideoTracks = stream
                        .getVideoTracks()
                        .some((track) => track.readyState === "live");

                      if (!hasActiveVideoTracks) {
                        console.log(
                          `Removing ghost stream ${stream.id} with inactive tracks`
                        );
                        stream.getTracks().forEach((track) => track.stop());
                        return false;
                      }
                      return true;
                    });

                    if (validStreams.length < prevStreams.length) {
                      console.log(
                        `Removed ${
                          prevStreams.length - validStreams.length
                        } ghost streams`
                      );
                    }

                    return validStreams;
                  });
                }, 2000);
              }
            }
          } else if (message.type === "clientDisconnected") {
            setStatus("Client disconnected");
            setErrorMessage(
              "The client has disconnected. Waiting for reconnection..."
            );
          } else if (message.type === "adminCommandResponse") {
            if (message.payload?.command === "disconnect") {
              setStatus("Client disconnected by request");
              setErrorMessage(
                message.payload.success
                  ? "Client has been successfully disconnected."
                  : "Failed to disconnect the client."
              );
            }
          }
        } catch (err) {
          setErrorMessage("Error parsing message");
        }
      };
    }

    function scheduleReconnect() {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        if (isMounted) setupConnection();
      }, 5000);
    }

    setupConnection();
    return cleanup;
  }, [code]);
  // Format date for display - use UTC to avoid hydration errors
  const formattedRefreshDate = React.useMemo(() => {
    return lastRefresh.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }, [lastRefresh]);

  // Copy session code to clipboard
  const copyCodeToClipboard = () => {
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        setIsCopied(true);
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(() => setIsCopied(false), 2000);
      });
    }
  }; // Handle refresh streams button click
  const handleRefresh = () => {
    if (
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN &&
      code &&
      !isRefreshing
    ) {
      // Disable refresh button temporarily to prevent multiple requests
      setIsRefreshing(true);
      setStatus("Requesting stream refresh...");

      socketRef.current.send(
        JSON.stringify({
          type: "adminCommand",
          code,
          payload: { command: "forceRefreshStreams", timestamp: Date.now() },
        })
      );

      // Clear existing streams immediately to prevent duplicates
      setStreams((prevStreams) => {
        console.log(
          `Preemptively clearing ${prevStreams.length} streams for refresh`
        );
        prevStreams.forEach((stream) =>
          stream.getTracks().forEach((track) => track.stop())
        );
        return [];
      });

      // Set backup timeout in case client doesn't respond
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        console.warn("Manual refresh timeout reached");
        setIsRefreshing(false);
        setStatus("Refresh request timeout - please try again");
      }, 30000);
    }
  };

  // Handle disconnect client button click
  const handleDisconnect = () => {
    if (
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN &&
      code
    ) {
      socketRef.current.send(
        JSON.stringify({
          type: "adminCommand",
          code,
          payload: { command: "disconnect", timestamp: Date.now() },
        })
      );
      setStatus("Disconnecting client...");
    }
  };
  const renderProcessesContent = () => {
    if (
      !processInfo ||
      !processInfo.processes ||
      processInfo.processes.length === 0
    ) {
      return (
        <div className="p-6 text-center">
          <p className="text-gray-400">No process information available</p>
        </div>
      );
    }
    return (
      <div className="overflow-hidden rounded-lg border border-gray-800/20">
        <div className="grid grid-cols-12 gap-2 p-3 border-b border-gray-800/50 text-xs text-gray-500 font-medium bg-[#0a0a0a]">
          <div className="col-span-1">PID</div>
          <div className="col-span-3">Process</div>
          <div className="col-span-6">Window Title</div>
          <div className="col-span-2 text-right">Memory</div>
        </div>
        <div className="overflow-y-auto max-h-[calc(100vh-10rem)] bg-black scrollbar-dark">
          {processInfo.processes.map((process) => (
            <div
              key={process.Id}
              className="grid grid-cols-12 gap-2 p-2.5 border-b border-gray-900/50 text-sm hover:bg-[#0a0a0a] transition-colors"
            >
              <div className="col-span-1 font-mono text-gray-500 text-xs">
                {process.Id}
              </div>
              <div className="col-span-3 truncate font-medium text-gray-300">
                {process.ProcessName}
              </div>
              <div className="col-span-6 truncate text-gray-400">
                {process.WindowTitle || "—"}
              </div>
              <div className="col-span-2 text-right text-gray-500 text-xs">
                {typeof process.Memory === "number"
                  ? `${process.Memory} MB`
                  : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col p-2 sm:p-8 font-sans">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-black z-10 px-3 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800/30 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              InterView{" "}
              <span className="text-base font-normal opacity-70">/ Viewer</span>
            </h1>
            <p className="text-sm text-gray-400">Session Code: {code}</p>
          </div>
          <div className="flex items-center sm:hidden">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            ></div>
            <span className="text-sm">{status}</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 sm:mt-0">
          <div className="hidden sm:flex items-center mr-4">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            ></div>
            <span className="text-sm">{status}</span>
          </div>{" "}
          <div className="flex space-x-2">
            <Button
              onClick={() => setActiveTab("screens")}
              variant={activeTab === "screens" ? "default" : "outline"}
              className={
                activeTab === "screens"
                  ? "text-xs sm:text-sm bg-blue-900/80 hover:bg-blue-800"
                  : "text-xs sm:text-sm bg-transparent text-gray-400 hover:text-white border-gray-800"
              }
              size="sm"
            >
              Screens
            </Button>
            <Button
              onClick={() => setActiveTab("processes")}
              variant={activeTab === "processes" ? "default" : "outline"}
              className={
                activeTab === "processes"
                  ? "text-xs sm:text-sm bg-blue-900/80 hover:bg-blue-800"
                  : "text-xs sm:text-sm bg-transparent text-gray-400 hover:text-white border-gray-800"
              }
              size="sm"
            >
              Processes
            </Button>
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="mt-28 sm:mt-24 mb-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main info panel */}{" "}
        <div className="lg:col-span-3">
          <Card className="bg-black border-gray-800/50 text-white p-4 space-y-4 shadow-xl rounded-xl">
            <div className="space-y-2">
              <h2 className="text-lg font-medium">Session Information</h2>
              {/* Session Code */}{" "}
              <div className="bg-[#0a0a0a] border border-gray-900 rounded p-2">
                <div className="text-gray-400 text-xs mb-1 flex justify-between items-center">
                  <span>Session Code</span>
                  <button
                    onClick={copyCodeToClipboard}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                  >
                    {isCopied ? (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-1"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mr-1"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          ></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="font-mono text-lg text-blue-400">{code}</div>
              </div>
              {/* Connection Status */}{" "}
              <div className="bg-[#0a0a0a] border border-gray-900 rounded p-2">
                <div className="text-gray-400 text-xs mb-1">
                  Connection Status
                </div>
                <div className="flex items-center">
                  <div
                    className={`w-2 h-2 rounded-full mr-2 ${
                      isConnected ? "bg-green-500" : "bg-red-500"
                    }`}
                  ></div>
                  <span>{isConnected ? "Connected" : "Disconnected"}</span>
                </div>
              </div>{" "}
              {/* Monitor stats */}
              {monitorInfo && (
                <div>
                  {" "}
                  <div className="bg-[#0a0a0a] border border-gray-900 rounded p-2 mb-2">
                    <div className="text-gray-400 text-xs mb-1">
                      Display Detection
                    </div>{" "}
                    <div className="flex justify-between">
                      <div>
                        <div className="text-sm font-medium">
                          Total Displays
                        </div>
                        <div className="text-xl font-semibold">
                          {" "}
                          {monitorInfo.total + (monitorInfo.inactive || 0)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          Active Displays
                        </div>
                        <div className="text-xl font-semibold">
                          {monitorInfo.active}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-[#0a0a0a] border border-gray-900 rounded p-2">
                      <div className="text-gray-400 text-xs mb-1">
                        Internal Monitors
                      </div>
                      <div className="text-lg font-medium">
                        {monitorInfo.internal}
                      </div>
                    </div>
                    <div className="bg-[#0a0a0a] border border-gray-900 rounded p-2">
                      <div className="text-gray-400 text-xs mb-1">
                        External Monitors
                      </div>
                      <div className="text-lg font-medium">
                        {monitorInfo.external}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-[#0a0a0a] border border-gray-900 rounded p-2">
                      <div className="text-gray-400 text-xs mb-1">
                        Active Monitors
                      </div>
                      <div className="text-lg font-medium">
                        {monitorInfo.active}
                      </div>
                    </div>
                    <div className="bg-[#0a0a0a] border border-gray-900 rounded p-2">
                      <div className="text-gray-400 text-xs mb-1">
                        Inactive Monitors
                      </div>
                      <div className="text-lg font-medium">
                        {monitorInfo.inactive}
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#0a0a0a] border border-gray-900 rounded p-2 mb-2">
                    <div className="text-gray-400 text-xs mb-1">
                      Last Update
                    </div>
                    <div className="text-xs text-gray-500">
                      {formattedRefreshDate}
                    </div>
                  </div>
                </div>
              )}{" "}
              {/* Process info */}
              {processInfo && (
                <div className="bg-[#0a0a0a] border border-gray-900 rounded p-2">
                  <div className="text-gray-400 text-xs mb-1">
                    Running Processes
                  </div>
                  <div className="text-lg font-medium">
                    {processInfo.processes.length}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Updated:{" "}
                    {new Date(processInfo.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              )}{" "}
              {/* Last refresh info */}
              <div className="text-xs text-gray-500 mt-4 text-center">
                Last refresh: {formattedRefreshDate}
              </div>
              {/* Controls */}{" "}
              <div className="pt-2 space-y-2">
                {" "}
                <Button
                  onClick={handleRefresh}
                  disabled={!isConnected || isRefreshing}
                  className="w-full bg-blue-950 hover:bg-blue-900 border border-blue-800/30 text-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRefreshing ? "Refreshing..." : "Refresh Streams"}
                </Button>
                <Button
                  onClick={handleDisconnect}
                  disabled={!isConnected}
                  variant="outline"
                  className="w-full border-red-950 bg-transparent text-red-400 hover:bg-red-950/30"
                >
                  Disconnect Client
                </Button>
              </div>{" "}
              {/* Error message */}
              {errorMessage && (
                <div className="bg-red-950/30 border border-red-950 rounded-md text-red-400 p-2 text-sm font-semibold shadow">
                  {errorMessage}
                </div>
              )}
            </div>
          </Card>
        </div>
        {/* Main content area */}
        <div className="lg:col-span-9">
          {" "}
          {activeTab === "screens" ? (
            <div>
              {" "}
              {streams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {streams.map((stream, index) => {
                    const videoTrack = stream.getVideoTracks()[0];
                    const hasVideoTrack = !!videoTrack;
                    const streamId = stream.id || `stream-${index}`;

                    // Get display label based on track label
                    let displayLabel = hasVideoTrack
                      ? videoTrack.label
                      : "Unknown Screen";

                    // Determine if this is likely a primary display
                    const isPrimary =
                      index === 0 ||
                      (videoTrack &&
                        videoTrack.label &&
                        (videoTrack.label.toLowerCase().includes("primary") ||
                          videoTrack.label.toLowerCase().includes("screen 1")));

                    // Extract display number if present in the label
                    let displayNumber = "";
                    if (videoTrack && videoTrack.label) {
                      const match = videoTrack.label.match(/screen\s+(\d+)/i);
                      displayNumber = match ? match[1] : "";
                    }

                    return (
                      <Card
                        key={streamId}
                        className="bg-black border-gray-800/50 overflow-hidden shadow-lg rounded-xl"
                      >
                        <div className="aspect-video bg-[#050505] relative rounded-lg border border-gray-900/50 overflow-hidden">
                          <video
                            ref={(el) => {
                              if (el) {
                                videoRefs.current[streamId] = el;

                                // Check if stream is still valid before setting
                                if (
                                  stream.active &&
                                  stream
                                    .getVideoTracks()
                                    .some((t) => t.readyState === "live")
                                ) {
                                  // Set srcObject when ref is created
                                  if (el.srcObject !== stream) {
                                    el.srcObject = stream;

                                    // Create a cleanup function when the video is removed
                                    stream.getVideoTracks().forEach((track) => {
                                      track.addEventListener("ended", () => {
                                        console.log(
                                          `Track ended for video ${streamId}`
                                        );
                                        // Ensure we clean up the video source
                                        if (videoRefs.current[streamId]) {
                                          videoRefs.current[
                                            streamId
                                          ]!.srcObject = null;
                                        }
                                      });
                                    });

                                    // Try playing immediately
                                    el.play().catch((err) => {
                                      console.error(
                                        "Error playing video:",
                                        err
                                      );
                                    });
                                  }
                                } else {
                                  console.warn(
                                    `Attempt to use inactive stream for video ${streamId}`
                                  );
                                  if (el.srcObject) {
                                    el.srcObject = null;
                                  }
                                }
                              } else if (videoRefs.current[streamId]) {
                                // Clean up when element is removed
                                console.log(
                                  `Video element removed for ${streamId}`
                                );
                                const oldRef = videoRefs.current[streamId];
                                if (oldRef && oldRef.srcObject) {
                                  oldRef.srcObject = null;
                                }
                                delete videoRefs.current[streamId];
                              }
                            }}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute top-0 left-0 right-0 px-3 py-1.5 bg-gradient-to-b from-black/80 to-transparent text-xs text-blue-100 font-medium flex justify-between items-center">
                            <span>
                              {isPrimary
                                ? `Screen ${
                                    displayNumber || index + 1
                                  } (Primary)`
                                : `Screen ${displayNumber || index + 1}`}
                            </span>
                            <span
                              className={`${
                                hasVideoTrack
                                  ? "bg-blue-900/60"
                                  : "bg-amber-800/60"
                              } px-2 py-0.5 rounded text-xs`}
                            >
                              {hasVideoTrack ? "Live" : "Connecting..."}
                            </span>
                          </div>

                          {/* Find matching display info if available */}
                          {monitorInfo && monitorInfo.displays && (
                            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
                              {monitorInfo.displays.map((display) => {
                                // Try to match the track to a display
                                const matchesDisplay =
                                  videoTrack &&
                                  (videoTrack.label.includes(
                                    `screen:${display.id}`
                                  ) ||
                                    videoTrack.label.includes(
                                      `${display.size}`
                                    ));

                                if (matchesDisplay) {
                                  return (
                                    <div
                                      key={display.id}
                                      className="flex flex-col text-xs"
                                    >
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">
                                          Resolution:
                                        </span>
                                        <span className="text-gray-200">
                                          {display.size}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">
                                          Scale:
                                        </span>
                                        <span className="text-gray-200">
                                          {display.scaleFactor}x
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-400">
                                          Type:
                                        </span>
                                        <span
                                          className={`${
                                            display.internal
                                              ? "text-amber-400"
                                              : "text-blue-400"
                                          }`}
                                        >
                                          {display.internal
                                            ? "Internal"
                                            : "External"}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="bg-black border-gray-800/50 p-12 flex items-center justify-center text-center shadow-lg rounded-xl">
                  <div>
                    <p className="text-gray-400 mb-4 text-lg font-medium">
                      No streams available
                    </p>
                    <p className="text-sm text-gray-500">
                      {isConnected
                        ? "Waiting for the client to share their screens..."
                        : "Connect to the client first"}
                    </p>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <Card className="bg-black border-gray-800/50 p-6 shadow-lg rounded-xl">
              <h2 className="text-lg font-semibold mb-4">Running Processes</h2>
              {renderProcessesContent()}
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
