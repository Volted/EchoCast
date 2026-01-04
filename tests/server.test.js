const request = require('supertest');
const WebSocket = require('ws');
const http = require('http');
const express = require('express');

// Mock the server for testing
let app, server, wss;
beforeAll(() => {
    app = express();
    server = http.createServer(app);
    wss = new WebSocket.Server({ server });

    const channels = new Map();
    const BEARER_TOKEN = 'test-secret';

    const authMiddleware = (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${BEARER_TOKEN}`) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
    };

    app.use(express.static(__dirname + '/../'));
    app.post('/send/:channel', express.json(), authMiddleware, (req, res) => {
        const { channel } = req.params;
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Missing message' });
        if (channels.has(channel)) {
            channels.get(channel).forEach(client => client.send(JSON.stringify({ channel, message })));
        }
        res.status(200).json({ status: 'Message sent' });
    });

    wss.on('connection', (ws, req) => {
        const channel = req.url.substring(1);
        if (!channel) return ws.close();
        if (!channels.has(channel)) channels.set(channel, new Set());
        channels.get(channel).add(ws);
        ws.on('close', () => {
            channels.get(channel).delete(ws);
            if (channels.get(channel).size === 0) channels.delete(channel);
        });
    });

    server.listen(0); // Random port for testing
});

afterAll(() => {
    wss.close();
    server.close();
});

describe('Server Tests', () => {
    test('Unauthorized send request', async () => {
        const res = await request(server).post('/send/testchannel').send({ message: 'hello' });
        expect(res.status).toBe(401);
    });

    test('Authorized send without subscribers', async () => {
        const res = await request(server)
            .post('/send/testchannel')
            .set('Authorization', 'Bearer test-secret')
            .send({ message: 'hello' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('Message sent');
    });

    test('WebSocket connection and message broadcast', (done) => {
        const port = server.address().port;
        const ws = new WebSocket(`ws://localhost:${port}/testchannel`);

        ws.on('open', () => {
            request(server)
                .post('/send/testchannel')
                .set('Authorization', 'Bearer test-secret')
                .send({ message: 'hello' })
                .then(() => {});
        });

        ws.on('message', (data) => {
            const parsed = JSON.parse(data);
            expect(parsed.message).toBe('hello');
            ws.close();
            done();
        });
    });

    test('Missing channel in WS', (done) => {
        const port = server.address().port;
        const ws = new WebSocket(`ws://localhost:${port}/`);
        ws.on('close', () => {
            done();
        });
    });
});