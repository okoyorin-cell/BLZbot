// Importation des modules nécessaires
const { Client, IntentsBitField, SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

// Création du client Discord avec les intentions appropriées
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.MessageContent,
  ],
  partials: ['CHANNEL'],
});

// Connexion à la base de données SQLite3
const db = new sqlite3.Database('./sanctions.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Erreur lors de la connexion à la base de données SQLite3 :', err);
  } else {
    console.log('Connecté à la base de données SQLite3.');
    // Création de la table des sanctions si elle n'existe pas
    db.run(`CREATE TABLE IF NOT EXISTS sanctions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      reason TEXT,
      moderatorId TEXT NOT NULL,
      duration TEXT,
      date INTEGER NOT NULL
    )`);
  }
});

// Lors de la mise en ligne du bot
client.once('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
});

// Enregistrement des commandes lors de la mise en ligne
client.on('ready', async () => {
  const guild = client.guilds.cache.first();
  if (!guild) {
    console.error('Aucun serveur trouvé pour l\'enregistrement des commandes.');
    return;
  }

  // Commande /to
  await guild.commands.create(
    new SlashCommandBuilder()
      .setName('to')
      .setDescription('Mettre un membre en time out avec une durée et une raison spécifiques.')
      .addUserOption(option =>
        option.setName('utilisateur')
          .setDescription('Le membre à time out')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('temps')
          .setDescription('Durée du time out (ex: 10m, 2h, 1j, 3s)')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('raison')
          .setDescription('Raison du time out')
          .setRequired(true))
      .addAttachmentOption(option =>
        option.setName('preuve')
          .setDescription('Preuve (uniquement des captures d\'écran)')
          .setRequired(false))
  );

  // Commande /ban
  await guild.commands.create(
    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Bannir un membre avec une raison spécifique.')
      .addUserOption(option =>
        option.setName('utilisateur')
          .setDescription('Le membre à bannir')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('raison')
          .setDescription('Raison du bannissement')
          .setRequired(true))
      .addAttachmentOption(option =>
        option.setName('preuve')
          .setDescription('Preuve (uniquement des captures d\'écran)')
          .setRequired(false))
  );

  console.log('Commandes /to et /ban enregistrées avec succès.');
});

