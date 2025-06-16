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
  // CardFooter,
} from "@/components/ui/card";
import {
  RefreshCw,
  Loader2,
  // ArrowRight,
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
  // const [isConnecting, setIsConnecting] = useState(false);
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
        return;
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
      // setIsConnecting(true);
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
        </div>{" "}
        <Card className="bg-zinc-950 border-zinc-900 shadow-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/5 via-transparent to-transparent opacity-30 pointer-events-none"></div>

          <CardHeader className="border-b border-zinc-900/70 pb-4">
            <div className="flex items-center">
              <div className="mr-3">
                <div className="bg-blue-500/10 p-2 rounded-md">
                  <Monitor className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <div>
                <CardTitle>Interview Monitoring</CardTitle>
                <CardDescription className="text-zinc-400">
                  Generate a session code to monitor a candidate&apos;s screen
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 relative">
            {/* Generated code section */}
            {generatedCode ? (
              <div className="group relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 transition-all">
                <div className="absolute inset-0 bg-blue-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <h3 className="text-sm font-medium text-zinc-300">
                      Session Active
                    </h3>
                  </div>
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

                <div className="bg-zinc-800/50 border border-zinc-700/30 rounded-lg p-4 mb-6">
                  <div className="text-xs text-zinc-500 mb-2">
                    Session Code:
                  </div>
                  <div className="font-mono text-3xl tracking-[0.2em] text-blue-400 text-center py-2">
                    {generatedCode}
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button
                    onClick={handleGenerateCode}
                    disabled={isGenerating}
                    variant="outline"
                    className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400"
                    size="sm"
                  >
                    <RefreshCw size={14} className="mr-1.5" />
                    Regenerate
                  </Button>
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
              <div className="flex flex-col py-8 px-6">
                <div className="flex items-start mb-6">
                  <div className="bg-blue-900/10 p-3 rounded-full text-blue-500 mr-4">
                    <Share2 size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-zinc-200 text-base font-medium mb-1.5">
                      Create Interview Session
                    </h3>
                    <p className="text-zinc-400 text-sm">
                      Generate a unique session code to monitor candidate
                      screens in real-time
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-900/10 via-blue-800/5 to-blue-900/10 h-[1px] w-full my-4"></div>

                <Button
                  onClick={handleGenerateCode}
                  disabled={isGenerating}
                  className="relative bg-blue-600 hover:bg-blue-700 text-white group w-full py-5 mt-2"
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
              {" "}
              <Button
                variant="ghost"
                className="w-full justify-between text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40 p-0 h-auto"
                onClick={toggleInstructions}
              >
                <span className="flex items-center">
                  <span className="text-sm font-medium">How It Works</span>
                </span>
                <ChevronRight
                  size={16}
                  className={`transition-transform text-zinc-500 ${
                    showInstructions ? "rotate-90" : ""
                  }`}
                />
              </Button>{" "}
              {showInstructions && (
                <div className="text-xs text-zinc-500 mt-4 pl-2 border-l border-zinc-800">
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <span className="bg-zinc-800 text-zinc-300 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium mr-2 flex-shrink-0">
                        1
                      </span>
                      <p>Generate a unique session code for your interview</p>
                    </div>
                    <div className="flex items-start">
                      <span className="bg-zinc-800 text-zinc-300 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium mr-2 flex-shrink-0">
                        2
                      </span>
                      <p>
                        Share the code with your candidate before the interview
                      </p>
                    </div>
                    <div className="flex items-start">
                      <span className="bg-zinc-800 text-zinc-300 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium mr-2 flex-shrink-0">
                        3
                      </span>
                      <p>
                        Have them enter the code in the InterView client
                        application
                      </p>
                    </div>
                    <div className="flex items-start">
                      <span className="bg-zinc-800 text-zinc-300 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium mr-2 flex-shrink-0">
                        4
                      </span>
                      <p>
                        Monitor all candidate screens in real-time during the
                        interview
                      </p>
                    </div>
                  </div>
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
