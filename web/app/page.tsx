"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import {
  ArrowRight,
  Github,
  Monitor,
  Cpu,
  Activity,
  Lock,
  Code,
} from "lucide-react";
import { useState, useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  // For animation effects
  const [isLoaded, setIsLoaded] = useState(false);
  const [animateCode, setAnimateCode] = useState(false);

  useEffect(() => {
    setIsLoaded(true);

    // Random code animation
    const interval = setInterval(() => {
      setAnimateCode((prev) => !prev);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      {/* Enhanced gradient background with AMOLED accents */}
      <div className="fixed inset-0 overflow-hidden">
        {/* Ambient glow effects - subtle for AMOLED futuristic look */}
        <div className="absolute top-[30%] left-[5%] w-[30%] h-[40%] rounded-full bg-blue-900/10 blur-[120px] animate-pulse-slow"></div>
        <div className="absolute bottom-[20%] left-[20%] w-[25%] h-[25%] rounded-full bg-indigo-900/8 blur-[100px] animate-pulse-slower"></div>
        <div className="absolute top-[60%] right-[10%] w-[20%] h-[30%] rounded-full bg-violet-900/5 blur-[150px] animate-pulse-slow"></div>
      </div>

      {/* Minimal header with left-aligned design */}
      <header className="py-6 px-8 z-50">
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-8">
            <div className="absolute inset-0 bg-blue-500/10 rounded-full"></div>
            <Image
              src="/window.svg"
              alt="InterView Logo"
              fill
              className="object-contain p-1.5"
              priority
            />
          </div>
          <span className="text-xl font-medium text-white">InterView</span>
        </div>
      </header>

      {/* Redesigned hero section with preview */}
      <section className="flex-1 flex flex-col lg:flex-row px-8 py-12 gap-12 max-w-7xl mx-auto w-full">
        {/* Left content */}
        <div
          className={`flex-1 flex flex-col transition-all duration-700 ${
            isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
          }`}
        >
          {/* Subtle accent glow behind text */}
          <div className="absolute top-[20%] left-[5%] w-64 h-64 bg-blue-600/10 rounded-full blur-3xl"></div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            <span className="text-white/95">Secure Remote</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 mt-2">
              Interview Monitoring
            </span>
          </h1>

          <p className="text-zinc-400 text-lg lg:text-xl max-w-xl mb-8 leading-relaxed">
            Monitor technical interviews in real-time with secure screen sharing
            and comprehensive system insights.
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-3 mb-10">
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800/50 rounded-full px-3 py-1.5 text-sm text-zinc-300">
              <Lock size={14} className="text-blue-400" />
              <span>Secure Monitoring</span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800/50 rounded-full px-3 py-1.5 text-sm text-zinc-300">
              <Monitor size={14} className="text-blue-400" />
              <span>Multi-Display</span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-800/50 rounded-full px-3 py-1.5 text-sm text-zinc-300">
              <Cpu size={14} className="text-blue-400" />
              <span>Process Tracking</span>
            </div>
          </div>

          <div className="flex gap-4">
            <a
              href="https://github.com/sr2echa/InterView"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/50 text-white py-3 px-6 rounded-lg transition-all duration-300"
            >
              <Github size={18} />
              <span>GitHub</span>
            </a>

            <Button
              onClick={() => router.push("/viewer")}
              className="group flex items-center h-full gap-2 bg-blue-600/90 hover:bg-blue-700 text-white py-3 px-6 rounded-lg transition-all duration-300 overflow-hidden"
            >
              <span className="z-10">Launch App</span>
              <ArrowRight size={18} className="z-10" />
            </Button>
          </div>
        </div>

        {/* Preview Card with animation */}
        <div
          className={`flex-1 mt-12 lg:mt-0 transition-all duration-700 delay-300 ${
            isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-10 bg-blue-600/5 rounded-full blur-3xl"></div>

            <Card className="w-full max-w-[560px] bg-zinc-950 border border-zinc-900 overflow-hidden shadow-[0_0_45px_-10px_rgba(0,0,0,0.3)] backdrop-blur-sm rounded-2xl relative">
              <CardContent className="p-0">
                <div className="relative bg-gradient-to-br from-zinc-950 to-black p-5">
                  {/* Mock Header */}
                  <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full bg-blue-500 ${
                          animateCode ? "animate-pulse" : ""
                        }`}
                      ></div>
                      <span className="text-xs text-zinc-300">Connected</span>
                    </div>
                    <div className="bg-zinc-900 px-3 py-1.5 rounded-full text-xs text-zinc-300 border border-zinc-800">
                      Session:{" "}
                      <span
                        className={`font-mono text-blue-400 transition-colors ${
                          animateCode ? "text-blue-300" : "text-blue-500"
                        }`}
                      >
                        123456
                      </span>
                    </div>
                  </div>

                  {/* Mock Screens with animated glow */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative rounded-xl bg-zinc-900 border border-zinc-800 aspect-video overflow-hidden group transition-all">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <div className="absolute top-0 left-0 right-0 py-1.5 px-3 bg-gradient-to-b from-black/80 to-transparent text-[10px] text-zinc-300 flex justify-between">
                        <span>Primary Screen</span>
                        <span className="text-blue-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block animate-pulse"></span>
                          Live
                        </span>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-transparent"></div>
                        <Image
                          src="/file.svg"
                          width={40}
                          height={40}
                          alt="Screen preview"
                          className="opacity-20"
                        />
                      </div>
                    </div>
                    <div className="relative rounded-xl bg-zinc-900 border border-zinc-800 aspect-video overflow-hidden group transition-all">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <div className="absolute top-0 left-0 right-0 py-1.5 px-3 bg-gradient-to-b from-black/80 to-transparent text-[10px] text-zinc-300 flex justify-between">
                        <span>External Screen</span>
                        <span className="text-blue-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block animate-pulse"></span>
                          Live
                        </span>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-transparent"></div>
                        <Image
                          src="/file.svg"
                          width={40}
                          height={40}
                          alt="Screen preview"
                          className="opacity-20"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mock process list */}
                  <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-zinc-400">
                        Running Processes
                      </span>
                      <span className="text-xs text-zinc-500">3 active</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-xs text-zinc-300">
                            vscode.exe
                          </span>
                        </div>
                        <span className="text-xs text-zinc-500">217 MB</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-xs text-zinc-300">
                            chrome.exe
                          </span>
                        </div>
                        <span className="text-xs text-zinc-500">324 MB</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Animated tech particles */}
            <div className="absolute -bottom-6 -right-6 w-24 h-24 opacity-30">
              <div className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full bg-blue-400 animate-ping-slow"></div>
              <div className="absolute top-1/3 left-2/3 w-2 h-2 rounded-full bg-indigo-400 animate-ping-slower"></div>
              <div className="absolute top-2/3 left-1/4 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating code elements for visual effect */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[15%] right-[5%] opacity-20 transform rotate-12 text-[8px] font-mono text-blue-500">
          <Code size={12} className="mb-1 text-blue-500/50" />
          <div>{"{"}</div>
          <div className="ml-2">"session": "active",</div>
          <div className="ml-2">"monitors": 2,</div>
          <div className="ml-2">"secure": true</div>
          <div>{"}"}</div>
        </div>
        <div className="absolute bottom-[25%] left-[7%] opacity-10 transform -rotate-6 text-[8px] font-mono text-blue-300">
          {" "}
          <Activity size={12} className="mb-1 text-blue-300/50" />
          <div>connection.secure()</div>
          <div>
            .then(monitor {"=>"} {"{"}
          </div>
          <div className="ml-2">startStream();</div>
          <div>{"});"}</div>
        </div>
      </div>
    </main>
  );
}
