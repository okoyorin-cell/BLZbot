const { SlashCommandBuilder } = require('discord.js');
const { getOrCreateEventUser, grantEventCurrency, getEventState, db } = require('../../utils/db-valentin');
const logger = require('../../utils/logger');
const { handleCommandError } = require('../../utils/error-handler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rembourser-coeurs')
        .setDescription('Rembourser un prêt de Cœurs.')
        .addIntegerOption(option =>
            option.setName('montant')
                .setDescription('Le montant à rembourser')
                .setRequired(true)
                .setMinValue(1))
        .addStringOption(option =>
            option.setName('dette')
                .setDescription('La dette à rembourser')
                .setRequired(true)
                .setAutocomplete(true)),

    async autocomplete(interaction) {
        if (!getEventState('valentin')) {
            return interaction.respond([{ name: 'Événement inactif', value: '0' }]);
        }

        const borrowerId = interaction.user.id;

        // Récupérer les dettes non remboursées
        const getLoansStmt = db.prepare(`
            SELECT id, lender_id, amount FROM valentin_loans 
            WHERE borrower_id = ? AND repaid = 0 AND accepted = 1
            ORDER BY expires_at ASC
            LIMIT 25
        `);
        const loans = getLoansStmt.all(borrowerId);

        const userCache = {};

        const choices = await Promise.all(loans.map(async (loan) => {
            try {
                if (!userCache[loan.lender_id]) {
                    const lender = await interaction.client.users.fetch(loan.lender_id);
                    userCache[loan.lender_id] = lender.username;
                }

                return {
                    name: `${userCache[loan.lender_id]} - ${loan.amount} cœurs`,
                    value: loan.id.toString()
                };
            } catch (e) {
                return {
                    name: `ID ${loan.lender_id} - ${loan.amount} cœurs`,
                    value: loan.id.toString()
                };
            }
        }));

        try {
            await interaction.respond(choices.length > 0 ? choices :
                [{ name: 'Aucune dette à rembourser', value: '0' }]);
        } catch (error) {
            if (error.code !== 10062) {
                console.error('Erreur autocomplete:', error);
            }
        }
    },

    async execute(interaction) {
        try {
            if (!getEventState('valentin')) {
                return interaction.reply({ content: "L'événement Saint-Valentin n'est pas actif.", ephemeral: true });
            }

            const borrower = interaction.user;
            const amount = interaction.options.getInteger('montant');
            const loanIdStr = interaction.options.getString('dette');
            const loanId = parseInt(loanIdStr);

            if (isNaN(loanId) || loanId === 0) {
                return interaction.reply({ content: 'Veuillez sélectionner une dette valide.', ephemeral: true });
            }

            const getLoanStmt = db.prepare('SELECT * FROM valentin_loans WHERE id = ? AND borrower_id = ?');
            const loan = getLoanStmt.get(loanId, borrower.id);

            if (!loan) {
                return interaction.reply({ content: 'Cette dette n\'existe pas.', ephemeral: true });
            }

            if (!loan.accepted) {
                return interaction.reply({ content: 'Cette dette n\'a pas été acceptée.', ephemeral: true });
            }

            if (loan.repaid) {
                return interaction.reply({ content: 'Cette dette a déjà été remboursée.', ephemeral: true });
            }

            const borrowerUser = getOrCreateEventUser(borrower.id, borrower.username);

            if (borrowerUser.coeurs < amount) {
                return interaction.reply({ content: `Vous n'avez que **${borrowerUser.coeurs}** cœurs, vous ne pouvez pas rembourser **${amount}** cœurs.`, ephemeral: true });
            }

            // Pas d'intérêt pour les cœurs, donc montant total = montant prêté
            const totalAmount = loan.amount;

            // Calcul dette restante (ajouter colonne repaid_amount si besoin)
            try {
                db.exec(`ALTER TABLE valentin_loans ADD COLUMN repaid_amount INTEGER DEFAULT 0`);
            } catch (e) {
                // Colonne existe déjà
            }

            const alreadyRepaid = loan.repaid_amount || 0;
            const remainingDebt = totalAmount - alreadyRepaid;

            // Récupérer le prêteur
            let lender;
            try {
                lender = await interaction.client.users.fetch(loan.lender_id);
            } catch (error) {
                return interaction.reply({ content: 'Impossible de trouver le prêteur de cette dette.', ephemeral: true });
            }

            if (amount > remainingDebt) {
                // Si trop donné, rembourser juste ce qu'il faut
                const finalAmount = remainingDebt;

                grantEventCurrency(borrower.id, { coeurs: -finalAmount });
                getOrCreateEventUser(loan.lender_id, lender.username);
                grantEventCurrency(loan.lender_id, { coeurs: finalAmount });

                const updateLoanStmt = db.prepare('UPDATE valentin_loans SET repaid = ?, repaid_amount = ? WHERE id = ?');
                updateLoanStmt.run(1, totalAmount, loanId);

                await interaction.reply({
                    content: `✅ Vous avez remboursé **${finalAmount}** cœurs (au lieu de ${amount}). Dette complètement remboursée ! 💝`,
                    ephemeral: true
                });

                try {
                    await lender.send(`✅ ${borrower.username} a remboursé sa dette de **${finalAmount}** cœurs ! 💝`);
                } catch (error) {
                    logger.error(`DM au prêteur échoué:`, error.message);
                }

                logger.info(`${borrower.username} a remboursé ${finalAmount} cœurs à ${lender.username}.`);
            } else {
                grantEventCurrency(borrower.id, { coeurs: -amount });
                getOrCreateEventUser(loan.lender_id, lender.username);
                grantEventCurrency(loan.lender_id, { coeurs: amount });

                const newRepaidAmount = alreadyRepaid + amount;
                const isFullyRepaid = newRepaidAmount >= totalAmount;

                if (isFullyRepaid) {
                    const updateLoanStmt = db.prepare('UPDATE valentin_loans SET repaid = ?, repaid_amount = ? WHERE id = ?');
                    updateLoanStmt.run(1, totalAmount, loanId);

                    await interaction.reply({
                        content: `✅ Vous avez remboursé **${amount}** cœurs. Dette complètement remboursée ! 💝`,
                        ephemeral: true
                    });

                    try {
                        await lender.send(`✅ ${borrower.username} a remboursé sa dette de **${totalAmount}** cœurs ! 💝`);
                    } catch (error) {
                        logger.error(`DM au prêteur échoué:`, error.message);
                    }
                } else {
                    const updateLoanStmt = db.prepare('UPDATE valentin_loans SET repaid_amount = ? WHERE id = ?');
                    updateLoanStmt.run(newRepaidAmount, loanId);

                    const remaining = totalAmount - newRepaidAmount;
                    await interaction.reply({
                        content: `✅ Vous avez remboursé **${amount}** cœurs. Il vous reste **${remaining}** cœurs à rembourser.`,
                        ephemeral: true
                    });

                    try {
                        await lender.send(`${borrower.username} a remboursé **${amount}** cœurs. Il en reste **${remaining}** à rembourser.`);
                    } catch (error) {
                        logger.error(`DM au prêteur échoué:`, error.message);
                    }
                }

                logger.info(`${borrower.username} a remboursé ${amount} cœurs à ${lender.username}.`);
            }
        } catch (error) {
            await handleCommandError(interaction, error);
        }
    }
};
