const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const AUTO_ROLES_PATH = path.join(__dirname, '..', 'data', 'auto-roles.json');

// --- Utilitaires JSON ---
function loadAutoRoles() {
    try {
        if (!fs.existsSync(AUTO_ROLES_PATH)) return [];
        const data = fs.readFileSync(AUTO_ROLES_PATH, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

function saveAutoRoles(roles) {
    const dir = path.dirname(AUTO_ROLES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AUTO_ROLES_PATH, JSON.stringify(roles, null, 2), 'utf-8');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('auto-role')
        .setDescription('Gérer les rôles attribués automatiquement à tous les membres.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub.setName('ajouter')
                .setDescription('Ajouter un rôle à donner automatiquement à tous les membres.')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Le rôle à attribuer automatiquement')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('supprimer')
                .setDescription('Retirer un rôle de la liste des rôles automatiques.')
                .addStringOption(opt =>
                    opt.setName('role')
                        .setDescription('Le rôle à retirer')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(sub =>
            sub.setName('liste')
                .setDescription('Afficher la liste des rôles automatiques.'))
        .addSubcommand(sub =>
            sub.setName('sync')
                .setDescription('Synchroniser : attribuer tous les rôles auto aux membres qui ne les ont pas.')),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase();
        const autoRoles = loadAutoRoles();

        const choices = [];
        for (const entry of autoRoles) {
            const role = interaction.guild.roles.cache.get(entry.roleId);
            const name = role ? role.name : `Rôle inconnu (${entry.roleId})`;
            if (name.toLowerCase().includes(focused)) {
                choices.push({ name, value: entry.roleId });
            }
        }

        await interaction.respond(choices.slice(0, 25));
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'ajouter') {
            await interaction.deferReply({ ephemeral: true });

            const role = interaction.options.getRole('role');
            const autoRoles = loadAutoRoles();

            // Vérifications
            if (autoRoles.some(e => e.roleId === role.id)) {
                return interaction.editReply({ content: `⚠️ Le rôle **${role.name}** est déjà dans la liste des rôles automatiques.` });
            }

            if (role.managed) {
                return interaction.editReply({ content: `❌ Le rôle **${role.name}** est géré par une intégration et ne peut pas être attribué manuellement.` });
            }

            const botMember = interaction.guild.members.me;
            if (botMember.roles.highest.position <= role.position) {
                return interaction.editReply({ content: `❌ Le rôle **${role.name}** est au-dessus de mon rôle le plus élevé. Je ne pourrai pas l'attribuer.` });
            }

            // Sauvegarder
            autoRoles.push({
                roleId: role.id,
                addedBy: interaction.user.id,
                addedAt: new Date().toISOString()
            });
            saveAutoRoles(autoRoles);

            // Attribuer à tous les membres actuels
            let successCount = 0;
            let failCount = 0;
            const members = await interaction.guild.members.fetch();

            for (const [, member] of members) {
                if (member.user.bot) continue;
                if (member.roles.cache.has(role.id)) continue;
                try {
                    await member.roles.add(role, 'Auto-role : attribution automatique');
                    successCount++;
                } catch {
                    failCount++;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Rôle automatique ajouté')
                .setColor('#2ecc71')
                .setDescription(`Le rôle ${role} sera désormais attribué automatiquement à tous les nouveaux membres.`)
                .addFields(
                    { name: 'Attribution aux membres existants', value: `✅ ${successCount} membres | ❌ ${failCount} erreurs`, inline: true }
                )
                .setFooter({ text: `Par ${interaction.user.tag}` })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'supprimer') {
            await interaction.deferReply({ ephemeral: true });

            const roleId = interaction.options.getString('role');
            const autoRoles = loadAutoRoles();

            const index = autoRoles.findIndex(e => e.roleId === roleId);
            if (index === -1) {
                return interaction.editReply({ content: `⚠️ Ce rôle n'est pas dans la liste des rôles automatiques.` });
            }

            autoRoles.splice(index, 1);
            saveAutoRoles(autoRoles);

            const role = interaction.guild.roles.cache.get(roleId);
            const roleName = role ? role.name : roleId;

            const embed = new EmbedBuilder()
                .setTitle('🗑️ Rôle automatique retiré')
                .setColor('#e74c3c')
                .setDescription(`Le rôle **${roleName}** ne sera plus attribué automatiquement aux nouveaux membres.\n\n*Note : le rôle n'est pas retiré des membres qui l'ont déjà.*`)
                .setFooter({ text: `Par ${interaction.user.tag}` })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        if (sub === 'liste') {
            const autoRoles = loadAutoRoles();

            if (autoRoles.length === 0) {
                return interaction.reply({ content: '📋 Aucun rôle automatique configuré.', ephemeral: true });
            }

            const lines = autoRoles.map((entry, i) => {
                const role = interaction.guild.roles.cache.get(entry.roleId);
                const roleMention = role ? `${role}` : `\`${entry.roleId}\` *(supprimé)*`;
                const date = entry.addedAt ? new Date(entry.addedAt).toLocaleDateString('fr-FR') : '?';
                return `**${i + 1}.** ${roleMention} — ajouté le ${date}`;
            });

            const embed = new EmbedBuilder()
                .setTitle('📋 Rôles automatiques')
                .setColor('#3498db')
                .setDescription(lines.join('\n'))
                .setFooter({ text: `${autoRoles.length} rôle(s) configuré(s)` });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'sync') {
            await interaction.deferReply({ ephemeral: true });

            const autoRoles = loadAutoRoles();
            if (autoRoles.length === 0) {
                return interaction.editReply({ content: '⚠️ Aucun rôle automatique configuré.' });
            }

            const members = await interaction.guild.members.fetch();
            let totalAdded = 0;
            let totalFailed = 0;

            for (const entry of autoRoles) {
                const role = interaction.guild.roles.cache.get(entry.roleId);
                if (!role) continue;

                for (const [, member] of members) {
                    if (member.user.bot) continue;
                    if (member.roles.cache.has(role.id)) continue;
                    try {
                        await member.roles.add(role, 'Auto-role : synchronisation');
                        totalAdded++;
                    } catch {
                        totalFailed++;
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setTitle('🔄 Synchronisation terminée')
                .setColor('#f1c40f')
                .setDescription(`Tous les rôles automatiques ont été vérifiés et attribués aux membres manquants.`)
                .addFields(
                    { name: 'Résultat', value: `✅ ${totalAdded} attributions | ❌ ${totalFailed} erreurs`, inline: true }
                )
                .setFooter({ text: `Par ${interaction.user.tag}` })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }
    }
};
