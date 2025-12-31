const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const DJPermission = require('../../models/DJPermission');
const { isOwner } = require('../../utils/djMiddleware');
const shiva = require('../../shiva');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove_dj')
        .setDescription('Remove DJ permissions from users or roles')
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Remove a user from DJ list')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to remove from DJ list')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('role')
                .setDescription('Remove a role from DJ list')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Role to remove from DJ list')
                        .setRequired(true)
                )
        ),
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
            // Check if user is owner (bot owner or server owner)
            if (!isOwner(interaction)) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ Only bot owners or server owners can manage DJ permissions')
                    .setColor('#FF0000');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const subcommand = interaction.options.getSubcommand();
            const guildId = interaction.guild.id;

            // Get DJ permissions
            const djPermissions = await DJPermission.findOne({ guildId });
            if (!djPermissions) {
                const embed = new EmbedBuilder()
                    .setDescription('❌ No DJ permissions configured')
                    .setColor('#FF0000');
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (subcommand === 'user') {
                const user = interaction.options.getUser('user');

                // Check if user exists
                const index = djPermissions.djUsers.findIndex(dj => dj.userId === user.id);
                if (index === -1) {
                    const embed = new EmbedBuilder()
                        .setDescription(`❌ ${user} is not a DJ`)
                        .setColor('#FF0000');
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                // Remove user
                djPermissions.djUsers.splice(index, 1);
                await djPermissions.save();

                const embed = new EmbedBuilder()
                    .setTitle('✅ DJ Removed')
                    .setDescription(`${user} has been removed from DJ list`)
                    .setColor('#00FF00')
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

            } else if (subcommand === 'role') {
                const role = interaction.options.getRole('role');

                // Check if role exists
                const index = djPermissions.djRoles.findIndex(dj => dj.roleId === role.id);
                if (index === -1) {
                    const embed = new EmbedBuilder()
                        .setDescription(`❌ ${role} is not a DJ role`)
                        .setColor('#FF0000');
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                // Remove role
                djPermissions.djRoles.splice(index, 1);
                await djPermissions.save();

                const embed = new EmbedBuilder()
                    .setTitle('✅ DJ Role Removed')
                    .setDescription(`${role} has been removed from DJ roles`)
                    .setColor('#00FF00')
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Remove DJ command error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while removing DJ permissions')
                .setColor('#FF0000');
            await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => { });
        }
    }
};
