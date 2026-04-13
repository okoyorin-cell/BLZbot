
const db = require('../database/database');
const { getGuildById, getGuildMembersWithDetails } = require('./db-guilds');
const { getOrCreateUser, grantResources } = require('./db-users');
const logger = require('./logger');
const { EmbedBuilder } = require('discord.js');

/**
 * Met à jour les statistiques de guerre (victoires)
 * @param {string} winnerId - ID de la guilde gagnante
 * @param {number} winnerPercentage - Pourcentage de victoire
 */
function updateWarVictoryStats(winnerId, winnerPercentage) {
    db.prepare('UPDATE guilds SET wars_won = wars_won + 1 WHERE id = ?').run(winnerId);

    if (winnerPercentage >= 70) {
        db.prepare('UPDATE guilds SET wars_won_70 = wars_won_70 + 1 WHERE id = ?').run(winnerId);
    }
    if (winnerPercentage >= 80) {
        db.prepare('UPDATE guilds SET wars_won_80 = wars_won_80 + 1 WHERE id = ?').run(winnerId);
    }
    if (winnerPercentage >= 90) {
        db.prepare('UPDATE guilds SET wars_won_90 = wars_won_90 + 1 WHERE id = ?').run(winnerId);
    }

    logger.info(`War stats updated for guild ${winnerId}: +1 win (${winnerPercentage.toFixed(2)}%)`);
}

function checkFinishedWars(client) {
    const getFinishedWarsStmt = db.prepare('SELECT * FROM guild_wars WHERE status = \'ongoing\' AND end_time <= ?');
    const finishedWars = getFinishedWarsStmt.all(Date.now());

    for (const war of finishedWars) {
        logger.info(`Processing finished war: ${war.id}`);

        const guild1 = getGuildById(war.guild1_id);
        const guild2 = getGuildById(war.guild2_id);

        // Utiliser les war_points stockés (ne peuvent jamais être négatifs)
        const guild1PointsResult = db.prepare('SELECT COALESCE(SUM(war_points), 0) as total FROM guild_war_members WHERE war_id = ? AND guild_id = ?').get(war.id, war.guild1_id);
        const guild2PointsResult = db.prepare('SELECT COALESCE(SUM(war_points), 0) as total FROM guild_war_members WHERE war_id = ? AND guild_id = ?').get(war.id, war.guild2_id);

        const guild1Points = guild1PointsResult ? guild1PointsResult.total : 0;
        const guild2Points = guild2PointsResult ? guild2PointsResult.total : 0;

        let winner = null;
        let loser = null;
        let winnerPoints = 0;
        let loserPoints = 0;

        if (guild1Points > guild2Points) {
            winner = guild1;
            loser = guild2;
            winnerPoints = guild1Points;
            loserPoints = guild2Points;
        } else if (guild2Points > guild1Points) {
            winner = guild2;
            loser = guild1;
            winnerPoints = guild2Points;
            loserPoints = guild1Points;
        } else {
            // Draw - go to overtime
            const updateStatusStmt = db.prepare('UPDATE guild_wars SET status = \'overtime\' WHERE id = ?');
            updateStatusStmt.run(war.id);
            logger.info(`War ${war.id} between ${guild1.name} and ${guild2.name} ended in a draw. Entering overtime.`);
            continue;
        }

        if (winner) {
            // Calculer le pourcentage de victoire
            const totalPoints = winnerPoints + loserPoints;
            const winnerPercentage = totalPoints > 0 ? (winnerPoints / totalPoints) * 100 : 50;

            // Apply rewards and penalties
            const treasuryToSteal = Math.floor(loser.treasury * getStealPercentage(war.duration_type));
            const boostEndTime = new Date();
            boostEndTime.setHours(boostEndTime.getHours() + 24);

            // Mettre à jour le gagnant: trésorerie + niveau + boost
            db.prepare('UPDATE guilds SET treasury = ?, level = level + 20, guild_boost_until = ? WHERE id = ?')
                .run(winner.treasury + treasuryToSteal, boostEndTime.getTime(), winner.id);

            // Mettre à jour le perdant: retirer trésorerie
            db.prepare('UPDATE guilds SET treasury = ? WHERE id = ?')
                .run(Math.max(0, loser.treasury - treasuryToSteal), loser.id);

            const updateWarStmt = db.prepare('UPDATE guild_wars SET status = \'finished\', winner_id = ? WHERE id = ?');
            updateWarStmt.run(winner.id, war.id);

            // NOUVEAU: Mettre à jour les statistiques de victoires
            updateWarVictoryStats(winner.id, winnerPercentage);

            // Envoyer les résultats
            sendWarResults(client, war, winner, loser, winnerPoints, loserPoints, treasuryToSteal);
        }
    }
}