// Gestion des interactions (commandes)
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const roleModerateur = '1172237685763608579';
  const roleSuperieur = '1323241034855223348';

  if (interaction.commandName === 'to') {
    if (!interaction.member.roles.cache.has(roleModerateur)) {
      return interaction.reply({ content: 'Vous n\'avez pas l\'autorisation d\'utiliser cette commande.', ephemeral: true });
    }

    const utilisateur = interaction.options.getUser('utilisateur');
    const temps = interaction.options.getString('temps');
    const raison = interaction.options.getString('raison');
    const preuve = interaction.options.getAttachment('preuve');
    const modérateur = interaction.member;

    // Vérification du format du temps
    const regexTemps = /^(\d+)([mhjs])$/i;
    const match = temps.match(regexTemps);
    if (!match) {
      return interaction.reply({ content: 'Le format du temps est invalide. Utilisez par exemple 10m, 2h, 1j, 3s.', ephemeral: true });
    }

    const valeurTemps = parseInt(match[1]);
    const unitéTemps = match[2].toLowerCase();

    // Conversion de la durée en millisecondes
    let duréeMs;
    let duréeTexte;
    switch (unitéTemps) {
      case 'm':
        duréeMs = valeurTemps * 60 * 1000;
        duréeTexte = `${valeurTemps} minute(s)`;
        break;
      case 'h':
        duréeMs = valeurTemps * 60 * 60 * 1000;
        duréeTexte = `${valeurTemps} heure(s)`;
        break;
      case 'j':
        duréeMs = valeurTemps * 24 * 60 * 60 * 1000;
        duréeTexte = `${valeurTemps} jour(s)`;
        break;
      case 's':
        duréeMs = valeurTemps * 7 * 24 * 60 * 60 * 1000;
        duréeTexte = `${valeurTemps} semaine(s)`;
        break;
      default:
        return interaction.reply({ content: 'Unité de temps invalide. Utilisez m pour minutes, h pour heures, j pour jours, s pour semaines.', ephemeral: true });
    }

    // Vérification que la durée ne dépasse pas 28 jours
    const maxDurationMs = 28 * 24 * 60 * 60 * 1000; // 28 jours en millisecondes
    if (duréeMs > maxDurationMs) {
      return interaction.reply({ content: 'La durée maximale pour un time out est de 28 jours.', ephemeral: true });
    }

    const membreCible = await interaction.guild.members.fetch(utilisateur.id);

    // Vérification de la hiérarchie des rôles
    if (membreCible.roles.highest.position >= modérateur.roles.highest.position) {
      return interaction.reply({ content: 'Vous ne pouvez pas time out ce membre car il est au même niveau ou au-dessus de vous dans la hiérarchie des rôles.', ephemeral: true });
    }

    if (membreCible.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.reply({ content: 'Je ne peux pas time out ce membre car il est au-dessus de moi dans la hiérarchie des rôles.', ephemeral: true });
    }

    // Application du time out
    try {
      await membreCible.timeout(duréeMs, raison);

      // Enregistrement de la sanction dans la base de données
      db.run(`INSERT INTO sanctions (userId, type, reason, moderatorId, duration, date) VALUES (?, ?, ?, ?, ?, ?)`,
        [membreCible.id, 'Time Out', raison, modérateur.id, duréeTexte, Date.now()]);

      // Envoi du message dans le canal spécifique
      const canalLog = interaction.guild.channels.cache.get('1244739336659013842');
      if (canalLog && canalLog.isTextBased()) {
        let messageLog = `# ${membreCible.user.tag} (${membreCible.id}) a été time out pendant ${duréeTexte} pour la raison "${raison}" par ${modérateur} (${modérateur.id})`;
        if (preuve && preuve.contentType && preuve.contentType.startsWith('image/')) {
          canalLog.send({ content: messageLog, files: [preuve.url] });
        } else {
          if (preuve) {
            messageLog += '\n⚠️ Preuve non acceptée (seules les captures d\'écran sont autorisées).';
          }
          canalLog.send({ content: messageLog });
        }
      }

      // Notification au membre ciblé
      try {
        await membreCible.send(`Vous avez été time out (mute) pour la raison : "${raison}" pendant une durée de ${duréeTexte}.`);
      } catch {
        console.warn('Impossible d\'envoyer un message privé au membre ciblé.');
      }

      // Réponse au modérateur
      await interaction.reply({ content: 'Le warn ne peut pas être donné au membre, vous devez le faire vous-même si besoin de le warn.', ephemeral: true });
    } catch (erreur) {
      console.error('Erreur lors de l\'application du time out :', erreur);
      await interaction.reply({ content: 'Une erreur est survenue lors de l\'application du time out.', ephemeral: true });
    }
  }

  if (interaction.commandName === 'ban') {
    if (!interaction.member.roles.cache.has(roleSuperieur) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'Vous n\'avez pas l\'autorisation d\'utiliser cette commande.', ephemeral: true });
    }

    const utilisateur = interaction.options.getUser('utilisateur');
    const raison = interaction.options.getString('raison');
    const preuve = interaction.options.getAttachment('preuve');
    const modérateur = interaction.member;

    const membreCible = await interaction.guild.members.fetch(utilisateur.id);

    // Vérification si le membre est modérateur
    if (membreCible.roles.cache.has(roleModerateur)) {
      return interaction.reply({ content: 'Vous essayez de bannir un modérateur, vu que cela est une action importante veuillez le faire par vous-même.', ephemeral: true });
    }

    // Enregistrement de la sanction dans la base de données
    db.run(`INSERT INTO sanctions (userId, type, reason, moderatorId, date) VALUES (?, ?, ?, ?, ?)`,
      [membreCible.id, 'Ban', raison, modérateur.id, Date.now()]);

    // Envoi du message dans le canal spécifique avant le bannissement
    const canalLog = interaction.guild.channels.cache.get('1244739336659013842');
    if (canalLog && canalLog.isTextBased()) {
      let messageLog = `# ${membreCible.user.tag} (${membreCible.id}) a été banni définitivement pour la raison : "${raison}" par ${modérateur} (${modérateur.id})`;
      if (preuve && preuve.contentType && preuve.contentType.startsWith('image/')) {
        canalLog.send({ content: messageLog, files: [preuve.url] });
      } else {
        if (preuve) {
          messageLog += '\n⚠️ Preuve non acceptée (seules les captures d\'écran sont autorisées).';
        }
        canalLog.send({ content: messageLog });
      }
    }

    // Notification au membre ciblé
    try {
      await membreCible.send(`Vous avez été BANNI définitivement du serveur de BLZstarss pour la raison : "${raison}".`);
      // Bannissement du membre
      await membreCible.ban({ reason: raison });
      await interaction.reply({ content: `${membreCible.user.tag} a été banni définitivement.`, ephemeral: true });
    } catch (erreur) {
      console.error('Erreur lors du bannissement :', erreur);
      await interaction.reply({ content: 'Une erreur est survenue lors du bannissement.', ephemeral: true });
    }
  }
});

// Écoute des événements de time out et de bannissement externes
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  // Détection du time out
  if (!oldMember.communicationDisabledUntil && newMember.communicationDisabledUntil) {
    const durationMs = newMember.communicationDisabledUntilTimestamp - Date.now();
    const duration = msToReadableTime(durationMs);
    const modérateur = 'Inconnu (action externe)';

    // Vérification que la durée est valide
    if (durationMs > 0 && durationMs <= 28 * 24 * 60 * 60 * 1000) {
      // Enregistrement de la sanction dans la base de données
      db.run(`INSERT INTO sanctions (userId, type, reason, moderatorId, duration, date) VALUES (?, ?, ?, ?, ?, ?)`,
        [newMember.id, 'Time Out', 'Raison non spécifiée', modérateur, duration, Date.now()]);
    }
  }
});

