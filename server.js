const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const BEARER_TOKEN = process.env.BEARER_TOKEN || 'default-secret'; // Set via env for security

// In-memory channel subscriptions (Map<channel, Set<ws>>)
const channels = new Map();

// Middleware for bearer auth
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
    }
    const token = authHeader.split(' ')[1];
    if (token !== BEARER_TOKEN) {
        return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
    next();
};

// Static serve client.js (for CDN simulation; in prod, upload to actual CDN)
app.use(express.static(__dirname));

// HTTP endpoint to push a message to a channel
app.post('/send/:channel', express.json(), authMiddleware, (req, res) => {
    const { channel } = req.params;
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Missing message in body' });
    }

    if (!channels.has(channel)) {
        return res.status(200).json({ status: 'No subscribers, but message accepted' });
    }

    const clients = channels.get(channel);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ channel, message }));
        }
    });

    res.status(200).json({ status: 'Message sent' });
});

// WebSocket handling
wss.on('connection', (ws, req) => {
    const channel = req.url.substring(1); // e.g., ws://host/channel123 -> 'channel123'
    if (!channel) {
        ws.close(1008, 'Channel required in URL');
        return;
    }

    if (!channels.has(channel)) {
        channels.set(channel, new Set());
    }
    channels.get(channel).add(ws);

    ws.on('close', () => {
        const clients = channels.get(channel);
        if (clients) {
            clients.delete(ws);
            if (clients.size === 0) {
                channels.delete(channel);
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});