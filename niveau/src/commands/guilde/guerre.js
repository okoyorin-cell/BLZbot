const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getGuildOfUser, getAllGuilds, getGuildById } = require('../../utils/db-guilds');
const { declareWar, acceptWar, getActiveDeclaration, getOngoingWar, getWarStats } = require('../../utils/guild/guild-wars');
const { handleCommandError } = require('../../utils/error-handler');
const { hasCustomPermission, CUSTOM_ROLE_PERMISSIONS } = require('../../utils/guild/guild-custom-roles');
const { areGuildFeaturesDisabled } = require('../../utils/guild/guild-overstaffing');
const db = require('../../database/database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guerre')
        .setDescription('Gérer les guerres de guildes')
        .addSubcommand(subcommand =>
            subcommand
                .setName('declarer')
                .setDescription('Déclarez une guerre à une autre guilde (Upgrade 6+)')
                .addStringOption(option =>
                    option.setName('guilde_cible')
                        .setDescription('Nom de la guilde à attaquer')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addStringOption(option =>
                    option.setName('duree')
                        .setDescription('Durée de la guerre')
                        .setRequired(true)
                        .addChoices(
                            { name: '12 heures (Guerre courte - 25% pillage)', value: 'short' },
                            { name: '48 heures (Guerre classique - 50% pillage)', value: 'normal' },
                            { name: '7 jours (Guerre longue - 100% pillage)', value: 'long' }
                        ))
                .addBooleanOption(option =>
                    option.setName('utiliser_coup_detat')
                        .setDescription('Utiliser un Coup d\'État pour forcer la guerre (item requis)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('repondre')
                .setDescription('Répondre à une déclaration de guerre')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Accepter ou refuser la déclaration')
                        .setRequired(true)
                        .addChoices(
                            { name: '✅ Accepter', value: 'accept' },
                            { name: '❌ Refuser', value: 'refuse' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('statut')
                .setDescription('Affiche le statut de la guerre en cours de votre guilde')),
    
    async autocomplete(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'declarer') {
            const focusedValue = interaction.options.getFocused();
            const guilds = getAllGuilds();
            
            // Filtrer les guildes eligibles (upgrade 6+, pas la sienne)
            const userGuild = getGuildOfUser(interaction.user.id);
            const choices = guilds
                .filter(g => g.upgrade_level >= 6 && (!userGuild || g.id !== userGuild.id))
                .filter(g => g.name.toLowerCase().includes(focusedValue.toLowerCase()))
                .slice(0, 25)
                .map(g => ({ name: `${g.emoji} ${g.name} (Niv. ${g.level})`, value: g.name }));
            
            await interaction.respond(choices);
        }
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'declarer') {
                await handleDeclarer(interaction);
            } else if (subcommand === 'repondre') {
                await handleRepondre(interaction);
            } else if (subcommand === 'statut') {
                await handleStatut(interaction);
            }
        } catch (error) {
            await handleCommandError(interaction, error);
        }
    },
};

async function handleDeclarer(interaction) {
    const userId = interaction.user.id;
    const guild = getGuildOfUser(userId);

    if (!guild) {
        return interaction.reply({ content: "❌ Vous n'êtes pas dans une guilde.", flags: 64 });
    }

    // Vérifier le sureffectif
    if (areGuildFeaturesDisabled(guild.id)) {
        const memberCount = db.prepare('SELECT COUNT(*) as count FROM guild_members WHERE guild_id = ?')
            .get(guild.id).count;
        return interaction.reply({
            content: `❌ **Guilde en sureffectif !**\n\n` +
                `Votre guilde a **${memberCount} membres** mais ne peut en avoir que **12 maximum**.\n` +
                `🚫 Toutes les fonctionnalités sont désactivées jusqu'à ce que vous excluiez des membres.`,
            flags: 64
        });
    }

    const isOwner = guild.owner_id === userId;
    const isSubChief = guild.sub_chiefs && guild.sub_chiefs.includes(userId);
    const hasWarPermission = hasCustomPermission(guild.id, userId, CUSTOM_ROLE_PERMISSIONS.START_WAR);

    if (!isOwner && !isSubChief && !hasWarPermission) {
        return interaction.reply({ content: '❌ Seuls le chef, les sous-chefs ou les membres avec la permission "démarrer guerre" peuvent déclarer une guerre.', flags: 64 });
    }

    if (guild.upgrade_level < 6) {
        return interaction.reply({ content: '❌ Les guerres de guildes sont débloquées à partir de l\'Upgrade 6.', flags: 64 });
    }

    const targetGuildName = interaction.options.getString('guilde_cible');
    const durationType = interaction.options.getString('duree');
    const useCoupDetat = interaction.options.getBoolean('utiliser_coup_detat') || false;

    // Trouver la guilde cible
    const targetGuild = db.prepare('SELECT * FROM guilds WHERE name = ?').get(targetGuildName);
    
    if (!targetGuild) {
        return interaction.reply({ content: '❌ Guilde introuvable.', flags: 64 });
    }

    if (targetGuild.id === guild.id) {
        return interaction.reply({ content: '❌ Vous ne pouvez pas déclarer la guerre à votre propre guilde.', flags: 64 });
    }

    if (targetGuild.upgrade_level < 6) {
        return interaction.reply({ content: '❌ La guilde cible doit être Upgrade 6+ pour participer aux guerres.', flags: 64 });
    }

    // Si coup d'état, vérifier l'item
    if (useCoupDetat) {
        const inventory = db.prepare('SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ?')
            .get(userId, 'coup_detat');
        
        if (!inventory || inventory.quantity < 1) {
            return interaction.reply({ content: '❌ Vous n\'avez pas de Coup d\'État dans votre inventaire.', flags: 64 });
        }

        // Retirer l'item
        db.prepare('UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?')
            .run(userId, 'coup_detat');
        db.prepare('DELETE FROM user_inventory WHERE quantity <= 0').run();
    }

    await interaction.deferReply();

    try {
        await declareWar(interaction.client, guild.id, targetGuild.id, durationType, useCoupDetat);

        if (useCoupDetat) {
            await interaction.editReply({ 
                content: `🔥 **GUERRE FORCÉE !**\n\nVous avez utilisé un Coup d'État pour forcer une guerre contre ${targetGuild.emoji} **${targetGuild.name}** !\n\nLa guerre commence immédiatement.`
            });
        } else {
            await interaction.editReply({ 
                content: `⚔️ **Guerre déclarée !**\n\nVous avez déclaré la guerre à ${targetGuild.emoji} **${targetGuild.name}**.\n\nEn attente de l'acceptation du chef adverse...`
            });
        }
    } catch (error) {
        await interaction.editReply({ content: `❌ ${error.message}` });
    }
}

async function handleRepondre(interaction) {
    await interaction.deferReply();

    const action = interaction.options.getString('action');
    const userId = interaction.user.id;

    // Vérifier que l'utilisateur est dans une guilde
    const guild = getGuildOfUser(userId);
    if (!guild) {
        return await interaction.editReply({
            content: '❌ Vous devez être dans une guilde pour répondre à une déclaration de guerre.',
            ephemeral: true
        });
    }

    // Vérifier que l'utilisateur est le chef
    if (guild.owner_id !== userId) {
        return await interaction.editReply({
            content: '❌ Seul le chef de guilde peut répondre à une déclaration de guerre.',
            ephemeral: true
        });
    }

    // Récupérer la déclaration de guerre en attente
    const declaration = getActiveDeclaration(guild.id);
    if (!declaration || declaration.status !== 'pending') {
        return await interaction.editReply({
            content: '❌ Aucune déclaration de guerre en attente pour votre guilde.',
            ephemeral: true
        });
    }

    const attackerGuild = getGuildById(declaration.from_guild_id);
    if (!attackerGuild) {
        return await interaction.editReply({
            content: '❌ Erreur : impossible de récupérer la guilde attaquante.',
            ephemeral: true
        });
    }

    // Traiter l'action
    if (action === 'accept') {
        try {
            await acceptWar(interaction.client, declaration.id);
            
            const embed = new EmbedBuilder()
                .setTitle('⚔️ Guerre Acceptée !')
                .setDescription(`Votre guilde **${guild.name}** a accepté la déclaration de guerre de **${attackerGuild.name}** !`)
                .addFields(
                    { name: '⏱️ Durée', value: declaration.duration_type === 'short' ? '12h' : declaration.duration_type === 'normal' ? '48h' : '7 jours', inline: true },
                    { name: '💰 Pillage', value: `${declaration.duration_type === 'short' ? '25%' : declaration.duration_type === 'normal' ? '50%' : '100%'}`, inline: true }
                )
                .setColor(0xff0000)
                .setTimestamp();

            // Notifier le chef de la guilde attaquante
            try {
                const attackerUser = await interaction.client.users.fetch(attackerGuild.owner_id);
                await attackerUser.send({
                    embeds: [embed.setDescription(`La guilde **${guild.name}** a accepté votre déclaration de guerre ! La guerre commence maintenant.`)]
                });
            } catch (error) {
                logger.error(`Impossible d'envoyer la notification au chef attaquant ${attackerGuild.owner_id}:`, error);
            }

            logger.info(`Guerre acceptée entre ${attackerGuild.name} et ${guild.name}`);
            return await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Erreur lors de l\'acceptation de la guerre:', error);
            return await interaction.editReply({
                content: `❌ Erreur lors de l'acceptation de la guerre : ${error.message}`,
                ephemeral: true
            });
        }

    } else if (action === 'refuse') {
        // Mettre à jour la déclaration en 'refused'
        db.prepare('UPDATE guild_war_declarations SET status = ? WHERE id = ?')
            .run('refused', declaration.id);

        const embed = new EmbedBuilder()
            .setTitle('🛡️ Guerre Refusée')
            .setDescription(`Votre guilde **${guild.name}** a refusé la déclaration de guerre de **${attackerGuild.name}**.`)
            .setColor(0x808080)
            .setTimestamp();

        // Notifier le chef de la guilde attaquante
        try {
            const attackerUser = await interaction.client.users.fetch(attackerGuild.owner_id);
            await attackerUser.send({
                embeds: [embed.setDescription(`La guilde **${guild.name}** a refusé votre déclaration de guerre.`)]
            });
        } catch (error) {
            logger.error(`Impossible d'envoyer la notification au chef attaquant ${attackerGuild.owner_id}:`, error);
        }

        logger.info(`Guerre refusée entre ${attackerGuild.name} et ${guild.name}`);
        return await interaction.editReply({ embeds: [embed] });
    }
}