function getStealPercentage(durationType) {
    switch (durationType) {
        case 'courte':
        case 'short':
            return 0.25;
        case 'classique':
        case 'normal':
            return 0.5;
        case 'longue':
        case 'long':
            return 1;
        default:
            return 0.5; // défaut: classique
    }
}

/**
 * Envoie les résultats de guerre dans les salons appropriés
 */
async function sendWarResults(client, war, winner, loser, winnerPoints, loserPoints, treasuryStolen) {
    try {
        // Calculer le pourcentage
        const totalPoints = winnerPoints + loserPoints;
        const winnerPercentage = totalPoints > 0 ? (winnerPoints / totalPoints) * 100 : 50;
        const loserPercentage = totalPoints > 0 ? (loserPoints / totalPoints) * 100 : 50;

        // Durée en texte
        const durationText = war.duration_type === 'short' || war.duration_type === 'courte' ? '12h' :
            war.duration_type === 'normal' || war.duration_type === 'classique' ? '48h' : '7j';

        // Créer l'embed de récapitulation
        const embed = new EmbedBuilder()
            .setTitle('🏆 GUERRE TERMINÉE !')
            .setDescription(`${winner.emoji || '⚔️'} **${winner.name}** a remporté la guerre contre ${loser.emoji || '🛡️'} **${loser.name}** !`)
            .setColor('#FFD700')
            .addFields(
                {
                    name: '📊 Score Final',
                    value: `${winner.emoji || '⚔️'} **${winner.name}**: ${winnerPoints.toLocaleString('fr-FR')} pts (**${winnerPercentage.toFixed(1)}%**)\n${loser.emoji || '🛡️'} **${loser.name}**: ${loserPoints.toLocaleString('fr-FR')} pts (${loserPercentage.toFixed(1)}%)`,
                    inline: false
                },
                {
                    name: '🎁 Récompenses du Gagnant',
                    value: `• +20 niveaux de guilde\n• +${treasuryStolen.toLocaleString('fr-FR')} ⭐ pillés\n• x2 boost pendant 24h`,
                    inline: true
                },
                {
                    name: '💀 Pénalités du Perdant',
                    value: `• -${treasuryStolen.toLocaleString('fr-FR')} ⭐ volés\n• Boosts désactivés 24h`,
                    inline: true
                },
                {
                    name: '⏱️ Durée',
                    value: durationText,
                    inline: true
                }
            )
            .setFooter({ text: `Guerre #${war.id}` })
            .setTimestamp();

        // Récupérer les top 3 contributeurs du gagnant
        const topContributors = db.prepare(`
            SELECT gwm.user_id, gwm.war_points, u.username 
            FROM guild_war_members gwm 
            LEFT JOIN users u ON gwm.user_id = u.id 
            WHERE gwm.war_id = ? AND gwm.guild_id = ? 
            ORDER BY gwm.war_points DESC 
            LIMIT 3
        `).all(war.id, winner.id);

        if (topContributors.length > 0) {
            const medals = ['🥇', '🥈', '🥉'];
            const topText = topContributors.map((c, i) =>
                `${medals[i]} **${c.username || 'Inconnu'}**: ${c.war_points.toLocaleString('fr-FR')} pts`
            ).join('\n');

            embed.addFields({ name: '🌟 Top Contributeurs', value: topText, inline: false });
        }

        // 1. Envoyer dans le salon des guildes (GUILD_CHANNEL)
        const guildChannelId = process.env.GUILD_CHANNEL;
        if (guildChannelId) {
            try {
                const guildChannel = await client.channels.fetch(guildChannelId).catch(() => null);
                if (guildChannel) {
                    await guildChannel.send({ embeds: [embed] });
                    logger.info(`War results sent to guild channel for war ${war.id}`);
                }
            } catch (error) {
                logger.error(`Failed to send war results to guild channel:`, error);
            }
        }

        // 2. Envoyer dans le salon privé de la guilde gagnante
        if (winner.channel_id) {
            try {
                const winnerChannel = await client.channels.fetch(winner.channel_id).catch(() => null);
                if (winnerChannel) {
                    const winEmbed = EmbedBuilder.from(embed)
                        .setTitle('🎉 VICTOIRE !')
                        .setColor('#00FF00')
                        .setDescription(`Félicitations ! Votre guilde **${winner.name}** a remporté la guerre contre **${loser.name}** !`);
                    await winnerChannel.send({ embeds: [winEmbed] });
                    logger.info(`War victory message sent to winner guild channel`);
                }
            } catch (error) {
                logger.error(`Failed to send war results to winner guild channel:`, error);
            }
        }

        // 3. Envoyer dans le salon privé de la guilde perdante
        if (loser.channel_id) {
            try {
                const loserChannel = await client.channels.fetch(loser.channel_id).catch(() => null);
                if (loserChannel) {
                    const loseEmbed = EmbedBuilder.from(embed)
                        .setTitle('💀 DÉFAITE')
                        .setColor('#FF0000')
                        .setDescription(`Votre guilde **${loser.name}** a perdu la guerre contre **${winner.name}**. Préparez-vous pour la prochaine !`);
                    await loserChannel.send({ embeds: [loseEmbed] });
                    logger.info(`War defeat message sent to loser guild channel`);
                }
            } catch (error) {
                logger.error(`Failed to send war results to loser guild channel:`, error);
            }
        }

        logger.info(`Guerre terminée: ${winner.name} a gagné contre ${loser.name} (${winnerPercentage.toFixed(2)}%)`);
    } catch (error) {
        logger.error('Error sending war results:', error);
    }
}

