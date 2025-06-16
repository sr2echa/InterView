import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, Maximize2, X } from "lucide-react";

export default function Preview(): React.JSX.Element {
  // State variables
  const [isLoaded, setIsLoaded] = useState(false);
  const [focusedMonitor, setFocusedMonitor] = useState<number | null>(null);
  const [connectingAnimation, setConnectingAnimation] = useState(false);
  const [activePreview, setActivePreview] = useState<"web" | "client">("web");
  const [expandedFrame, setExpandedFrame] = useState<boolean>(false);
  const [expandedMonitor, setExpandedMonitor] = useState<number | null>(null);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  // Handler functions
  const handleFrameMouseEnter = (frameType: "web" | "client") => {
    if (!expandedMonitor) {
      setActivePreview(frameType);
    }
  };

  const handleFrameTouch = (frameType: "web" | "client") => {
    if (!expandedMonitor) {
      setActivePreview(frameType);
    }
  };

  const handleMonitorMouseEnter = (index: number) => {
    if (expandedMonitor === null) {
      setFocusedMonitor(index);
      setExpandedFrame(true);
    }
  };

  const handleMonitorMouseLeave = () => {
    if (expandedMonitor === null) {
      setFocusedMonitor(null);
      setExpandedFrame(false);
    }
  };

  const handleMonitorClick = (index: number) => {
    if (expandedMonitor === null) {
      setExpandedMonitor(index);

      // Auto shrink after 3 seconds
      setTimeout(() => {
        setExpandedMonitor(null);
      }, 3000);
    } else if (expandedMonitor === index) {
      setExpandedMonitor(null);
    }
  };

  const handleConnect = () => {
    setConnectingAnimation(true);

    // After brief animation, switch back to web view
    setTimeout(() => {
      setConnectingAnimation(false);
      setActivePreview("web");
    }, 2000);
  };

  return (
    <div
      className={`flex-1 w-full max-w-full sm:max-w-[450px] lg:max-w-[550px] mt-0 lg:mt-0 transition-all duration-700 delay-300 flex justify-center ${
        isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="relative w-full h-[240px] xs:h-[300px] sm:h-[380px] md:h-[440px]">
        {/* Subtle glow effect */}
        <div className="absolute -inset-10 bg-blue-600/5 rounded-full blur-3xl animate-pulse-slow"></div>

        {/* Web Monitoring View (Interviewer) */}
        <div
          className={`absolute inset-0 z-${
            activePreview === "web" ? "20" : "10"
          } transition-all duration-800 ease-in-out ${
            activePreview === "web"
              ? "translate-x-0 translate-y-0 opacity-100 scale-100"
              : "translate-x-4 sm:translate-x-6 md:translate-x-8 translate-y-4 sm:translate-y-6 md:translate-y-8 opacity-80 scale-[0.98]"
          }`}
          onMouseEnter={() => handleFrameMouseEnter("web")}
          onTouchStart={() => handleFrameTouch("web")}
          onClick={() => {
            // For mobile, tapping on a frame should focus it
            if (window.innerWidth < 768) {
              handleFrameTouch("web");
            }
          }}
        >
          <Card
            className={`bg-zinc-950 border ${
              activePreview === "web" ? "border-blue-900/50" : "border-zinc-900"
            } overflow-hidden rounded-xl relative h-full ${
              activePreview === "web"
                ? "shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]"
                : ""
            } transition-all duration-700`}
          >
            <CardContent className="p-0">
              <div className="relative bg-gradient-to-br from-zinc-950 to-black p-2 xs:p-3 sm:p-4 md:p-5 h-full">
                {/* Mock Header */}
                <div className="flex justify-between items-center mb-2 sm:mb-3 md:mb-5">
                  <div className="flex items-center gap-1.5 sm:gap-1.5 md:gap-2">
                    <div className="w-1.5 sm:w-1.5 md:w-2 h-1.5 sm:h-1.5 md:h-2 rounded-full bg-blue-500 animate-ping-slow"></div>
                    <span className="text-[10px] xs:text-xs text-zinc-300">
                      Connection Active
                    </span>
                  </div>
                  <div className="bg-zinc-900 px-2 sm:px-2 md:px-3 py-1 sm:py-1 md:py-1.5 rounded-full text-[10px] xs:text-xs text-zinc-300 border border-zinc-800">
                    Session:{" "}
                    <span className="font-mono text-blue-400">AB29**</span>
                  </div>
                </div>

                {/* Stats Summary */}
                <div
                  className={`grid grid-cols-4 gap-1 xs:gap-1.5 sm:gap-2 mb-2 sm:mb-3 md:mb-4 transition-opacity duration-500 ${
                    expandedMonitor !== null ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-1 sm:p-1.5 md:p-2 flex flex-col items-center justify-center">
                    <span className="text-blue-400 text-sm sm:text-base md:text-lg font-bold">
                      2
                    </span>
                    <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-zinc-500">
                      Total Displays
                    </span>
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-1 sm:p-1.5 md:p-2 flex flex-col items-center justify-center">
                    <span className="text-green-400 text-sm sm:text-base md:text-lg font-bold">
                      2
                    </span>
                    <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-zinc-500">
                      Active
                    </span>
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-1 sm:p-1.5 md:p-2 flex flex-col items-center justify-center">
                    <span className="text-blue-400 text-sm sm:text-base md:text-lg font-bold">
                      1
                    </span>
                    <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-zinc-500">
                      Internal
                    </span>
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-1 sm:p-1.5 md:p-2 flex flex-col items-center justify-center">
                    <span className="text-blue-400 text-sm sm:text-base md:text-lg font-bold">
                      1
                    </span>
                    <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-zinc-500">
                      External
                    </span>
                  </div>
                </div>

                {/* Interactive Monitors with animated hover effects */}
                <div className="grid grid-cols-2 gap-1.5 xs:gap-2 sm:gap-2 md:gap-3 relative">
                  {[0, 1].map((index) => (
                    <div
                      key={index}
                      className={`relative rounded-lg sm:rounded-xl bg-zinc-900 border 
                      ${
                        focusedMonitor === index && expandedMonitor === null
                          ? "ring-1 sm:ring-1 md:ring-2 ring-blue-500/50 border-blue-700/50 animate-frame-glow"
                          : "border-zinc-800"
                      } 
                      ${
                        expandedFrame && focusedMonitor === index
                          ? "animate-expand"
                          : ""
                      }
                      ${
                        expandedMonitor === index
                          ? "absolute inset-0 z-30 animate-expand-full"
                          : expandedMonitor !== null &&
                            expandedMonitor !== index
                          ? "animate-shrink-back opacity-0 pointer-events-none"
                          : ""
                      }
                      aspect-video overflow-hidden group cursor-pointer transition-all duration-700`}
                      onMouseEnter={() => handleMonitorMouseEnter(index)}
                      onMouseLeave={handleMonitorMouseLeave}
                      onTouchStart={() => handleMonitorMouseEnter(index)}
                      onClick={() => handleMonitorClick(index)}
                    >
                      {expandedMonitor === index && (
                        <button
                          className="absolute top-1 sm:top-1 md:top-2 right-1 sm:right-1 md:right-2 z-40 bg-black/40 p-0.5 sm:p-0.5 md:p-1 rounded-full hover:bg-black/60 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedMonitor(null);
                          }}
                        >
                          <X className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 text-white/70" />
                        </button>
                      )}

                      <div className="absolute top-0 left-0 right-0 py-1 sm:py-1 md:py-1.5 px-2 sm:px-2 md:px-3 bg-gradient-to-b from-black/80 to-transparent text-[8px] xs:text-[9px] sm:text-[10px] text-zinc-300 flex justify-between">
                        <span>
                          {index === 0 ? "Primary Screen" : "External Screen"}
                        </span>
                        <span className="text-blue-400 flex items-center gap-0.5 sm:gap-0.5 md:gap-1">
                          <span className="w-1 h-1 sm:w-1 sm:h-1 md:w-1.5 md:h-1.5 rounded-full bg-blue-500 inline-block animate-pulse"></span>
                          Live
                        </span>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className={`absolute inset-0 bg-gradient-to-br 
                        ${
                          focusedMonitor === index || expandedMonitor === index
                            ? "from-blue-600/10 via-transparent to-transparent"
                            : "from-blue-600/5 via-transparent to-transparent"
                        } transition-opacity duration-500`}
                        ></div>
                        <Image
                          src="/file.svg"
                          width={expandedMonitor === index ? 40 : 30}
                          height={expandedMonitor === index ? 40 : 30}
                          alt="Screen preview"
                          className={`transition-all duration-500 
                          ${
                            expandedMonitor === index
                              ? "opacity-40"
                              : "opacity-20"
                          }
                          ${
                            focusedMonitor === index && expandedMonitor === null
                              ? "opacity-30"
                              : ""
                          } sm:w-[35px] sm:h-[35px] md:w-[40px] md:h-[40px]`}
                        />

                        {expandedMonitor === null && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="bg-black/40 p-1 sm:p-1 md:p-1.5 rounded-full">
                              <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-blue-400" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mock process list */}
                <div
                  className={`mt-2 sm:mt-2 md:mt-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-lg md:rounded-xl p-2 sm:p-2 md:p-3 transition-all duration-500 ${
                    expandedMonitor !== null ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1 sm:mb-1 md:mb-2">
                    <span className="text-[10px] xs:text-xs md:text-xs text-zinc-400">
                      Active Processes
                    </span>
                    <span className="text-[10px] xs:text-xs md:text-xs text-zinc-500">
                      3 detected
                    </span>
                  </div>
                  <div className="space-y-1 sm:space-y-1 md:space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1 sm:gap-1 md:gap-2">
                        <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-[10px] xs:text-xs md:text-xs text-zinc-300">
                          vscode.exe
                        </span>
                      </div>
                      <span className="text-[10px] xs:text-xs md:text-xs text-zinc-500">
                        217 MB
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1 sm:gap-1 md:gap-2">
                        <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-[10px] xs:text-xs md:text-xs text-zinc-300">
                          chrome.exe
                        </span>
                      </div>
                      <span className="text-[10px] xs:text-xs md:text-xs text-zinc-500">
                        324 MB
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1 sm:gap-1 md:gap-2">
                        <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full"></div>
                        <span className="text-[10px] xs:text-xs md:text-xs text-zinc-300">
                          node.exe
                        </span>
                      </div>
                      <span className="text-[10px] xs:text-xs md:text-xs text-zinc-500">
                        156 MB
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client View (Interviewee) */}
        <div
          className={`absolute inset-0 z-${
            activePreview === "client" ? "20" : "10"
          } transition-all duration-800 ease-in-out ${
            activePreview === "client"
              ? "translate-x-0 translate-y-0 opacity-100 scale-100"
              : "translate-x-4 sm:translate-x-6 md:translate-x-8 translate-y-4 sm:translate-y-6 md:translate-y-8 opacity-80 scale-[0.98]"
          }`}
          onMouseEnter={() => handleFrameMouseEnter("client")}
          onTouchStart={() => handleFrameTouch("client")}
          onClick={() => {
            // For mobile, tapping on a frame should focus it
            if (window.innerWidth < 768) {
              handleFrameTouch("client");
            }
          }}
        >
          <Card
            className={`bg-zinc-950 border ${
              activePreview === "client"
                ? "border-blue-900/50"
                : "border-zinc-900"
            } overflow-hidden rounded-xl relative h-full ${
              activePreview === "client"
                ? "shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]"
                : ""
            } transition-all duration-700`}
          >
            <CardContent className="p-2 xs:p-3 sm:p-3 md:p-4">
              <div className="flex items-center justify-between mb-2 sm:mb-3 md:mb-4">
                <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
                  <Code className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-zinc-500" />
                  <span className="text-xs sm:text-xs md:text-sm text-zinc-300">
                    InterView Client
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-1 md:gap-1.5">
                  <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 md:w-2 md:h-2 rounded-full bg-red-500/70"></div>
                  <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 md:w-2 md:h-2 rounded-full bg-yellow-500/70"></div>
                  <div className="w-1.5 h-1.5 sm:w-1.5 sm:h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse"></div>
                </div>
              </div>

              <div className="flex flex-col justify-center items-center h-[calc(100%-32px)] sm:h-[calc(100%-40px)] md:h-[330px] bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 sm:p-4 md:p-6">
                {/* Normal state */}
                <div
                  className={`${
                    connectingAnimation ? "hidden" : "block"
                  } text-center`}
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-4 sm:mb-5 md:mb-6 flex items-center justify-center rounded-full bg-zinc-800 border border-zinc-700">
                    <Image
                      src="/window.svg"
                      width={24}
                      height={24}
                      alt="InterView Logo"
                      className="opacity-70 sm:w-[26px] sm:h-[26px] md:w-[30px] md:h-[30px]"
                    />
                  </div>

                  <h3 className="text-zinc-300 text-base sm:text-base md:text-lg font-medium mb-1 sm:mb-1.5 md:mb-2">
                    Join Interview Session
                  </h3>
                  <p className="text-zinc-500 text-xs sm:text-xs md:text-sm mb-4 sm:mb-5 md:mb-6">
                    Enter the 6-digit code provided by your interviewer
                  </p>

                  <div className="flex items-center justify-center mb-4 sm:mb-5 md:mb-6 gap-1 sm:gap-1 md:gap-1.5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className={`w-6 h-8 sm:w-7 sm:h-9 md:w-8 md:h-10 border border-zinc-700 rounded flex items-center justify-center text-sm sm:text-sm md:text-base font-mono ${
                          i <= 4
                            ? "bg-zinc-800 text-blue-400"
                            : "bg-zinc-900 text-zinc-600"
                        }`}
                      >
                        {i <= 4
                          ? i === 1
                            ? "A"
                            : i === 2
                            ? "B"
                            : i === 3
                            ? "2"
                            : "9"
                          : ""}
                      </div>
                    ))}
                  </div>

                  <Button
                    className="w-36 sm:w-40 md:w-48 bg-blue-600/80 hover:bg-blue-700 border-0 text-xs sm:text-xs md:text-sm font-medium py-1.5 sm:py-1.5 md:py-2"
                    onClick={handleConnect}
                  >
                    Connect to Session
                  </Button>
                </div>

                {/* Simplified connecting animation - just shows "Connecting..." */}
                <div
                  className={`${
                    connectingAnimation ? "animate-slide-up" : "hidden"
                  } text-center`}
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto mb-4 sm:mb-5 md:mb-6 rounded-full bg-blue-900/20 border border-blue-800/30 animate-connecting flex items-center justify-center">
                    <div className="animate-spin h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                  </div>

                  <h3 className="text-zinc-300 text-base sm:text-base md:text-lg font-medium mb-2 sm:mb-3 md:mb-4">
                    Connecting...
                  </h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
