const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateUser, setLevel } = require('../../../utils/db-users');
const { getGuildOfUser, updateGuildLevel } = require('../../../utils/db-guilds');
const { updateLevelRoles } = require('../../../utils/level-roles');
const logger = require('../../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-level')
        .setDescription('Définir le niveau d\'un membre.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('membre')
                .setDescription('Le membre à modifier.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('niveau')
                .setDescription('Le nouveau niveau.')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('membre');
        const level = interaction.options.getInteger('niveau');

        if (targetUser.bot) {
            return interaction.reply({ content: 'Vous ne pouvez pas modifier le niveau d\'un bot.', flags: 64 });
        }

        getOrCreateUser(targetUser.id, targetUser.username);
        setLevel(targetUser.id, level);

        // Mettre à jour le niveau de la guilde si l'utilisateur en a une
        const userGuild = getGuildOfUser(targetUser.id);
        if (userGuild) {
            updateGuildLevel(userGuild.id);
        }

        // Mettre à jour les rôles de niveau
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (member) {
            await updateLevelRoles(member, level);
        }

        await interaction.reply({
            content: `Le niveau de **${targetUser.username}** a été défini sur **${level}**.`,
            flags: 64
        });
    },
};