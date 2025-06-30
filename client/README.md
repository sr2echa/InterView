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

This will:

- Skip the code entry screen
- Automatically connect to the session with code `123456`
- Show the dashboard directly
- Close the application when the session disconnects

## Features

- **Screen Sharing**: Share your screen with remote viewers
- **Multi-Monitor Support**: Capture from multiple displays
- **Real-time Statistics**: Display count, active streams, and system info
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **CLI Interface**: Command-line usage for automation and scripting
