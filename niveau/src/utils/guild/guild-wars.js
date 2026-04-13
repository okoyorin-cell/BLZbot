const db = require('../../database/database');
const logger = require('../logger');
const { EmbedBuilder } = require('discord.js');

/**
 * Durées de guerre en millisecondes
 */
const WAR_DURATIONS = {
    'short': 12 * 60 * 60 * 1000,      // 12h
    'normal': 48 * 60 * 60 * 1000,     // 48h
    'long': 168 * 60 * 60 * 1000       // 168h (7 jours)
};

/**
 * Pourcentages de pillage selon le type de guerre
 */
const PLUNDER_RATES = {
    'short': 0.25,    // 25%
    'normal': 0.50,   // 50%
    'long': 1.00      // 100%
};

/**
 * Déclare une guerre entre deux guildes
 */
async function declareWar(client, fromGuildId, toGuildId, durationType, forced = false) {
    const fromGuild = db.prepare('SELECT * FROM guilds WHERE id = ?').get(fromGuildId);
    const toGuild = db.prepare('SELECT * FROM guilds WHERE id = ?').get(toGuildId);

    // Vérifications
    if (!fromGuild || !toGuild) {
        throw new Error('Guilde introuvable');
    }

    if (fromGuild.upgrade_level < 6) {
        throw new Error('Votre guilde doit être Upgrade 6+ pour déclarer une guerre');
    }

    if (toGuild.upgrade_level < 6) {
        throw new Error('La guilde cible doit être Upgrade 6+ pour participer aux guerres');
    }

    // Vérifier si une des guildes est déjà en guerre (ongoing ou overtime)
    const ongoingWar = db.prepare(
        "SELECT * FROM guild_wars WHERE (guild1_id = ? OR guild2_id = ? OR guild1_id = ? OR guild2_id = ?) AND (status = 'ongoing' OR status = 'overtime')"
    ).get(fromGuildId, fromGuildId, toGuildId, toGuildId);

    if (ongoingWar) {
        throw new Error('Une des guildes est déjà en guerre');
    }

    // Vérifier si une déclaration est déjà en attente
    const pendingDeclaration = db.prepare(
        "SELECT * FROM guild_war_declarations WHERE (from_guild_id = ? OR to_guild_id = ? OR from_guild_id = ? OR to_guild_id = ?) AND status = 'pending'"
    ).get(fromGuildId, fromGuildId, toGuildId, toGuildId);

    if (pendingDeclaration) {
        throw new Error('Une déclaration de guerre est déjà en attente pour une de ces guildes');
    }

    // Si guerre forcée, créer directement la guerre
    if (forced) {
        return await startWar(client, fromGuildId, toGuildId, durationType, true);
    }

    // Sinon, créer une déclaration en attente
    const declarationId = db.prepare(
        'INSERT INTO guild_war_declarations (from_guild_id, to_guild_id, duration_type, forced, timestamp, status) VALUES (?, ?, ?, 0, ?, ?)'
    ).run(fromGuildId, toGuildId, durationType, Date.now(), 'pending').lastInsertRowid;

    logger.info(`Guerre déclarée: Guilde ${fromGuildId} → Guilde ${toGuildId} (${durationType})`);

    // Envoyer notification dans le salon de la guilde cible
    await sendWarDeclarationNotification(client, fromGuild, toGuild, durationType, declarationId);

    return declarationId;
}

/**
 * Envoie une notification de déclaration de guerre
 */
async function sendWarDeclarationNotification(client, fromGuild, toGuild, durationType, declarationId) {
    try {
        const guildChannelId = process.env.GUILD_CHANNEL;
        if (!guildChannelId) return;

        const channel = await client.channels.fetch(guildChannelId).catch(() => null);
        if (!channel) return;

        const durationText = durationType === 'short' ? '12 heures' : durationType === 'normal' ? '48 heures' : '7 jours';

        const embed = new EmbedBuilder()
            .setTitle('⚔️ DÉCLARATION DE GUERRE !')
            .setDescription(`${fromGuild.emoji} **${fromGuild.name}** a déclaré la guerre à ${toGuild.emoji} **${toGuild.name}** !`)
            .addFields(
                { name: '⏱️ Durée', value: durationText, inline: true },
                { name: '🎯 Type', value: durationType === 'short' ? 'Guerre courte' : durationType === 'normal' ? 'Guerre classique' : 'Guerre longue', inline: true }
            )
            .setColor('#FF0000')
            .setFooter({ text: `<@${toGuild.owner_id}>, acceptez ou refusez cette guerre avec /guerre-repondre` });

        await channel.send({ content: `<@${toGuild.owner_id}>`, embeds: [embed] });
    } catch (error) {
        logger.error('Erreur lors de l\'envoi de la notification de guerre:', error);
    }
}

