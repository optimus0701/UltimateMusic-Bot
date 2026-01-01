const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const DJPermission = require('../../models/DJPermission');
const shiva = require('../../shiva');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list_dj')
        .setDescription('List all DJs and DJ roles'),
    securityToken: COMMAND_SECURITY_TOKEN,

    async execute(interaction, client) {
        interaction.shivaValidated = true;
        interaction.securityToken = COMMAND_SECURITY_TOKEN;

        await interaction.deferReply();

        try {
            const guildId = interaction.guild.id;
            const djPermissions = await DJPermission.findOne({ guildId });

            const embed = new EmbedBuilder()
                .setTitle('🎵 DJ List')
                .setColor('#9B59B6')
                .setTimestamp();

            if (!djPermissions || (!djPermissions.djUsers.length && !djPermissions.djRoles.length)) {
                embed.setDescription('No DJ permissions set. Everyone can use music commands.');
                return interaction.editReply({ embeds: [embed] });
            }

            let description = '';

            // List DJ users
            if (djPermissions.djUsers.length > 0) {
                description += '**DJ Users:**\n';
                for (const dj of djPermissions.djUsers) {
                    const user = await client.users.fetch(dj.userId).catch(() => null);
                    const userName = user ? user.tag : `Unknown User (${dj.userId})`;
                    const addedDate = new Date(dj.addedAt).toLocaleDateString();
                    description += `• ${userName} - Added: ${addedDate}\n`;
                }
                description += '\n';
            }

            // List DJ roles
            if (djPermissions.djRoles.length > 0) {
                description += '**DJ Roles:**\n';
                for (const dj of djPermissions.djRoles) {
                    const role = interaction.guild.roles.cache.get(dj.roleId);
                    const roleName = role ? role.name : `Unknown Role (${dj.roleId})`;
                    const addedDate = new Date(dj.addedAt).toLocaleDateString();
                    description += `• ${roleName} - Added: ${addedDate}\n`;
                }
            }

            embed.setDescription(description || 'No DJs configured.');
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('List DJ command error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while listing DJs')
                .setColor('#FF0000');
            await interaction.editReply({ embeds: [embed] }).catch(() => { });
        }
    }
};
