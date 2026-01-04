// Client-side JS for establishing WebSocket connection
// Usage: Load this script in browser, then call connectToChannel(channel, onMessageCallback)
// Example: <script src="https://your-cdn.com/client.js"></script>
// Then: connectToChannel('myChannel', (msg) => console.log('Received:', msg));

function connectToChannel(channel, onMessage) {
    if (!channel) {
        throw new Error('Channel is required');
    }
    if (typeof onMessage !== 'function') {
        throw new Error('onMessage callback is required');
    }

    const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/' + channel;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log(`Connected to channel: ${channel}`);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            onMessage(data.message);
        } catch (err) {
            console.error('Invalid message format:', err);
        }
    };

    ws.onclose = () => {
        console.log(`Disconnected from channel: ${channel}`);
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
    };

    // Return disconnect function
    return () => ws.close();
}

// Export for module usage (optional, for modern browsers or bundlers)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { connectToChannel };
} else {
    window.connectToChannel = connectToChannel;
}