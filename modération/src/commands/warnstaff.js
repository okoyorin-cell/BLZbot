const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const CONFIG = require('../config.js');
const { getModeratorTitleWithArticle } = require('../utils/helpers.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnstaff')
        .setDescription('Gérer les avertissements du staff')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Avertir un membre du staff')
                .addUserOption(opt =>
                    opt.setName('utilisateur')
                        .setDescription('Le membre du staff à avertir')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('raison')
                        .setDescription('La raison de l\'avertissement')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Supprimer un warn staff par son ID (Owner uniquement)')
                .addIntegerOption(opt =>
                    opt.setName('id')
                        .setDescription('L\'ID du warn staff à supprimer')
                        .setRequired(true)
                )
        ),

    async execute(interaction, { dbManager }) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'add') {
            await handleAddWarn(interaction, dbManager);
        } else if (subcommand === 'remove') {
            await handleRemoveWarn(interaction, dbManager);
        }
    }
};

// ============================================
// Handler: Ajouter un warn staff
// ============================================
async function handleAddWarn(interaction, dbManager) {
    const db = dbManager.databases.staffWarns;

    const utilisateur = interaction.options.getUser('utilisateur');
    const raison = interaction.options.getString('raison');
    const modérateur = interaction.member;

    // Vérifier que le membre existe
    const membreCible = await interaction.guild.members.fetch(utilisateur.id).catch(() => null);
    if (!membreCible) {
        return interaction.reply({ content: 'Membre introuvable.', flags: MessageFlags.Ephemeral });
    }

    // Trouver le rôle staff de l'utilisateur cible
    const userRoles = membreCible.roles.cache.map(r => r.id);
    const targetStaffRole = CONFIG.STAFF_ROLES.find(role => 
        userRoles.includes(role.id) && role.demotion !== null
    );

    if (!targetStaffRole) {
        return interaction.reply({ content: 'Cet utilisateur n\'est pas un modérateur configurable pour la rétrogradation.', flags: MessageFlags.Ephemeral });
    }

    // Obtenir le titre du modérateur avec l'article approprié
    const moderatorTitleWithArticle = getModeratorTitleWithArticle(modérateur);

    // Ajouter l'avertissement dans la base de données
    db.run('INSERT INTO staff_warns (userId, moderatorId, reason, date) VALUES (?, ?, ?, ?)',
        [utilisateur.id, modérateur.id, raison, Date.now()],
        async function(err) {
            if (err) {
                console.error('Erreur lors de l\'ajout du staffwarn:', err);
                return interaction.reply({ content: 'Erreur lors de l\'ajout du staffwarn.', flags: MessageFlags.Ephemeral });
            }

            // Compter les warns staff avant d'envoyer le message
            db.all('SELECT id FROM staff_warns WHERE userId = ?', [utilisateur.id], async (err, rows) => {
                if (err) {
                    console.error('Erreur lors du comptage des warns staff:', err);
                    return;
                }

                const warnCount = rows.length;
                const warnText = warnCount > 1 ? 'warns staff' : 'warn staff';

                // Envoyer la notification dans le canal des warns staff
                const warnChannel = interaction.guild.channels.cache.get(CONFIG.STAFF_WARN_CHANNEL_ID);
                if (warnChannel) {
                    await warnChannel.send(`# <@${utilisateur.id}> a été warn (warn staff) pour la raison suivante : "${raison}" par ${moderatorTitleWithArticle} <@${modérateur.id}>\n-# Il est à ${warnCount} ${warnText}`);
                }
            });

            // Vérifier d'abord si l'utilisateur est en période de sensibilité
            const staffProfileDb = dbManager.getStaffProfileDb();
            
            staffProfileDb.get(
                'SELECT * FROM staff_sensitivity WHERE userId = ? AND active = 1 AND end_date > ?',
                [utilisateur.id, Date.now()],
                async (err, sensitivity) => {
                    if (err) {
                        console.error('Erreur vérification sensibilité:', err);
                    }

                    // ⭐ SENSIBILITÉ - Si en période de sensibilité, derank immédiat au 1er warn
                    if (sensitivity) {
                        const demotionAction = targetStaffRole.demotion;
                        
                        if (typeof demotionAction === 'string') {
                            // Rétrogradation simple
                            const demotionRole = await interaction.guild.roles.fetch(demotionAction).catch(() => null);
                            const targetRoleName = CONFIG.STAFF_ROLES.find(r => r.id === demotionAction)?.name || demotionRole?.name || 'un rôle inférieur';
                            
                            if (demotionRole) {
                                await membreCible.roles.remove(targetStaffRole.id);
                                await membreCible.roles.add(demotionRole);
                                db.run('DELETE FROM staff_warns WHERE userId = ?', [utilisateur.id]);
                                
                                // Désactiver la sensibilité
                                staffProfileDb.run('UPDATE staff_sensitivity SET active = 0 WHERE userId = ?', [utilisateur.id]);
                                
                                interaction.reply({ 
                                    content: `⚠️ **PÉRIODE DE SENSIBILITÉ** ⚠️\n${utilisateur.tag} a été rétrogradé de **${targetStaffRole.name}** vers **${targetRoleName}** car il était en période de sensibilité.\nRaison: ${raison}`, 
                                    flags: MessageFlags.Ephemeral 
                                });
                                
                                interaction.channel.send(`⚠️ ${utilisateur.tag} a été rétrogradé de **${targetStaffRole.name}** vers **${targetRoleName}** en raison d'un warn staff pendant sa période de sensibilité.`);
                                return;
                            }
                        } else if (Array.isArray(demotionAction)) {
                            // Derank complet
                            let rolesRemoved = 0;
                            for (const roleIdToRemove of demotionAction) {
                                const roleToRemove = await interaction.guild.roles.fetch(roleIdToRemove).catch(() => null);
                                if (roleToRemove && membreCible.roles.cache.has(roleIdToRemove)) {
                                    await membreCible.roles.remove(roleToRemove);
                                    rolesRemoved++;
                                }
                            }
                            
                            if (rolesRemoved > 0) {
                                db.run('DELETE FROM staff_warns WHERE userId = ?', [utilisateur.id]);
                                staffProfileDb.run('UPDATE staff_sensitivity SET active = 0 WHERE userId = ?', [utilisateur.id]);
                                
                                interaction.reply({ 
                                    content: `⚠️ **PÉRIODE DE SENSIBILITÉ** ⚠️\n${utilisateur.tag} a été complètement rétrogradé (derank de **${targetStaffRole.name}**) car il était en période de sensibilité.\nRaison: ${raison}`, 
                                    flags: MessageFlags.Ephemeral 
                                });
                                
                                interaction.channel.send(`⚠️ ${utilisateur.tag} a été complètement rétrogradé (derank) en raison d'un warn staff pendant sa période de sensibilité. ${rolesRemoved} rôle(s) retiré(s).`);
                                return;
                            }
                        }
                    }

                    // Si pas en sensibilité, comportement normal
                    interaction.reply({ content: `${utilisateur.tag} a été averti (staff) pour la raison : ${raison}.`, flags: MessageFlags.Ephemeral });

                    // Ajouter/prolonger la période de sensibilité (30 jours après chaque warn)
                    const sensitivityStart = Date.now();
                    const sensitivityEnd = sensitivityStart + (30 * 24 * 60 * 60 * 1000); // 30 jours

                    staffProfileDb.run(
                        'INSERT OR REPLACE INTO staff_sensitivity (userId, start_date, end_date, active) VALUES (?, ?, ?, 1)',
                        [utilisateur.id, sensitivityStart, sensitivityEnd],
                        (err) => {
                            if (err) {
                                console.error('Erreur lors de l\'ajout de la période de sensibilité:', err);
                            }
                        }
                    );
                }
            );

            // Vérifier le nombre total d'avertissements pour rétrogradation (système 3 warns)
            db.all('SELECT id FROM staff_warns WHERE userId = ?', [utilisateur.id], async (err, rows) => {
                if (err) {
                    console.error('Erreur lors de la vérification des warns:', err);
                    return;
                }

                if (rows.length >= 3) {
                    // Vérifier d'abord si c'est un admin avec dérank conditionnel
                    let conditionalDemotion = null;
                    if (CONFIG.ADMIN_CONDITIONAL_DERANKS) {
                        for (const condition of CONFIG.ADMIN_CONDITIONAL_DERANKS) {
                            if (userRoles.includes(condition.checkRoleId)) {
                                conditionalDemotion = condition;
                                break;
                            }
                        }
                    }

                    // Si dérank conditionnel trouvé, l'utiliser en priorité
                    let demotionAction = conditionalDemotion ? conditionalDemotion.demotionRoleId : targetStaffRole.demotion;

                    if (typeof demotionAction === 'string') {
                        // Rétrogradation simple vers un rôle inférieur
                        let demotionRole = interaction.guild.roles.cache.get(demotionAction);
                        
                        // Si le rôle n'est pas dans le cache, essayer de le fetch
                        if (!demotionRole) {
                            try {
                                demotionRole = await interaction.guild.roles.fetch(demotionAction);
                            } catch (error) {
                                console.error(`Erreur lors du fetch du rôle de rétrogradation ${demotionAction}:`, error);
                            }
                        }
                        
                        const targetRoleName = CONFIG.STAFF_ROLES.find(r => r.id === demotionAction)?.name || demotionRole?.name || 'un rôle inférieur';
                        
                        if (demotionRole) {
                            // Retirer le rôle staff principal
                            if (conditionalDemotion && CONFIG.MAIN_ADMIN_ROLE_ID) {
                                // Dérank conditionnel : retirer le rôle admin principal + le rôle conditionnel
                                await membreCible.roles.remove(CONFIG.MAIN_ADMIN_ROLE_ID);
                                await membreCible.roles.remove(conditionalDemotion.checkRoleId);
                            } else {
                                // Dérank normal : retirer le rôle staff détecté
                                await membreCible.roles.remove(targetStaffRole.id);
                            }
                            
                            await membreCible.roles.add(demotionRole);
                            db.run('DELETE FROM staff_warns WHERE userId = ?', [utilisateur.id]);
                            
                            const derankType = conditionalDemotion ? '(dérank conditionnel)' : '';
                            interaction.channel.send(`⚠️ ${utilisateur.tag} a été rétrogradé de **${targetStaffRole.name}** vers **${targetRoleName}** après 3 avertissements staff. ${derankType}`);
                        } else {
                            console.error(`Rôle de rétrogradation introuvable - ID: ${demotionAction}, Config: ${targetStaffRole.name}`);
                            interaction.channel.send(`❌ Erreur: Le rôle de rétrogradation (ID: ${demotionAction}) pour ${utilisateur.tag} n'a pas été trouvé. Vérifiez la configuration.`);
                        }
                    } else if (Array.isArray(demotionAction)) {
                        // Derank complet (retrait de plusieurs rôles)
                        let rolesRemoved = 0;
                        for (const roleIdToRemove of demotionAction) {
                            let roleToRemove = interaction.guild.roles.cache.get(roleIdToRemove);
                            
                            // Si le rôle n'est pas dans le cache, essayer de le fetch
                            if (!roleToRemove) {
                                try {
                                    roleToRemove = await interaction.guild.roles.fetch(roleIdToRemove);
                                } catch (error) {
                                    console.error(`Erreur lors du fetch du rôle ${roleIdToRemove}:`, error);
                                }
                            }
                            
                            if (roleToRemove && membreCible.roles.cache.has(roleIdToRemove)) {
                                await membreCible.roles.remove(roleToRemove);
                                rolesRemoved++;
                            }
                        }
                        
                        if (rolesRemoved > 0) {
                            db.run('DELETE FROM staff_warns WHERE userId = ?', [utilisateur.id]);
                            interaction.channel.send(`⚠️ ${utilisateur.tag} a été complètement rétrogradé (derank de **${targetStaffRole.name}**) après 3 avertissements staff. ${rolesRemoved} rôle(s) retiré(s).`);
                        } else {
                            console.error(`Aucun rôle à retirer trouvé pour ${utilisateur.tag} - Config: ${demotionAction.join(', ')}`);
                            interaction.channel.send(`⚠️ ${utilisateur.tag} devrait être rétrogradé mais aucun rôle n'a pu être retiré. Vérifiez la configuration.`);
                        }
                    }
                }
            });
        }
    );
}

