const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

// Configuration du canvas pour les graphiques
const chartWidth = 800;
const chartHeight = 400;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: chartWidth, height: chartHeight, backgroundColour: '#2b2d31' });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats-moderation')
        .setDescription('Statistiques de modération')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('global')
                .setDescription('Vue d\'ensemble des statistiques')
                .addStringOption(option =>
                    option.setName('période')
                        .setDescription('Période à analyser')
                        .setRequired(false)
                        .addChoices(
                            { name: '7 derniers jours', value: '7' },
                            { name: '30 derniers jours', value: '30' },
                            { name: '90 derniers jours', value: '90' },
                            { name: 'Tout', value: 'all' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('staff')
                .setDescription('Classement des modérateurs')
                .addStringOption(option =>
                    option.setName('période')
                        .setDescription('Période à analyser')
                        .setRequired(false)
                        .addChoices(
                            { name: '7 derniers jours', value: '7' },
                            { name: '30 derniers jours', value: '30' },
                            { name: '90 derniers jours', value: '90' },
                            { name: 'Tout', value: 'all' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('membre')
                .setDescription('Statistiques d\'un membre spécifique')
                .addUserOption(option =>
                    option.setName('utilisateur')
                        .setDescription('Le membre à analyser')
                        .setRequired(true))),

    async execute(interaction, { dbManager }) {
        const subcommand = interaction.options.getSubcommand();
        const sanctionsDb = dbManager.getSanctionsDb();

        switch (subcommand) {
            case 'global':
                await handleGlobal(interaction, sanctionsDb);
                break;
            case 'staff':
                await handleStaff(interaction, sanctionsDb);
                break;
            case 'membre':
                await handleMembre(interaction, sanctionsDb);
                break;
        }
    }
};

/**
 * Calcule la date de début selon la période
 */
function getStartDate(period) {
    if (period === 'all') return 0;
    const days = parseInt(period) || 30;
    return Date.now() - (days * 24 * 60 * 60 * 1000);
}

/**
 * Génère un graphique en barres pour les types de sanctions
 */
async function generateSanctionTypeChart(stats) {
    const labels = ['Bans', 'Time Out', 'Warns', 'Kicks'];
    const data = [
        stats['Ban'] || 0,
        stats['Time Out'] || 0,
        stats['Warn'] || 0,
        stats['Kick'] || 0
    ];

    const configuration = {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Sanctions',
                data,
                backgroundColor: [
                    '#e74c3c',  // Rouge pour Ban
                    '#f39c12',  // Orange pour Mute
                    '#e67e22',  // Orange foncé pour Warn
                    '#9b59b6'   // Violet pour Kick
                ],
                borderColor: [
                    '#c0392b',
                    '#d68910',
                    '#ca6f1e',
                    '#7d3c98'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Répartition par Type',
                    color: '#ffffff',
                    font: { size: 18, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#b9bbbe', stepSize: 1 },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    ticks: { color: '#b9bbbe' },
                    grid: { display: false }
                }
            }
        }
    };

    return await chartJSNodeCanvas.renderToBuffer(configuration);
}

/**
 * Génère un graphique en ligne pour l'évolution temporelle
 */
async function generateTimelineChart(sanctionsDb, startDate, period) {
    // Déterminer le groupement selon la période
    const groupByDay = period !== 'all' && parseInt(period) <= 30;

    const getTimeline = () => new Promise((resolve, reject) => {
        let query;
        if (groupByDay) {
            query = `SELECT date, COUNT(*) as count FROM sanctions WHERE date >= ? GROUP BY date(date/1000, 'unixepoch') ORDER BY date ASC`;
        } else {
            query = `SELECT date, COUNT(*) as count FROM sanctions WHERE date >= ? GROUP BY strftime('%Y-%W', date/1000, 'unixepoch') ORDER BY date ASC`;
        }
        sanctionsDb.all(query, [startDate], (err, rows) => err ? reject(err) : resolve(rows || []));
    });

    try {
        const timeline = await getTimeline();

        if (timeline.length === 0) {
            return null;
        }

        // Limiter à 14 points max pour lisibilité
        const limitedTimeline = timeline.length > 14
            ? timeline.filter((_, i) => i % Math.ceil(timeline.length / 14) === 0)
            : timeline;

        const labels = limitedTimeline.map(t => {
            const date = new Date(t.date);
            return `${date.getDate()}/${date.getMonth() + 1}`;
        });
        const data = limitedTimeline.map(t => t.count);

        const configuration = {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Sanctions',
                    data,
                    borderColor: '#5865f2',
                    backgroundColor: 'rgba(88, 101, 242, 0.2)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#5865f2'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Évolution Temporelle',
                        color: '#ffffff',
                        font: { size: 18, weight: 'bold' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#b9bbbe' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    x: {
                        ticks: { color: '#b9bbbe' },
                        grid: { display: false }
                    }
                }
            }
        };

        return await chartJSNodeCanvas.renderToBuffer(configuration);
    } catch (error) {
        console.error('[Stats] Erreur génération timeline:', error);
        return null;
    }
}

/**
 * Statistiques globales
 */
async function handleGlobal(interaction, sanctionsDb) {
    const period = interaction.options.getString('période') || '30';
    const startDate = getStartDate(period);
    const periodLabel = period === 'all' ? 'Depuis le début' : `${period} derniers jours`;

    const getStats = () => new Promise((resolve, reject) => {
        sanctionsDb.all(
            `SELECT type, COUNT(*) as count FROM sanctions WHERE date >= ? GROUP BY type`,
            [startDate],
            (err, rows) => err ? reject(err) : resolve(rows || [])
        );
    });

    const getAllTimeStats = () => new Promise((resolve, reject) => {
        sanctionsDb.all(
            `SELECT type, COUNT(*) as count FROM sanctions GROUP BY type`,
            [],
            (err, rows) => err ? reject(err) : resolve(rows || [])
        );
    });

    const getTotalCount = () => new Promise((resolve, reject) => {
        sanctionsDb.get(
            `SELECT COUNT(*) as total FROM sanctions WHERE date >= ?`,
            [startDate],
            (err, row) => err ? reject(err) : resolve(row?.total || 0)
        );
    });

    const getAllTimeTotal = () => new Promise((resolve, reject) => {
        sanctionsDb.get(
            `SELECT COUNT(*) as total FROM sanctions`,
            [],
            (err, row) => err ? reject(err) : resolve(row?.total || 0)
        );
    });

    const getActiveWarns = () => new Promise((resolve, reject) => {
        sanctionsDb.get(
            `SELECT COUNT(*) as count FROM sanctions WHERE type = 'Warn' AND active = 1`,
            [],
            (err, row) => err ? reject(err) : resolve(row?.count || 0)
        );
    });

    const getMostSanctioned = () => new Promise((resolve, reject) => {
        sanctionsDb.all(
            `SELECT userId, COUNT(*) as count FROM sanctions WHERE date >= ? GROUP BY userId ORDER BY count DESC LIMIT 5`,
            [startDate],
            (err, rows) => err ? reject(err) : resolve(rows || [])
        );
    });

    try {
        await interaction.deferReply();

        const [stats, allTimeStats, total, allTimeTotal, activeWarns, mostSanctioned] = await Promise.all([
            getStats(),
            getAllTimeStats(),
            getTotalCount(),
            getAllTimeTotal(),
            getActiveWarns(),
            getMostSanctioned()
        ]);

        // Mapper les stats par type
        const statsByType = {};
        stats.forEach(s => statsByType[s.type] = s.count);

        const allTimeByType = {};
        allTimeStats.forEach(s => allTimeByType[s.type] = s.count);

        // Calculer la moyenne par jour
        const daysInPeriod = period === 'all' ? 365 : parseInt(period);
        const avgPerDay = (total / daysInPeriod).toFixed(1);

        // Générer les graphiques
        const [typeChart, timelineChart] = await Promise.all([
            generateSanctionTypeChart(statsByType),
            generateTimelineChart(sanctionsDb, startDate, period)
        ]);

        // Construire l'UI
        const container = new ContainerBuilder();

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# Statistiques de Modération\n*${periodLabel}*`)
        );

        container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );

        // Stats par type (période sélectionnée)
        const banCount = statsByType['Ban'] || 0;
        const muteCount = statsByType['Time Out'] || 0;
        const warnCount = statsByType['Warn'] || 0;
        const kickCount = statsByType['Kick'] || 0;

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Répartition (${periodLabel})\n` +
                `> **Bans:** ${banCount}\n` +
                `> **Time Out:** ${muteCount}\n` +
                `> **Warns:** ${warnCount} (${activeWarns} actifs)\n` +
                `> **Kicks:** ${kickCount}\n\n` +
                `**Total:** ${total} sanctions | **Moyenne:** ${avgPerDay}/jour`
            )
        );

        container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );

        // Stats all-time
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Statistiques All-Time\n` +
                `> **Total:** ${allTimeTotal} sanctions\n` +
                `> **Bans:** ${allTimeByType['Ban'] || 0} | **Time Out:** ${allTimeByType['Time Out'] || 0}\n` +
                `> **Warns:** ${allTimeByType['Warn'] || 0} | **Kicks:** ${allTimeByType['Kick'] || 0}`
            )
        );

        // Top membres les plus sanctionnés
        if (mostSanctioned.length > 0) {
            container.addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
            );

            let topList = '## Membres les plus sanctionnés\n';
            const positions = ['1.', '2.', '3.', '4.', '5.'];

            for (let i = 0; i < mostSanctioned.length; i++) {
                const member = mostSanctioned[i];
                topList += `> ${positions[i]} <@${member.userId}> — **${member.count}** sanctions\n`;
            }

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(topList)
            );
        }

        // Envoyer avec les graphiques
        const files = [];
        if (typeChart) {
            files.push(new AttachmentBuilder(typeChart, { name: 'types.png' }));
        }
        if (timelineChart) {
            files.push(new AttachmentBuilder(timelineChart, { name: 'timeline.png' }));
        }

        await interaction.editReply({
            components: [container],
            files,
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] }
        });

    } catch (error) {
        console.error('[Stats] Erreur:', error);
        const content = 'Une erreur est survenue lors de la récupération des statistiques.';
        if (interaction.deferred) {
            await interaction.editReply({ content });
        } else {
            await interaction.reply({ content, ephemeral: true });
        }
    }
}

