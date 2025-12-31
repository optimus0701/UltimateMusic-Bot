const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const DJPermission = require('../../models/DJPermission');
const { isOwner } = require('../../utils/djMiddleware');
const shiva = require('../../shiva');

const COMMAND_SECURITY_TOKEN = shiva.SECURITY_TOKEN;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set_dj')
        .setDescription('Add DJ permissions to users or roles')
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Add a user as DJ')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to add as DJ')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('role')
                .setDescription('Add a role as DJ')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Role to add as DJ')
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

            // Get or create DJ permissions
            let djPermissions = await DJPermission.findOne({ guildId });
            if (!djPermissions) {
                djPermissions = new DJPermission({
                    guildId,
                    djUsers: [],
                    djRoles: []
                });
            }

            if (subcommand === 'user') {
                const user = interaction.options.getUser('user');

                // Check if user already exists
                const exists = djPermissions.djUsers.some(dj => dj.userId === user.id);
                if (exists) {
                    const embed = new EmbedBuilder()
                        .setDescription(`❌ ${user} is already a DJ`)
                        .setColor('#FF0000');
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                // Add user
                djPermissions.djUsers.push({
                    userId: user.id,
                    addedBy: interaction.user.id
                });

                await djPermissions.save();

                const embed = new EmbedBuilder()
                    .setTitle('✅ DJ Added')
                    .setDescription(`${user} has been added as a DJ`)
                    .setColor('#00FF00')
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

            } else if (subcommand === 'role') {
                const role = interaction.options.getRole('role');

                // Check if role already exists
                const exists = djPermissions.djRoles.some(dj => dj.roleId === role.id);
                if (exists) {
                    const embed = new EmbedBuilder()
                        .setDescription(`❌ ${role} is already a DJ role`)
                        .setColor('#FF0000');
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                // Add role
                djPermissions.djRoles.push({
                    roleId: role.id,
                    addedBy: interaction.user.id
                });

                await djPermissions.save();

                const embed = new EmbedBuilder()
                    .setTitle('✅ DJ Role Added')
                    .setDescription(`${role} has been added as a DJ role`)
                    .setColor('#00FF00')
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Set DJ command error:', error);
            const embed = new EmbedBuilder()
                .setDescription('❌ An error occurred while setting DJ permissions')
                .setColor('#FF0000');
            await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => { });
        }
    }
};
