const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../database/database');
const { getOrCreateUser } = require('../utils/db-users');
const { getTierFromXp, BATTLE_PASS_REWARDS } = require('../utils/battle-pass');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('battlepass-admin')
        .setDescription('Commandes admin pour le battle pass.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-xp')
                .setDescription('Définir l\'XP saisonnier d\'un utilisateur.')
                .addUserOption(option => option.setName('utilisateur').setDescription('L\'utilisateur').setRequired(true))
                .addIntegerOption(option => option.setName('xp').setDescription('La nouvelle valeur d\'XP saisonnier').setRequired(true).setMinValue(0)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add-xp')
                .setDescription('Ajouter de l\'XP saisonnier à un utilisateur.')
                .addUserOption(option => option.setName('utilisateur').setDescription('L\'utilisateur').setRequired(true))
                .addIntegerOption(option => option.setName('xp').setDescription('La quantité d\'XP à ajouter').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-season')
                .setDescription('Réinitialiser l\'XP saisonnier de tous les utilisateurs.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view-tier')
                .setDescription('Voir le tier actuel d\'un utilisateur.')
                .addUserOption(option => option.setName('utilisateur').setDescription('L\'utilisateur').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-claims')
                .setDescription('Réinitialiser les rewards réclamées du battle pass.')
                .addUserOption(option => option.setName('utilisateur').setDescription('L\'utilisateur').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Voir les infos du battle pass d\'un utilisateur.')
                .addUserOption(option => option.setName('utilisateur').setDescription('L\'utilisateur').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('fix-overclaimed')
                .setDescription('Supprimer les claims des tiers non atteints par un utilisateur.')
                .addUserOption(option => option.setName('utilisateur').setDescription('L\'utilisateur').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('fix-all-overclaimed')
                .setDescription('Corriger les claims en trop pour TOUS les utilisateurs.')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set-xp') {
            const user = interaction.options.getUser('utilisateur');
            const xp = interaction.options.getInteger('xp');

            const userData = getOrCreateUser(user.id, user.username);
            const updateStmt = db.prepare('UPDATE users SET seasonal_xp = ? WHERE id = ?');
            updateStmt.run(xp, user.id);

            const oldTier = getTierFromXp(userData.seasonal_xp);
            const newTier = getTierFromXp(xp);

            const embed = new EmbedBuilder()
                .setTitle('✅ XP Saisonnier défini')
                .setColor('#00FF00')
                .addFields(
                    { name: 'Utilisateur', value: `${user.username}`, inline: true },
                    { name: 'Ancien XP', value: `${userData.seasonal_xp.toLocaleString('fr-FR')}`, inline: true },
                    { name: 'Nouvel XP', value: `${xp.toLocaleString('fr-FR')}`, inline: true },
                    { name: 'Ancien Tier', value: `${oldTier}`, inline: true },
                    { name: 'Nouveau Tier', value: `${newTier}`, inline: true }
                );

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'add-xp') {
            const user = interaction.options.getUser('utilisateur');
            const xpToAdd = interaction.options.getInteger('xp');

            const userData = getOrCreateUser(user.id, user.username);
            const newXp = userData.seasonal_xp + xpToAdd;
            const updateStmt = db.prepare('UPDATE users SET seasonal_xp = ? WHERE id = ?');
            updateStmt.run(newXp, user.id);

            const oldTier = getTierFromXp(userData.seasonal_xp);
            const newTier = getTierFromXp(newXp);

            const embed = new EmbedBuilder()
                .setTitle('✅ XP Saisonnier ajouté')
                .setColor('#00FF00')
                .addFields(
                    { name: 'Utilisateur', value: `${user.username}`, inline: true },
                    { name: 'XP Ajouté', value: `+${xpToAdd.toLocaleString('fr-FR')}`, inline: true },
                    { name: 'Nouvel XP Total', value: `${newXp.toLocaleString('fr-FR')}`, inline: true },
                    { name: 'Ancien Tier', value: `${oldTier}`, inline: true },
                    { name: 'Nouveau Tier', value: `${newTier}`, inline: true }
                );

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'reset-season') {
            const updateStmt = db.prepare('UPDATE users SET seasonal_xp = 0');
            updateStmt.run();

            const embed = new EmbedBuilder()
                .setTitle('✅ Saison réinitialisée')
                .setColor('#00FF00')
                .setDescription('L\'XP saisonnier de tous les utilisateurs a été réinitialisé à 0.');

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'view-tier') {
            const user = interaction.options.getUser('utilisateur');
            const userData = getOrCreateUser(user.id, user.username);
            const currentTier = getTierFromXp(userData.seasonal_xp);

            // Calculer l'XP pour le prochain tier
            const xpPerTier = 10000; // À adapter selon votre système
            const xpInCurrentTier = userData.seasonal_xp % xpPerTier;
            const xpForNextTier = xpPerTier - xpInCurrentTier;

            const embed = new EmbedBuilder()
                .setTitle(`Battle Pass - ${user.username}`)
                .setColor('#00FFFF')
                .addFields(
                    { name: 'Tier Actuel', value: `${currentTier} / 50`, inline: true },
                    { name: 'XP Total', value: `${userData.seasonal_xp.toLocaleString('fr-FR')}`, inline: true },
                    { name: 'XP dans le tier', value: `${xpInCurrentTier.toLocaleString('fr-FR')} / ${xpPerTier.toLocaleString('fr-FR')}`, inline: false },
                    { name: 'XP pour le prochain tier', value: `+${xpForNextTier.toLocaleString('fr-FR')}`, inline: true }
                );

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'reset-claims') {
            const user = interaction.options.getUser('utilisateur');

            const deleteStmt = db.prepare('DELETE FROM battle_pass WHERE user_id = ?');
            deleteStmt.run(user.id);

            const embed = new EmbedBuilder()
                .setTitle('✅ Rewards réinitialisées')
                .setColor('#00FF00')
                .setDescription(`Les rewards réclamées de ${user.username} ont été réinitialisées. Il peut maintenant réclamer toutes les récompenses du battle pass.`);

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'info') {
            const user = interaction.options.getUser('utilisateur');
            const userData = getOrCreateUser(user.id, user.username);
            const currentTier = getTierFromXp(userData.seasonal_xp);

            // Récupérer les rewards réclamées
            const getClaimsStmt = db.prepare('SELECT tier, claimed_free, claimed_vip FROM battle_pass WHERE user_id = ? ORDER BY tier ASC');
            const claims = getClaimsStmt.all(user.id);

            let claimedInfo = '**Aucune reward réclamée**';
            if (claims.length > 0) {
                const claimedTiers = claims
                    .filter(c => c.claimed_free || c.claimed_vip)
                    .map(c => {
                        const status = [];
                        if (c.claimed_free) status.push('Gratuit ✅');
                        if (c.claimed_vip) status.push('VIP ✅');
                        return `Tier ${c.tier}: ${status.join(', ')}`;
                    })
                    .join('\n');
                claimedInfo = claimedTiers || '**Aucune reward réclamée**';
            }

            const embed = new EmbedBuilder()
                .setTitle(`Infos Battle Pass - ${user.username}`)
                .setColor('#FFD700')
                .addFields(
                    { name: 'Tier Actuel', value: `${currentTier} / 50`, inline: true },
                    { name: 'XP Saisonnier', value: `${userData.seasonal_xp.toLocaleString('fr-FR')}`, inline: true },
                    { name: 'Rewards Réclamées', value: claimedInfo, inline: false }
                );

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'fix-overclaimed') {
            const user = interaction.options.getUser('utilisateur');
            const userData = getOrCreateUser(user.id, user.username);
            const currentTier = getTierFromXp(userData.seasonal_xp);

            // Supprimer les claims des tiers supérieurs au tier actuel
            const deleteStmt = db.prepare('DELETE FROM battle_pass WHERE user_id = ? AND tier > ?');
            const result = deleteStmt.run(user.id, currentTier);

            const embed = new EmbedBuilder()
                .setTitle('✅ Claims corrigées')
                .setColor('#00FF00')
                .setDescription(`**${result.changes}** claim(s) en trop supprimée(s) pour ${user.username}.`)
                .addFields(
                    { name: 'Tier actuel', value: `${currentTier}`, inline: true },
                    { name: 'XP Saisonnier', value: `${userData.seasonal_xp.toLocaleString('fr-FR')}`, inline: true }
                );

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'fix-all-overclaimed') {
            await interaction.deferReply();

            // Récupérer tous les utilisateurs avec des claims
            const users = db.prepare('SELECT DISTINCT user_id FROM battle_pass').all();
            let totalFixed = 0;
            let usersFixed = 0;

            for (const { user_id } of users) {
                const userData = db.prepare('SELECT seasonal_xp FROM users WHERE id = ?').get(user_id);
                if (!userData) continue;

                const currentTier = getTierFromXp(userData.seasonal_xp || 0);
                const deleteStmt = db.prepare('DELETE FROM battle_pass WHERE user_id = ? AND tier > ?');
                const result = deleteStmt.run(user_id, currentTier);

                if (result.changes > 0) {
                    totalFixed += result.changes;
                    usersFixed++;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Correction globale terminée')
                .setColor('#00FF00')
                .addFields(
                    { name: 'Utilisateurs corrigés', value: `${usersFixed}`, inline: true },
                    { name: 'Claims supprimées', value: `${totalFixed}`, inline: true }
                );

            await interaction.editReply({ embeds: [embed] });
        }
    }
};