/**
 * Accepte une déclaration de guerre
 */
async function acceptWar(client, declarationId) {
    const declaration = db.prepare('SELECT * FROM guild_war_declarations WHERE id = ? AND status = ?')
        .get(declarationId, 'pending');

    if (!declaration) {
        throw new Error('Déclaration de guerre introuvable ou déjà traitée');
    }

    // Marquer la déclaration comme acceptée
    db.prepare('UPDATE guild_war_declarations SET status = ? WHERE id = ?').run('accepted', declarationId);

    // Démarrer la guerre
    return await startWar(client, declaration.from_guild_id, declaration.to_guild_id, declaration.duration_type, false);
}

/**
 * Démarre une guerre
 */
async function startWar(client, guild1Id, guild2Id, durationType, forced) {
    const now = Date.now();
    const duration = WAR_DURATIONS[durationType];
    const endTime = now + duration;

    const guild1 = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guild1Id);
    const guild2 = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guild2Id);

    // Créer la guerre
    const warId = db.prepare(
        'INSERT INTO guild_wars (guild1_id, guild2_id, start_time, end_time, duration_type, status, forced, guild1_initial_treasury, guild2_initial_treasury) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(guild1Id, guild2Id, now, endTime, durationType, 'ongoing', forced ? 1 : 0, guild1.treasury, guild2.treasury).lastInsertRowid;

    // Enregistrer les membres participants (compteurs à zéro au début)
    const members1 = db.prepare('SELECT user_id FROM guild_members WHERE guild_id = ?').all(guild1Id);
    const members2 = db.prepare('SELECT user_id FROM guild_members WHERE guild_id = ?').all(guild2Id);

    logger.info(`[GUILD-WAR] Insertion des membres: ${members1.length} membres guilde ${guild1Id}, ${members2.length} membres guilde ${guild2Id}`);

    const insertMember = db.prepare('INSERT OR IGNORE INTO guild_war_members (war_id, user_id, guild_id, war_messages, war_counting_messages, war_voice_minutes, war_points) VALUES (?, ?, ?, 0, 0, 0, 0)');

    let inserted = 0;
    for (const member of members1) {
        try {
            insertMember.run(warId, member.user_id, guild1Id);
            inserted++;
        } catch (err) {
            logger.error(`[GUILD-WAR] Erreur insertion membre ${member.user_id} guilde ${guild1Id}:`, err.message);
        }
    }

    for (const member of members2) {
        try {
            insertMember.run(warId, member.user_id, guild2Id);
            inserted++;
        } catch (err) {
            logger.error(`[GUILD-WAR] Erreur insertion membre ${member.user_id} guilde ${guild2Id}:`, err.message);
        }
    }

    logger.info(`[GUILD-WAR] ${inserted}/${members1.length + members2.length} membres insérés pour la guerre ${warId}`);

    logger.info(`Guerre démarrée: ${warId} entre guildes ${guild1Id} et ${guild2Id}`);

    // Envoyer notification de début
    await sendWarStartNotification(client, guild1, guild2, durationType, warId, forced);

    return warId;
}

/**
 * Envoie notification de début de guerre
 */
