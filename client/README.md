# Interwu

A remote screen sharing client for technical interviews and remote assistance.

## Installation

Install globally using npm:

```bash
npm install -g interwu
```

## Usage

### Basic Usage

Start the application with the GUI:

```bash
interwu
```

This will open the InterWu application where you can enter a 6-digit code to connect to a session.

### CLI Mode with Auto-Connect

Connect directly to a session using a 6-digit code:

```bash
interwu 123456
```

incase you forget the syntax to use the cli, you can always use

```bash
interwu --help
```

This will:

- Skip the code entry screen
- Automatically connect to the session with code `123456`
- Show the dashboard directly
- Close the application when the session disconnects

## Development Mode

Connect to localhost instead of production server:

```bash
interwu --local
```

This connects to `ws://localhost:3004` instead of the production server.

You can also mention custom WebSocket server:

````bash
interwu --local "ws://localhost:6969"
``` or ```bash
interwu --local=ws://localhost:6969
````

## Development Environment

`Debug Logging`
Enable debug logging by setting an environment variable:

```bash
# On Windows
set IS_PRODUCTION=false
interwu

# On macOS/Linux
IS_PRODUCTION=false && interwu
```

You can also create a .env file in the application directory with:

```env
IS_PRODUCTION=false
```

This will:

- Enable detailed debug logs in the console
- Use the local WebSocket server (localhost:3004)
- Show additional diagnostic information

## Features

**Screen Sharing:** Share your screen with remote viewers
**Multi-Monitor Support:** Capture from multiple displays
**Real-time Statistics:** Display count, active streams, and system info
**Cross-Platform:** Works on Windows, macOS, and Linux
**CLI Interface:** Command-line usage for automation and scripting
**Auto-Reconnect:** Automatically reconnects if the connection drops
**Display Change Detection:** Automatically adapts to display configuration changes
**Process Monitoring:** Shares system process information with viewers