module.exports = { checkFinishedWars, checkOvertimeWars };

async function checkOvertimeWars(client) {
    const getOvertimeWarsStmt = db.prepare('SELECT * FROM guild_wars WHERE status = \'overtime\'');
    const overtimeWars = getOvertimeWarsStmt.all();

    for (const war of overtimeWars) {
        logger.info(`Processing overtime war: ${war.id}`);

        const guild1 = getGuildById(war.guild1_id);
        const guild2 = getGuildById(war.guild2_id);

        // Utiliser les war_points stockés (ne peuvent jamais être négatifs)
        const guild1PointsResult = db.prepare('SELECT COALESCE(SUM(war_points), 0) as total FROM guild_war_members WHERE war_id = ? AND guild_id = ?').get(war.id, war.guild1_id);
        const guild2PointsResult = db.prepare('SELECT COALESCE(SUM(war_points), 0) as total FROM guild_war_members WHERE war_id = ? AND guild_id = ?').get(war.id, war.guild2_id);

        const guild1Points = guild1PointsResult ? guild1PointsResult.total : 0;
        const guild2Points = guild2PointsResult ? guild2PointsResult.total : 0;

        let winner = null;
        let loser = null;
        let winnerPoints = 0;
        let loserPoints = 0;

        if (guild1Points > guild2Points) {
            winner = guild1;
            loser = guild2;
            winnerPoints = guild1Points;
            loserPoints = guild2Points;
        } else if (guild2Points > guild1Points) {
            winner = guild2;
            loser = guild1;
            winnerPoints = guild2Points;
            loserPoints = guild1Points;
        }

        if (winner) {
            // Calculer le pourcentage de victoire
            const totalPoints = winnerPoints + loserPoints;
            const winnerPercentage = totalPoints > 0 ? (winnerPoints / totalPoints) * 100 : 50;

            // Apply rewards and penalties
            const treasuryToSteal = Math.floor(loser.treasury * getStealPercentage(war.duration_type));
            const boostEndTime = new Date();
            boostEndTime.setHours(boostEndTime.getHours() + 24);

            // Mettre à jour le gagnant: trésorerie + niveau + boost
            db.prepare('UPDATE guilds SET treasury = ?, level = level + 20, guild_boost_until = ? WHERE id = ?')
                .run(winner.treasury + treasuryToSteal, boostEndTime.getTime(), winner.id);

            // Mettre à jour le perdant: retirer trésorerie
            db.prepare('UPDATE guilds SET treasury = ? WHERE id = ?')
                .run(Math.max(0, loser.treasury - treasuryToSteal), loser.id);

            const updateWarStmt = db.prepare('UPDATE guild_wars SET status = \'finished\', winner_id = ? WHERE id = ?');
            updateWarStmt.run(winner.id, war.id);

            // NOUVEAU: Mettre à jour les statistiques de victoires
            updateWarVictoryStats(winner.id, winnerPercentage);

            // Envoyer les résultats
            sendWarResults(client, war, winner, loser, winnerPoints, loserPoints, treasuryToSteal);
        }
    }
}
