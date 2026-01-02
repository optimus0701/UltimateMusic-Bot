const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const shiva = require('../../shiva');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dashboard')
        .setDescription('Get the link to the web dashboard'),
    securityToken: COMMAND_SECURITY_TOKEN,

    async execute(interaction) {
        interaction.shivaValidated = true;
        interaction.securityToken = COMMAND_SECURITY_TOKEN;

        const redirectUri = process.env.DISCORD_REDIRECT_URI;
        let dashboardUrl = 'http://0.0.0.0:8888'; // Default fallback

        if (redirectUri) {
            try {
                // Extract base URL from redirect URI (e.g., http://domain.com/auth/callback -> http://domain.com)
                const url = new URL(redirectUri);
                dashboardUrl = `${url.protocol}//${url.host}/dashboard`;
            } catch (e) {
                console.error('Error parsing DISCORD_REDIRECT_URI:', e);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🎛️ Ultimate Music Bot Dashboard')
            .setDescription('Control the music, view stats, and manage your experience from the web dashboard.')
            .setColor('#9B59B6')
            .addFields({ name: 'Dashboard Link', value: `[Click here to open Dashboard](${dashboardUrl})` });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Open Dashboard')
                    .setStyle(ButtonStyle.Link)
                    .setURL(dashboardUrl)
            );

        await interaction.reply({ embeds: [embed], components: [row] });
    }
};
