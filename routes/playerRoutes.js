const express = require('express');
const router = express.Router();
const { hasDJPermission } = require('../utils/djMiddleware');
const DJPermission = require('../models/DJPermission');
const config = require('../config');

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

// Get player status
router.get('/status', requireAuth, async (req, res) => {
    try {
        const client = req.app.get('discordClient');
        if (!client || !client.riffy) {
            return res.json({ active: false, players: [] });
        }

        const userId = req.user.id;
        const players = [];
        let userVoiceGuildId = null;

        for (const [guildId, player] of client.riffy.players) {
            const djPermissions = await DJPermission.findOne({ guildId });
            const mockInteraction = {
                user: { id: userId },
                guild: { id: guildId, ownerId: null },
                member: null
            };

            const isOwner = config.bot.ownerIds.includes(userId);
            const hasPermission = isOwner || await hasDJPermission(mockInteraction, djPermissions);

            if (hasPermission && player.current) {
                const guild = client.guilds.cache.get(guildId);
                const member = guild?.members.cache.get(userId);
                const userInVoice = member?.voice?.channelId ? true : false;

                if (userInVoice && !userVoiceGuildId) {
                    userVoiceGuildId = guildId;
                }

                const track = player.current;
                players.push({
                    guildId: guildId,
                    guildName: guild?.name || 'Unknown',
                    userInVoice: userInVoice,
                    track: {
                        title: track.info?.title || 'Unknown',
                        author: track.info?.author || 'Unknown',
                        duration: track.info?.length || 0,
                        thumbnail: track.info?.artworkUrl || track.info?.thumbnail || null,
                        url: track.info?.uri || null
                    },
                    position: player.position || 0,
                    volume: player.volume || 100,
                    paused: player.paused || false,
                    queue: player.queue?.map(t => ({
                        title: t.info?.title || 'Unknown',
                        author: t.info?.author || 'Unknown',
                        duration: t.info?.length || 0
                    })) || []
                });
            }
        }

        if (userVoiceGuildId) {
            players.sort((a, b) => (a.guildId === userVoiceGuildId ? -1 : 1));
        }

        res.json({
            active: players.length > 0,
            players: players,
            userVoiceGuildId: userVoiceGuildId
        });
    } catch (error) {
        console.error('Error getting player status:', error);
        res.status(500).json({ error: 'Failed to get player status' });
    }
});

// Skip current track
router.post('/skip', requireAuth, async (req, res) => {
    try {
        const { guildId } = req.body;
        if (!guildId) {
            return res.status(400).json({ error: 'Guild ID required' });
        }

        const client = req.app.get('discordClient');
        const player = client.riffy?.players.get(guildId);

        if (!player) {
            return res.status(404).json({ error: 'No active player' });
        }

        // Check permissions
        const djPermissions = await DJPermission.findOne({ guildId });
        const mockInteraction = {
            user: { id: req.user.id },
            guild: { id: guildId, ownerId: null },
            member: null
        };

        const isOwner = config.bot.ownerIds.includes(req.user.id);
        const hasPermission = isOwner || await hasDJPermission(mockInteraction, djPermissions);

        if (!hasPermission) {
            return res.status(403).json({ error: 'No permission' });
        }

        player.stop();
        res.json({ success: true, message: 'Track skipped' });
    } catch (error) {
        console.error('Error skipping track:', error);
        res.status(500).json({ error: 'Failed to skip track' });
    }
});

// Stop playback
router.post('/stop', requireAuth, async (req, res) => {
    try {
        const { guildId } = req.body;
        if (!guildId) {
            return res.status(400).json({ error: 'Guild ID required' });
        }

        const client = req.app.get('discordClient');
        const player = client.riffy?.players.get(guildId);

        if (!player) {
            return res.status(404).json({ error: 'No active player' });
        }

        // Check permissions
        const djPermissions = await DJPermission.findOne({ guildId });
        const mockInteraction = {
            user: { id: req.user.id },
            guild: { id: guildId, ownerId: null },
            member: null
        };

        const isOwner = config.bot.ownerIds.includes(req.user.id);
        const hasPermission = isOwner || await hasDJPermission(mockInteraction, djPermissions);

        if (!hasPermission) {
            return res.status(403).json({ error: 'No permission' });
        }

        player.destroy();
        res.json({ success: true, message: 'Playback stopped' });
    } catch (error) {
        console.error('Error stopping playback:', error);
        res.status(500).json({ error: 'Failed to stop playback' });
    }
});

// Pause/Resume
router.post('/pause', requireAuth, async (req, res) => {
    try {
        const { guildId } = req.body;
        if (!guildId) {
            return res.status(400).json({ error: 'Guild ID required' });
        }

        const client = req.app.get('discordClient');
        const player = client.riffy?.players.get(guildId);

        if (!player) {
            return res.status(404).json({ error: 'No active player' });
        }

        // Check permissions
        const djPermissions = await DJPermission.findOne({ guildId });
        const mockInteraction = {
            user: { id: req.user.id },
            guild: { id: guildId, ownerId: null },
            member: null
        };

        const isOwner = config.bot.ownerIds.includes(req.user.id);
        const hasPermission = isOwner || await hasDJPermission(mockInteraction, djPermissions);

        if (!hasPermission) {
            return res.status(403).json({ error: 'No permission' });
        }

        player.pause(!player.paused);
        res.json({ success: true, paused: player.paused });
    } catch (error) {
        console.error('Error toggling pause:', error);
        res.status(500).json({ error: 'Failed to toggle pause' });
    }
});

// Set volume
router.post('/volume', requireAuth, async (req, res) => {
    try {
        const { guildId, volume } = req.body;
        if (!guildId || volume === undefined) {
            return res.status(400).json({ error: 'Guild ID and volume required' });
        }

        if (volume < 0 || volume > 100) {
            return res.status(400).json({ error: 'Volume must be between 0 and 100' });
        }

        const client = req.app.get('discordClient');
        const player = client.riffy?.players.get(guildId);

        if (!player) {
            return res.status(404).json({ error: 'No active player' });
        }

        // Check permissions
        const djPermissions = await DJPermission.findOne({ guildId });
        const mockInteraction = {
            user: { id: req.user.id },
            guild: { id: guildId, ownerId: null },
            member: null
        };

        const isOwner = config.bot.ownerIds.includes(req.user.id);
        const hasPermission = isOwner || await hasDJPermission(mockInteraction, djPermissions);

        if (!hasPermission) {
            return res.status(403).json({ error: 'No permission' });
        }

        player.setVolume(volume);
        res.json({ success: true, volume: volume });
    } catch (error) {
        console.error('Error setting volume:', error);
        res.status(500).json({ error: 'Failed to set volume' });
    }
});

module.exports = router;