async function sendWarStartNotification(client, guild1, guild2, durationType, warId, forced) {
    try {
        const guildChannelId = process.env.GUILD_CHANNEL;
        if (!guildChannelId) return;

        const channel = await client.channels.fetch(guildChannelId).catch(() => null);
        if (!channel) return;

        const durationText = durationType === 'short' ? '12 heures' : durationType === 'normal' ? '48 heures' : '7 jours';
        const warType = forced ? '🔥 GUERRE FORCÉE (Coup d\'État)' : '⚔️ GUERRE ACCEPTÉE';

        const embed = new EmbedBuilder()
            .setTitle(warType)
            .setDescription(`La guerre entre ${guild1.emoji} **${guild1.name}** et ${guild2.emoji} **${guild2.name}** commence maintenant !`)
            .addFields(
                { name: '⏱️ Durée', value: durationText, inline: true },
                { name: '🆔 ID Guerre', value: `#${warId}`, inline: true }
            )
            .setColor(forced ? '#8B0000' : '#FF4500')
            .setFooter({ text: 'Que le meilleur gagne !' });

        await channel.send({ embeds: [embed] });
    } catch (error) {
        logger.error('Erreur lors de l\'envoi de la notification de début de guerre:', error);
    }
}

/**
 * Calcule les points de guerre d'une guilde (utilise les war_points stockés)
 */
function calculateWarPoints(warId, guildId) {
    const result = db.prepare('SELECT COALESCE(SUM(war_points), 0) as total FROM guild_war_members WHERE war_id = ? AND guild_id = ?')
        .get(warId, guildId);
    return result ? result.total : 0;
}

/**
 * Met à jour les points de guerre d'un membre (appelé après chaque gain de ressources)
 * Formule: 1 message normal = 1pt, 1 message comptage = 0.5pt, 1 minute vocal = 5pt
 * @param {number} warId - ID de la guerre
 * @param {string} userId - ID de l'utilisateur
 */
function updateMemberWarPoints(warId, userId) {
    const member = db.prepare('SELECT * FROM guild_war_members WHERE war_id = ? AND user_id = ?').get(warId, userId);
    if (!member) return;

    // Formule simplifiée: 1 message = 1pt, 1 comptage = 0.5pt, 1 minute vocal = 1pt
    const newWarPoints = Math.floor(
        member.war_messages * 1 +
        member.war_counting_messages * 0.5 +
        member.war_voice_minutes * 1
    );

    // Mettre à jour les points
    db.prepare('UPDATE guild_war_members SET war_points = ? WHERE war_id = ? AND user_id = ?')
        .run(newWarPoints, warId, userId);
    logger.debug(`War points updated for ${userId} in war ${warId}: ${newWarPoints} pts (${member.war_messages} msg + ${member.war_counting_messages} comptage + ${member.war_voice_minutes} min vocal)`);
}

/**
 * Vérifie les guerres terminées et applique les résultats
 */
async function checkAndEndWars(client) {
    const now = Date.now();
    const endedWars = db.prepare("SELECT * FROM guild_wars WHERE (status = 'ongoing' OR status = 'overtime') AND end_time <= ?")
        .all(now);

    for (const war of endedWars) {
        await endWar(client, war.id);
    }
}

/**
 * Termine une guerre et applique les résultats
 */
