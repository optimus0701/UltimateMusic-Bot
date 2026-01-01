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
    } else if (!member && djPermissions && djPermissions.djRoles.length > 0) {
        // If no member object (e.g. from Web UI), but DJ roles are required, 
        // we might fail validation if roles are strictly enforced. 
        // However, for web dashboard, we can't easily check roles without fetching member.
        // For now, if user is not in djUsers, and we can't check roles, strict DJ mode might block them.

        // Strategy: Try to fetch member from guild if client is available
        if (interaction.guild && interaction.client) {
            try {
                const guild = interaction.client.guilds.cache.get(interaction.guild.id);
                if (guild) {
                    const fetchedMember = await guild.members.fetch(interaction.user.id);
                    if (fetchedMember && fetchedMember.roles) {
                        const hasDJRole = djPermissions.djRoles.some(dj =>
                            fetchedMember.roles.cache.has(dj.roleId)
                        );
                        if (hasDJRole) return true;
                    }
                }
            } catch (e) {
                // Ignore fetch errors
            }
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
