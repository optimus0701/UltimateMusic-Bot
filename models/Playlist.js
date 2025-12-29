const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        maxlength: 32
    },
    songs: [{
        title: {
            type: String,
            required: true
        },
        author: {
            type: String,
            required: true
        },
        url: {
            type: String,
            required: true
        },
        duration: {
            type: Number,
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Compound index for unique playlist name per user per guild
playlistSchema.index({ userId: 1, guildId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Playlist', playlistSchema);
