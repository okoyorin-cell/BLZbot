const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, PermissionsBitField } = require('discord.js'); // Importer EmbedBuilder pour les embeds
const { getPoints, getTopUsers } = require('./points'); // Importer les fonctions nécessaires

module.exports = {
    registerCommands: (client) => {
        // Définition de la commande /points
        const pointsCommand = new SlashCommandBuilder()
            .setName('points')
            .setDescription('Afficher vos points');

        // Définition de la commande /toppoints
        const topPointsCommand = new SlashCommandBuilder()
            .setName('toppoints')
            .setDescription('Afficher les utilisateurs avec le plus de points');

        // Définition de la commande /stats
        const statsCommand = new SlashCommandBuilder()
            .setName('stats')
            .setDescription('Afficher les statistiques du serveur');

        // Définition de la commande /info-bot
        const infoBotCommand = new SlashCommandBuilder()
            .setName('info-bot')
            .setDescription('Afficher les informations sur le bot');

        // Définition de la commande /lockdown
        const lockdownCommand = new SlashCommandBuilder()
            .setName('lockdown')
            .setDescription('Gérer le lockdown du serveur.')
            .addStringOption(option =>
                option.setName('action')
                    .setDescription('Action à effectuer')
                    .setRequired(true)
                    .addChoices(
                        { name: 'commencer', value: 'commencer' },
                        { name: 'arreter', value: 'arreter' }
                    ))
            .addStringOption(option =>
                option.setName('message')
                    .setDescription('Message à afficher pendant le lockdown')
                    .setRequired(false));

        // Définition de la commande /lock
        const lockCommand = new SlashCommandBuilder()
            .setName('lock')
            .setDescription('Verrouiller ou déverrouiller le canal.')
            .addStringOption(option =>
                option.setName('action')
                    .setDescription('Action à effectuer')
                    .setRequired(true)
                    .addChoices(
                        { name: 'verrouiller', value: 'verrouiller' },
                        { name: 'déverrouiller', value: 'déverrouiller' }
                    ))
            .addStringOption(option =>
                option.setName('message')
                    .setDescription('Message à afficher lors de l\'action')
                    .setRequired(false));

        // Enregistrement des commandes
        client.application?.commands.create(pointsCommand);
        client.application?.commands.create(topPointsCommand);
        client.application?.commands.create(statsCommand);
        client.application?.commands.create(infoBotCommand);
        client.application?.commands.create(lockdownCommand);
        client.application?.commands.create(lockCommand);

        // Gestionnaire des commandes
        client.on('interactionCreate', async interaction => {
            if (!interaction.isCommand()) return;

            try {
                const userRoleId = '1172237685763608579'; // ID du rôle pour exécuter la commande /lock
                const memberRoleId = '1323236382881222797'; // ID du rôle des membres
                const adminRoleId = '1323241037392642129'; // ID du rôle des administrateurs
                const categoryIds = [
                    '1325497542259118131',
                    '1323248418495139840',
                    '1323250666545746002',
                    '1323257934934966383',
                    '1323259261647851572',
                    '1323256225558953984'
                ]; // ID des catégories pour la commande /lockdown

                if (interaction.commandName === 'points') {
                    const user = interaction.user;
                    if (!user) {
                        return interaction.reply('Utilisateur non valide ou non trouvé.');
                    }

                    const points = getPoints(user.id);

                    const embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle(`Points de ${user.tag}`)
                        .setDescription(`${user.tag} a ${points} points.`)
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                } else if (interaction.commandName === 'toppoints') {
                    const topUsers = getTopUsers();
                    const embed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('Top utilisateurs avec le plus de points')
                        .setTimestamp();

                    let description = '';
                    for (const [index, user] of topUsers.entries()) {
                        description += `${index + 1}. <@${user.userId}> a ${user.points} points\n`;
                    }

                    embed.setDescription(description.trim());

                    await interaction.reply({ embeds: [embed] });
                } else if (interaction.commandName === 'stats') {
                    const guild = interaction.guild;

                    const totalMembers = guild.memberCount;

                    await guild.members.fetch();

                    const totalBots = guild.members.cache.filter(member => member.user.bot).size;
                    const totalRoles = guild.roles.cache.size;
                    const totalChannels = guild.channels.cache.size;

                    const roleEmojis = {
                        '1323241032770654289': '<:modo:1324011402041495602>',
                        '1323241034855223348': '<:supermodo:1324011614063558778>',
                        '1323241037392642129': '<:admin:1324011836252749936>',
                        '1323241039405781092': '<:superadmin:1324012058534084640>',
                        '1323241048029528105': '<:blz:1321310980562489375>',
                        '1323241046154678313': '<:souschef:1324012634126815254>'
                    };

                    const getRoleEmoji = (member) => {
                        if (member.id === '1256662876593193110') {
                            return '<:adminult:1321308974632665138>';
                        }
                        for (const roleId in roleEmojis) {
                            if (member.roles.cache.has(roleId)) {
                                return roleEmojis[roleId];
                            }
                        }
                        return '';
                    };

                    const formatMembers = (members) => {
                        const lines = [];
                        for (let i = 0; i < members.length; i += 3) {
                            lines.push(members.slice(i, i + 3).join(' '.repeat(15)));
                        }
                        return lines.join('\n');
                    };

                    const admins = guild.members.cache
                        .filter(member => member.permissions.has(PermissionsBitField.Flags.Administrator) && !member.user.bot)
                        .map(member => `<@!${member.id}> ${getRoleEmoji(member)}`);

                    const onlineModerators = guild.members.cache
                        .filter(member => member.roles.cache.has(userRoleId) && member.presence?.status === 'online' && !member.user.bot)
                        .map(member => `<@!${member.id}> ${getRoleEmoji(member)}`);

                    const moderators = guild.members.cache
                        .filter(member => member.roles.cache.has(userRoleId) && !member.user.bot)
                        .map(member => `<@!${member.id}> ${getRoleEmoji(member)}`);

                    const splitLongField = (title, values) => {
                        const chunks = [];
                        let currentChunk = '';
                        values.forEach(value => {
                            if ((currentChunk + value).length > 1024) {
                                chunks.push(currentChunk.trim());
                                currentChunk = '';
                            }
                            currentChunk += ` ${value}`;
                        });
                        if (currentChunk) {
                            chunks.push(currentChunk.trim());
                        }
                        return chunks.map(chunk => ({ name: title, value: chunk, inline: false }));
                    };

                    const adminFields = splitLongField(`🔒 Administrateurs (${admins.length})`, formatMembers(admins).split('\n'));
                    const onlineModFields = splitLongField(`🟢 Modérateurs en ligne (${onlineModerators.length}/${moderators.length})`, formatMembers(onlineModerators).split('\n'));
                    const modFields = splitLongField(`👮 Modérateurs (${moderators.length})`, formatMembers(moderators).split('\n'));

                    const statsEmbed = new EmbedBuilder()
                        .setColor('#606060')
                        .setTitle('Serveur de BLZStarss <:BLZstarss:1317892047016820787>')
                        .addFields(
                            { name: '👥 Nombre total de membres', value: `${totalMembers}`, inline: true },
                            { name: '🤖 Nombre de bots', value: `${totalBots}`, inline: true },
                            { name: '🎭 Nombre de rôles', value: `${totalRoles}`, inline: true },
                            { name: '📢 Nombre de canaux', value: `${totalChannels}`, inline: true },
                            ...adminFields,
                            ...onlineModFields,
                            ...modFields
                        );

                    await interaction.reply({ embeds: [statsEmbed] });
                } else if (interaction.commandName === 'info-bot') {
                    const embed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('Informations sur le bot')
                        .setDescription('Ce bot est développé pour aider à la gestion du serveur Discord avec diverses fonctionnalités telles que la gestion des points, les statistiques du serveur, et plus.')
                        .addFields(
                                                        { name: 'Développeur', value: 'Richard', inline: true },
                            { name: 'Version', value: '1.0.0', inline: true },
                            { name: 'Commandes', value: '/points, /toppoints, /stats, /info-bot', inline: false }
                        )
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                } else if (interaction.commandName === 'lockdown') {
                    const action = interaction.options.getString('action');
                    const messageOption = interaction.options.getString('message');
                    const message = messageOption || (action === 'commencer' ? 'Le serveur est actuellement bloqué, veuillez attendre que cela se termine.' : 'Le serveur est à nouveau disponible.');

                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                        return interaction.reply({ content: 'Vous n\'avez pas la permission d\'utiliser cette commande.', ephemeral: true });
                    }

                    const channels = interaction.guild.channels.cache.filter(channel => categoryIds.includes(channel.parentId) && channel.isTextBased());

                    if (action === 'commencer') {
                        channels.forEach(async channel => {
                            await channel.permissionOverwrites.edit(memberRoleId, { SendMessages: false });
                            await channel.send(message);
                        });
                        await interaction.reply({ content: 'Le lockdown a été commencé.', ephemeral: true });
                    } else if (action === 'arreter') {
                        channels.forEach(async channel => {
                            await channel.permissionOverwrites.edit(memberRoleId, { SendMessages: true });
                            await channel.send(message);
                        });
                        await interaction.reply({ content: 'Le lockdown a été arrêté.', ephemeral: true });
                    }
                } else if (interaction.commandName === 'lock') {
                    const action = interaction.options.getString('action');
                    const messageOption = interaction.options.getString('message');
                    const message = messageOption || (action === 'verrouiller' ? 'Ce canal est actuellement verrouillé.' : 'Ce canal est à nouveau disponible.');

                    if (!interaction.member.roles.cache.has(userRoleId)) {
                        return interaction.reply({ content: 'Vous n\'avez pas la permission d\'utiliser cette commande.', ephemeral: true });
                    }

                    const channel = interaction.channel;

                    if (action === 'verrouiller') {
                        await channel.permissionOverwrites.edit(memberRoleId, { SendMessages: false });
                        await channel.send(message);
                        await interaction.reply({ content: 'Le canal a été verrouillé.', ephemeral: true });
                    } else if (action === 'déverrouiller') {
                        await channel.permissionOverwrites.edit(memberRoleId, { SendMessages: true });
                        await channel.send(message);
                        await interaction.reply({ content: 'Le canal a été déverrouillé.', ephemeral: true });
                    }
                }
            } catch (error) {
                const { handleCommandError } = require('../../utils/error-handler');
                await handleCommandError(interaction, error, client);
            }
        });
    }
};
