const Playlist = require('../models/Playlist');

class PlaylistManager {
    /**
     * Create a new playlist
     */
    async createPlaylist(userId, guildId, name) {
        try {
            // Validate name
            if (!name || name.length > 32) {
                throw new Error('Playlist name must be between 1 and 32 characters!');
            }

            // Check if playlist already exists
            const exists = await this.playlistExists(userId, null, name);
            if (exists) {
                throw new Error('A playlist with this name already exists!');
            }

            const playlist = new Playlist({
                userId,
                guildId,
                name,
                songs: []
            });

            await playlist.save();
            return playlist;
        } catch (error) {
            if (error.code === 11000) {
                throw new Error('A playlist with this name already exists!');
            }
            throw error;
        }
    }

    /**
     * Delete a playlist
     */
    async deletePlaylist(userId, guildId, name) {
        const result = await Playlist.findOneAndDelete({
            userId,
            name
        });

        if (!result) {
            throw new Error('Playlist not found!');
        }

        return result;
    }

    /**
     * Get a specific playlist
     */
    async getPlaylist(userId, guildId, name) {
        const playlist = await Playlist.findOne({
            userId,
            name
        });

        if (!playlist) {
            throw new Error('Playlist not found!');
        }

        return playlist;
    }

    /**
     * Get all playlists for a user in a guild
     */
    async getUserPlaylists(userId, guildId = null) {
        const query = { userId };
        if (guildId) {
            query.guildId = guildId;
        }

        const playlists = await Playlist.find(query).sort({ createdAt: -1 });

        return playlists;
    }

    /**
     * Add a song to playlist
     */
    async addSong(userId, guildId, playlistName, songData) {
        const playlist = await Playlist.findOne({
            userId,
            name: playlistName
        });

        if (!playlist) {
            throw new Error('Playlist not found!');
        }

        // Check if song already exists in playlist
        const songExists = playlist.songs.some(song => song.url === songData.url);
        if (songExists) {
            throw new Error('This song is already in the playlist!');
        }

        playlist.songs.push({
            title: songData.title,
            author: songData.author,
            url: songData.url,
            duration: songData.duration,
            addedAt: new Date()
        });

        await playlist.save();
        return playlist;
    }

    /**
     * Remove a song from playlist by position
     */
    async removeSong(userId, guildId, playlistName, position) {
        const playlist = await Playlist.findOne({
            userId,
            name: playlistName
        });

        if (!playlist) {
            throw new Error('Playlist not found!');
        }

        if (position < 1 || position > playlist.songs.length) {
            throw new Error(`Invalid position! Playlist has ${playlist.songs.length} songs.`);
        }

        const removedSong = playlist.songs[position - 1];
        playlist.songs.splice(position - 1, 1);

        await playlist.save();
        return { playlist, removedSong };
    }

    /**
     * Rename a playlist
     */
    async renamePlaylist(userId, guildId, oldName, newName) {
        // Validate new name
        if (!newName || newName.length > 32) {
            throw new Error('New playlist name must be between 1 and 32 characters!');
        }

        // Check if new name already exists
        const exists = await this.playlistExists(userId, null, newName);
        if (exists) {
            throw new Error('A playlist with the new name already exists!');
        }

        const playlist = await Playlist.findOneAndUpdate(
            { userId, name: oldName },
            { name: newName },
            { new: true }
        );

        if (!playlist) {
            throw new Error('Playlist not found!');
        }

        return playlist;
    }

    /**
     * Check if a playlist exists
     */
    async playlistExists(userId, guildId, name) {
        const count = await Playlist.countDocuments({
            userId,
            name
        });

        return count > 0;
    }

    /**
     * Get playlist count for a user
     */
    async getPlaylistCount(userId, guildId) {
        return await Playlist.countDocuments({
            userId
        });
    }
}

module.exports = PlaylistManager;
