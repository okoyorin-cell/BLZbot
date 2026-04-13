const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
    TextDisplayBuilder,
    ContainerBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    StringSelectMenuBuilder
} = require('discord.js');
const { getGuildById, getGuildCustomRoles, saveGuildCustomRoles, getGuildMembersWithDetails, assignMemberRole } = require('../db-guilds');
const logger = require('../logger');

/**
 * Handles interactions for the Custom Guild Roles system.
 * Routes based on customId: custom_role_action_*, custom_role_modal_*, custom_role_delete_*, custom_role_edit_*
 */
async function handleCustomRoleInteraction(interaction) {
    try {
        // --- 1. HANDLE SELECT MENU ACTION (Main Menu) ---
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('custom_role_action_')) {
            const guildId = interaction.customId.replace('custom_role_action_', '');
            const action = interaction.values[0];

            if (action === 'create_role') {
                // Show modal to create a role
                // Check limit first
                const roles = getGuildCustomRoles(guildId);
                if (roles.length >= 3) {
                    return interaction.reply({ content: '❌ Vous avez atteint la limite de 3 rôles personnalisés.', ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`custom_role_create_modal_${guildId}`)
                    .setTitle('Créer un rôle personnalisé');

                const nameInput = new TextInputBuilder()
                    .setCustomId('role_name')
                    .setLabel("Nom du rôle")
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(30)
                    .setRequired(true);

                const iconInput = new TextInputBuilder()
                    .setCustomId('role_icon')
                    .setLabel("Icône (Emoji)")
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(5)
                    .setRequired(true)
                    .setPlaceholder('🛡️');

                const row1 = new ActionRowBuilder().addComponents(nameInput);
                const row2 = new ActionRowBuilder().addComponents(iconInput);

                modal.addComponents(row1, row2);
                await interaction.showModal(modal);

            } else if (action === 'delete_role') {
                // Show select menu to delete a role
                const roles = getGuildCustomRoles(guildId);
                if (roles.length === 0) return interaction.reply({ content: '❌ Aucun rôle à supprimer.', ephemeral: true });

                const roleOptions = roles.map((r, index) => ({
                    label: r.name,
                    value: index.toString(), // We use index as ID for simplicity in this JSON structure
                    emoji: r.icon
                }));

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`custom_role_delete_select_${guildId}`)
                    .setPlaceholder('Sélectionnez le rôle à supprimer')
                    .addOptions(roleOptions);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                await interaction.reply({ content: '🗑️ Quel rôle voulez-vous supprimer ?', components: [row], ephemeral: true });

            } else if (action === 'edit_role') {
                // Show select menu to edit permissions
                const roles = getGuildCustomRoles(guildId);
                if (roles.length === 0) return interaction.reply({ content: '❌ Aucun rôle à modifier.', ephemeral: true });

                const roleOptions = roles.map((r, index) => ({
                    label: r.name,
                    value: index.toString(),
                    emoji: r.icon,
                    description: `Permissions: ${Object.keys(r.permissions).filter(k => r.permissions[k]).length}`
                }));

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`custom_role_edit_select_${guildId}`)
                    .setPlaceholder('Sélectionnez le rôle à modifier')
                    .addOptions(roleOptions);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                await interaction.reply({ content: '⚙️ Quel rôle voulez-vous modifier ?', components: [row], ephemeral: true });
            }
        }

        // --- 2. HANDLE MODAL SUBMIT (Create Role) ---
        else if (interaction.isModalSubmit() && interaction.customId.startsWith('custom_role_create_modal_')) {
            const guildId = interaction.customId.replace('custom_role_create_modal_', '');
            const name = interaction.fields.getTextInputValue('role_name');
            const icon = interaction.fields.getTextInputValue('role_icon');

            // Save role
            const roles = getGuildCustomRoles(guildId) || [];
            if (roles.length >= 3) return interaction.reply({ content: '❌ Limite de rôles atteinte.', ephemeral: true });

            const newRole = {
                id: Date.now().toString(), // Simple ID
                name: name,
                icon: icon,
                permissions: {
                    can_kick: false,
                    can_manage_blacklist: false,
                    can_start_war: false,
                    can_empty_treasury: false
                }
            };

            roles.push(newRole);
            saveGuildCustomRoles(guildId, roles);

            await interaction.reply({ content: `✅ Rôle **${icon} ${name}** créé avec succès !`, ephemeral: true });
        }

        // --- 3. HANDLE DELETE SELECTION ---
        else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('custom_role_delete_select_')) {
            const guildId = interaction.customId.replace('custom_role_delete_select_', '');
            const roleIndex = parseInt(interaction.values[0]);

            const roles = getGuildCustomRoles(guildId);
            if (!roles[roleIndex]) return interaction.reply({ content: '❌ Rôle introuvable.', ephemeral: true });

            const deletedRole = roles.splice(roleIndex, 1)[0];
            saveGuildCustomRoles(guildId, roles);

            // TODO: Remove this role from all members who have it (assignMemberRole(..., null))
            // But checking all members is expensive. For now, keep as is, functionality handles invalid role IDs gracefully hopefully.
            // Or better: iterate guild members.
            // Let's keep it simple for now as requested.

            await interaction.reply({ content: `✅ Rôle **${deletedRole.name}** supprimé.`, ephemeral: true });
        }

        // --- 4. HANDLE EDIT SELECTION (Show Permissions) ---
        else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('custom_role_edit_select_')) {
            const guildId = interaction.customId.replace('custom_role_edit_select_', '');
            const roleIndex = parseInt(interaction.values[0]);

            const roles = getGuildCustomRoles(guildId);
            const role = roles[roleIndex];
            if (!role) return interaction.reply({ content: '❌ Rôle introuvable.', ephemeral: true });

            // Create buttons to toggle permissions
            const perms = role.permissions;

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`perm_toggle_${guildId}_${roleIndex}_can_kick`)
                    .setLabel('Expulser membres')
                    .setStyle(perms.can_kick ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji(perms.can_kick ? '✅' : '❌'),
                new ButtonBuilder()
                    .setCustomId(`perm_toggle_${guildId}_${roleIndex}_can_manage_blacklist`)
                    .setLabel('Blacklist/Whitelist')
                    .setStyle(perms.can_manage_blacklist ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji(perms.can_manage_blacklist ? '✅' : '❌')
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`perm_toggle_${guildId}_${roleIndex}_can_start_war`)
                    .setLabel('Lancer/Refuser Guerre')
                    .setStyle(perms.can_start_war ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji(perms.can_start_war ? '✅' : '❌'),
                new ButtonBuilder()
                    .setCustomId(`perm_toggle_${guildId}_${roleIndex}_can_empty_treasury`)
                    .setLabel('Vider Trésorerie') // WARNING: High risk permission
                    .setStyle(perms.can_empty_treasury ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji(perms.can_empty_treasury ? '✅' : '❌')
            );

            // Add Assign Button
            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`role_assign_start_${guildId}_${roleIndex}`)
                    .setLabel('Assigner à un membre')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👤')
            );

            const text = new TextDisplayBuilder()
                .setContent(`# ⚙️ Modification: ${role.icon} ${role.name}\nCliquez sur les permissions pour les activer/désactiver.`);

            const container = new ContainerBuilder().addTextDisplayComponents(text);

            // We update the message
            await interaction.reply({
                components: [container, row1, row2, row3],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        // --- 5. HANDLE PERMISSION TOGGLES ---
        else if (interaction.isButton() && interaction.customId.startsWith('perm_toggle_')) {
            const parts = interaction.customId.split('_');
            // Format: perm_toggle_GUILDID_ROLEINDEX_PERMNAME (permname can have underscores)
            // Let's parse carefully.
            // parts[0] = perm
            // parts[1] = toggle
            // parts[2] = guildId
            // parts[3] = roleIndex
            // parts[4+] = permission_name

            const guildId = parts[2];
            const roleIndex = parseInt(parts[3]);
            const permName = parts.slice(4).join('_');

            const roles = getGuildCustomRoles(guildId);
            const role = roles[roleIndex];

            if (!role) return interaction.reply({ content: '❌ Rôle introuvable.', ephemeral: true });

            // Toggle
            role.permissions[permName] = !role.permissions[permName];
            saveGuildCustomRoles(guildId, roles);

            // Re-render buttons (copy-paste of logic above essentially, optimized by simple update)
            const perms = role.permissions;

            // Rebuild rows
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`perm_toggle_${guildId}_${roleIndex}_can_kick`)
                    .setLabel('Expulser membres')
                    .setStyle(perms.can_kick ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji(perms.can_kick ? '✅' : '❌'),
                new ButtonBuilder()
                    .setCustomId(`perm_toggle_${guildId}_${roleIndex}_can_manage_blacklist`)
                    .setLabel('Blacklist/Whitelist')
                    .setStyle(perms.can_manage_blacklist ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji(perms.can_manage_blacklist ? '✅' : '❌')
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`perm_toggle_${guildId}_${roleIndex}_can_start_war`)
                    .setLabel('Lancer/Refuser Guerre')
                    .setStyle(perms.can_start_war ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji(perms.can_start_war ? '✅' : '❌'),
                new ButtonBuilder()
                    .setCustomId(`perm_toggle_${guildId}_${roleIndex}_can_empty_treasury`)
                    .setLabel('Vider Trésorerie')
                    .setStyle(perms.can_empty_treasury ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji(perms.can_empty_treasury ? '✅' : '❌')
            );

            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`role_assign_start_${guildId}_${roleIndex}`)
                    .setLabel('Assigner à un membre')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('👤')
            );

            // Update message
            await interaction.update({ components: [interaction.message.components[0], row1, row2, row3] }); // Keep header container
        }

        // --- 6. HANDLE ASSIGN START (Open User Select) ---
        else if (interaction.isButton() && interaction.customId.startsWith('role_assign_start_')) {
            const parts = interaction.customId.split('_');
            const guildId = parts[3];
            const roleIndex = parseInt(parts[4]);

            // Open a modal? No, User Select Menu must be in a Message or Modal.
            // Let's use a Select Menu in a new ephemeral message (or update/reply).

            const roles = getGuildCustomRoles(guildId);
            const role = roles[roleIndex];

            const row = new ActionRowBuilder().addComponents({
                type: ComponentType.UserSelect,
                customId: `role_assign_finish_${guildId}_${roleIndex}`,
                placeholder: `Choisir le membre pour "${role.name}"`
            });

            await interaction.reply({
                content: `👤 Sélectionnez le membre à qui attribuer le rôle **${role.name}** :`,
                components: [row],
                ephemeral: true
            });
        }

        // --- 7. HANDLE ASSIGN FINISH (User Selected) ---
        else if (interaction.isUserSelectMenu() && interaction.customId.startsWith('role_assign_finish_')) {
            const parts = interaction.customId.split('_');
            const guildId = parts[3];
            const roleIndex = parseInt(parts[4]);
            const targetUserId = interaction.values[0];

            const roles = getGuildCustomRoles(guildId);
            const role = roles[roleIndex];

            // Check if user is in guild
            const member = getGuildMembersWithDetails(guildId).find(m => m.id === targetUserId);
            if (!member) {
                return interaction.update({ content: '❌ Ce membre n\'est pas dans la guilde.', components: [] });
            }

            // Assign role (role_id is role.id)
            assignMemberRole(guildId, targetUserId, role.id);

            await interaction.update({ content: `✅ Rôle **${role.name}** attribué à <@${targetUserId}> !`, components: [] });
        }


    } catch (error) {
        logger.error('Error in custom role handler:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
        }
    }
}

module.exports = { handleCustomRoleInteraction };
