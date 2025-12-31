const mongoose = require('mongoose');

const djPermissionSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    djUsers: [{
        userId: {
            type: String,
            required: true
        },
        addedBy: {
            type: String,
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    djRoles: [{
        roleId: {
            type: String,
            required: true
        },
        addedBy: {
            type: String,
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

// Index for faster queries
djPermissionSchema.index({ guildId: 1 });

module.exports = mongoose.model('DJPermission', djPermissionSchema);
