const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require('discord.js');
const db = require('../../database/database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reset-db')
        .setDescription('Gestion des données du bot (reset ou refresh usernames).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('full-reset')
                .setDescription('Réinitialise COMPLÈTEMENT toutes les bases de données (sauf succès Halloween).'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('refresh-usernames')
                .setDescription('Vérifie et met à jour tous les noms d\'utilisateurs depuis Discord.')),

    async execute(interaction) {
        let subcommand;
        try {
            subcommand = interaction.options.getSubcommand();
        } catch (e) {
            // Rétrocompatibilité: si pas de sous-commande, afficher un message d'aide
            await interaction.reply({
                content: `⚠️ **Commande mise à jour !**\n\nUtilisez maintenant :\n• \`/reset-db full-reset\` - Pour réinitialiser toutes les données\n• \`/reset-db refresh-usernames\` - Pour mettre à jour les noms d'utilisateur depuis Discord\n\n*(Redéployez les commandes avec \`/deploy-commands\` si les options n'apparaissent pas)*`,
                flags: 64
            });
            return;
        }

        if (subcommand === 'refresh-usernames') {
            await handleRefreshUsernames(interaction);
        } else if (subcommand === 'full-reset') {
            await handleFullReset(interaction);
        }
    },
};

async function handleRefreshUsernames(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
        const users = db.prepare('SELECT id, username FROM users').all();
        let updated = 0;
        let failed = 0;
        let unchanged = 0;

        await interaction.editReply({ content: `⏳ Vérification de ${users.length} utilisateurs en cours...` });

        const updateStmt = db.prepare('UPDATE users SET username = ? WHERE id = ?');

        for (const user of users) {
            try {
                const discordUser = await interaction.client.users.fetch(user.id);
                if (discordUser.username !== user.username) {
                    updateStmt.run(discordUser.username, user.id);
                    logger.info(`Username mis à jour: ${user.username} -> ${discordUser.username}`);
                    updated++;
                } else {
                    unchanged++;
                }
            } catch (error) {
                // L'utilisateur n'est plus accessible (a quitté, compte supprimé, etc.)
                failed++;
                logger.debug(`Impossible de récupérer l'utilisateur ${user.id}: ${error.message}`);
            }
        }

        await interaction.editReply({
            content: `✅ **Vérification des noms terminée !**\n\n` +
                `📝 **${updated}** mis à jour\n` +
                `✓ **${unchanged}** déjà corrects\n` +
                `⚠️ **${failed}** inaccessibles (ont quitté le serveur ou compte supprimé)`
        });

    } catch (error) {
        logger.error('Erreur lors du refresh usernames:', error);
        await interaction.editReply({ content: `❌ Erreur: ${error.message}` });
    }
}

async function handleFullReset(interaction) {
    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_db_reset')
        .setLabel('OUI, TOUT RÉINITIALISER')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_db_reset')
        .setLabel('ANNULER')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    const response = await interaction.reply({
        content: `⚠️ **ALERTE CRITIQUE** ⚠️\n\nVous êtes sur le point de **SUPPRIMER TOUTES LES DONNÉES DU BOT** (Utilisateurs, Guildes, Banques, Inventaires, etc.).\n\nSeuls les **succès Halloween** seront préservés.\n\nÊtes-vous ABSOLUMENT sûr ? Cette action est IRREVERSIBLE.`,
        components: [row],
        flags: 64,
    });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30 * 1000,
    });

    collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
            await i.reply({ content: 'Seul l\'administrateur ayant lancé la commande peut confirmer.', flags: 64 });
            return;
        }

        if (i.customId === 'confirm_db_reset') {
            try {
                await i.update({ content: '⏳ Réinitialisation en cours... Veuillez patienter.', components: [] });

                await resetDatabasesAndPreserveHalloween(interaction.client);

                await i.editReply({ content: '✅ **Réinitialisation terminée !** Toutes les bases de données ont été vidées (sauf succès Halloween). Les noms d\'utilisateurs ont été récupérés depuis Discord.', components: [] });
            } catch (error) {
                logger.error('Erreur lors du reset DB:', error);
                await i.editReply({ content: `❌ Une erreur est survenue lors de la réinitialisation : ${error.message}`, components: [] });
            }
        } else if (i.customId === 'cancel_db_reset') {
            await i.update({ content: '❌ Réinitialisation annulée.', components: [] });
        }
        collector.stop();
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            interaction.editReply({ content: '⏰ Confirmation expirée. Action annulée.', components: [] }).catch(() => { });
        }
    });
}

async function resetDatabasesAndPreserveHalloween(client) {
    // 1. Sauvegarder les succès Halloween
    const halloweenAchievements = db.prepare(`
        SELECT * FROM quest_progress 
        WHERE quest_id LIKE 'HALLOWEEN_%' AND completed > 0
    `).all();

    logger.info(`Extraction de ${halloweenAchievements.length} succès Halloween à préserver.`);

    // 2. Désactiver les foreign keys pour éviter les erreurs de cascade pendant le wipe
    db.pragma('foreign_keys = OFF');

    try {
        const tablesToClear = [
            'users',
            'user_inventory',
            'shop_purchases',
            'quest_progress',
            'guilds',
            'guild_members',
            'guild_invitations',
            'guild_wars',
            'guild_war_members',
            'guild_war_declarations',
            'server_quests',
            'server_quest_votes',
            'guild_application_refusals',
            'daily_shop',
            'loans',
            'custom_roles',
            'shop_info',
            'war_mvps',
            'user_badges',
            'shop_alerts',
            'guild_quests',
            'resource_history',
            'battle_pass'
        ];

        db.transaction(() => {
            for (const table of tablesToClear) {
                // Vérifier si la table existe avant de DELETE
                const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
                if (tableExists) {
                    db.prepare(`DELETE FROM ${table}`).run();
                    logger.info(`Table ${table} vidée.`);
                }
            }

            // 3. Restaurer les succès Halloween avec les vrais noms Discord
            if (halloweenAchievements.length > 0) {
                const uniqueUserIds = [...new Set(halloweenAchievements.map(a => a.user_id))];
                const insertUserStmt = db.prepare(`INSERT OR IGNORE INTO users (id, username, xp, level, points, stars) VALUES (?, ?, 0, 1, 0, 0)`);

                for (const userId of uniqueUserIds) {
                    // Essayer de récupérer le vrai nom depuis Discord
                    let username = 'Survivant V4';
                    try {
                        const discordUser = client.users.cache.get(userId);
                        if (discordUser) {
                            username = discordUser.username;
                        }
                    } catch (err) {
                        // Garder le nom par défaut
                    }
                    insertUserStmt.run(userId, username);
                }

                logger.info(`${uniqueUserIds.length} utilisateurs squelettes créés.`);

                const insertQuestStmt = db.prepare(`
                    INSERT INTO quest_progress (user_id, quest_id, progress, completed) 
                    VALUES (?, ?, ?, ?)
                `);

                for (const ach of halloweenAchievements) {
                    insertQuestStmt.run(ach.user_id, ach.quest_id, ach.progress, ach.completed);
                }
                logger.info(`${halloweenAchievements.length} succès Halloween restaurés.`);
            }
        })();

    } finally {
        // Toujours réactiver les foreign keys
        db.pragma('foreign_keys = ON');
    }
}
