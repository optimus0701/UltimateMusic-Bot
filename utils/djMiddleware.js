const config = require('../config');

/**
 * Check if user has DJ permissions
 * @param {Interaction} interaction - Discord interaction
 * @param {Object} djPermissions - DJ permissions from database
 * @returns {Boolean} - True if user has permissions
 */
async function hasDJPermission(interaction, djPermissions = null) {
    // Owner always has permission
    if (config.bot.ownerIds.includes(interaction.user.id)) {
        return true;
    }

    // Server owner always has permission
    if (interaction.guild.ownerId === interaction.user.id) {
        return true;
    }

    // If no DJ permissions set, anyone can use (backward compatibility)
    if (!djPermissions || (!djPermissions.djUsers.length && !djPermissions.djRoles.length)) {
        return true;
    }

    // Check if user is in DJ users list
    const isDJUser = djPermissions.djUsers.some(dj => dj.userId === interaction.user.id);
    if (isDJUser) {
        return true;
    }

    // Check if user has any DJ role
    const member = interaction.member;
    if (member && member.roles) {
        const hasDJRole = djPermissions.djRoles.some(dj =>
            member.roles.cache.has(dj.roleId)
        );
        if (hasDJRole) {
            return true;
        }
    }

    return false;
}

/**
 * Check if user is server owner or bot owner
 * @param {Interaction} interaction - Discord interaction
 * @returns {Boolean} - True if user is owner
 */
function isOwner(interaction) {
    return config.bot.ownerIds.includes(interaction.user.id) ||
        interaction.guild.ownerId === interaction.user.id;
}

module.exports = {
    hasDJPermission,
    isOwner
};
