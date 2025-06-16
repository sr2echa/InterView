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

interface MonitorInfoProps {
  monitorInfo: MonitorInfo | null;
  processInfo: ProcessInfo | null;
  formattedRefreshDate: string;
  activeTab: "screens" | "processes";
  setActiveTab?: React.Dispatch<React.SetStateAction<"screens" | "processes">>;
}

export default function MonitorInfo({
  monitorInfo,
  processInfo,
  formattedRefreshDate,
  activeTab,
}: // setActiveTab,
MonitorInfoProps) {
  return (
    <div className="bg-black h-full flex flex-col p-3 overflow-y-auto thin-scrollbar">
      <div className="text-xs text-zinc-400 mb-2 hidden md:block">
        Last updated: {formattedRefreshDate}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-zinc-200 font-medium text-sm uppercase">
          {activeTab === "screens" ? "Monitor Info" : "Process Info"}
        </h3>
        <div className="flex items-center space-x-2">
          <span className="bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded-full text-xs flex items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse mr-1.5"></div>
            Live
          </span>
        </div>
      </div>

      {/* Monitor Info */}
      {activeTab === "screens" && monitorInfo ? (
        <div className="flex-grow overflow-y-auto thin-scrollbar">
          {/* Stats in grid layout - matching reference design */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mb-3">
            <div className="bg-zinc-900/50 border border-zinc-800/30 rounded p-2">
              <div className="text-xs text-zinc-400">Total Displays</div>
              <div className="text-lg font-medium text-blue-400">
                {monitorInfo.total}
              </div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800/30 rounded p-2">
              <div className="text-xs text-zinc-400">Active</div>
              <div className="text-lg font-medium text-green-400">
                {monitorInfo.active}
              </div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800/30 rounded p-2">
              <div className="text-xs text-zinc-400">Inactive</div>
              <div className="text-lg font-medium text-amber-400">
                {monitorInfo.inactive}
              </div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800/30 rounded p-2">
              <div className="text-xs text-zinc-400">Primary</div>
              <div className="text-lg font-medium text-purple-400">
                {monitorInfo.primary !== null ? "1" : "0"}
              </div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800/30 rounded p-2">
              <div className="text-xs text-zinc-400">External</div>
              <div className="text-lg font-medium text-cyan-400">
                {monitorInfo.external}
              </div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800/30 rounded p-2">
              <div className="text-xs text-zinc-400">Internal</div>
              <div className="text-lg font-medium text-orange-400">
                {monitorInfo.internal}
              </div>
            </div>
          </div>

          {/* Display Details section */}
          {monitorInfo.displays && monitorInfo.displays.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs text-zinc-500 uppercase mb-2">
                Display Details
              </h4>
              <div className="space-y-2">
                {monitorInfo.displays.map((display) => (
                  <div
                    key={display.id}
                    className="bg-zinc-900/30 border border-zinc-800/30 p-2 rounded"
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-2 h-2 rounded-full mr-2 ${
                          display.isPrimary ? "bg-purple-400" : "bg-blue-400"
                        }`}
                      ></div>
                      <span className="text-zinc-300 text-sm">
                        {display.isPrimary ? "Primary" : `Screen ${display.id}`}
                      </span>
                      <div className="ml-auto text-zinc-500 text-xs">
                        {display.bounds.width}x{display.bounds.height}
                      </div>
                    </div>
                    <div className="text-zinc-600 text-xs mt-1 pl-4">
                      {display.size} @ {display.scaleFactor}x
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === "processes" && processInfo ? (
        <div className="overflow-y-auto flex-grow thin-scrollbar">
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs text-zinc-400">
              Total processes: {processInfo.processes.length}
            </div>
            <div className="text-xs text-zinc-500">
              Showing with active window
            </div>
          </div>

          <div className="space-y-2">
            {processInfo.processes
              .filter((p) => p.WindowTitle)
              .slice(0, 10)
              .map((process) => (
                <div
                  key={process.Id}
                  className="bg-zinc-900/20 border border-zinc-800/30 rounded p-2 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-blue-400">
                      {process.ProcessName}
                    </div>
                    <div className="text-zinc-500 text-[10px]">
                      PID: {process.Id}
                    </div>
                  </div>
                  <div
                    className="text-zinc-400 truncate mt-1"
                    title={process.WindowTitle}
                  >
                    {process.WindowTitle}
                  </div>
                  {(process.Memory != null || process.CPU != null) && (
                    <div className="flex justify-between mt-2 text-xs text-zinc-500">
                      {process.Memory != null && (
                        <span>{Math.round(process.Memory / 1024)} MB</span>
                      )}
                      {process.CPU != null && (
                        <span className="text-green-500">
                          {process.CPU.toFixed(1)}% CPU
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mb-3 opacity-50"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M9 17h6" />
          </svg>
          <p>No data available</p>
        </div>
      )}
    </div>
  );
}
