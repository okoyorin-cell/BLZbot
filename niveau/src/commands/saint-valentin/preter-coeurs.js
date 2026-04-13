const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getOrCreateEventUser, grantEventCurrency, getEventState, db } = require('../../utils/db-valentin');
const logger = require('../../utils/logger');

// Créer la table des prêts Valentine si elle n'existe pas
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS valentin_loans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lender_id TEXT NOT NULL,
            borrower_id TEXT NOT NULL,
            amount INTEGER NOT NULL,
            interest INTEGER NOT NULL DEFAULT 0,
            expires_at TEXT NOT NULL,
            accepted INTEGER NOT NULL DEFAULT 0,
            repaid INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        )
    `);
} catch (e) {
    // Table existe déjà
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('preter-coeurs')
        .setDescription('Prêter des Cœurs à un autre utilisateur.')
        .addUserOption(option => option.setName('utilisateur').setDescription("L'utilisateur à qui prêter").setRequired(true))
        .addIntegerOption(option => option.setName('montant').setDescription('Le montant de Cœurs à prêter').setRequired(true).setMinValue(1))
        .addStringOption(option => option.setName('duree').setDescription('La durée du prêt (ex: 24h, 3d)').setRequired(true)),

    async execute(interaction) {
        if (!getEventState('valentin')) {
            return interaction.reply({ content: "L'événement Saint-Valentin n'est pas actif.", ephemeral: true });
        }

        await interaction.deferReply();

        const lender = interaction.user;
        const borrower = interaction.options.getUser('utilisateur');
        const amount = interaction.options.getInteger('montant');
        const timeInput = interaction.options.getString('duree');

        if (lender.id === borrower.id) {
            return interaction.editReply({ content: "Tu veux te prêter de l'amour à toi-même ? C'est touchant mais non." });
        }

        if (borrower.bot) {
            return interaction.editReply({ content: "Les bots n'ont pas besoin de cœurs. Ils tournent au binaire." });
        }

        const timeRegex = /^(\d+)([hd])$/;
        const match = timeInput.match(timeRegex);

        if (!match) {
            return interaction.editReply({ content: 'Format de durée invalide. Exemples: "24h", "3d", "7d".' });
        }

        const value = parseInt(match[1]);
        const unit = match[2];
        let durationMs = unit === 'h' ? value * 60 * 60 * 1000 : value * 24 * 60 * 60 * 1000;

        if (durationMs < 1 * 60 * 60 * 1000 || durationMs > 7 * 24 * 60 * 60 * 1000) {
            return interaction.editReply({ content: 'La durée doit être entre 1 heure et 7 jours.' });
        }

        const lenderUser = getOrCreateEventUser(lender.id, lender.username);

        if (lenderUser.coeurs < amount) {
            return interaction.editReply({ content: `Tu n'as pas assez de Cœurs. Tu as ${lenderUser.coeurs.toLocaleString('fr-FR')} Cœurs.` });
        }

        // Vérifier les prêts actifs de l'emprunteur
        const activeBorrowerLoans = db.prepare(`
            SELECT COUNT(*) as count FROM valentin_loans 
            WHERE borrower_id = ? AND accepted = 1 AND repaid = 0
        `).get(borrower.id);

        if (activeBorrowerLoans.count >= 5) {
            return interaction.editReply({ content: `${borrower.username} a déjà 5 prêts en cours. C'est un peu beaucoup !` });
        }

        const expiresAt = new Date(Date.now() + durationMs);

        const insertStmt = db.prepare(`
            INSERT INTO valentin_loans (lender_id, borrower_id, amount, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        const info = insertStmt.run(lender.id, borrower.id, amount, expiresAt.toISOString(), Date.now());
        const loanId = info.lastInsertRowid;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`valentin_loan_accept_${loanId}`)
                .setLabel('Accepter 💝')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`valentin_loan_decline_${loanId}`)
                .setLabel('Refuser 💔')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({
            content: `${borrower}, **${lender.username}** te propose un prêt de **${amount.toLocaleString('fr-FR')} Cœurs** à rembourser avant le **${expiresAt.toLocaleDateString('fr-FR')}**.\n\n*Tu as 1 heure pour accepter.*`,
            components: [row]
        });

        logger.info(`Prêt Valentine créé: ${lender.username} -> ${borrower.username}, ${amount} cœurs`);
    },
};
