const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setMaintenanceMode, isMaintenanceMode } = require('../../utils/maintenance');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('maintenance')
        .setDescription('Active ou désactive le mode maintenance du bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('statut')
                .setDescription('Le statut du mode maintenance (on/off).')
                .setRequired(true)
                .addChoices(
                    { name: 'Activer', value: 'on' },
                    { name: 'Désactiver', value: 'off' },
                )),

    async execute(interaction) {
        const status = interaction.options.getString('statut');
        const newStatus = status === 'on';

        setMaintenanceMode(newStatus);

        await interaction.reply({
            content: `Le mode maintenance a été **${newStatus ? 'activé' : 'désactivé'}**.`, 
            flags: 64
        });
    },
};