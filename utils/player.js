const CentralEmbedHandler = require('./centralEmbed');
const NowPlayingDisplay = require('./nowPlayingDisplay');

class PlayerHandler {
    constructor(client) {
        this.client = client;
        this.centralEmbed = new CentralEmbedHandler(client);
        this.nowPlayingDisplay = new NowPlayingDisplay(client);
    }

    async createPlayer(guildId, voiceChannelId, textChannelId, options = {}) {
        try {
            let player = this.client.riffy.players.get(guildId);

            if (player) {
                if (player.voiceChannel === voiceChannelId) {
                    return player;
                } else {
                    await player.setVoiceChannel(voiceChannelId);
                    return player;
                }
            }

            player = this.client.riffy.createConnection({
                guildId: guildId,
                voiceChannel: voiceChannelId,
                textChannel: textChannelId,
                deaf: true,
                ...options
            });

            return player;
        } catch (error) {
            console.error('Player creation error:', error.message);
            return null;
        }
    }

    async playSong(player, query, requester) {
        try {
            if (!player) return { type: 'error', message: 'Player not available' };

            let resolve;
            try {
                resolve = await this.client.riffy.resolve({
                    query: query,
                    requester: requester
                });
            } catch (resolveError) {
                // Node might be disconnected or failing — try to reconnect and retry once
                console.warn(`⚠️ Resolve failed: ${resolveError.message} — attempting failover with exclusion...`);

                if (this.client.reconnectLavalink) {
                    // Try to identify current node to exclude it
                    const currentNode = this.client.riffy.nodes.values().next().value;
                    const excludeNode = currentNode ? {
                        name: currentNode.name,
                        host: currentNode.host,
                        port: currentNode.port
                    } : null;

                    const reconnected = await this.client.reconnectLavalink(excludeNode);
                    if (reconnected) {
                        try {
                            resolve = await this.client.riffy.resolve({
                                query: query,
                                requester: requester
                            });
                        } catch (retryError) {
                            console.error('Retry resolve failed after switch:', retryError.message);
                            return { type: 'error', message: 'Không thể kết nối tới Lavalink server sau khi chuyển node' };
                        }
                    } else {
                        return { type: 'error', message: 'Không thể tìm thấy node Lavalink hoạt động' };
                    }
                } else {
                    return { type: 'error', message: 'Lavalink node không khả dụng' };
                }
            }

            const { loadType, tracks, playlistInfo } = resolve;

            if (loadType === 'playlist' || loadType === 'playlist_loaded') {
                for (const track of tracks) {
                    if (track && track.info) {
                        track.info.requester = requester;
                        player.queue.add(track);
                    }
                }

                if (!player.playing && !player.paused) {
                    const connected = await this.waitForConnection(player);
                    if (!connected) return { type: 'error', message: 'Voice connection timeout' };
                    try {
                        player.play();
                    } catch (playError) {
                        console.error('Player.play() error:', playError.message);
                        return { type: 'error', message: 'Failed to start playback' };
                    }
                }

                return {
                    type: 'playlist',
                    tracks: tracks.length,
                    name: playlistInfo?.name || 'Unknown Playlist'
                };

            } else if (loadType === 'search' || loadType === 'track' || loadType === 'search_result' || loadType === 'track_loaded' || (tracks && tracks.length > 0)) {
                const track = tracks[0];
                if (!track || !track.info) {
                    return { type: 'error', message: 'No results found' };
                }

                track.info.requester = requester;
                player.queue.add(track);

                if (!player.playing && !player.paused) {
                    const connected = await this.waitForConnection(player);
                    if (!connected) return { type: 'error', message: 'Voice connection timeout' };
                    try {
                        player.play();
                    } catch (playError) {
                        console.error('Player.play() error:', playError.message);
                        return { type: 'error', message: 'Failed to start playback' };
                    }
                }

                return {
                    type: 'track',
                    track: track
                };

            } else {
                return { type: 'error', message: 'No results found' };
            }

        } catch (error) {
            console.error('Play song error:', error.message);
            return { type: 'error', message: 'Failed to play song' };
        }
    }