client.on('guildBanAdd', async (ban) => {
  const modérateur = 'Inconnu (action externe)';

  // Enregistrement de la sanction dans la base de données
  db.run(`INSERT INTO sanctions (userId, type, reason, moderatorId, date) VALUES (?, ?, ?, ?, ?)`,
    [ban.user.id, 'Ban', ban.reason || 'Raison non spécifiée', modérateur, Date.now()]);
});

// Commande +modlog
client.on('messageCreate', async message => {
  if (message.content.startsWith('+modlog')) {
    // Vérification que l'utilisateur est administrateur
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('Vous n\'avez pas l\'autorisation d\'utiliser cette commande.');
    }

    const args = message.content.split(' ');
    let cible;

    // Vérification si un utilisateur est mentionné ou si un ID est fourni
    if (message.mentions.users.first()) {
      cible = message.mentions.users.first();
    } else if (args[1]) {
      try {
        cible = await client.users.fetch(args[1]);
      } catch (err) {
        return message.reply('Utilisateur invalide. Veuillez mentionner un utilisateur ou fournir un ID valide.');
      }
    } else {
      return message.reply('Veuillez mentionner un utilisateur ou fournir son ID pour afficher son historique de sanctions.');
    }

    // Récupération des sanctions depuis la base de données
    db.all(`SELECT * FROM sanctions WHERE userId = ? ORDER BY date DESC`, [cible.id], async (err, rows) => {
      if (err) {
        console.error('Erreur lors de la récupération des sanctions :', err);
        return message.reply('Une erreur est survenue lors de la récupération des sanctions.');
      }

      if (rows.length === 0) {
        return message.reply('Aucune sanction trouvée pour cet utilisateur.');
      }

      // Calcul des totaux de bans et de time outs
      const totalBans = rows.filter(s => s.type === 'Ban').length;
      const totalTOs = rows.filter(s => s.type === 'Time Out').length;

      // Préparation des pages de l'embed
      const sanctionsParPage = 5;
      const pages = [];
      for (let i = 0; i < rows.length; i += sanctionsParPage) {
        const currentPage = rows.slice(i, i + sanctionsParPage);
        const embed = new EmbedBuilder()
          .setTitle(`Historique des sanctions de ${cible.tag}`)
          .setColor('#808080') // Gris
          .setTimestamp();

        // Ajout des totaux en en-tête
        let descriptionEntête = '';
        if (totalBans > 0) descriptionEntête += `[${totalBans}] Ban(s) `;
        if (totalTOs > 0) descriptionEntête += `[${totalTOs}] Time Out(s)`;
        if (descriptionEntête) {
          embed.setDescription(descriptionEntête);
        }

        currentPage.forEach(sanction => {
          const date = new Date(sanction.date).toLocaleString('fr-FR');
          let description = `**Type :** ${sanction.type}\n`;
          if (sanction.duration) {
            description += `**Durée :** ${sanction.duration}\n`;
          }
          description += `**Raison :** ${sanction.reason}\n`;
          description += `**Modérateur :** ${sanction.moderatorId.startsWith('Inconnu') ? sanction.moderatorId : `<@${sanction.moderatorId}>`}\n`;
          description += `**Date :** ${date}`;

          embed.addFields({ name: `${sanction.type} - ${date}`, value: description });
        });

        pages.push(embed);
      }

      // Gestion de la pagination
      let pageActuelle = 0;
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('previous')
            .setLabel('Précédent')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Suivant')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(pages.length <= 1)
        );

      const messageEmbed = await message.channel.send({ embeds: [pages[pageActuelle]], components: [row] });

      const collector = messageEmbed.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

      collector.on('collect', async i => {
        if (i.user.id !== message.author.id) {
          return i.reply({ content: 'Vous ne pouvez pas utiliser ces boutons.', ephemeral: true });
        }

        if (i.customId === 'previous') {
          pageActuelle--;
        } else if (i.customId === 'next') {
          pageActuelle++;
        }

        // Mise à jour des boutons
        row.components[0].setDisabled(pageActuelle === 0);
        row.components[1].setDisabled(pageActuelle === pages.length - 1);

        await i.update({ embeds: [pages[pageActuelle]], components: [row] });
      });

      collector.on('end', () => {
        row.components.forEach(button => button.setDisabled(true));
        messageEmbed.edit({ components: [row] });
      });
    });
  }
});

// Fonction pour convertir la durée en millisecondes en format lisible
function msToReadableTime(duration) {
  const seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),
    hours = Math.floor((duration / (1000 * 60 * 60)) % 24),
    days = Math.floor(duration / (1000 * 60 * 60 * 24));

  let time = '';
  if (days > 0) time += `${days} jour(s) `;
  if (hours > 0) time += `${hours} heure(s) `;
  if (minutes > 0) time += `${minutes} minute(s) `;
  if (seconds > 0) time += `${seconds} seconde(s)`;
  return time.trim();
}

// Connexion du bot à Discord
client.login(process.env.BOT_TOKEN);
