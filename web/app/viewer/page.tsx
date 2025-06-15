"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  RefreshCw,
  Loader2,
  ArrowRight,
  Clipboard,
  Check,
  RotateCw,
  Monitor,
  Share2,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";

const serverUrl = "ws://localhost:3004";

export default function ViewerPage() {
  const [generatedCode, setGeneratedCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const copiedTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clean up on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  // Connect to WebSocket server
  const connectToServer = async () => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        return; // Already connected
      }

      setError("");
      const ws = new WebSocket(serverUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to WebSocket server");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Received message:", message);

          if (message.type === "codeAssigned") {
            setGeneratedCode(message.payload.code);
            setIsGenerating(false);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError("Failed to connect to server. Please try again.");
        setIsGenerating(false);
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        wsRef.current = null;
        scheduleReconnect();
      };
    } catch (err) {
      console.error("Error connecting to WebSocket server:", err);
      setError("Failed to connect to server. Please try again.");
      setIsGenerating(false);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    reconnectTimerRef.current = setTimeout(() => {
      connectToServer();
    }, 5000);
  };

  // Generate a new code
  const handleGenerateCode = async () => {
    setIsGenerating(true);
    setError("");

    try {
      await connectToServer();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "requestCode" }));
      } else {
        setError("Could not connect to server. Please try again.");
        setIsGenerating(false);
      }
    } catch (err) {
      console.error("Error generating code:", err);
      setError("Failed to generate code. Please try again.");
      setIsGenerating(false);
    }
  };

  // Copy code to clipboard
  const copyToClipboard = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode).then(() => {
        setIsCopied(true);
        if (copiedTimerRef.current) {
          clearTimeout(copiedTimerRef.current);
        }
        copiedTimerRef.current = setTimeout(() => setIsCopied(false), 2000);
      });
    }
  }; // Handle navigation to the monitoring page
  const connectWithGeneratedCode = () => {
    if (generatedCode) {
      setIsConnecting(true);
      router.push(`/viewer/${generatedCode}`);
    }
  };
  // Handle connect with generated code
  const connectWithCode = () => {
    if (generatedCode) {
      setIsConnecting(true);
      router.push(`/viewer/${generatedCode}`);
    }
  };

  // Toggle instructions
  const toggleInstructions = () => {
    setShowInstructions(!showInstructions);
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col justify-center items-center p-4">
      {/* Subtle background glow effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] right-[20%] w-[40%] h-[40%] rounded-full bg-blue-900/5 blur-[100px]"></div>
        <div className="absolute top-[60%] left-[10%] w-[30%] h-[30%] rounded-full bg-blue-900/5 blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex justify-center mb-8">
          <div className="flex items-center">
            <div className="relative h-10 w-10 mr-3">
              <div className="absolute inset-0 rounded-full bg-blue-500/10"></div>
              <Image
                src="/window.svg"
                alt="InterView Logo"
                fill
                className="object-contain p-1"
                priority
              />
            </div>
            <h1 className="text-2xl font-medium">InterView</h1>
          </div>
        </div>

        <Card className="bg-zinc-950 border-zinc-900 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/5 via-transparent to-transparent opacity-30 pointer-events-none"></div>

          <CardHeader>
            <CardTitle>Create Monitoring Session</CardTitle>
            <CardDescription className="text-zinc-400">
              Generate a session code to monitor a candidate's screen
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 relative">
            {/* Generated code section */}
            {generatedCode ? (
              <div className="group relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 transition-all">
                <div className="absolute inset-0 bg-blue-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-zinc-300">
                    Session Code
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                    onClick={copyToClipboard}
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} className="mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Clipboard size={14} className="mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex justify-center">
                  <div className="font-mono text-3xl tracking-[0.3em] text-blue-400 py-6">
                    {generatedCode}
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button
                    onClick={handleGenerateCode}
                    disabled={isGenerating}
                    variant="outline"
                    className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 mr-2"
                    size="sm"
                  >
                    <RefreshCw size={14} className="mr-1.5" />
                    Regenerate
                  </Button>{" "}
                  <Button
                    onClick={connectWithGeneratedCode}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    <Monitor size={14} className="mr-1.5" />
                    Start Monitoring
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-6">
                <div className="bg-blue-900/10 p-4 rounded-full mb-6 text-blue-500">
                  <Share2 size={32} />
                </div>

                <p className="text-zinc-400 mb-8 text-center">
                  Generate a unique session code to monitor candidate screens in
                  real-time
                </p>

                <Button
                  onClick={handleGenerateCode}
                  disabled={isGenerating}
                  className="relative bg-blue-600 hover:bg-blue-700 text-white group w-full py-6"
                >
                  <div className="absolute inset-0 bg-blue-400/10 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md"></div>
                  <div className="relative flex items-center justify-center">
                    {isGenerating ? (
                      <>
                        <Loader2 size={18} className="mr-2 animate-spin" />
                        Generating Session Code...
                      </>
                    ) : (
                      <>
                        <RotateCw size={18} className="mr-2" />
                        Generate Session Code
                      </>
                    )}
                  </div>
                </Button>
              </div>
            )}

            {/* How It Works accordion */}
            <div className="border-t border-zinc-900 mt-6 pt-4">
              <Button
                variant="ghost"
                className="w-full justify-between text-zinc-400 hover:text-white p-0 h-auto"
                onClick={toggleInstructions}
              >
                <span className="flex items-center">
                  <span className="text-sm font-medium">How It Works</span>
                </span>
                <ChevronRight
                  size={16}
                  className={`transition-transform ${
                    showInstructions ? "rotate-90" : ""
                  }`}
                />
              </Button>

              {showInstructions && (
                <div className="text-xs text-zinc-500 mt-3 space-y-2 pl-2 border-l border-zinc-900">
                  <p>1. Generate a unique session code</p>
                  <p>2. Share the code with your candidate</p>
                  <p>3. Have them enter the code at the client URL</p>
                  <p>4. Start monitoring the screens in real-time</p>
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-950/30 border border-red-900/50 text-red-400 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-zinc-500 text-xs text-center mt-6">
          InterView • Secure Remote Interview Monitoring
        </p>
      </div>
    </main>
  );
}
