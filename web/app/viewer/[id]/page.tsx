"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import MonitorInfo from "@/components/monitor-info";

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

type Payload = {
  isRefreshing?: boolean;
  refreshType?: string;
  displayChangeDetected?: boolean;
  error?: string;
  newStreamCount?: number;
};

const serverAddress =
  process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:3004";

export default function ViewerIdPage() {
  const params = useParams();
  const code = params.id as string;
  const socketRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const copiedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
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
  const [expandedStream, setExpandedStream] = useState<{
    stream: MediaStream;
    index: number;
  } | null>(null);

  useEffect(() => {
    if (!code) {
      setStatus("❌ No code provided");
      setErrorMessage(
        "Missing 6-digit code. Please go back and enter a valid code."
      );
      const redirectTimer = setTimeout(() => {
        window.location.href = "/viewer";
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
      socket = new WebSocket(serverAddress.replace(/\/$/, ""));
      socketRef.current = socket;

      socket.onopen = () => {
        if (!isMounted) return;
        setStatus("Connected to server");
        console.log("Sending registration for code:", code);
        socket!.send(
          JSON.stringify({ type: "register", code, role: "viewer" })
        );

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
          }
        }
      };
      peer.onicecandidate = (event) => {
        if (!isMounted) return;
        if (event.candidate && socketRef.current) {
          console.log("ICE candidate:", event.candidate);
          socketRef.current.send(
            JSON.stringify({
              type: "signal",
              code,
              payload: event.candidate,
            })
          );
        }
      };

      peer.onconnectionstatechange = () => {
        if (!isMounted) return;
        console.log("Connection state change:", peer!.connectionState);
        if (peer!.connectionState === "connected") {
          setStatus("Connected to client");
          setIsConnected(true);
        } else if (
          ["disconnected", "failed", "closed"].includes(peer!.connectionState)
        ) {
          setStatus(`WebRTC ${peer!.connectionState}`);
          setIsConnected(false);
        }
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
            handleDisplayConfigChange(message.payload);
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
          console.error("Error processing message:", err);
          setErrorMessage("Error parsing message");
        }
      };
    }

    function scheduleReconnect() {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        if (!isMounted) return;
        console.log("Attempting to reconnect...");
        cleanup();
        setupConnection();
      }, 5000);
    }

    setupConnection();
    return cleanup;
  }, [code, serverAddress]);
  // Format date for display - use UTC to avoid hydration errors
  const formattedRefreshDate = useMemo(() => {
    return lastRefresh.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }, [lastRefresh]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expandedStream) {
        setExpandedStream(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expandedStream]);

  // Copy session code to clipboard
  const copyCodeToClipboard = () => {
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        setIsCopied(true);
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(() => setIsCopied(false), 2000);
      });
    }
  };

  // Handle refresh streams button click
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
        // Stop all tracks before clearing
        prevStreams.forEach((stream) =>
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch (e) {
              console.error("Error stopping track:", e);
            }
          })
        );
        return [];
      });

      // Set backup timeout in case client doesn't respond
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        setIsRefreshing(false);
        setStatus("Refresh timeout - try again");
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

  const handleDisplayConfigChange = (payload: Payload) => {
    if (payload?.isRefreshing) {
      setIsRefreshing(true);

      // Set timeout for refresh operation
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        console.warn("Refresh timeout reached");
        setIsRefreshing(false);
        setStatus("Refresh timeout - please try again");
        setErrorMessage("Stream refresh took too long and was cancelled");
      }, 30000); // 30 second timeout

      if (payload.refreshType === "manual") {
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
    } else if (payload?.displayChangeDetected) {
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

      if (payload?.error) {
        setStatus(`Stream refresh failed: ${payload.error}`);
        setErrorMessage(`Refresh error: ${payload.error}`);
      } else {
        const streamCount = payload?.newStreamCount || 0;
        setStatus(`Stream refresh completed (${streamCount} streams)`);
        setErrorMessage("");
        setLastRefresh(new Date());

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
  };

  // const renderProcessesContent = () => {
  //   if (
  //     !processInfo ||
  //     !processInfo.processes ||
  //     processInfo.processes.length === 0
  //   ) {
  //     return (
  //       <div className="flex flex-col items-center justify-center h-64 text-gray-500">
  //         <svg
  //           xmlns="http://www.w3.org/2000/svg"
  //           width="48"
  //           height="48"
  //           viewBox="0 0 24 24"
  //           fill="none"
  //           stroke="currentColor"
  //           strokeWidth="1.5"
  //           strokeLinecap="round"
  //           strokeLinejoin="round"
  //           className="mb-3 opacity-50"
  //         >
  //           <path d="M18 6a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v12a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4z" />
  //           <circle cx="12" cy="10" r="3" />
  //           <path d="M12 16v6" />
  //         </svg>
  //         <p>No process information available</p>
  //         <p className="text-sm mt-2">
  //           This will appear once the connection is established
  //         </p>
  //       </div>
  //     );
  //   }

  //   return (
  //     <div className="overflow-hidden rounded-lg border border-zinc-800/30 shadow-lg">
  //       <div className="bg-zinc-900/40 px-4 py-3 flex items-center justify-between border-b border-zinc-800/30">
  //         <div className="flex items-center">
  //           <svg
  //             xmlns="http://www.w3.org/2000/svg"
  //             width="16"
  //             height="16"
  //             viewBox="0 0 24 24"
  //             fill="none"
  //             stroke="currentColor"
  //             strokeWidth="1.5"
  //             strokeLinecap="round"
  //             strokeLinejoin="round"
  //             className="mr-2 text-blue-500"
  //           >
  //             <rect x="2" y="4" width="20" height="16" rx="2" />
  //             <rect x="6" y="8" width="8" height="8" rx="1" />
  //             <path d="M18 8v8" />
  //           </svg>
  //           <span className="font-medium">Running Processes</span>
  //         </div>
  //         <div className="text-xs text-gray-400">
  //           Last updated: {formattedRefreshDate}
  //         </div>
  //       </div>
  //       <div className="overflow-auto max-h-96">
  //         <table className="w-full text-sm">
  //           <thead>
  //             {" "}
  //             <tr className="bg-zinc-950/80 text-zinc-400 text-xs uppercase">
  //               <th className="px-4 py-2 text-left font-medium">Process</th>
  //               <th className="px-4 py-2 text-left font-medium">PID</th>
  //               <th className="px-4 py-2 text-right font-medium">
  //                 Memory (MB)
  //               </th>
  //               <th className="px-4 py-2 text-right font-medium">CPU %</th>
  //               <th className="px-4 py-2 text-left font-medium">
  //                 Window Title
  //               </th>
  //             </tr>
  //           </thead>
  //           <tbody>
  //             {processInfo.processes.slice(0, 100).map((proc) => (
  //               <tr
  //                 key={`${proc.Id}-${proc.ProcessName}`}
  //                 className="border-t border-zinc-800/20 hover:bg-zinc-900/40 transition-colors"
  //               >
  //                 <td className="px-4 py-2 text-white font-mono">
  //                   {proc.ProcessName}
  //                 </td>
  //                 <td className="px-4 py-2 text-gray-400 font-mono">
  //                   {proc.Id}
  //                 </td>
  //                 <td className="px-4 py-2 text-right text-blue-400 font-mono">
  //                   {proc.Memory ? proc.Memory.toFixed(1) : "N/A"}
  //                 </td>
  //                 <td className="px-4 py-2 text-right text-green-400 font-mono">
  //                   {proc.CPU ? proc.CPU.toFixed(1) : "N/A"}
  //                 </td>
  //                 <td className="px-4 py-2 text-gray-300 font-mono truncate max-w-[300px]">
  //                   {proc.WindowTitle || ""}
  //                 </td>
  //               </tr>
  //             ))}
  //           </tbody>
  //         </table>
  //       </div>
  //     </div>
  //   );
  // };

  return (
    <main className="relative min-h-screen bg-black text-white">
      {/* Fullscreen video overlay */}
      {expandedStream && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setExpandedStream(null);
            }
          }}
        >
          <div className="relative w-full max-w-7xl h-full max-h-screen p-4 md:p-6">
            <div className="absolute top-1 right-1 z-20">
              <button
                onClick={() => setExpandedStream(null)}
                className="bg-zinc-900/90 hover:bg-black text-white/70 hover:text-white/90 p-2 rounded-lg transition-all backdrop-blur-sm border border-zinc-700/30 shadow-lg hover:shadow-blue-900/20 flex items-center justify-center"
                aria-label="Close fullscreen view"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="relative w-full h-full rounded-lg overflow-hidden shadow-2xl border border-zinc-800/40">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-transparent opacity-30 pointer-events-none"></div>
              <video
                ref={(el) => {
                  if (el) {
                    el.srcObject = expandedStream.stream;
                    el.muted = true;
                    el.play().catch((e) =>
                      console.error("Error playing fullscreen video:", e)
                    );
                  }
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain bg-black"
              />

              <div className="absolute top-0 left-0 right-14 py-3 px-4 md:px-6 bg-gradient-to-b from-black/90 to-transparent flex justify-between items-center">
                <div>
                  <h3 className="text-base md:text-lg font-medium text-white">
                    Screen {expandedStream.index + 1}{" "}
                    {expandedStream.index === 0 ? "(Primary)" : ""}
                  </h3>
                  <p className="text-xs md:text-sm text-blue-300">
                    {expandedStream.stream.getVideoTracks()[0]?.label ||
                      "Unknown Device"}
                  </p>
                </div>
                <div className="flex items-center">
                  <span className="bg-blue-900/60 px-2 md:px-3 py-1 rounded text-xs md:text-sm text-blue-100 font-medium flex items-center">
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse mr-1.5 md:mr-2"></div>
                    Live
                  </span>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 py-3 px-4 md:px-6 bg-gradient-to-t from-black/90 to-transparent">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                  <div className="text-xs md:text-sm text-zinc-300">
                    <span className="font-mono">
                      Stream ID: {expandedStream.stream.id.slice(-12)}
                    </span>
                  </div>
                  <div className="text-xs md:text-sm text-zinc-400/50 mt-1 md:mt-0">
                    Press ESC or click outside to close
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}{" "}
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-black border-b border-zinc-800/50">
        <div className="flex flex-row items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <Image
              src="/window.svg"
              alt="InterView Logo"
              width={22}
              height={22}
              className="mr-2 opacity-80"
            />
            <span className="text-zinc-400 text-sm">Monitoring Session</span>
          </div>

          <div
            className="flex items-center bg-gray-900 border border-gray-800 rounded-md px-3 py-1.5 mr-4 cursor-pointer"
            onClick={copyCodeToClipboard}
          >
            <span className="font-mono text-blue-400 text-sm mr-2">
              {code || "------"}
            </span>
            <div
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center"
              title="Copy code"
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
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
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
                </>
              )}
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-amber-500"
              }`}
            ></div>
            <span className="text-xs text-gray-400">{status}</span>
          </div>
        </div>{" "}
        {/* Tabs positioned below header */}
        <div className="absolute top-[52px] left-0 right-0 px-4 py-1.5 border-b border-zinc-900/80 bg-black z-10">
          <div className="flex items-center justify-between">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab("screens")}
                className={`px-3 py-1.5 text-xs md:text-sm transition-colors rounded-md flex items-center ${
                  activeTab === "screens"
                    ? "bg-blue-900/30 text-blue-200 border border-blue-900/30"
                    : "text-gray-400 hover:text-gray-300 hover:bg-zinc-900/50"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1.5"
                >
                  <rect width="18" height="14" x="3" y="3" rx="2" />
                  <line x1="8" x2="16" y1="21" y2="21" />
                  <line x1="12" x2="12" y1="17" y2="21" />
                </svg>
                Screens
              </button>
              <button
                onClick={() => setActiveTab("processes")}
                className={`px-3 py-1.5 text-xs md:text-sm transition-colors rounded-md flex items-center ${
                  activeTab === "processes"
                    ? "bg-blue-900/30 text-blue-200 border border-blue-900/30"
                    : "text-gray-400 hover:text-gray-300 hover:bg-zinc-900/50"
                }`}
              >
                Processes
              </button>{" "}
            </div>
            <div className="ml-auto flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                className={`px-3 py-1.5 rounded-md transition-colors bg-blue-900/40 hover:bg-blue-800/40 border border-blue-800/40 flex items-center ${
                  isRefreshing ? "cursor-not-allowed opacity-50" : ""
                }`}
                disabled={isRefreshing || !isConnected}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`mr-1.5 ${
                    isRefreshing
                      ? "animate-spin text-blue-300"
                      : "text-blue-300"
                  }`}
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
                <span className="text-xs text-blue-300 font-medium">
                  Refresh
                </span>
              </button>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 rounded-md bg-red-900/20 hover:bg-red-800/20 border border-red-900/20 text-red-400 hover:text-red-300 transition-colors flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1.5"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
                <span className="text-xs font-medium">Disconnect</span>
              </button>{" "}
            </div>
          </div>
        </div>
        {/* Content Area */}
        <div className="pt-[85px] h-[calc(100vh-85px)] flex flex-col md:flex-row overflow-hidden">
          {/* Error message overlay */}
          {errorMessage && (
            <div className="absolute top-[85px] left-4 right-4 z-10 bg-red-900/20 border border-red-900/40 rounded-lg text-red-400 text-sm p-4">
              <div className="flex items-start">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-3 mt-0.5 flex-shrink-0"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <div>
                  <p className="font-medium">{errorMessage}</p>
                  <p className="text-xs mt-1 text-red-400/70">
                    {errorMessage.includes("No code provided")
                      ? "Redirecting to viewer page..."
                      : "Check the connection or try refreshing"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mobile Monitor Summary (Only visible on mobile) */}
          <div className="w-full md:hidden px-2 py-2 mb-1">
            {monitorInfo && (
              <div className="bg-zinc-950/70 border border-zinc-800/40 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-zinc-200 font-medium text-xs">
                    MONITOR SUMMARY
                  </h3>
                  <div className="flex items-center space-x-2">
                    <span className="bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded-full text-xs flex items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse mr-1.5"></div>
                      Live
                    </span>
                    <button
                      onClick={() =>
                        setActiveTab(
                          activeTab === "screens" ? "processes" : "screens"
                        )
                      }
                      className="text-zinc-400 hover:text-white text-xs bg-zinc-800/50 hover:bg-zinc-700/50 py-1 px-2 rounded border border-zinc-700/30 flex items-center"
                    >
                      {activeTab === "screens" ? "Processes" : "Screens"}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="bg-zinc-900/20 rounded p-1.5 text-center">
                    <div className="text-xs text-zinc-400">Total</div>{" "}
                    <div className="text-base font-medium text-blue-400">
                      {monitorInfo?.total}
                    </div>
                  </div>
                  <div className="bg-zinc-900/20 rounded p-1.5 text-center">
                    <div className="text-xs text-zinc-400">Active</div>
                    <div className="text-base font-medium text-green-400">
                      {monitorInfo?.active}
                    </div>
                  </div>
                  <div className="bg-zinc-900/20 rounded p-1.5 text-center">
                    <div className="text-xs text-zinc-400">Primary</div>
                    <div className="text-base font-medium text-purple-400">
                      {monitorInfo?.primary !== null ? "1" : "0"}
                    </div>
                  </div>
                  <div className="bg-zinc-900/20 rounded p-1.5 text-center">
                    <div className="text-xs text-zinc-400">External</div>
                    <div className="text-base font-medium text-cyan-400">
                      {monitorInfo?.external}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Left Sidebar for Monitor Info (Desktop) */}
          <div className="hidden md:block md:w-72 shrink-0 overflow-y-auto border-r border-zinc-800/30">
            <div className="h-full">
              <MonitorInfo
                monitorInfo={monitorInfo}
                processInfo={processInfo}
                formattedRefreshDate={formattedRefreshDate}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-grow overflow-y-auto px-2 pb-4 md:px-4">
            {activeTab === "screens" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 pb-6">
                {streams.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center h-64 text-gray-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="48"
                      height="48"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mb-3 opacity-50"
                    >
                      <rect
                        x="2"
                        y="3"
                        width="20"
                        height="14"
                        rx="2"
                        ry="2"
                      ></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    <p className="text-lg">No active screens</p>
                    <p className="text-sm mt-2 text-gray-600">
                      {isConnected
                        ? "Try refreshing to request screen access"
                        : "Waiting for connection..."}
                    </p>
                  </div>
                )}

                {streams.map((stream, index) => (
                  <div
                    key={stream.id}
                    className="relative group bg-zinc-950 border border-zinc-800/40 rounded-lg overflow-hidden shadow-lg transition-all hover:shadow-blue-900/20 hover:border-blue-700/30 cursor-pointer flex flex-col"
                    onClick={() => setExpandedStream({ stream, index })}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-900/5 to-transparent pointer-events-none"></div>
                    <div className="px-3 py-2 flex justify-between items-center bg-black/40 border-b border-zinc-800/30">
                      <div className="text-sm font-medium text-white/90 flex items-center truncate">
                        <span
                          className={`w-2 h-2 flex-shrink-0 rounded-full ${
                            index === 0 ? "bg-purple-400" : "bg-blue-400"
                          } mr-2`}
                        ></span>
                        <span className="truncate">
                          Screen {index + 1}
                          {index === 0 ? " (Primary)" : ""}
                        </span>
                      </div>
                      <div className="flex-shrink-0 flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedStream({ stream, index });
                          }}
                          className="p-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors hover:bg-blue-900/20 rounded"
                          title="View fullscreen"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <polyline points="9 21 3 21 3 15"></polyline>
                            <line x1="21" y1="3" x2="14" y2="10"></line>
                            <line x1="3" y1="21" x2="10" y2="14"></line>
                          </svg>
                        </button>
                      </div>
                    </div>{" "}
                    <div className="relative aspect-video bg-black/50 flex-grow">
                      <video
                        ref={(el) => {
                          videoRefs.current[stream.id] = el;
                          if (el) {
                            el.srcObject = stream;
                            el.muted = true;
                            el.play().catch((e) =>
                              console.error("Error playing video:", e)
                            );
                          }
                        }}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute bottom-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/60 text-blue-400 text-xs py-1 px-2 rounded backdrop-blur-sm border border-zinc-800/30">
                          <span className="font-mono tracking-tighter">
                            {stream.id.slice(-6)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-zinc-950/60 border border-zinc-800/40 rounded-lg p-2 md:p-4 shadow-lg mb-4">
                {processInfo?.processes.filter((p) => p.WindowTitle).length ===
                0 ? (
                  <div className="text-gray-500 text-center py-10">
                    <p className="text-lg">No active window processes</p>
                    <p className="text-sm mt-2">
                      No processes with window titles were found
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800/40">
                          <th className="px-2 md:px-3 py-3 font-medium">
                            Process
                          </th>
                          <th className="px-2 md:px-3 py-3 font-medium">
                            Window Title
                          </th>
                          <th className="px-2 md:px-3 py-3 font-medium text-right">
                            Memory
                          </th>
                          <th className="px-2 md:px-3 py-3 font-medium text-right">
                            CPU
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/20">
                        {processInfo?.processes
                          .filter((p) => p.WindowTitle)
                          .slice(0, 50)
                          .map((process) => (
                            <tr
                              key={process.Id}
                              className="hover:bg-zinc-900/30"
                            >
                              <td className="px-2 md:px-3 py-2.5 text-sm text-blue-400">
                                {process.ProcessName}
                              </td>
                              <td className="px-2 md:px-3 py-2.5 text-sm text-zinc-300 max-w-xs truncate">
                                {process.WindowTitle}
                              </td>
                              <td className="px-2 md:px-3 py-2.5 text-sm text-zinc-400 text-right whitespace-nowrap">
                                {process.Memory
                                  ? `${Math.round(process.Memory / 1024)} MB`
                                  : "-"}
                              </td>
                              <td className="px-2 md:px-3 py-2.5 text-sm text-zinc-400 text-right whitespace-nowrap">
                                {process.CPU
                                  ? `${process.CPU.toFixed(1)}%`
                                  : "-"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Close the header/tabs/content area wrapper */}
      </div>
    </main>
  );
}