async function endWar(client, warId) {
    const war = db.prepare('SELECT * FROM guild_wars WHERE id = ?').get(warId);
    if (!war) return;

    const guild1 = db.prepare('SELECT * FROM guilds WHERE id = ?').get(war.guild1_id);
    const guild2 = db.prepare('SELECT * FROM guilds WHERE id = ?').get(war.guild2_id);

    // Calculer les points
    const points1 = calculateWarPoints(warId, war.guild1_id);
    const points2 = calculateWarPoints(warId, war.guild2_id);

    const totalPoints = points1 + points2;
    const percentage1 = totalPoints > 0 ? (points1 / totalPoints) * 100 : 50;
    const percentage2 = totalPoints > 0 ? (points2 / totalPoints) * 100 : 50;

    // Déterminer le gagnant - gérer l'égalité (overtime)
    if (points1 === points2) {
        // Égalité: prolonger de 24h (overtime)
        const newEndTime = Date.now() + (24 * 60 * 60 * 1000);
        db.prepare('UPDATE guild_wars SET status = ?, end_time = ? WHERE id = ?').run('overtime', newEndTime, warId);
        logger.info(`Guerre ${warId} terminée en égalité (${points1} vs ${points2}). Overtime de 24h accordé.`);
        return; // Attendre la prochaine vérification
    }

    const winnerId = points1 > points2 ? war.guild1_id : war.guild2_id;
    const loserId = winnerId === war.guild1_id ? war.guild2_id : war.guild1_id;
    const winnerGuild = winnerId === war.guild1_id ? guild1 : guild2;
    const loserGuild = loserId === war.guild1_id ? guild1 : guild2;
    const winnerPercentage = winnerId === war.guild1_id ? percentage1 : percentage2;

    // Marquer la guerre comme terminée
    db.prepare('UPDATE guild_wars SET status = ?, winner_id = ? WHERE id = ?')
        .run('finished', winnerId, warId);

    // Appliquer les récompenses et pénalités
    await applyWarResults(client, war, winnerGuild, loserGuild, winnerPercentage);

    // Mettre à jour les stats de guerre
    await updateWarStats(client, winnerId, winnerPercentage);

    // --- GESTION DU MVP DE GUERRE ---
    let mvpUser = null;
    let mvpPoints = 0;

    try {
        // Récupérer tous les participants de la guilde gagnante et trouver celui avec le plus de war_points
        const winnerMembers = db.prepare('SELECT * FROM guild_war_members WHERE war_id = ? AND guild_id = ? ORDER BY war_points DESC LIMIT 1').get(warId, winnerId);

        if (winnerMembers && winnerMembers.war_points > 0) {
            mvpUser = winnerMembers.user_id;
            mvpPoints = winnerMembers.war_points;
        }

        if (mvpUser) {
            // Enregistrer le MVP
            db.prepare('INSERT OR REPLACE INTO war_mvps (war_id, user_id, guild_id, points_contributed, rewarded_at) VALUES (?, ?, ?, ?, ?)')
                .run(warId, mvpUser, winnerId, Math.floor(mvpPoints), Date.now());

            // Donner le badge MVP
            db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, ?)')
                .run(mvpUser, 'war_mvp', Date.now());

            // Bonus de Starss pour le MVP (5000 Starss)
            const { grantResources } = require('../db-users');
            grantResources(client, mvpUser, { stars: 5000, source: 'guild_war' });

            logger.info(`MVP de la guerre ${warId}: ${mvpUser} avec ${mvpPoints} points`);
        }
    } catch (error) {
        logger.error('Erreur lors du calcul du MVP de guerre:', error);
    }

    // Envoyer notification de fin
    await sendWarEndNotification(client, war, guild1, guild2, points1, points2, percentage1, percentage2, winnerId, mvpUser);

    logger.info(`Guerre ${warId} terminée. Gagnant: Guilde ${winnerId}`);
}

/**
 * Applique les résultats de la guerre
 */
async function applyWarResults(client, war, winnerGuild, loserGuild, winnerPercentage) {
    const plunderRate = PLUNDER_RATES[war.duration_type];
    const plunderedAmount = Math.floor(loserGuild.treasury * plunderRate);

    // Récompenses pour le gagnant : DOUBLER la trésorerie + ajouter le pillage
    const newWinnerTreasury = Math.min(
        (winnerGuild.treasury * 2) + plunderedAmount,
        winnerGuild.treasury_capacity
    );

    // Boost de guilde multiplié par 1.5 pendant (durée_guerre / 2)
    const warDuration = WAR_DURATIONS[war.duration_type];
    const boostDuration = Math.floor(warDuration / 2);
    const boostMultiplier = 1.5;

    // Calculer le boost_level effectif (boost actuel * 1.5)
    const effectiveBoostLevel = Math.floor(winnerGuild.boost_level * boostMultiplier);

    db.prepare('UPDATE guilds SET treasury = ?, boost_level = ?, guild_boost_until = ? WHERE id = ?')
        .run(newWinnerTreasury, effectiveBoostLevel, Date.now() + boostDuration, winnerGuild.id);

    // Ajouter 20 niveaux à la guilde gagnante
    db.prepare('UPDATE guilds SET level = level + 20 WHERE id = ?').run(winnerGuild.id);

    // Pénalités pour le perdant : retirer le montant pillé
    const newLoserTreasury = Math.max(0, loserGuild.treasury - plunderedAmount);
    db.prepare('UPDATE guilds SET treasury = ? WHERE id = ?')
        .run(newLoserTreasury, loserGuild.id);

    logger.info(`Résultats de guerre appliqués. Pillage: ${plunderedAmount} starss, Nouveau trésor gagnant: ${newWinnerTreasury}, Boost x${boostMultiplier} pendant ${Math.floor(boostDuration / (60 * 60 * 1000))}h`);

    logger.info(`Résultats de guerre appliqués. Pillage: ${plunderedAmount} starss`);
}

