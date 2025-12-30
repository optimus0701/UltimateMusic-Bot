const mainClient = require('./main');
require('./shiva');
const path = require('path');
const express = require("express");
const app = express();
const port = 8888;

// Store bot start time
const botStartTime = Date.now();

// Serve main dashboard
app.get('/', (req, res) => {
    const imagePath = path.join(__dirname, 'index.html');
    res.sendFile(imagePath);
});

// API endpoint for bot stats
app.get('/api/stats', (req, res) => {
    try {
        const client = mainClient;

        // Calculate stats
        const serverCount = client.guilds.cache.size;
        const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const uptime = Date.now() - botStartTime;

        res.json({
            success: true,
            data: {
                botStartTime: botStartTime,
                uptime: uptime,
                servers: serverCount,
                users: userCount,
                timestamp: Date.now()
            }
        });
    } catch (error) {
        res.json({
            success: false,
            error: 'Failed to fetch stats',
            data: {
                botStartTime: botStartTime,
                uptime: Date.now() - botStartTime,
                servers: 0,
                users: 0,
                timestamp: Date.now()
            }
        });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🔗 Listening to GlaceYT : http://0.0.0.0:${port}`);
});
