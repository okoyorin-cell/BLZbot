const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-quest-end')
        .setDescription('Modifie la date de fin d\'une quête de serveur active.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(option =>
            option.setName('objectif')
                .setDescription('L\'objectif de la quête à modifier')
                .setRequired(true)
                .addChoices(
                    { name: 'Messages', value: 'messages' },
                    { name: 'Counting', value: 'counting' },
                    { name: 'Starss', value: 'starss' },
                    { name: 'XP', value: 'xp' }
                ))
        .addStringOption(option =>
            option.setName('date')
                .setDescription('La nouvelle date de fin (JJ/MM/AAAA)')
                .setRequired(true)),

    async execute(interaction) {
        const objective = interaction.options.getString('objectif');
        const dateStr = interaction.options.getString('date');

        // Validation du format de date
        const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const match = dateStr.match(dateRegex);

        if (!match) {
            return interaction.reply({ content: '❌ Format de date invalide. Utilisez JJ/MM/AAAA (ex: 31/12/2025).', ephemeral: true });
        }

        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // Les mois sont 0-indexés en JS
        const year = parseInt(match[3]);

        const newDate = new Date(year, month, day, 23, 59, 59); // Fin de journée

        // Validation basique des jours/mois
        if (month < 0 || month > 11 || day < 1 || day > 31) {
            return interaction.reply({ content: '❌ Date invalide (jour ou mois incorrect).', ephemeral: true });
        }

        if (isNaN(newDate.getTime())) {
            return interaction.reply({ content: '❌ Date invalide.', ephemeral: true });
        }

        // Vérifier si la date est dans le futur
        if (newDate.getTime() < Date.now()) {
            return interaction.reply({ content: '❌ La date de fin doit être dans le futur.', ephemeral: true });
        }

        try {
            // Mise à jour en base de données
            const stmt = db.prepare('UPDATE server_quests SET end_time = ? WHERE objective = ? AND status = ?');
            const result = stmt.run(newDate.getTime(), objective, 'active');

            if (result.changes > 0) {
                await interaction.reply({ content: `✅ La date de fin de la quête **${objective}** a été mise à jour au **${dateStr}** (23h59).` });
            } else {
                await interaction.reply({ content: `❌ Aucune quête active trouvée pour l'objectif **${objective}** (ou date identique). Assurez-vous qu'une quête est en cours.`, ephemeral: true });
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour de la quête:', error);
            await interaction.reply({ content: '❌ Une erreur interne est survenue lors de la mise à jour.', ephemeral: true });
        }
    },
};