/**
 * Met à jour les statistiques de guerre
 */
async function updateWarStats(client, guildId, percentage) {
    db.prepare('UPDATE guilds SET wars_won = wars_won + 1 WHERE id = ?').run(guildId);

    if (percentage >= 70) {
        db.prepare('UPDATE guilds SET wars_won_70 = wars_won_70 + 1 WHERE id = ?').run(guildId);
    }
    if (percentage >= 80) {
        db.prepare('UPDATE guilds SET wars_won_80 = wars_won_80 + 1 WHERE id = ?').run(guildId);
    }
    if (percentage >= 90) {
        db.prepare('UPDATE guilds SET wars_won_90 = wars_won_90 + 1 WHERE id = ?').run(guildId);
    }

    // Vérifier les quêtes de guerre
    const { checkAndCompleteGuildQuests } = require('./guild-quests');
    const { getGuildById } = require('../db-guilds');
    const winnerGuild = getGuildById(guildId);
    if (winnerGuild) {
        await checkAndCompleteGuildQuests(client, winnerGuild, 'war_win');
    }
}

/**
 * Envoie notification de fin de guerre
 */
async function sendWarEndNotification(client, war, guild1, guild2, points1, points2, percentage1, percentage2, winnerId, mvpUserId = null) {
    try {
        const guildChannelId = process.env.GUILD_CHANNEL;
        if (!guildChannelId) return;

        const channel = await client.channels.fetch(guildChannelId).catch(() => null);
        if (!channel) return;

        const winnerGuild = winnerId === war.guild1_id ? guild1 : guild2;
        const loserGuild = winnerId === war.guild1_id ? guild2 : guild1;
        const winnerPercentage = winnerId === war.guild1_id ? percentage1 : percentage2;

        const embed = new EmbedBuilder()
            .setTitle('🏆 GUERRE TERMINÉE !')
            .setDescription(`Victoire de ${winnerGuild.emoji} **${winnerGuild.name}** contre ${loserGuild.emoji} **${loserGuild.name}** !`)
            .addFields(
                { name: `${guild1.emoji} ${guild1.name}`, value: `${points1 || 0} points (${(percentage1 || 0).toFixed(2)}%)`, inline: true },
                { name: 'VS', value: '⚔️', inline: true },
                { name: `${guild2.emoji} ${guild2.name}`, value: `${points2 || 0} points (${(percentage2 || 0).toFixed(2)}%)`, inline: true }
            )
            .setColor('#FFD700')
            .setFooter({ text: `Victoire à ${winnerPercentage.toFixed(2)}%` });

        if (mvpUserId) {
            embed.addFields({ name: '🌟 MVP de la Guerre', value: `<@${mvpUserId}> (+5000 Starss + Badge MVP)`, inline: false });
        }

        await channel.send({ embeds: [embed] });
    } catch (error) {
        logger.error('Erreur lors de l\'envoi de la notification de fin de guerre:', error);
    }
}

/**
 * Récupère la guerre en cours d'une guilde (ongoing ou overtime)
 */
function getOngoingWar(guildId) {
    return db.prepare(
        "SELECT * FROM guild_wars WHERE (guild1_id = ? OR guild2_id = ?) AND (status = 'ongoing' OR status = 'overtime')"
    ).get(guildId, guildId);
}

/**
 * Récupère les stats détaillées d'une guerre
 */