async function handleStatut(interaction) {
    const userId = interaction.user.id;
    const guild = getGuildOfUser(userId);

    if (!guild) {
        return interaction.reply({ content: "❌ Vous n'êtes pas dans une guilde.", flags: 64 });
    }

    const war = getOngoingWar(guild.id);

    if (!war) {
        return interaction.reply({ content: '❌ Votre guilde n\'est actuellement pas en guerre.', flags: 64 });
    }

    const stats = getWarStats(war.id);
    
    if (!stats) {
        return interaction.reply({ content: '❌ Impossible de récupérer les statistiques de guerre.', flags: 64 });
    }

    const { guild1, guild2, points1, points2, percentage1, percentage2, timeRemaining } = stats;

    // Déterminer qui est qui
    const isGuild1 = guild.id === guild1.id;
    const myGuild = isGuild1 ? guild1 : guild2;
    const enemyGuild = isGuild1 ? guild2 : guild1;
    const myPoints = isGuild1 ? points1 : points2;
    const enemyPoints = isGuild1 ? points2 : points1;
    const myPercentage = isGuild1 ? percentage1 : percentage2;
    const enemyPercentage = isGuild1 ? percentage2 : percentage1;

    // Calcul du temps restant
    let timeString;
    if (timeRemaining <= 0) {
        timeString = '⏰ Overtime !';
    } else {
        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        timeString = `${hours}h ${minutes}m`;
    }

    // Déterminer qui gagne
    const leader = myPoints > enemyPoints ? 'Vous menez !' : myPoints < enemyPoints ? 'Vous êtes en retard !' : 'Égalité !';
    const leaderColor = myPoints > enemyPoints ? '#00FF00' : myPoints < enemyPoints ? '#FF0000' : '#FFFF00';

    // Durée de guerre
    const durationText = war.duration_type === 'short' ? 'Guerre courte (12h)' : 
                         war.duration_type === 'normal' ? 'Guerre classique (48h)' : 
                         'Guerre longue (7 jours)';

    const embed = new EmbedBuilder()
        .setTitle(`⚔️ Guerre en cours - ${leader}`)
        .setDescription(`${myGuild.emoji} **${myGuild.name}** VS ${enemyGuild.emoji} **${enemyGuild.name}**`)
        .setColor(leaderColor)
        .addFields(
            { name: '⏱️ Temps restant', value: timeString, inline: true },
            { name: '🎯 Type', value: durationText, inline: true },
            { name: '🔥 Forcée', value: war.forced ? 'Oui (Coup d\'État)' : 'Non', inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: `${myGuild.emoji} Votre guilde`, value: `**Points:** ${myPoints || 0}\n**Pourcentage:** ${(myPercentage || 0).toFixed(2)}%`, inline: true },
            { name: 'VS', value: '⚔️', inline: true },
            { name: `${enemyGuild.emoji} Guilde adverse`, value: `**Points:** ${enemyPoints || 0}\n**Pourcentage:** ${(enemyPercentage || 0).toFixed(2)}%`, inline: true }
        )
        .setFooter({ text: 'Continuez à envoyer des messages, compter et être en vocal pour augmenter vos points de guerre !' });

    await interaction.reply({ embeds: [embed] });
}
