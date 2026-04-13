const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const CONFIG = require('../config.js');
const database = require('../modules/database.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reglement')
        .setDescription('Gestion du règlement du serveur')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('cree')
                .setDescription('Créer un nouveau règlement')
                .addStringOption(option =>
                    option
                        .setName('nom')
                        .setDescription('Nom du règlement')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('modifier')
                .setDescription('Modifier un règlement existant')
                .addStringOption(option =>
                    option
                        .setName('nom')
                        .setDescription('Nom du règlement à modifier')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('supprimer')
                .setDescription('Supprimer un règlement existant')
                .addStringOption(option =>
                    option
                        .setName('nom')
                        .setDescription('Nom du règlement à supprimer')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const nom = interaction.options.getString('nom');

        if (subcommand === 'cree') {
            await this.handleCreate(interaction, nom);
        } else if (subcommand === 'modifier') {
            await this.handleModify(interaction, nom);
        } else if (subcommand === 'supprimer') {
            await this.handleDelete(interaction, nom);
        }
    },

    /**
     * Créer un nouveau règlement
     */
    async handleCreate(interaction, nom) {
        // Vérifier si le règlement existe déjà
        const existing = await this.getReglement(nom);
        if (existing) {
            return interaction.reply({
                content: `❌ Un règlement avec le nom **${nom}** existe déjà. Utilisez \`/reglement modifier\` pour le modifier.`,
                flags: 64
            });
        }

        // Créer le règlement dans la base de données avec des règles vides
        await this.createReglement(nom, interaction.channelId);

        // Afficher le modal pour ajouter la première règle
        await this.showRuleModal(interaction, nom, null);
    },

    /**
     * Modifier un règlement existant
     */
    async handleModify(interaction, nom) {
        const reglement = await this.getReglement(nom);
        if (!reglement) {
            return interaction.reply({
                content: `❌ Aucun règlement trouvé avec le nom **${nom}**.`,
                flags: 64
            });
        }

        // Afficher modal pour ajouter une nouvelle règle
        await this.showRuleModal(interaction, nom, null);
    },

    /**
     * Supprimer un règlement
     */
    async handleDelete(interaction, nom) {
        const reglement = await this.getReglement(nom);
        if (!reglement) {
            return interaction.reply({
                content: `❌ Aucun règlement trouvé avec le nom **${nom}**.`,
                flags: 64
            });
        }

        // Supprimer le message si possible
        if (reglement.message_id) {
            try {
                const channel = await interaction.client.channels.fetch(reglement.channel_id);
                if (channel) {
                    const message = await channel.messages.fetch(reglement.message_id);
                    await message.delete();
                }
            } catch (error) {
                // Message déjà supprimé ou introuvable, on ignore
                if (error.code !== 10008) { // 10008 = Unknown Message
                    console.error('Erreur lors de la suppression du message:', error);
                }
            }
        }

        // Supprimer de la base de données
        await this.deleteReglement(nom);

        await interaction.reply({
            content: `✅ Le règlement **${nom}** a été supprimé.`,
            flags: 64
        });
    },

    /**
     * Afficher le modal pour ajouter/modifier une règle
     */
    async showRuleModal(interaction, reglementNom, ruleIndex) {
        const modal = new ModalBuilder()
            .setCustomId(`rule_modal_${reglementNom}_${ruleIndex || 'new'}`)
            .setTitle('Ajouter une règle');

        const titleInput = new TextInputBuilder()
            .setCustomId('rule_title')
            .setLabel('Titre de la règle')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(256);

        const contentInput = new TextInputBuilder()
            .setCustomId('rule_content')
            .setLabel('Contenu de la règle')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1024);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(contentInput)
        );

        await interaction.showModal(modal);
    },

    /**
     * Créer l'embed du règlement
     */
    async createReglementEmbed(nom) {
        const reglement = await this.getReglement(nom);
        if (!reglement) return null;

        const rules = JSON.parse(reglement.rules || '[]');

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`📜 Règlement du serveur de BLZstarss`)
            .setDescription(`**${nom}**`)
            .setTimestamp();

        // Ajouter chaque règle comme field
        for (let i = 0; i < rules.length; i++) {
            embed.addFields({
                name: `${i + 1}. ${rules[i].title}`,
                value: rules[i].content,
                inline: false
            });
        }

        if (rules.length === 0) {
            embed.setDescription(`**${nom}**\n\n*Aucune règle définie pour le moment.*`);
        }

        return embed;
    },

    /**
     * Créer le bouton "Accepter le règlement"
     */
    createAcceptButton() {
        const button = new ButtonBuilder()
            .setCustomId('accept_reglement')
            .setLabel('✅ Accepter le règlement')
            .setStyle(ButtonStyle.Success);

        return new ActionRowBuilder().addComponents(button);
    },

    /**
     * Créer le bouton "Ajouter une règle"
     */
    createAddRuleButton(reglementNom) {
        const button = new ButtonBuilder()
            .setCustomId(`add_rule_${reglementNom}`)
            .setLabel('➕ Ajouter une règle')
            .setStyle(ButtonStyle.Primary);

        return new ActionRowBuilder().addComponents(button);
    },

    /**
     * Envoyer ou mettre à jour le règlement
     */
    async sendOrUpdateReglement(interaction, nom, isUpdate = false) {
        const reglement = await this.getReglement(nom);
        if (!reglement) return;

        const embed = await this.createReglementEmbed(nom);
        const acceptButton = this.createAcceptButton();

        const channel = await interaction.client.channels.fetch(reglement.channel_id);
        if (!channel) return;

        if (isUpdate && reglement.message_id) {
            // Mettre à jour le message existant
            try {
                const message = await channel.messages.fetch(reglement.message_id);
                await message.edit({ embeds: [embed], components: [acceptButton] });
            } catch (error) {
                console.error('Erreur lors de la mise à jour:', error);
                // Si le message n'existe plus, en créer un nouveau
                const newMessage = await channel.send({ embeds: [embed], components: [acceptButton] });
                await this.updateReglementMessageId(nom, newMessage.id);
            }
        } else {
            // Créer un nouveau message
            const message = await channel.send({ embeds: [embed], components: [acceptButton] });
            await this.updateReglementMessageId(nom, message.id);
        }
    },

    // ==================== BASE DE DONNÉES ====================

    /**
     * Créer un règlement
     */
    async createReglement(nom, channelId) {
        return new Promise((resolve, reject) => {
            const db = database.getRulesDb();
            const stmt = db.prepare('INSERT INTO reglements (name, channel_id, rules) VALUES (?, ?, ?)');
            stmt.run(nom, channelId, '[]', function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
            stmt.finalize();
        });
    },

    /**
     * Récupérer un règlement par nom
     */
    async getReglement(nom) {
        return new Promise((resolve, reject) => {
            const db = database.getRulesDb();
            db.get('SELECT * FROM reglements WHERE name = ?', [nom], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },

    /**
     * Récupérer tous les règlements
     */
    async getAllReglements() {
        return new Promise((resolve, reject) => {
            const db = database.getRulesDb();
            db.all('SELECT * FROM reglements', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    /**
     * Ajouter une règle à un règlement
     */
    async addRule(nom, title, content) {
        const reglement = await this.getReglement(nom);
        if (!reglement) return false;

        const rules = JSON.parse(reglement.rules || '[]');
        rules.push({ title, content });

        return new Promise((resolve, reject) => {
            const db = database.getRulesDb();
            const stmt = db.prepare('UPDATE reglements SET rules = ? WHERE name = ?');
            stmt.run(JSON.stringify(rules), nom, function(err) {
                if (err) reject(err);
                else resolve(true);
            });
            stmt.finalize();
        });
    },

    /**
     * Mettre à jour le message_id d'un règlement
     */
    async updateReglementMessageId(nom, messageId) {
        return new Promise((resolve, reject) => {
            const db = database.getRulesDb();
            const stmt = db.prepare('UPDATE reglements SET message_id = ? WHERE name = ?');
            stmt.run(messageId, nom, function(err) {
                if (err) reject(err);
                else resolve(true);
            });
            stmt.finalize();
        });
    },

    /**
     * Supprimer un règlement
     */
    async deleteReglement(nom) {
        return new Promise((resolve, reject) => {
            const db = database.getRulesDb();
            const stmt = db.prepare('DELETE FROM reglements WHERE name = ?');
            stmt.run(nom, function(err) {
                if (err) reject(err);
                else resolve(true);
            });
            stmt.finalize();
        });
    },

    /**
     * Récupérer les règles d'un règlement pour les autocomplete
     */
    async getRulesForAutocomplete(nom) {
        const reglement = await this.getReglement(nom);
        if (!reglement) return [];

        const rules = JSON.parse(reglement.rules || '[]');
        return rules.map((rule, index) => ({
            name: `${index + 1}. ${rule.title}`,
            value: index.toString()
        }));
    },

    /**
     * Autocomplete pour les noms de règlements
     */
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        
        // Autocomplete pour le champ "nom" (liste des règlements)
        if (focusedOption.name === 'nom') {
            try {
                const reglements = await this.getAllReglements();
                const filtered = reglements
                    .filter(r => r.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .slice(0, 25) // Discord limite à 25 résultats
                    .map(r => ({
                        name: r.name,
                        value: r.name
                    }));
                
                await interaction.respond(filtered);
            } catch (error) {
                console.error('Erreur autocomplete règlement:', error);
                await interaction.respond([]);
            }
        }
    }
};