function getWarStats(warId) {
    const war = db.prepare('SELECT * FROM guild_wars WHERE id = ?').get(warId);
    if (!war) return null;

    const guild1 = db.prepare('SELECT * FROM guilds WHERE id = ?').get(war.guild1_id);
    const guild2 = db.prepare('SELECT * FROM guilds WHERE id = ?').get(war.guild2_id);

    const points1 = calculateWarPoints(warId, war.guild1_id);
    const points2 = calculateWarPoints(warId, war.guild2_id);

    const totalPoints = points1 + points2;
    const percentage1 = totalPoints > 0 ? (points1 / totalPoints) * 100 : 50;
    const percentage2 = totalPoints > 0 ? (points2 / totalPoints) * 100 : 50;

    return {
        war,
        guild1,
        guild2,
        points1,
        points2,
        percentage1,
        percentage2,
        timeRemaining: war.end_time - Date.now()
    };
}

/**
 * Récupère la déclaration de guerre active pour une guilde cible
 */
function getActiveDeclaration(targetGuildId) {
    const stmt = db.prepare(`
        SELECT * FROM guild_war_declarations 
        WHERE to_guild_id = ? AND status = 'pending'
        ORDER BY timestamp DESC
        LIMIT 1
    `);
    return stmt.get(targetGuildId);
}

/**
 * Incrémente le compteur de messages normaux pour un utilisateur en guerre
 * @param {string} userId - ID de l'utilisateur
 */
function incrementWarMessages(userId) {
    try {
        // Trouver les guerres actives de cet utilisateur
        const warMembers = db.prepare(`
            SELECT gwm.* FROM guild_war_members gwm
            JOIN guild_wars gw ON gwm.war_id = gw.id
            WHERE gwm.user_id = ? AND (gw.status = 'ongoing' OR gw.status = 'overtime')
        `).all(userId);

        // Si l'utilisateur n'est pas dans guild_war_members, essayer de l'ajouter (il a peut-être rejoint la guilde après le début de la guerre)
        if (warMembers.length === 0) {
            const userGuild = db.prepare('SELECT guild_id FROM guild_members WHERE user_id = ?').get(userId);
            if (!userGuild) return;

            const activeWar = db.prepare(
                "SELECT * FROM guild_wars WHERE (guild1_id = ? OR guild2_id = ?) AND (status = 'ongoing' OR status = 'overtime')"
            ).get(userGuild.guild_id, userGuild.guild_id);
            if (!activeWar) return;

            // Ajouter dynamiquement le membre à la guerre
            const result = db.prepare('INSERT OR IGNORE INTO guild_war_members (war_id, user_id, guild_id, war_messages, war_counting_messages, war_voice_minutes, war_points) VALUES (?, ?, ?, 0, 0, 0, 0)')
                .run(activeWar.id, userId, userGuild.guild_id);
            logger.info(`[GUILD-WAR] Membre ${userId} ajouté dynamiquement à la guerre ${activeWar.id} (changes: ${result.changes})`);

            // Réessayer
            const newMember = db.prepare('SELECT * FROM guild_war_members WHERE war_id = ? AND user_id = ?').get(activeWar.id, userId);
            if (newMember) {
                db.prepare('UPDATE guild_war_members SET war_messages = war_messages + 1 WHERE war_id = ? AND user_id = ?')
                    .run(activeWar.id, userId);
                updateMemberWarPoints(activeWar.id, userId);
                logger.debug(`[GUILD-WAR] +1 msg pour ${userId} dans guerre ${activeWar.id} (ajout dynamique)`);
            }
            return;
        }

        for (const member of warMembers) {
            db.prepare('UPDATE guild_war_members SET war_messages = war_messages + 1 WHERE war_id = ? AND user_id = ?')
                .run(member.war_id, userId);
            updateMemberWarPoints(member.war_id, userId);
        }
    } catch (error) {
        logger.error(`[GUILD-WAR] Erreur increment war messages pour ${userId}:`, error);
    }
}

/**
 * Incrémente le compteur de messages de comptage pour un utilisateur en guerre
 * @param {string} userId - ID de l'utilisateur
 */
