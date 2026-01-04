# Node.js WebSocket Messenger

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)

A lightweight, stateless WebSocket-based messenger built with Node.js. This application enables real-time messaging through WebSocket channels, where clients can subscribe to channels and receive instant updates. Messages are pushed via an authenticated HTTP endpoint using bearer token authentication. The client-side JavaScript is designed to be CDN-friendly, allowing it to be hosted separately for easy integration into web applications.

This project is a monorepo, keeping everything in a single repository for simplicity. It's stateless, meaning it relies on in-memory storage for connections (no database required), making it ideal for quick prototypes or single-instance deployments. For production scalability, integration with a pub/sub system like Redis is recommended.

## Table of Contents

- [Features](#features)
- [Inner Structure](#inner-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
    - [Starting the Server](#starting-the-server)
    - [Pushing Messages (Server-Side)](#pushing-messages-server-side)
    - [Client-Side Integration](#client-side-integration)
- [Use Cases](#use-cases)
- [Testing](#testing)
- [Scaling Considerations](#scaling-considerations)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Real-Time Messaging**: Clients connect via WebSocket to specific channels and receive messages instantly.
- **Stateless Design**: No persistent storage; connections are managed in-memory for lightweight operation.
- **Bearer Token Authentication**: Secure message pushing via HTTP POST with a configurable bearer token.
- **CDN-Friendly Client**: A single `client.js` file that can be hosted on a CDN for establishing WebSocket connections.
- **Channel-Based Subscriptions**: Clients subscribe to named channels (e.g., "room1", "user123-notifications").
- **Broadcasting**: Messages sent to a channel are delivered to all connected clients in that channel.
- **Error Handling**: Basic checks for invalid channels, missing messages, and authentication failures.
- **Test Suite**: Included Jest tests for server functionality, authentication, and WebSocket behavior.

## Inner Structure

The application is structured as a monorepo with minimal files for ease of maintenance. Here's the file tree:

```
messenger/
├── package.json          # Project metadata, dependencies, and scripts
├── server.js             # Core server logic: Handles HTTP endpoints and WebSocket server
├── client.js             # Client-side JavaScript: Establishes WebSocket connections (CDN-able)
├── tests/                # Test directory
│   └── server.test.js    # Jest tests for server, auth, and WebSocket functionality
└── README.md             # This documentation file
```

### How It Works Internally

1. **Server Initialization**:
    - Uses Express.js for HTTP routing and `ws` library for WebSocket.
    - Creates an in-memory `Map` to track channels and their connected WebSocket clients (as Sets).

2. **WebSocket Connection**:
    - Clients connect to `ws://host/channelName`.
    - The server extracts the channel from the URL and adds the WebSocket instance to the channel's Set.
    - On close, the client is removed; empty channels are deleted to free memory.

3. **Message Pushing**:
    - HTTP POST to `/send/:channel` with JSON body `{ "message": "your message" }`.
    - Authenticated via bearer token (checked against `process.env.BEARER_TOKEN`).
    - If authenticated, broadcasts the message to all open clients in the channel.

4. **Client-Side**:
    - `client.js` exposes `connectToChannel(channel, onMessageCallback)` to open a WebSocket.
    - Handles open, message, close, and error events.
    - Returns a disconnect function for cleanup.

5. **Stateless Nature**:
    - No database or session persistence; restarting the server drops all connections.
    - Suitable for horizontal scaling with a shared pub/sub backend (not included).

This design ensures low overhead, with the server acting as a simple relay for real-time updates.

## Installation

1. Clone the repository:
   ```
   git clone https://your-repo-url/messenger.git
   cd messenger
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set the bearer token environment variable (required for authentication):
   ```
   export BEARER_TOKEN=your-secret-key
   ```

## Configuration

- **Environment Variables**:
    - `PORT`: Server port (default: 3000).
    - `BEARER_TOKEN`: Secret key for authenticating message pushes (default: 'default-secret' – change this immediately!).

- **Customization**:
    - Edit `server.js` to add rate limiting (e.g., via `express-rate-limit`).
    - For HTTPS, wrap the server with Node's `https` module or use a reverse proxy like Nginx.

## Usage

### Starting the Server

Run the server:
```
npm start
```
The server will listen on `http://localhost:3000` (or your configured port). WebSocket endpoint: `ws://localhost:3000/channelName`.

### Pushing Messages (Server-Side)

Use an HTTP client like curl to send messages:
```
curl -H "Authorization: Bearer your-secret-key" \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello, world!"}' \
     http://localhost:3000/send/myChannel
```

- Response: `{ "status": "Message sent" }` (200 OK) even if no subscribers.
- Errors: 401 (Unauthorized), 403 (Forbidden), 400 (Missing message).

Integrate this endpoint into your backend services for triggering notifications.

### Client-Side Integration

1. Host `client.js` on a CDN or serve it statically (it's available at `http://localhost:3000/client.js` during development).

2. In your HTML:
   ```html
   <script src="https://your-cdn.com/client.js"></script>
   <script>
     // Connect to a channel
     const disconnect = connectToChannel('myChannel', (message) => {
       console.log('Received message:', message);
       // Update UI, e.g., append to chat log
     });

     // Later, to disconnect:
     // disconnect();
   </script>
   ```

- The WebSocket URL is auto-detected based on the current protocol/host.
- Handles JSON-parsed messages; errors are logged to console.

## Use Cases

This messenger is versatile for real-time applications. Here are some examples:

1. **Chat Applications**:
    - Use channels for rooms (e.g., "general-chat").
    - Clients subscribe to rooms; servers push user messages.
    - Ideal for small-scale group chats or live support.

2. **Notification System**:
    - Channels per user (e.g., "user-123-notifications").
    - Backend services push alerts (e.g., order updates, mentions).
    - Clients in web apps receive instant pop-ups.

3. **Live Updates Dashboard**:
    - Channels for data streams (e.g., "stock-ticker-AAPL").
    - Servers push real-time data from APIs.
    - Clients update UI elements like graphs or tables without polling.

4. **Collaborative Tools**:
    - Channels for documents (e.g., "doc-456-edits").
    - Push changes from one user to others for real-time editing.

5. **IoT Monitoring**:
    - Channels for devices (e.g., "sensor-001").
    - Devices or gateways push status updates.
    - Web dashboards subscribe for live monitoring.

6. **Gaming**:
    - Channels for game lobbies.
    - Push moves or events to connected players.

In all cases, the stateless design keeps it simple, but for high-traffic, add persistence.

## Testing

The project includes a Jest test suite in `tests/server.test.js`.

Run tests:
```
npm test
```

Tests cover:
- Unauthorized requests.
- Authorized sends with/without subscribers.
- WebSocket connections and message broadcasting.
- Invalid channel handling.

Expand tests as needed for custom features.

## Scaling Considerations

- **Single-Instance Limitation**: In-memory storage means connections are lost on restart, and it doesn't scale horizontally.
- **Recommendations**:
    - Integrate Redis Pub/Sub for channel broadcasting across instances.
    - Use load balancers with sticky sessions for WebSockets.
    - Add monitoring (e.g., Prometheus) for connection counts.
- **Security**: Always use HTTPS in production; rotate bearer tokens regularly.

## Contributing

Contributions are welcome! Follow these steps:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/YourFeature`).
3. Commit changes (`git commit -m 'Add YourFeature'`).
4. Push to the branch (`git push origin feature/YourFeature`).
5. Open a Pull Request.


