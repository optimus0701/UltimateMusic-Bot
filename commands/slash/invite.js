const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const shiva = require('../../shiva');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Get the invite link to add this bot to your server'),
    securityToken: COMMAND_SECURITY_TOKEN,

    async execute(interaction, client) {
        if (!shiva || !shiva.validateCore || !shiva.validateCore()) {
            const embed = new EmbedBuilder()
                .setDescription('❌ System core offline - Command unavailable')
                .setColor('#FF0000');
            return interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => { });
        }

        interaction.shivaValidated = true;
        interaction.securityToken = COMMAND_SECURITY_TOKEN;

        try {
            // Generate OAuth2 invite link with necessary permissions
            const permissions = [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.UseVAD,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ManageChannels
            ];

            const permissionsValue = permissions.reduce((a, b) => a | b, 0n);
            const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=${permissionsValue}&scope=bot%20applications.commands`;

            const embed = new EmbedBuilder()
                .setTitle('🎵 Invite Ultimate Music Bot')
                .setColor(0x9B59B6)
                .setDescription(
                    `Click the link below to invite me to your server!\n\n` +
                    `**Invite Link:**\n${inviteLink}\n\n` +
                    `• **Servers**: ${client.guilds.cache.size}\n` +
                    `• **Commands**: 25 slash commands`
                )
                .setTimestamp()
                .setFooter({ text: 'Ultimate Music Bot • Developed by GlaceYT' });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Invite command error:', error);
            await interaction.reply({ content: '❌ An error occurred while generating the invite link.', ephemeral: true });
        }
    }
};