function incrementWarCountingMessages(userId) {
    try {
        const warMembers = db.prepare(`
            SELECT gwm.* FROM guild_war_members gwm
            JOIN guild_wars gw ON gwm.war_id = gw.id
            WHERE gwm.user_id = ? AND (gw.status = 'ongoing' OR gw.status = 'overtime')
        `).all(userId);

        if (warMembers.length === 0) {
            const userGuild = db.prepare('SELECT guild_id FROM guild_members WHERE user_id = ?').get(userId);
            if (!userGuild) return;

            const activeWar = db.prepare(
                "SELECT * FROM guild_wars WHERE (guild1_id = ? OR guild2_id = ?) AND (status = 'ongoing' OR status = 'overtime')"
            ).get(userGuild.guild_id, userGuild.guild_id);
            if (!activeWar) return;

            db.prepare('INSERT OR IGNORE INTO guild_war_members (war_id, user_id, guild_id, war_messages, war_counting_messages, war_voice_minutes, war_points) VALUES (?, ?, ?, 0, 0, 0, 0)')
                .run(activeWar.id, userId, userGuild.guild_id);
            logger.info(`[GUILD-WAR] Membre ${userId} ajouté dynamiquement à la guerre ${activeWar.id} (counting)`);

            db.prepare('UPDATE guild_war_members SET war_counting_messages = war_counting_messages + 1 WHERE war_id = ? AND user_id = ?')
                .run(activeWar.id, userId);
            updateMemberWarPoints(activeWar.id, userId);
            return;
        }

        for (const member of warMembers) {
            db.prepare('UPDATE guild_war_members SET war_counting_messages = war_counting_messages + 1 WHERE war_id = ? AND user_id = ?')
                .run(member.war_id, userId);
            updateMemberWarPoints(member.war_id, userId);
        }
    } catch (error) {
        logger.error(`[GUILD-WAR] Erreur increment war counting pour ${userId}:`, error.message);
    }
}

/**
 * Incrémente le compteur de minutes vocales pour un utilisateur en guerre
 * @param {string} userId - ID de l'utilisateur
 */
function incrementWarVoiceMinutes(userId) {
    try {
        const warMembers = db.prepare(`
            SELECT gwm.* FROM guild_war_members gwm
            JOIN guild_wars gw ON gwm.war_id = gw.id
            WHERE gwm.user_id = ? AND (gw.status = 'ongoing' OR gw.status = 'overtime')
        `).all(userId);

        if (warMembers.length === 0) {
            const userGuild = db.prepare('SELECT guild_id FROM guild_members WHERE user_id = ?').get(userId);
            if (!userGuild) return;

            const activeWar = db.prepare(
                "SELECT * FROM guild_wars WHERE (guild1_id = ? OR guild2_id = ?) AND (status = 'ongoing' OR status = 'overtime')"
            ).get(userGuild.guild_id, userGuild.guild_id);
            if (!activeWar) return;

            db.prepare('INSERT OR IGNORE INTO guild_war_members (war_id, user_id, guild_id, war_messages, war_counting_messages, war_voice_minutes, war_points) VALUES (?, ?, ?, 0, 0, 0, 0)')
                .run(activeWar.id, userId, userGuild.guild_id);
            logger.info(`[GUILD-WAR] Membre ${userId} ajouté dynamiquement à la guerre ${activeWar.id} (voice)`);

            db.prepare('UPDATE guild_war_members SET war_voice_minutes = war_voice_minutes + 1 WHERE war_id = ? AND user_id = ?')
                .run(activeWar.id, userId);
            updateMemberWarPoints(activeWar.id, userId);
            return;
        }

        for (const member of warMembers) {
            db.prepare('UPDATE guild_war_members SET war_voice_minutes = war_voice_minutes + 1 WHERE war_id = ? AND user_id = ?')
                .run(member.war_id, userId);
            updateMemberWarPoints(member.war_id, userId);
        }
    } catch (error) {
        logger.error(`[GUILD-WAR] Erreur increment war voice pour ${userId}:`, error.message);
    }
}

/**
 * Ajuste les valeurs initiales d'un utilisateur en guerre.
 * Utilisé pour que les transferts, commandes admin, et paris ne faussent pas les scores de guerre.
 * @param {string} userId - ID de l'utilisateur
 * @param {object} adjustments - { stars, xp } montants à ajuster
 */
