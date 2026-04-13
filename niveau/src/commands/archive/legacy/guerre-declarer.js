const { SlashCommandBuilder } = require('discord.js');
const { getGuildOfUser, getAllGuilds } = require('../../../utils/db-guilds');
const { declareWar } = require('../../../utils/guild/guild-wars');
const { handleCommandError } = require('../../../utils/error-handler');
const { hasCustomPermission, CUSTOM_ROLE_PERMISSIONS } = require('../../../utils/guild/guild-custom-roles');
const { areGuildFeaturesDisabled } = require('../../../utils/guild/guild-overstaffing');
const db = require('../../../database/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guerre-declarer')
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
                .setRequired(false)),
    
    async autocomplete(interaction) {
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
    },
    
    async execute(interaction) {
        try {
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

        } catch (error) {
            await handleCommandError(interaction, error);
        }
    },
};