/**
 * Classement des modérateurs
 * 
 * CRITÈRES DE CLASSEMENT :
 * 1. Total de sanctions appliquées sur la période sélectionnée
 * 2. Les sanctions comptabilisées : Ban, Time Out (mute), Warn, Kick
 * 3. Les sanctions automatiques (System) sont exclues
 * 4. Activité récente (sanctions dans les 7 derniers jours)
 */
async function handleStaff(interaction, sanctionsDb) {
    const period = interaction.options.getString('période') || '30';
    const startDate = getStartDate(period);
    const periodLabel = period === 'all' ? 'Depuis le début' : `${period} derniers jours`;
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const getModeratorStats = () => new Promise((resolve, reject) => {
        sanctionsDb.all(
            `SELECT moderatorId, type, COUNT(*) as count 
             FROM sanctions 
             WHERE date >= ? AND moderatorId != 'System'
             GROUP BY moderatorId, type
             ORDER BY count DESC`,
            [startDate],
            (err, rows) => err ? reject(err) : resolve(rows || [])
        );
    });

    // Récupérer l'activité récente (7 derniers jours)
    const getRecentActivity = () => new Promise((resolve, reject) => {
        sanctionsDb.all(
            `SELECT moderatorId, COUNT(*) as count 
             FROM sanctions 
             WHERE date >= ? AND moderatorId != 'System'
             GROUP BY moderatorId`,
            [sevenDaysAgo],
            (err, rows) => err ? reject(err) : resolve(rows || [])
        );
    });

    // Stats all-time par modérateur
    const getAllTimeStats = () => new Promise((resolve, reject) => {
        sanctionsDb.all(
            `SELECT moderatorId, COUNT(*) as count 
             FROM sanctions 
             WHERE moderatorId != 'System'
             GROUP BY moderatorId
             ORDER BY count DESC`,
            [],
            (err, rows) => err ? reject(err) : resolve(rows || [])
        );
    });

    try {
        await interaction.deferReply();

        const [stats, recentActivity, allTimeStats] = await Promise.all([
            getModeratorStats(),
            getRecentActivity(),
            getAllTimeStats()
        ]);

        // Mapper l'activité récente
        const recentMap = {};
        recentActivity.forEach(r => recentMap[r.moderatorId] = r.count);

        // Mapper les all-time
        const allTimeMap = {};
        allTimeStats.forEach(r => allTimeMap[r.moderatorId] = r.count);

        // Agréger par modérateur
        const modStats = {};
        stats.forEach(s => {
            if (!modStats[s.moderatorId]) {
                modStats[s.moderatorId] = { total: 0, Ban: 0, 'Time Out': 0, Warn: 0, Kick: 0 };
            }
            modStats[s.moderatorId][s.type] = (modStats[s.moderatorId][s.type] || 0) + s.count;
            modStats[s.moderatorId].total += s.count;
        });

        // Trier par total et filtrer les bots
        const guild = interaction.guild;
        const sortedModsRaw = Object.entries(modStats)
            .sort((a, b) => b[1].total - a[1].total);

        // Filtrer les bots (async)
        const sortedMods = [];
        for (const [modId, data] of sortedModsRaw) {
            try {
                const member = await guild.members.fetch(modId).catch(() => null);
                // Exclure si c'est un bot ou si on ne trouve pas le membre
                if (member && !member.user.bot) {
                    sortedMods.push([modId, data]);
                }
            } catch {
                // Membre introuvable, on l'inclut quand même (ancien staff)
                sortedMods.push([modId, data]);
            }
            if (sortedMods.length >= 10) break; // Limiter à 10
        }

        if (sortedMods.length === 0) {
            return interaction.editReply({
                content: 'Aucune statistique disponible pour cette période.',
            });
        }

        // Générer le graphique du top 5
        const top5 = sortedMods.slice(0, 5);
        const chartConfig = {
            type: 'bar',
            data: {
                labels: top5.map((_, i) => `#${i + 1}`),
                datasets: [{
                    label: 'Sanctions',
                    data: top5.map(m => m[1].total),
                    backgroundColor: ['#ffd700', '#c0c0c0', '#cd7f32', '#5865f2', '#5865f2'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Top 5 Modérateurs',
                        color: '#ffffff',
                        font: { size: 18, weight: 'bold' }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { color: '#b9bbbe' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    y: {
                        ticks: { color: '#b9bbbe' },
                        grid: { display: false }
                    }
                }
            }
        };
        const chart = await chartJSNodeCanvas.renderToBuffer(chartConfig);

        // Construire l'UI
        const container = new ContainerBuilder();

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# Classement des Modérateurs\n*${periodLabel}*`)
        );

        container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );

        // Explication des critères
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Critères de classement\n` +
                `> • **Total de sanctions** appliquées sur la période\n` +
                `> • Types comptabilisés : Ban, Time Out, Warn, Kick\n` +
                `> • Sanctions automatiques (System) exclues\n` +
                `> • Indicateur d'activité récente (7 derniers jours)`
            )
        );

        container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );

        const positions = ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.'];

        for (let i = 0; i < sortedMods.length; i++) {
            const [modId, data] = sortedMods[i];
            const details = [];
            if (data.Ban > 0) details.push(`Ban: ${data.Ban}`);
            if (data['Time Out'] > 0) details.push(`Time Out: ${data['Time Out']}`);
            if (data.Warn > 0) details.push(`Warn: ${data.Warn}`);
            if (data.Kick > 0) details.push(`Kick: ${data.Kick}`);

            // Indicateur d'activité
            const recentCount = recentMap[modId] || 0;
            const allTimeCount = allTimeMap[modId] || 0;
            let activityIndicator = '';
            if (recentCount > 0) {
                activityIndicator = ` | Actif (${recentCount} cette semaine)`;
            } else {
                activityIndicator = ' | Inactif cette semaine';
            }

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### ${positions[i]} <@${modId}>\n` +
                    `> **${data.total}** sanctions (${periodLabel}) | **${allTimeCount}** all-time\n` +
                    `> ${details.join(' | ')}${activityIndicator}`
                )
            );
        }

        await interaction.editReply({
            components: [container],
            files: [new AttachmentBuilder(chart, { name: 'ranking.png' })],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] }
        });

    } catch (error) {
        console.error('[Stats] Erreur:', error);
        const content = 'Une erreur est survenue lors de la récupération des statistiques.';
        if (interaction.deferred) {
            await interaction.editReply({ content });
        } else {
            await interaction.reply({ content, ephemeral: true });
        }
    }
}

