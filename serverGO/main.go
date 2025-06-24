package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

// Configuration constants
const (
	MAX_BUFFER         = 1024 * 1024 * 10 // 10MB buffer
	PROCESS_TIMEOUT    = 10 * time.Second // 10 seconds timeout
	DETECTION_INTERVAL = 30 * time.Second // 30 seconds between scans
	CLEANUP_INTERVAL   = 60 * time.Second // 1 minute cleanup interval
	PENDING_CODE_TTL   = 30 * time.Minute // 30 minutes TTL for pending codes
)

// Message types
type MessageType string

const (
	RequestCode            MessageType = "requestCode"
	CodeAssigned           MessageType = "codeAssigned"
	Register               MessageType = "register"
	SessionEstablished     MessageType = "sessionEstablished"
	ClientConnected        MessageType = "clientConnected"
	ClientDisconnected     MessageType = "clientDisconnected"
	ClientReconnected      MessageType = "clientReconnected"
	ViewerConnected        MessageType = "viewerConnected"
	ViewerDisconnected     MessageType = "viewerDisconnected"
	Connect                MessageType = "connect"
	Signal                 MessageType = "signal"
	DisplayConfigChanged   MessageType = "displayConfigChanged"
	MonitorInfo            MessageType = "monitorInfo"
	ProcessInfo            MessageType = "processInfo"
	AdminCommand           MessageType = "adminCommand"
	AdminCommandResponse   MessageType = "adminCommandResponse"
	Error                  MessageType = "error"
)

// Role types
type Role string

const (
	ClientRole Role = "client"
	ViewerRole Role = "viewer"
)

// WebSocket connection wrapper
type Connection struct {
	ID          string          `json:"id"`
	WS          *websocket.Conn `json:"-"`
	Role        Role            `json:"role"`
	SessionCode string          `json:"sessionCode"`
	Connected   time.Time       `json:"connected"`
	mu          sync.Mutex      `json:"-"`
}

// Send message to connection with thread safety
func (c *Connection) Send(message interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	if c.WS == nil {
		return fmt.Errorf("connection is nil")
	}
	
	return c.WS.WriteJSON(message)
}

// Check if connection is open
func (c *Connection) IsOpen() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.WS != nil
}

// Close connection safely
func (c *Connection) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	if c.WS != nil {
		c.WS.Close()
		c.WS = nil
	}
}

// Session info
type SessionInfo struct {
	CreatedAt   time.Time   `json:"createdAt"`
	MonitorInfo interface{} `json:"monitorInfo"`
	ProcessInfo interface{} `json:"processInfo"`
	ClientInfo  interface{} `json:"clientInfo"`
}

// Session represents a client-viewer pair
type Session struct {
	Client *Connection
	Viewer *Connection
	Info   *SessionInfo
	mu     sync.RWMutex
}

// Pending code data
type PendingCode struct {
	CreatedAt time.Time
	ViewerWS  *Connection
}

