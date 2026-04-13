const { SlashCommandBuilder } = require('discord.js');
const { getGuildOfUser, removeMemberFromGuild, updateGuildLevel } = require('../../../utils/db-guilds');
const { updateGuildChannelPermissions } = require('../../../utils/guild/guild-upgrades');
const logger = require('../../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quitterguilde')
        .setDescription('Quitter votre guilde actuelle.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guild = getGuildOfUser(userId);

        if (!guild) {
            return interaction.reply({ content: 'Vous n\'êtes actuellement dans aucune guilde.', flags: 64 });
        }

        if (guild.owner_id === userId) {
            return interaction.reply({ content: 'Vous ne pouvez pas quitter une guilde dont vous êtes le chef. Vous devez d\'abord la dissoudre ou nommer un nouveau chef.', flags: 64 });
        }

        try {
            await interaction.deferReply();

            // Retirer le membre
            removeMemberFromGuild(userId);
            // Mettre à jour les permissions du salon (V5)
            if (guild.channel_id) {
                await updateGuildChannelPermissions(interaction.client, guild, userId, 'remove');
            }

            // Mettre à jour le niveau de la guilde après le départ
            updateGuildLevel(guild.id);

            await interaction.editReply({ content: `Vous avez quitté la guilde "**${guild.name}**".` });

        } catch (error) {
            logger.error(`Erreur lorsque ${interaction.user.username} a tenté de quitter la guilde ${guild.name}:`, error);
            await interaction.followUp({ content: 'Une erreur est survenue. Veuillez réessayer.', flags: 64 });
        }
    },
};