/**
 * Statistiques d'un membre spécifique
 */
async function handleMembre(interaction, sanctionsDb) {
    const targetUser = interaction.options.getUser('utilisateur');

    const getMemberStats = () => new Promise((resolve, reject) => {
        sanctionsDb.all(
            `SELECT type, COUNT(*) as count FROM sanctions WHERE userId = ? GROUP BY type`,
            [targetUser.id],
            (err, rows) => err ? reject(err) : resolve(rows || [])
        );
    });

    const getActiveWarns = () => new Promise((resolve, reject) => {
        sanctionsDb.get(
            `SELECT COUNT(*) as count FROM sanctions WHERE userId = ? AND type = 'Warn' AND active = 1`,
            [targetUser.id],
            (err, row) => err ? reject(err) : resolve(row?.count || 0)
        );
    });

    const getLastSanction = () => new Promise((resolve, reject) => {
        sanctionsDb.get(
            `SELECT * FROM sanctions WHERE userId = ? ORDER BY date DESC LIMIT 1`,
            [targetUser.id],
            (err, row) => err ? reject(err) : resolve(row)
        );
    });

    const getFirstSanction = () => new Promise((resolve, reject) => {
        sanctionsDb.get(
            `SELECT date FROM sanctions WHERE userId = ? ORDER BY date ASC LIMIT 1`,
            [targetUser.id],
            (err, row) => err ? reject(err) : resolve(row?.date)
        );
    });

    try {
        await interaction.deferReply();

        const [stats, activeWarns, lastSanction, firstSanctionDate] = await Promise.all([
            getMemberStats(),
            getActiveWarns(),
            getLastSanction(),
            getFirstSanction()
        ]);

        // Mapper les stats
        const statsByType = {};
        let total = 0;
        stats.forEach(s => {
            statsByType[s.type] = s.count;
            total += s.count;
        });

        const container = new ContainerBuilder();

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`# Statistiques de ${targetUser.tag}`)
        );

        container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );

        if (total === 0) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent('> Aucune sanction enregistrée pour ce membre.')
            );
        } else {
            // Déterminer le niveau de risque
            let riskLevel = 'Faible';
            if (total >= 5 || activeWarns >= 2) riskLevel = 'Modéré';
            if (total >= 10 || activeWarns >= 3) riskLevel = 'Élevé';

            // Générer le graphique
            const chart = await generateSanctionTypeChart(statsByType);

            // Stats détaillées
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## Résumé\n` +
                    `> **Total sanctions:** ${total}\n` +
                    `> **Niveau de risque:** ${riskLevel}\n` +
                    `> **Warns actifs:** ${activeWarns}\n\n` +
                    `## Détail par type\n` +
                    `> **Bans:** ${statsByType['Ban'] || 0}\n` +
                    `> **Time Out:** ${statsByType['Time Out'] || 0}\n` +
                    `> **Warns:** ${statsByType['Warn'] || 0}\n` +
                    `> **Kicks:** ${statsByType['Kick'] || 0}`
                )
            );

            if (firstSanctionDate) {
                container.addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
                );

                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Historique\n` +
                        `> **Première sanction:** <t:${Math.floor(firstSanctionDate / 1000)}:f>\n` +
                        (lastSanction ? `> **Dernière sanction:** <t:${Math.floor(lastSanction.date / 1000)}:f> (${lastSanction.type})` : '')
                    )
                );
            }

            await interaction.editReply({
                components: [container],
                files: [new AttachmentBuilder(chart, { name: 'member_stats.png' })],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] }
            });
            return;
        }

        await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });

    } catch (error) {
        console.error('[Stats] Erreur:', error);
        const content = 'Une erreur est survenue lors de la récupération des statistiques.';
        if (interaction.deferred) {
            await interaction.editReply({ content });
        } else {
            await interaction.reply({ content, ephemeral: true });
        }
    }
}