    /**
     * Wait for player voice connection to be established.
     * Polls player.connected up to timeoutMs before calling play().
     * Prevents "Player connection is not initiated" crash on high-latency (HTTPS) connections.
     */
    async waitForConnection(player, timeoutMs = 5000) {
        if (player.connected) return true;
        const start = Date.now();
        while (!player.connected && Date.now() - start < timeoutMs) {
            await new Promise(r => setTimeout(r, 100));
        }
        if (!player.connected) {
            console.warn(`⚠️ Voice connection timeout after ${timeoutMs}ms for guild ${player.guildId}`);
            return false;
        }
        return true;
    }

    async getThumbnailSafely(track) {
        try {

            if (track.info.thumbnail instanceof Promise) {
                const thumbnail = await Promise.race([
                    track.info.thumbnail,
                    new Promise((_, reject) => setTimeout(() => reject('timeout'), 2000))
                ]);
                return typeof thumbnail === 'string' ? thumbnail : null;
            }


            if (typeof track.info.thumbnail === 'string' && track.info.thumbnail.trim() !== '') {
                return track.info.thumbnail;
            }


            if (track.info.identifier && track.info.sourceName === 'youtube') {
                return `https://img.youtube.com/vi/${track.info.identifier}/maxresdefault.jpg`;
            }

            return null;
        } catch (error) {

            if (track.info.identifier && track.info.sourceName === 'youtube') {
                return `https://img.youtube.com/vi/${track.info.identifier}/maxresdefault.jpg`;
            }
            return null;
        }
    }

    async getPlayerInfo(guildId) {
        try {
            const player = this.client.riffy.players.get(guildId);

            if (!player || !player.current || !player.current.info) {
                return null;
            }


            const thumbnail = await this.getThumbnailSafely(player.current);

            return {
                title: player.current.info.title || 'Unknown Title',
                author: player.current.info.author || 'Unknown Artist',
                duration: player.current.info.length || 0,
                thumbnail: thumbnail,
                requester: player.current.info.requester || null,
                playing: player.playing || false,
                paused: player.paused || false,
                position: player.position || 0,
                volume: player.volume || 50,
                loop: player.loop || 'none',
                queueLength: player.queue.size || 0
            };
        } catch (error) {
            console.error('Get player info error:', error.message);
            return null;
        }
    }

