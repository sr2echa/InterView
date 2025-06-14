"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type MonitorInfo = {
  totalMonitors: number;
  externalMonitors: number;
  displays: Array<{
    id: number;
    internal: boolean;
    bounds: {
      width: number;
      height: number;
      x: number;
      y: number;
    };
    scaleFactor: number;
  }>;
};

export default function ViewerPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const socketRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [status, setStatus] = useState("Initializing...");
  const [streams, setStreams] = useState<MediaStream[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [monitorInfo, setMonitorInfo] = useState<MonitorInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Refs for video elements
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Setup WebRTC and WebSocket connections
  useEffect(() => {
    if (!code) {
      setStatus("❌ No code provided");
      setErrorMessage(
        "Missing 6-digit code. Please go back and enter a valid code."
      );
      return;
    }

    let isMounted = true;
    setupConnection();

    function setupConnection() {
      setStatus("Connecting to signaling server...");

      try {
        // Create WebSocket connection to signaling server
        const socket = new WebSocket("ws://localhost:3001");
        socketRef.current = socket;

        socket.onopen = () => {
          if (!isMounted) return;
          console.log("WebSocket connected");
          setStatus("Connected to server");

          // Register with the server as a viewer and request to connect to client
          socket.send(
            JSON.stringify({ type: "register", code, role: "viewer" })
          );
          socket.send(JSON.stringify({ type: "connect", code }));
        };

        socket.onerror = () => {
          if (!isMounted) return;
          console.error("WebSocket error");
          setStatus("Connection error");
          setIsConnected(false);
          scheduleReconnect();
        };

        socket.onclose = () => {
          if (!isMounted) return;
          console.log("WebSocket closed");
          setStatus("Disconnected from server");
          setIsConnected(false);
          scheduleReconnect();
        };

        // Create new RTCPeerConnection with STUN servers
        const peer = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
          iceCandidatePoolSize: 10,
        });
        peerRef.current = peer;

        // When ice connection state changes
        peer.oniceconnectionstatechange = () => {
          if (!isMounted) return;
          console.log("ICE state:", peer.iceConnectionState);

          if (
            peer.iceConnectionState === "connected" ||
            peer.iceConnectionState === "completed"
          ) {
            setIsConnected(true);
            setStatus("Connected to client");
          } else if (
            peer.iceConnectionState === "failed" ||
            peer.iceConnectionState === "disconnected" ||
            peer.iceConnectionState === "closed"
          ) {
            setIsConnected(false);
            setStatus(`Connection ${peer.iceConnectionState}`);
          }
        };

        // When connection state changes
        peer.onconnectionstatechange = () => {
          if (!isMounted) return;
          console.log("Connection state:", peer.connectionState);

          if (peer.connectionState === "connected") {
            setStatus("Stream active");
          } else if (
            peer.connectionState === "failed" ||
            peer.connectionState === "disconnected" ||
            peer.connectionState === "closed"
          ) {
            setIsConnected(false);
            setStatus(`Connection ${peer.connectionState}`);
          }
        };

        // When we receive a track from the client
        peer.ontrack = (event) => {
          if (!isMounted) return;
          console.log("Track received:", event);

          if (event.streams && event.streams[0]) {
            console.log("Stream received:", event.streams[0]);
            setStatus("Receiving stream");

            // Add the stream if it doesn't already exist
            setStreams((prev) => {
              if (prev.find((s) => s.id === event.streams[0].id)) return prev;
              return [...prev, event.streams[0]];
            });
          } else {
            console.warn("Track received without stream");
          }
        };

        // When we generate ICE candidates, send them to the client
        peer.onicecandidate = (event) => {
          if (event.candidate && socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: "signal",
                code,
                payload: event.candidate,
              })
            );
          }
        };

        // Handle messages from the signaling server
        socket.onmessage = async (event) => {
          if (!isMounted) return;
          try {
            const message = JSON.parse(event.data);
            console.log("Message received:", message);

            if (message.type === "signal") {
              const payload = message.payload;

              // If we get an offer from the client
              if (payload.type === "offer") {
                console.log("Received offer, setting remote description");
                setStatus("Received offer");

                try {
                  await peer.setRemoteDescription(
                    new RTCSessionDescription(payload)
                  );

                  // Create and send answer
                  const answer = await peer.createAnswer();
                  await peer.setLocalDescription(answer);

                  socket.send(
                    JSON.stringify({
                      type: "signal",
                      code,
                      payload: peer.localDescription,
                    })
                  );

                  setStatus("Sent answer");
                } catch (err) {
                  console.error("Error processing offer:", err);
                  setStatus("Error processing offer");
                  setErrorMessage(`WebRTC error: ${(err as Error).message}`);
                }
              }
              // If we get an ICE candidate from the client
              else if (payload.candidate) {
                try {
                  await peer.addIceCandidate(new RTCIceCandidate(payload));
                } catch (err) {
                  console.error("Error adding ICE candidate:", err);
                }
              }
            }
            // If we get monitor info from the client
            else if (message.type === "monitorInfo") {
              console.log("Received monitor info:", message.payload);
              setMonitorInfo(message.payload);
            } else if (message.type === "error") {
              console.error("Server error:", message.message);
              setStatus(`Error: ${message.message}`);
              setErrorMessage(message.message);
            } else if (message.type === "clientDisconnected") {
              setIsConnected(false);
              setStatus("Client disconnected");
              setErrorMessage(
                "The client has disconnected. Waiting for reconnection..."
              );
            }
          } catch (err) {
            console.error("Error processing message:", err);
            setStatus("Error processing message");
          }
        };
      } catch (err) {
        console.error("Error setting up connection:", err);
        setStatus("Failed to connect");
        setErrorMessage(`Connection failed: ${(err as Error).message}`);
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      reconnectTimerRef.current = setTimeout(() => {
        if (isMounted) {
          console.log("Attempting to reconnect...");
          setStatus("Reconnecting...");
          setupConnection();
        }
      }, 5000);
    }

    // Cleanup on unmount
    return () => {
      isMounted = false;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      if (socketRef.current) {
        socketRef.current.close();
      }

      if (peerRef.current) {
        peerRef.current.close();
      }

      // Stop all tracks from all streams
      streams.forEach((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });
    };
  }, [code]);

  // Attach streams to video elements
  useEffect(() => {
    streams.forEach((stream) => {
      const videoEl = videoRefs.current[stream.id];
      if (videoEl && !videoEl.srcObject) {
        console.log("Attaching stream to video:", stream.id);
        videoEl.srcObject = stream;
      }
    });
  }, [streams]);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col p-6">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-[#121212] z-10 px-6 py-4 flex items-center justify-between border-b border-gray-800">
        <div>
          <h1 className="text-xl font-medium">
            InterView{" "}
            <span className="text-sm font-normal opacity-70">/ Viewer</span>
          </h1>
          <p className="text-sm text-gray-400">Code: {code}</p>
        </div>

        <div className="flex items-center">
          <div
            className={`w-2 h-2 rounded-full mr-2 ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          ></div>
          <span className="text-sm">{status}</span>
        </div>
      </div>

      {/* Monitor info */}
      {monitorInfo && (
        <div className="mt-16 mb-4 px-2 py-2 bg-[#121212] rounded border border-gray-800 text-sm">
          <div className="flex justify-between mb-1">
            <span>Total Monitors: {monitorInfo.totalMonitors}</span>
            <span>External Monitors: {monitorInfo.externalMonitors}</span>
          </div>
          <div className="text-xs text-gray-400">
            {monitorInfo.displays.map((display, i) => (
              <span key={i} className="mr-4">
                Monitor {i + 1}: {display.bounds.width}x{display.bounds.height}(
                {display.internal ? "Internal" : "External"})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-900 rounded text-red-400 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Stream grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {" "}
        {streams.length === 0 ? (
          <div className="col-span-full flex items-center justify-center bg-[#121212] rounded border border-gray-800 min-h-[300px]">
            <div className="text-center">
              <div className="text-gray-400 mb-2">Waiting for streams...</div>
              <div className="text-xs text-gray-600">{status}</div>
            </div>
          </div>
        ) : (
          streams.map((stream, idx) => (
            <div
              key={stream.id}
              className="relative bg-[#121212] rounded overflow-hidden border border-gray-800"
            >
              <div className="absolute top-0 left-0 right-0 bg-black/50 text-xs p-2 flex justify-between">
                <span>Monitor {idx + 1}</span>
                <span>{stream.getVideoTracks()[0]?.label || "Unknown"}</span>
              </div>
              <video
                ref={(el) => {
                  if (el) videoRefs.current[stream.id] = el;
                }}
                className="w-full h-full object-contain bg-black"
                autoPlay
                playsInline
              />
            </div>
          ))
        )}
      </div>
    </main>
  );
}
