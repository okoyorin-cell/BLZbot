const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getEventState, getOrCreateEventUser } = require('../../utils/db-halloween');
const { renderHalloweenProfileCard } = require('../../utils/canvas-halloween-profile');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('halloween-profile')
        .setDescription("Affiche votre profil d'événement Halloween.")
        .addUserOption(option =>
            option.setName('membre')
                .setDescription("Le membre dont vous voulez voir le profil.")
                .setRequired(false)),

    async execute(interaction) {
        if (!getEventState('halloween')) {
            return interaction.reply({ content: "Il n'y a pas d'événement Halloween actif pour le moment.", ephemeral: true });
        }

        try {
            await interaction.deferReply();

            const targetDiscordUser = interaction.options.getUser('membre') || interaction.user;

            // Récupérer les données de l'événement pour l'utilisateur
            const eventUser = getOrCreateEventUser(targetDiscordUser.id, targetDiscordUser.username);

            // Générer l'image du profil
            const imageBuffer = await renderHalloweenProfileCard(eventUser, targetDiscordUser);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'halloween-profile.png' });

            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            logger.error('Erreur lors de l\'affichage du profil Halloween:', error);
            await interaction.reply({ content: 'Une erreur s\'est produite lors de l\'affichage du profil Halloween. Veuillez utiliser /halloween-profile.', ephemeral: true });
        }
    },
};