const express = require('express');
const router = express.Router();
const passport = require('../utils/passport');
const { hasDJPermission } = require('../utils/djMiddleware');
const DJPermission = require('../models/DJPermission');
const config = require('../config');

// Login route
router.get('/login', passport.authenticate('discord'));

// Callback route
router.get('/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/');
    }
);

// Logout route
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

// Get current user info
router.get('/user', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.json({ authenticated: false });
    }

    try {
        const user = req.user;

        // Check if user has DJ permissions on any server
        const permissions = {};

        // Get guilds where user has DJ permissions
        const djPerms = await DJPermission.find({
            $or: [
                { 'djUsers.userId': user.id }
            ]
        });

        for (const perm of djPerms) {
            permissions[perm.guildId] = true;
        }

        // Check if user is bot owner
        const isOwner = config.bot.ownerIds.includes(user.id);

        res.json({
            authenticated: true,
            user: {
                id: user.id,
                username: user.username,
                discriminator: user.discriminator,
                avatar: user.avatar,
                isOwner: isOwner
            },
            permissions: permissions
        });
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ error: 'Failed to fetch user info' });
    }
});

module.exports = router;
