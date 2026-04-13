const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../../database/database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('toggle-top-quest')
        .setDescription('[ADMIN] Active/désactive les quêtes TOP (EXP, PC, Streak) pour tout le serveur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Récupérer l'état actuel
            let currentState = false;
            try {
                const result = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get('top_quests_enabled');
                currentState = result && result.value === '1';
            } catch (err) {
                // Table inexistante ou erreur, on crée
            }

            // Toggle l'état
            const newState = !currentState;
            const newValue = newState ? '1' : '0';

            db.prepare('INSERT OR REPLACE INTO bot_settings (key, value) VALUES (?, ?)')
                .run('top_quests_enabled', newValue);

            const statusEmoji = newState ? '✅' : '❌';
            const statusText = newState ? 'ACTIVÉES' : 'DÉSACTIVÉES';

            const embed = new EmbedBuilder()
                .setColor(newState ? 0x00FF00 : 0xFF0000)
                .setTitle('🎯 Quêtes TOP')
                .setDescription(`Les quêtes TOP sont maintenant **${statusText}** ${statusEmoji}`)
                .addFields(
                    {
                        name: 'Quêtes concernées',
                        value: '• TOP 10/5/1 EXP\n• TOP 10/5/1 Comptage\n• 100 Streaks',
                        inline: false
                    }
                )
                .setFooter({ text: 'Utilisez /toggle-top-quest pour changer l\'état' })
                .setTimestamp();

            logger.info(`[ADMIN] Quêtes TOP ${statusText} par ${interaction.user.tag}`);

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Erreur commande /toggle-top-quest:`, error);
            await interaction.editReply({ content: "❌ Une erreur est survenue lors du toggle des quêtes TOP." });
        }
    }
};