    initializeEvents() {
        this.client.riffy.on('trackStart', async (player, track) => {
            try {
                const trackTitle = track?.info?.title || 'Unknown Track';
                const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
                console.log(`[${timestamp}] 🎵 Started playing: ${trackTitle} in ${player.guildId}`);

                if (this.client.statusManager) {
                    await this.client.statusManager.onTrackStart(player.guildId, track);
                }

                if (track && track.info) {
                    const thumbnail = await this.getThumbnailSafely(track);

                    await this.centralEmbed.updateCentralEmbed(player.guildId, {
                        title: track.info.title || 'Unknown Title',
                        author: track.info.author || 'Unknown Artist',
                        duration: track.info.length || 0,
                        thumbnail: thumbnail,
                        requester: track.info.requester || null,
                        paused: player.paused || false,
                        volume: player.volume || 50,
                        loop: player.loop || 'none',
                        queueLength: player.queue.size || 0
                    });

                    // Send beautiful Now Playing embed
                    await this.nowPlayingDisplay.sendNowPlaying(player, track, thumbnail);
                }
            } catch (error) {
                console.error('Track start error:', error.message);
            }
        });

        this.client.riffy.on('trackEnd', async (player, track) => {
            try {
                const trackTitle = track?.info?.title || 'Unknown Track';
                const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
                console.log(`[${timestamp}] 🎵 Finished playing: ${trackTitle} in ${player.guildId}`);

                if (this.client.statusManager) {
                    await this.client.statusManager.onTrackEnd(player.guildId);
                }
            } catch (error) {
                console.error('Track end error (handled):', error.message);
            }
        });

        this.client.riffy.on('queueEnd', async (player) => {
            try {
                const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
                console.log(`[${timestamp}] 🎵 Queue ended in ${player.guildId}`);

                await this.centralEmbed.updateCentralEmbed(player.guildId, null);

                // Guard: if player is no longer connected (e.g. destroyed by trackError), skip
                if (!player.connected) {
                    return;
                }

                const serverConfig = await require('../models/Server').findById(player.guildId);

                if (serverConfig?.settings?.autoplay) {
                    player.isAutoplay = true;
                }

                if (player.isAutoplay) {
                    player.autoplay(player);
                } else {
                    if (this.client.statusManager) {
                        await this.client.statusManager.onPlayerDisconnect(player.guildId);
                    }
                    player.destroy();
                }
            } catch (error) {
                console.error('Queue end error:', error.message);
                try {
                    player.destroy();
                } catch (destroyError) {
                    console.error('Player destroy error:', destroyError.message);
                }
            }
        });

        this.client.riffy.on('playerCreate', async (player) => {
            try {
                const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
                console.log(`[${timestamp}] 🎵 Player created for guild ${player.guildId}`);
            } catch (error) {
                console.error('Player create error:', error.message);
            }
        });

        this.client.riffy.on('playerDisconnect', async (player) => {
            try {
                const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
                console.log(`[${timestamp}] 🎵 Player destroyed for guild ${player.guildId}`);

                if (this.client.statusManager) {
                    await this.client.statusManager.onPlayerDisconnect(player.guildId);
                }

                await this.centralEmbed.updateCentralEmbed(player.guildId, null);
            } catch (error) {
                console.error('Player disconnect error:', error.message);
            }
        });

        this.client.riffy.on('trackError', async (player, track, error) => {
            try {
                const trackTitle = track?.info?.title || 'Unknown Track';
                const errorMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
                console.error(`❌ Track error: ${trackTitle} in ${player.guildId} — ${errorMsg}`);

                // Check for YouTube-specific errors that warrant a node switch (e.g. login required, rate limited)
                const isYoutubeError = track?.info?.sourceName === 'youtube';
                const needsSwitch = errorMsg.includes('login') || errorMsg.includes('403') || errorMsg.includes('rate limit');

                if (isYoutubeError && needsSwitch && this.client.reconnectLavalink) {
                    console.log(`📡 YouTube issue detected on current node. Attempting failover for ${player.guildId}...`);

                    const currentNode = this.client.riffy.nodes.values().next().value;
                    const excludeNode = currentNode ? {
                        name: currentNode.name,
                        host: currentNode.host,
                        port: currentNode.port
                    } : null;

                    const switched = await this.client.reconnectLavalink(excludeNode);
                    if (switched) {
                        // Re-add to queue and try playing again on the new node
                        player.queue.unshift(track);
                        player.stop(); // This will trigger next track (the one we just unshifted)
                        return;
                    }
                }

                // Notify the text channel about the error
                const guild = this.client.guilds.cache.get(player.guildId);
                const textChannel = guild?.channels.cache.get(player.textChannel);
                if (textChannel) {
                    const { EmbedBuilder } = require('discord.js');
                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription(`❌ Không thể phát **${trackTitle}** — bài hát có thể bị giới hạn hoặc không khả dụng.`);
                    await textChannel.send({ embeds: [embed] }).catch(() => { });
                }

                // Use stop() instead of destroy() to let queueEnd handle cleanup normally
                player.stop();
            } catch (err) {
                console.error('Track error handler failed:', err.message);
                try { player.stop(); } catch (_) { }
            }
        });

        this.client.riffy.on('trackStuck', async (player, track, threshold) => {
            try {
                const trackTitle = track?.info?.title || 'Unknown Track';
                console.warn(`⚠️ Track stuck: ${trackTitle} in ${player.guildId} (threshold: ${threshold}ms)`);

                const guild = this.client.guilds.cache.get(player.guildId);
                const textChannel = guild?.channels.cache.get(player.textChannel);
                if (textChannel) {
                    const { EmbedBuilder } = require('discord.js');
                    const embed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setDescription(`⚠️ Bài **${trackTitle}** bị stuck. Đang bỏ qua sang bài tiếp theo...`);
                    await textChannel.send({ embeds: [embed] }).catch(() => { });
                }

                // Skip to next track
                player.stop();
            } catch (err) {
                console.error('Track stuck handler failed:', err.message);
            }
        });

        this.client.riffy.on('nodeError', (node, error) => {
            const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
            console.error(`[${ts}] 🔴 [Lavalink] Node "${node.name}" (${node.host}:${node.port}) error: ${error.message}`);
        });

        this.client.riffy.on('nodeDisconnect', (node) => {
            const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
            console.warn(`[${ts}] 🟡 [Lavalink] Node "${node.name}" (${node.host}:${node.port}) disconnected — failover sẽ tự chuyển sang node khác nếu có`);
        });
    }
}

module.exports = PlayerHandler;
