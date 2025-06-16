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
  MousePointer,
  Maximize2,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import Preview from "@/components/preview";

export default function HomePage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [animateCode, setAnimateCode] = useState(false);

  useEffect(() => {
    setIsLoaded(true);

    // Random code animation
    const interval = setInterval(() => {
      console.log(animateCode);
      setAnimateCode((prev) => !prev);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen h-[100dvh] bg-black text-white flex flex-col overflow-x-hidden overflow-y-auto md:overflow-hidden">
      {/* Enhanced gradient background with AMOLED accents */}
      <div className="fixed inset-0 overflow-hidden">
        {/* Ambient glow effects - subtle for AMOLED futuristic look */}
        <div className="absolute top-[30%] left-[5%] w-[30%] h-[40%] rounded-full bg-blue-900/10 blur-[120px] animate-pulse-slower"></div>
        <div className="absolute bottom-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-900/5 blur-[150px] animate-pulse-slow"></div>
      </div>

      {/* Minimal header with left-aligned design */}
      <header className="py-4 sm:py-5 px-4 sm:px-8 z-50">
        <div className="flex items-center gap-3">
          <div className="relative h-7 w-7 sm:h-7 md:h-8 sm:w-7 md:w-8">
            <div className="absolute inset-0 bg-blue-500/10 rounded-full"></div>
            <Image
              src="/window.svg"
              alt="InterView Logo"
              fill
              className="object-contain p-1.5"
              priority
            />
          </div>
          <span className="text-lg sm:text-lg md:text-xl font-medium text-white">
            InterView
          </span>
        </div>
      </header>

      {/* Redesigned hero section with improved preview */}
      <section className="flex-1 flex flex-col lg:flex-row items-center justify-start lg:justify-center px-4 sm:px-8 py-4 lg:py-0 gap-8 lg:gap-12 max-w-7xl mx-auto w-full h-full overflow-y-auto lg:overflow-visible">
        {/* Left content */}
        <div
          className={`flex-1 flex flex-col w-full max-w-full lg:max-w-[500px] transition-all duration-700 pt-4 md:pt-0 ${
            isLoaded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
          }`}
        >
          {/* Subtle accent glow behind text */}
          <div className="absolute top-[20%] left-[5%] w-64 h-64 bg-blue-600/10 rounded-full blur-3xl"></div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight mb-4 sm:mb-6">
            <span className="text-white/95">Secure Remote</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-blue-300 to-blue-600 bg-[length:200%_200%] animate-flow-text mt-2">
              Interview Monitoring
            </span>
          </h1>

          <p className="text-zinc-400 text-base sm:text-lg lg:text-xl max-w-xl mb-6 sm:mb-8 leading-relaxed">
            Monitor technical interviews in real-time with secure screen sharing
            and comprehensive system insights.
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-2 sm:gap-2 md:gap-3 mb-6 sm:mb-6 md:mb-8">
            <div className="flex items-center gap-1.5 sm:gap-1.5 md:gap-2 bg-zinc-900/80 border border-zinc-800/50 rounded-full px-2.5 sm:px-2.5 md:px-3 py-1.5 text-xs sm:text-xs md:text-sm text-zinc-300">
              <Lock className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-blue-400" />
              <span>Secure Monitoring</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-1.5 md:gap-2 bg-zinc-900/80 border border-zinc-800/50 rounded-full px-2.5 sm:px-2.5 md:px-3 py-1.5 text-xs sm:text-xs md:text-sm text-zinc-300">
              <Monitor className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-blue-400" />
              <span>Multi-Display</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-1.5 md:gap-2 bg-zinc-900/80 border border-zinc-800/50 rounded-full px-2.5 sm:px-2.5 md:px-3 py-1.5 text-xs sm:text-xs md:text-sm text-zinc-300">
              <Cpu className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-blue-400" />
              <span>Process Tracking</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 sm:gap-3 md:gap-4">
            <a
              href="https://github.com/sr2echa/InterView"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/50 text-white py-2 sm:py-2.5 md:py-3 px-4 sm:px-4 md:px-6 rounded-lg transition-all duration-300"
            >
              <Github className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5" />
              <span className="text-sm sm:text-sm md:text-base">GitHub</span>
            </a>

            <Button
              onClick={() => router.push("/viewer")}
              className="group flex items-center h-full gap-2 bg-blue-600/90 hover:bg-blue-700 text-white py-2 sm:py-2.5 md:py-3 px-4 sm:px-4 md:px-6 rounded-lg transition-all duration-300 overflow-hidden"
            >
              <span className="z-10 text-sm sm:text-sm md:text-base">
                Launch App
              </span>
              <ArrowRight className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 z-10" />
            </Button>
          </div>

          {/* UI controls hint - subtle instructional element */}
          <div className="mt-6 sm:mt-6 md:mt-8 flex items-center gap-1.5 sm:gap-1.5 md:gap-2 text-xs text-zinc-600">
            <MousePointer className="w-3 h-3 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-zinc-500" />
            <span>Try clicking on a screen to expand it</span>
          </div>
        </div>

        <Preview />
      </section>

      {/* Restored floating code elements for visual effect */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="hidden sm:block absolute top-[15%] right-[5%] opacity-20 transform rotate-12 text-[8px] font-mono text-blue-500">
          <Code size={12} className="mb-1 text-blue-500/50" />
          <div>{"{"}</div>
          <div className="ml-2">&apos;session&apos;: &apos;active&apos;,</div>
          <div className="ml-2">&apos;monitors&apos;: 2,</div>
          <div className="ml-2">&apos;secure&apos;: true</div>
          <div>{"}"}</div>
        </div>{" "}
        <div className="hidden sm:block absolute bottom-[25%] left-[7%] opacity-10 transform -rotate-6 text-[8px] font-mono text-blue-300">
          <Activity className="w-3 h-3 mb-1 text-blue-300/50" />
          <div>connection.secure()</div>
          <div>.then(monitor =&gt; {"{"}</div>
          <div className="ml-2">startStream();</div>
          <div>{"})"}</div>
        </div>
      </div>
    </main>
  );
}
