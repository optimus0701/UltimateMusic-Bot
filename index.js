const mainClient = require('./main');
require('./shiva');
const path = require('path');
const express = require("express");
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./utils/passport');
const authRoutes = require('./routes/authRoutes');
const playerRoutes = require('./routes/playerRoutes');

const app = express();
const port = 8888;

// Store bot start time
const botStartTime = Date.now();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 14 * 24 * 60 * 60 // 14 days
    }),
    cookie: {
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Store Discord client in app for routes to access
app.set('discordClient', mainClient);

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

// Auth routes
app.use('/auth', authRoutes);

// Player API routes
app.use('/api/player', playerRoutes);

app.listen(port, '0.0.0.0', () => {
    console.log(`🔗 Listening to GlaceYT : http://0.0.0.0:${port}`);
});
