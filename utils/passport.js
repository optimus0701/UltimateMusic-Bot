const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const config = require('../config');

// Serialize user for session
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

// Discord OAuth Strategy
passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_REDIRECT_URI || 'http://localhost:8888/auth/callback',
    scope: ['identify', 'guilds']
},
    function (accessToken, refreshToken, profile, done) {
        // Return user profile
        return done(null, profile);
    }));

module.exports = passport;