function adjustWarInitialValues(userId, { stars = 0, xp = 0 } = {}) {
    try {
        // Trouver les guerres actives où cet utilisateur participe
        const warMembers = db.prepare(`
            SELECT gwm.war_id FROM guild_war_members gwm
            JOIN guild_wars gw ON gwm.war_id = gw.id
            WHERE gwm.user_id = ? AND (gw.status = 'ongoing' OR gw.status = 'overtime')
        `).all(userId);

        // Pas en guerre, rien à faire
        if (warMembers.length === 0) return;

        // Pour chaque guerre active, on pourrait ajuster les valeurs initiales
        // Mais la table guild_wars ne stocke que guild1_initial_treasury et guild2_initial_treasury
        // Les transferts entre joueurs n'affectent pas la trésorerie de guilde, donc pas d'ajustement nécessaire
        // Cette fonction existe pour éviter les crashs dans les commandes qui l'appellent
        logger.debug(`[GUILD-WARS] adjustWarInitialValues appelé pour ${userId} (stars: ${stars}, xp: ${xp}) - ${warMembers.length} guerre(s) active(s)`);
    } catch (error) {
        // Silencieux - ne pas crasher les commandes appelantes
        logger.debug(`[GUILD-WARS] adjustWarInitialValues erreur pour ${userId}: ${error.message}`);
    }
}

/**
 * Récupère toutes les guerres actives (ongoing, overtime) et les déclarations en attente
 */
function getAllActiveWars() {
    const wars = db.prepare(
        "SELECT gw.*, g1.name as guild1_name, g1.emoji as guild1_emoji, g2.name as guild2_name, g2.emoji as guild2_emoji FROM guild_wars gw JOIN guilds g1 ON gw.guild1_id = g1.id JOIN guilds g2 ON gw.guild2_id = g2.id WHERE gw.status IN ('ongoing', 'overtime') ORDER BY gw.start_time DESC"
    ).all();

    const declarations = db.prepare(
        "SELECT gwd.*, g1.name as from_guild_name, g1.emoji as from_guild_emoji, g2.name as to_guild_name, g2.emoji as to_guild_emoji FROM guild_war_declarations gwd JOIN guilds g1 ON gwd.from_guild_id = g1.id JOIN guilds g2 ON gwd.to_guild_id = g2.id WHERE gwd.status = 'pending' ORDER BY gwd.timestamp DESC"
    ).all();

    return { wars, declarations };
}

/**
 * Supprime une guerre (et ses données associées) sans appliquer de résultats
 * @param {number} warId - ID de la guerre à supprimer
 * @param {'war'|'declaration'} type - Type d'entrée à supprimer
 */
function deleteWar(warId, type = 'war') {
    if (type === 'declaration') {
        const declaration = db.prepare('SELECT * FROM guild_war_declarations WHERE id = ?').get(warId);
        if (!declaration) throw new Error('Déclaration de guerre introuvable');
        db.prepare('DELETE FROM guild_war_declarations WHERE id = ?').run(warId);
        logger.info(`[GUILD-WAR] Déclaration de guerre #${warId} supprimée par un admin`);
        return { type: 'declaration', id: warId, declaration };
    }

    const war = db.prepare('SELECT * FROM guild_wars WHERE id = ?').get(warId);
    if (!war) throw new Error('Guerre introuvable');

    // Supprimer les membres de guerre associés
    db.prepare('DELETE FROM guild_war_members WHERE war_id = ?').run(warId);
    // Supprimer la guerre elle-même
    db.prepare('DELETE FROM guild_wars WHERE id = ?').run(warId);

    logger.info(`[GUILD-WAR] Guerre #${warId} supprimée par un admin (${war.status})`);
    return { type: 'war', id: warId, war };
}

module.exports = {
    declareWar,
    acceptWar,
    startWar,
    calculateWarPoints,
    updateMemberWarPoints,
    incrementWarMessages,
    incrementWarCountingMessages,
    incrementWarVoiceMinutes,
    checkAndEndWars,
    endWar,
    applyWarResults,
    updateWarStats,
    getOngoingWar,
    getWarStats,
    getActiveDeclaration,
    adjustWarInitialValues,
    getAllActiveWars,
    deleteWar,
    WAR_DURATIONS,
    PLUNDER_RATES
};
