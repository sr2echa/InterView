"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Image from "next/image";

const serverUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3004";

export default function HomePage() {
  const [code, setCode] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [serverCode, setServerCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const copiedTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError("");
    connectToServer();
    const safetyTimer = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setError("Could not connect to server. Please refresh the page.");
      }
    }, 8000);
    return () => {
      clearTimeout(safetyTimer);
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  function connectToServer() {
    try {
      setIsLoading(true);
      setError("");
      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          setError("Connection timeout. Please try again.");
          setIsLoading(false);
        }
      }, 5000);
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        setIsConnected(true);
        setError("");
        ws.send(JSON.stringify({ type: "requestCode" }));
      };
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "codeAssigned") {
            const receivedCode = message.payload.code;
            setServerCode(receivedCode);
            setCode(receivedCode);
            setIsLoading(false);
            document.title = `InterView - Code: ${receivedCode}`;
          } else if (message.type === "clientConnected") {
            setIsLoading(false);
            setError("Client connected! Click 'Start Monitoring' to begin.");
          }
        } catch (err) {
          setError("Failed to process server message");
          setIsLoading(false);
        }
      };
      ws.onclose = () => {
        setIsConnected(false);
        setIsLoading(false);
        if (!serverCode && !code) {
          setError("Connection to server closed. Attempting to reconnect...");
        }
        scheduleReconnect();
      };
      ws.onerror = () => {
        setIsConnected(false);
        setError("Connection to server failed");
        setIsLoading(false);
        scheduleReconnect();
      };
    } catch (err) {
      setError("Failed to connect to server");
      setIsLoading(false);
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      connectToServer();
    }, 5000);
  }

  const handleRequestNewCode = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsLoading(true);
      setIsCopied(false);
      setServerCode("");
      setCode("");
      wsRef.current.send(JSON.stringify({ type: "requestCode" }));
      setTimeout(() => {
        if (!serverCode && isLoading) {
          setIsLoading(false);
          setError("Code generation timed out. Please try again.");
        }
      }, 5000);
    } else {
      setError("Server connection lost. Reconnecting...");
      connectToServer();
    }
  };

  const handleSubmit = () => {
    if ((serverCode || code) && (serverCode || code).length === 6) {
      router.push(`/viewer?code=${serverCode || code}`);
    } else {
      setError("Enter a valid 6-digit code");
    }
  };

  const copyToClipboard = () => {
    if (serverCode) {
      navigator.clipboard.writeText(serverCode).then(() => {
        setIsCopied(true);
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(() => setIsCopied(false), 2000);
      });
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black text-white p-4 font-sans">
      {/* Hero Section */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-20 h-20 mb-4 relative">
          <Image
            src="/window.svg"
            alt="InterView Logo"
            fill
            className="object-contain"
          />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">InterView</h1>
        <p className="text-lg text-gray-400 font-medium mb-2">
          Simple, Secure Interview Monitoring
        </p>
        <div className="flex items-center space-x-2 mt-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          ></div>
          <span className="text-sm text-gray-400">
            {isConnected ? "Server Connected" : "Connecting..."}
          </span>
        </div>
      </div>

      {/* Session Code Card */}
      <Card className="w-full max-w-lg bg-[#18181b] border-gray-800 shadow-2xl rounded-2xl p-8 mb-8">
        <div className="flex flex-col items-center">
          <div className="mb-4 w-full flex flex-col items-center">
            <span className="text-gray-400 text-sm mb-1">Session Code</span>
            <div className="flex items-center space-x-2">
              <span className="text-3xl font-mono tracking-widest text-blue-400 bg-[#101014] px-6 py-2 rounded-lg border border-blue-900 shadow-inner">
                {serverCode || code || "------"}
              </span>
              <button
                onClick={copyToClipboard}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!serverCode}
                aria-label="Copy code"
              >
                {isCopied ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
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
                      width="16"
                      height="16"
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
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-900/40 rounded-md text-red-400 text-sm p-2 mb-4 w-full text-center font-semibold">
              {error}
            </div>
          )}

          {isLoading ? (
            <p className="text-blue-400 animate-pulse flex items-center justify-center mb-4">
              <svg
                className="animate-spin -ml-1 mr-2 h-5 w-5 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Generating session code...
            </p>
          ) : null}

          <Button
            onClick={handleSubmit}
            className="w-full mt-2 bg-blue-700 hover:bg-blue-600 text-white text-lg py-3 rounded-xl shadow-lg"
            disabled={!serverCode || isLoading}
          >
            Start Monitoring
          </Button>

          <Button
            onClick={handleRequestNewCode}
            variant="outline"
            className="w-full mt-3 border-gray-700 hover:bg-gray-800 text-base rounded-xl"
            disabled={!isConnected || isLoading}
          >
            {isLoading ? "Generating..." : "Generate New Code"}
          </Button>
        </div>
      </Card>

      {/* How it works */}
      <div className="w-full max-w-lg bg-[#18181b] border border-gray-800 rounded-2xl shadow-lg p-6 flex flex-col items-center">
        <h3 className="text-lg font-semibold mb-3">How it works</h3>
        <ol className="text-gray-400 text-sm space-y-2 list-decimal pl-5 w-full">
          <li>
            Click{" "}
            <span className="font-semibold text-blue-400">
              Generate New Code
            </span>{" "}
            to start a session
          </li>
          <li>
            Share the{" "}
            <span className="font-mono text-blue-400">Session Code</span> with
            the candidate
          </li>
          <li>Candidate enters the code in their InterView client</li>
          <li>
            Click{" "}
            <span className="font-semibold text-blue-400">
              Start Monitoring
            </span>{" "}
            to view their screens
          </li>
        </ol>
        <div className="flex justify-center items-center space-x-2 pt-4">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <p className="text-xs text-gray-500">
            Secure end-to-end encrypted connection
          </p>
        </div>
      </div>
    </main>
  );
}
