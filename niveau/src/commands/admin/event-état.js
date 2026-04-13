const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setEventState } = require('../../utils/db-halloween');
const { setEventState: setNoelState } = require('../../utils/db-noel');
const { setEventState: setValentinState } = require('../../utils/db-valentin');
const deployCommands = require('../../utils/deploy-commands');
const {
    loadHalloweenCommands, unloadHalloweenCommands,
    loadChristmasCommands, unloadChristmasCommands,
    loadValentinCommands, unloadValentinCommands
} = require('../../utils/command-loader');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('event-état')
        .setDescription("[Admin] Active ou désactive un événement spécial.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('event')
                .setDescription("Le nom de l'événement à gérer.")
                .setRequired(true)
                .addChoices(
                    { name: 'Halloween', value: 'halloween' },
                    { name: 'Noël', value: 'noël' },
                    { name: 'Saint-Valentin', value: 'valentin' }
                ))
        .addBooleanOption(option =>
            option.setName('etat')
                .setDescription("L'état de l'événement (actif/inactif).")
                .setRequired(true)),

    async execute(interaction) {
        const eventName = interaction.options.getString('event');
        const isActive = interaction.options.getBoolean('etat');

        if (!['halloween', 'noël', 'valentin'].includes(eventName)) {
            return interaction.reply({ content: `L'événement '${eventName}' n'est pas reconnu.`, ephemeral: true });
        }

        try {
            await interaction.reply({ content: `Mise à jour de l\'événement en cours...`, ephemeral: true });

            // 1. Changer l'état de l'événement
            if (eventName === 'halloween') {
                setEventState(eventName, isActive);
            } else if (eventName === 'noël') {
                setNoelState(eventName, isActive);
            } else if (eventName === 'valentin') {
                setValentinState(eventName, isActive);
            }

            // 2. Mettre à jour les commandes en mémoire
            if (eventName === 'halloween') {
                if (isActive) {
                    loadHalloweenCommands(interaction.client);
                } else {
                    unloadHalloweenCommands(interaction.client);
                }
            } else if (eventName === 'noël') {
                if (isActive) {
                    loadChristmasCommands(interaction.client);
                } else {
                    unloadChristmasCommands(interaction.client);
                }
            } else if (eventName === 'valentin') {
                if (isActive) {
                    loadValentinCommands(interaction.client);
                } else {
                    unloadValentinCommands(interaction.client);
                }
            }

            // 3. Redéployer les commandes sur Discord
            await deployCommands(interaction.client);

            const eventLabels = {
                'halloween': 'Halloween',
                'noël': 'Noël',
                'valentin': 'Saint-Valentin'
            };
            const eventDisplayName = eventLabels[eventName] || eventName;

            await interaction.editReply({
                content: `L'événement **${eventDisplayName}** a bien été **${isActive ? 'ACTIVÉ' : 'DÉSACTIVÉ'}**. Les commandes ont été mises à jour.`,
            });
        } catch (error) {
            console.error("Erreur lors du changement d'état de l'événement:", error);
            await interaction.editReply({ content: "Une erreur est survenue lors de la mise à jour de l'événement.", ephemeral: true });
        }
    },
};