// Message structure - matches Node.js server exactly
type Message struct {
	Type    MessageType     `json:"type"`
	Code    string          `json:"code,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
	Role    Role            `json:"role,omitempty"`
}

// Response message structure - simplified to match Node.js exactly
type ResponseMessage struct {
	Type      MessageType `json:"type"`
	Payload   interface{} `json:"payload,omitempty"`
	Timestamp *int64      `json:"timestamp,omitempty"`
}

// Error payload
type ErrorPayload struct {
	Message string `json:"message"`
}

// Code assignment payload
type CodeAssignmentPayload struct {
	Code string `json:"code"`
}

// Helper function to get current timestamp in milliseconds
func getCurrentTimestamp() int64 {
	return time.Now().UnixMilli()
}

// Helper function to create response message with timestamp
func createResponseMessage(msgType MessageType, payload interface{}) ResponseMessage {
	timestamp := getCurrentTimestamp()
	return ResponseMessage{
		Type:      msgType,
		Payload:   payload,
		Timestamp: &timestamp,
	}
}

// Helper function to create response message without timestamp
func createSimpleResponseMessage(msgType MessageType, payload interface{}) ResponseMessage {
	return ResponseMessage{
		Type:    msgType,
		Payload: payload,
	}
}

// Client info payload
type ClientInfoPayload struct {
	Timestamp  int64       `json:"timestamp"`
	Code       string      `json:"code,omitempty"`
	ClientInfo interface{} `json:"clientInfo,omitempty"`
}

// Admin command response payload
type AdminCommandResponsePayload struct {
	Command string `json:"command"`
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// Server struct
type Server struct {
	sessions      map[string]*Session
	activeCodes   map[string]bool
	pendingCodes  map[string]*PendingCode
	connections   map[string]*Connection
	nextConnID    int64
	upgrader      websocket.Upgrader
	mu            sync.RWMutex
}

// Create new server
func NewServer() *Server {
	return &Server{
		sessions:     make(map[string]*Session),
		activeCodes:  make(map[string]bool),
		pendingCodes: make(map[string]*PendingCode),
		connections:  make(map[string]*Connection),
		nextConnID:   1,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true // Allow all origins for now
			},
		},
	}
}

// Generate unique 6-digit code
func (s *Server) generateUniqueCode() string {
	s.mu.Lock()
	defer s.mu.Unlock()

	var code string
	attempts := 0
	maxAttempts := 10

	for {
		code = fmt.Sprintf("%06d", rand.Intn(900000)+100000)
		attempts++

		if attempts >= maxAttempts {
			log.Printf("Warning: Many code generation attempts. Active codes count: %d", len(s.activeCodes))
			code = fmt.Sprintf("%06d", rand.Intn(700000)+200000)
			break
		}

		if !s.activeCodes[code] {
			break
		}
	}

	s.activeCodes[code] = true
	return code
}

// Clean up expired pending codes
func (s *Server) cleanupExpiredCodes() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for code, data := range s.pendingCodes {
		if now.Sub(data.CreatedAt) > PENDING_CODE_TTL {
			log.Printf("🧹 Removing expired pending code: %s", code)
			delete(s.pendingCodes, code)
		}
	}
}

// Start cleanup routine
func (s *Server) startCleanupRoutine() {
	ticker := time.NewTicker(CLEANUP_INTERVAL)
	go func() {
		for range ticker.C {
			s.cleanupExpiredCodes()
		}
	}()
}

// Handle WebSocket connection
func (s *Server) handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// Create connection wrapper
	s.mu.Lock()
	connID := fmt.Sprintf("conn-%d", s.nextConnID)
	s.nextConnID++
	s.mu.Unlock()

	connection := &Connection{
		ID:        connID,
		WS:        conn,
		Connected: time.Now(),
	}

	s.mu.Lock()
	s.connections[connID] = connection
	s.mu.Unlock()

	log.Printf("🔌 New WebSocket connection established: %s", connID)

	// Set up cleanup - this will be called when the function exits
	defer func() {
		log.Printf("🔌 Connection %s closing", connID)
		s.handleConnectionClose(connection)
		connection.Close()
		s.mu.Lock()
		delete(s.connections, connID)
		s.mu.Unlock()
	}()

	// Handle messages directly in this goroutine
	s.handleMessages(connection)
}

// Handle incoming messages
func (s *Server) handleMessages(conn *Connection) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered from panic in handleMessages: %v", r)
		}
	}()

	for {
		var msg Message
		err := conn.WS.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error for %s: %v", conn.ID, err)
			} else {
				log.Printf("WebSocket closed for %s: %v", conn.ID, err)
			}
			break
		}

		log.Printf("Received message: %s from %s", msg.Type, conn.ID)
		s.processMessage(conn, &msg)
	}
}

// Process individual message
func (s *Server) processMessage(conn *Connection, msg *Message) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered from panic in processMessage: %v", r)
			errorResponse := createSimpleResponseMessage(Error, map[string]string{
				"message": "Internal server error",
			})
			conn.Send(errorResponse)
		}
	}()

	switch msg.Type {
	case RequestCode:
		s.handleRequestCode(conn)
	case Register:
		s.handleRegister(conn, msg)
	case Signal:
		s.handleSignal(conn, msg)
	case Connect:
		s.handleConnect(conn, msg)
	case DisplayConfigChanged:
		s.handleDisplayConfigChanged(conn, msg)
	case MonitorInfo:
		s.handleMonitorInfo(conn, msg)
	case ProcessInfo:
		s.handleProcessInfo(conn, msg)
	case AdminCommand:
		s.handleAdminCommand(conn, msg)
	default:
		log.Printf("Unknown message type: %s from %s", msg.Type, conn.ID)
		errorResponse := createSimpleResponseMessage(Error, map[string]string{
			"message": "Unknown message type",
		})
		conn.Send(errorResponse)
	}
}

// Handle request code message
func (s *Server) handleRequestCode(conn *Connection) {
	code := s.generateUniqueCode()
	
	s.mu.Lock()
	s.pendingCodes[code] = &PendingCode{
		CreatedAt: time.Now(),
		ViewerWS:  conn,
	}
	s.mu.Unlock()

	conn.SessionCode = code
	conn.Role = ViewerRole

	response := createSimpleResponseMessage(CodeAssigned, map[string]string{"code": code})
	err := conn.Send(response)
	if err != nil {
		log.Printf("Error sending code assignment: %v", err)
		return
	}

	log.Printf("🎲 Generated new code for viewer: %s", code)
}

// Handle register message
func (s *Server) handleRegister(conn *Connection, msg *Message) {
	if msg.Role == ClientRole {
		s.handleClientRegister(conn, msg)
	} else if msg.Role == ViewerRole {
		s.handleViewerRegister(conn, msg)
	}
}

// Handle client registration
func (s *Server) handleClientRegister(conn *Connection, msg *Message) {
	code := msg.Code
	log.Printf("🔍 Client attempting to register with code: %s", code)

	s.mu.Lock()
	defer s.mu.Unlock()

	// Parse client info payload
	var clientInfo interface{}
	if len(msg.Payload) > 0 {
		json.Unmarshal(msg.Payload, &clientInfo)
	}

	// Check if this is a code that a viewer is waiting for
	if pendingData, exists := s.pendingCodes[code]; exists {
		viewerWS := pendingData.ViewerWS
		log.Printf("✅ Found pending code %s with waiting viewer", code)

		// Create a new session for this code
		session := &Session{
			Client: conn,
			Viewer: viewerWS,
			Info: &SessionInfo{
				CreatedAt:  time.Now(),
				ClientInfo: clientInfo,
			},
		}

		s.sessions[code] = session
		delete(s.pendingCodes, code)
		s.activeCodes[code] = true

		conn.Role = ClientRole
		conn.SessionCode = code
		viewerWS.Role = ViewerRole
		viewerWS.SessionCode = code

		log.Printf("✅ Client registered with code: %s", code)

		// Send immediate confirmation to client
		timestampPayload := map[string]interface{}{
			"timestamp": getCurrentTimestamp(),
		}
		response := createSimpleResponseMessage(SessionEstablished, timestampPayload)
		err := conn.Send(response)
		if err != nil {
			log.Printf("Error sending session establishment: %v", err)
		}

		log.Printf("📤 Session establishment sent to client for code: %s", code)

		// Notify viewer with delay
		go func() {
			time.Sleep(1500 * time.Millisecond)
			if viewerWS.IsOpen() {
				log.Printf("🔔 Notifying viewer that client connected for code: %s", code)
				clientConnectedPayload := map[string]interface{}{
					"timestamp":  getCurrentTimestamp(),
					"code":       code,
					"clientInfo": clientInfo,
				}
				viewerResponse := createSimpleResponseMessage(ClientConnected, clientConnectedPayload)
				viewerWS.Send(viewerResponse)
			}

			// Tell client to start WebRTC
			time.Sleep(1000 * time.Millisecond)
			if conn.IsOpen() {
				log.Printf("🔄 Sending connect signal to client for code: %s", code)
				connectPayload := map[string]interface{}{
					"timestamp": getCurrentTimestamp(),
					"message":   "Start WebRTC connection",
				}
				connectResponse := createSimpleResponseMessage(Connect, connectPayload)
				conn.Send(connectResponse)
			}
		}()

	} else if s.activeCodes[code] && s.sessions[code] != nil {
		// Session already exists
		session := s.sessions[code]
		session.mu.Lock()
		defer session.mu.Unlock()

		// Check if client is reconnecting
		if session.Client == nil || !session.Client.IsOpen() {
			// Update the client connection
			session.Client = conn
			conn.Role = ClientRole
			conn.SessionCode = code

			log.Printf("✅ Client reconnected with code: %s", code)
			reconnectPayload := map[string]interface{}{
				"timestamp": getCurrentTimestamp(),
				"reconnect": true,
			}
			response := createSimpleResponseMessage(SessionEstablished, reconnectPayload)
			conn.Send(response)

			// Notify reconnection
			if session.Viewer != nil && session.Viewer.IsOpen() {
				reconnectedPayload := map[string]interface{}{
					"timestamp": getCurrentTimestamp(),
				}
				viewerResponse := createSimpleResponseMessage(ClientReconnected, reconnectedPayload)
				session.Viewer.Send(viewerResponse)
			}

			// Tell client to start WebRTC after delay
			go func() {
				time.Sleep(1000 * time.Millisecond)
				if conn.IsOpen() {
					connectPayload := map[string]interface{}{
						"message":   "Restart WebRTC connection",
						"timestamp": getCurrentTimestamp(),
					}
					connectResponse := createSimpleResponseMessage(Connect, connectPayload)
					conn.Send(connectResponse)
				}
			}()

		} else if session.Client == conn {
			// Same client reconnecting
			log.Printf("✅ Client session refreshed for code: %s", code)
			refreshPayload := map[string]interface{}{
				"timestamp": getCurrentTimestamp(),
				"refresh":   true,
			}
			response := createSimpleResponseMessage(SessionEstablished, refreshPayload)
			conn.Send(response)
		} else {
			// Different client trying to use same code
			errorResponse := createSimpleResponseMessage(Error, map[string]string{
				"message": "Session already has an active client",
			})
			conn.Send(errorResponse)
			go func() {
				time.Sleep(500 * time.Millisecond)
				conn.Close()
			}()
		}
	} else {
		// Invalid code
		errorResponse := createSimpleResponseMessage(Error, map[string]string{
			"message": "Invalid code or no viewer waiting for this code",
		})
		conn.Send(errorResponse)
		go func() {
			time.Sleep(500 * time.Millisecond)
			conn.Close()
		}()
	}
}

// Handle viewer registration
func (s *Server) handleViewerRegister(conn *Connection, msg *Message) {
	code := msg.Code

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, hasPending := s.pendingCodes[code]; !hasPending && s.sessions[code] == nil {
		s.pendingCodes[code] = &PendingCode{
			CreatedAt: time.Now(),
			ViewerWS:  conn,
		}
		conn.SessionCode = code
		conn.Role = ViewerRole
	} else if session := s.sessions[code]; session != nil {
		session.mu.Lock()
		defer session.mu.Unlock()

		// Only allow one viewer per session
		if session.Viewer != nil && session.Viewer != conn {
			errorResponse := createSimpleResponseMessage(Error, map[string]string{
				"message": "Session already has a viewer connected",
			})
			conn.Send(errorResponse)
			return
		}

		session.Viewer = conn
		conn.SessionCode = code
		conn.Role = ViewerRole

		// Send current monitor info if available
		if session.Info != nil && session.Info.MonitorInfo != nil {
			monitorResponse := createSimpleResponseMessage(MonitorInfo, session.Info.MonitorInfo)
			conn.Send(monitorResponse)
		}

		// Notify client if connected
		if session.Client != nil && session.Client.IsOpen() {
			log.Printf("🔔 Notifying client that viewer connected for code: %s", code)
			viewerConnectedPayload := map[string]interface{}{
				"timestamp": getCurrentTimestamp(),
			}
			clientResponse := createSimpleResponseMessage(ViewerConnected, viewerConnectedPayload)
			session.Client.Send(clientResponse)
		}
	} else if pendingData := s.pendingCodes[code]; pendingData != nil {
		pendingData.ViewerWS = conn
		conn.SessionCode = code
		conn.Role = ViewerRole
	}
}

// Handle WebRTC signaling
func (s *Server) handleSignal(conn *Connection, msg *Message) {
	code := msg.Code
	
	s.mu.RLock()
	session := s.sessions[code]
	s.mu.RUnlock()
	
	log.Printf("📡 Received signal message from %s for code: %s", conn.Role, code)

	if session == nil {
		log.Printf("⚠️ Cannot relay signal: no session found for code %s", code)
		return
	}

	session.mu.RLock()
	defer session.mu.RUnlock()

	// Parse the payload to determine signal type for debugging
	var payload interface{}
	if len(msg.Payload) > 0 {
		json.Unmarshal(msg.Payload, &payload)
	}

	if conn.Role == ClientRole && session.Viewer != nil && session.Viewer.IsOpen() {
		log.Println("Forwarding signal from client to viewer")
		
		// Determine signal type for debugging
		signalType := "Unknown"
		if payloadMap, ok := payload.(map[string]interface{}); ok {
			if t, exists := payloadMap["type"]; exists {
				signalType = fmt.Sprintf("%v", t)
			} else if _, exists := payloadMap["candidate"]; exists {
				signalType = "ICE candidate"
			}
		}
		log.Printf("Signal type being forwarded: %s", signalType)

		// Add small delay to prevent signal races
		go func() {
			time.Sleep(50 * time.Millisecond)
			if session.Viewer.IsOpen() {
				response := createResponseMessage(Signal, payload)
				session.Viewer.Send(response)
			}
		}()

	} else if conn.Role == ViewerRole && session.Client != nil && session.Client.IsOpen() {
		log.Println("Forwarding signal from viewer to client")
		
		// Determine signal type for debugging
		signalType := "Unknown"
		if payloadMap, ok := payload.(map[string]interface{}); ok {
			if t, exists := payloadMap["type"]; exists {
				signalType = fmt.Sprintf("%v", t)
			} else if _, exists := payloadMap["candidate"]; exists {
				signalType = "ICE candidate"
			}
		}
		log.Printf("Signal type being forwarded: %s", signalType)

		// Add small delay to prevent signal races
		go func() {
			time.Sleep(50 * time.Millisecond)
			if session.Client.IsOpen() {
				response := createResponseMessage(Signal, payload)
				session.Client.Send(response)
			}
		}()

	} else {
		log.Printf("⚠️ Cannot relay signal: session state issue for %s", code)
		log.Printf("Role: %s, Session exists: %t, Client connected: %t, Viewer connected: %t",
			conn.Role, session != nil, session != nil && session.Client != nil && session.Client.IsOpen(),
			session != nil && session.Viewer != nil && session.Viewer.IsOpen())
	}
}

// Handle connect message
func (s *Server) handleConnect(conn *Connection, msg *Message) {
	code := msg.Code
	
	s.mu.RLock()
	session := s.sessions[code]
	s.mu.RUnlock()

	if conn.Role == ViewerRole && session != nil {
		session.mu.RLock()
		client := session.Client
		session.mu.RUnlock()

		if client != nil {
			log.Printf("🔄 Forwarding connect request to client for code: %s", code)
			if client.IsOpen() {
				response := createSimpleResponseMessage(Connect, nil)
				client.Send(response)
			} else {
				log.Printf("⚠️ Client for code %s not connected or ready", code)
			}
		}
	}
}

// Handle display configuration change
func (s *Server) handleDisplayConfigChanged(conn *Connection, msg *Message) {
	code := msg.Code
	
	s.mu.RLock()
	session := s.sessions[code]
	s.mu.RUnlock()

	if conn.Role == ClientRole && session != nil {
		session.mu.RLock()
		viewer := session.Viewer
		session.mu.RUnlock()

		if viewer != nil && viewer.IsOpen() {
			// Parse payload
			var payload interface{}
			if len(msg.Payload) > 0 {
				json.Unmarshal(msg.Payload, &payload)
			}
			
			response := createSimpleResponseMessage(DisplayConfigChanged, payload)
			viewer.Send(response)
		}
	}
}

// Handle monitor info update
func (s *Server) handleMonitorInfo(conn *Connection, msg *Message) {
	code := msg.Code
	
	s.mu.RLock()
	session := s.sessions[code]
	s.mu.RUnlock()

	if conn.Role == ClientRole && session != nil {
		log.Printf("📊 Received monitor info from client for code: %s", code)
		
		// Parse payload
		var payload interface{}
		if len(msg.Payload) > 0 {
			json.Unmarshal(msg.Payload, &payload)
		}
		
		session.mu.Lock()
		if session.Info != nil {
			session.Info.MonitorInfo = payload
		}
		viewer := session.Viewer
		session.mu.Unlock()

		if viewer != nil && viewer.IsOpen() {
			response := createSimpleResponseMessage(MonitorInfo, payload)
			viewer.Send(response)
		}
	}
}

// Handle process info update
func (s *Server) handleProcessInfo(conn *Connection, msg *Message) {
	code := msg.Code
	
	s.mu.RLock()
	session := s.sessions[code]
	s.mu.RUnlock()

	if conn.Role == ClientRole && session != nil {
		// Parse payload
		var payload interface{}
		if len(msg.Payload) > 0 {
			json.Unmarshal(msg.Payload, &payload)
		}
		
		session.mu.Lock()
		if session.Info != nil {
			session.Info.ProcessInfo = payload
		}
		viewer := session.Viewer
		session.mu.Unlock()

		if viewer != nil && viewer.IsOpen() {
			response := createSimpleResponseMessage(ProcessInfo, payload)
			viewer.Send(response)
		}
	}
}

// Handle admin command
func (s *Server) handleAdminCommand(conn *Connection, msg *Message) {
	if conn.Role != ViewerRole {
		return
	}

	code := msg.Code
	
	s.mu.RLock()
	session := s.sessions[code]
	s.mu.RUnlock()

	// Parse payload
	var payload map[string]interface{}
	if len(msg.Payload) > 0 {
		json.Unmarshal(msg.Payload, &payload)
	}

	if command, exists := payload["command"]; exists {
		log.Printf("Received admin command: %v for code: %s", command, code)

		if command == "disconnect" {
			if session != nil {
				session.mu.RLock()
				client := session.Client
				session.mu.RUnlock()

				if client != nil && client.IsOpen() {
					log.Printf("🔌 Sending disconnect command to client for code: %s", code)
					adminResponse := createSimpleResponseMessage(AdminCommand, payload)
					client.Send(adminResponse)
				}
			}

			// Notify viewer that disconnect request was processed
			responsePayload := map[string]interface{}{
				"command": "disconnect",
				"success": true,
				"message": "Disconnect request sent to client",
			}
			response := createSimpleResponseMessage(AdminCommandResponse, responsePayload)
			conn.Send(response)

		} else if session != nil {
			session.mu.RLock()
			client := session.Client
			session.mu.RUnlock()

			if client != nil && client.IsOpen() {
				// Forward other commands to client
				adminResponse := createSimpleResponseMessage(AdminCommand, payload)
				client.Send(adminResponse)
			} else {
				errorResponse := createSimpleResponseMessage(Error, map[string]string{
					"message": "Client not connected",
				})
				conn.Send(errorResponse)
			}
		}
	}
}

// Handle connection close
func (s *Server) handleConnectionClose(conn *Connection) {
	log.Printf("🔌 WebSocket closed: %s", conn.ID)

	// Clean up session if this connection was part of one
	sessionCode := conn.SessionCode
	if sessionCode != "" {
		s.mu.Lock()
		session := s.sessions[sessionCode]
		s.mu.Unlock()

		if session != nil {
			session.mu.Lock()
			defer session.mu.Unlock()

			if conn.Role == ClientRole && session.Client == conn {
				session.Client = nil
				log.Printf("🔌 Client disconnected from session %s", sessionCode)

				// Notify viewer if present
				if session.Viewer != nil && session.Viewer.IsOpen() {
					disconnectedPayload := map[string]interface{}{
						"timestamp": getCurrentTimestamp(),
						"code":      sessionCode,
					}
					response := createSimpleResponseMessage(ClientDisconnected, disconnectedPayload)
					session.Viewer.Send(response)
				}

			} else if conn.Role == ViewerRole && session.Viewer == conn {
				session.Viewer = nil
				log.Printf("🔌 Viewer disconnected from session %s", sessionCode)

				// Notify client if present
				if session.Client != nil && session.Client.IsOpen() {
					disconnectedPayload := map[string]interface{}{
						"timestamp": getCurrentTimestamp(),
						"code":      sessionCode,
					}
					response := createSimpleResponseMessage(ViewerDisconnected, disconnectedPayload)
					session.Client.Send(response)
				}
			}

			// Clean up session if both client and viewer are gone
			if session.Client == nil && session.Viewer == nil {
				s.mu.Lock()
				delete(s.sessions, sessionCode)
				delete(s.activeCodes, sessionCode)
				s.mu.Unlock()
				log.Printf("🧹 Cleaned up empty session %s", sessionCode)
			}
		}

		// Check if this was a pending code that never got claimed
		s.mu.Lock()
		if pendingData := s.pendingCodes[sessionCode]; pendingData != nil && pendingData.ViewerWS == conn {
			delete(s.pendingCodes, sessionCode)
		}
		s.mu.Unlock()
	}
}

// Start server
func (s *Server) Start() {
	// Load .env file
	err := godotenv.Load()
	if err != nil {
		log.Printf("Warning: Error loading .env file: %v", err)
		log.Println("Using environment variables or defaults")
	}

	// Initialize random seed
	rand.Seed(time.Now().UnixNano())

	// Start cleanup routine
	s.startCleanupRoutine()

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "3004"
	}

	// Setup HTTP handler
	http.HandleFunc("/", s.handleConnection)

	log.Printf("🚀 Signaling server running at ws://localhost:%s", port)

	// Start server
	err = http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatal("Server failed to start:", err)
	}
}

func main() {
	server := NewServer()
	server.Start()
}