// ============================================
// Handler: Supprimer un warn staff
// ============================================
async function handleRemoveWarn(interaction, dbManager) {
    const authorizedUsers = ['1222548578539536405', '845654783264030721'];

    if (!authorizedUsers.includes(interaction.user.id)) {
        return interaction.reply({
            content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.',
            flags: MessageFlags.Ephemeral
        });
    }

    const warnId = interaction.options.getInteger('id');
    const db = dbManager.databases.staffWarns;

    // Vérifier si le warn existe avant de le supprimer pour donner un feedback plus précis
    db.get('SELECT * FROM staff_warns WHERE id = ?', [warnId], (err, row) => {
        if (err) {
            console.error('Erreur lors de la recherche du warn staff:', err);
            return interaction.reply({
                content: '❌ Une erreur est survenue lors de la recherche du warn.',
                flags: MessageFlags.Ephemeral
            });
        }

        if (!row) {
            return interaction.reply({
                content: `❌ Aucun warn staff trouvé avec l'ID #${warnId}.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // Supprimer le warn
        db.run('DELETE FROM staff_warns WHERE id = ?', [warnId], function (err) {
            if (err) {
                console.error('Erreur lors de la suppression du warn staff:', err);
                return interaction.reply({
                    content: '❌ Une erreur est survenue lors de la suppression du warn.',
                    flags: MessageFlags.Ephemeral
                });
            }

            interaction.reply({
                content: `✅ Le warn staff #${warnId} (Utilisateur: <@${row.userId}>, Raison: "${row.reason}") a été supprimé avec succès.`,
                flags: MessageFlags.Ephemeral
            });
        });
    });
}
