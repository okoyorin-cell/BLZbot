require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const BOT_ID = '1317275021017612340'; // L'ID du bot
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const version = '2.0.1';
const createur = 'Richard';
const description = 'Je gère actuellement le comptage et la vérification de liens';

client.once('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', message => {
    if (message.author.bot) return;

    // Vérifie si le message contient uniquement la mention du bot
    const content = message.content.trim();
    if (content === `<@${BOT_ID}>` || content === `<@!${BOT_ID}>`) {
        const ping = Date.now() - message.createdTimestamp;

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('🤖 Informations du Bot')
            .addFields(
                { name: 'Ping', value: `${ping} ms`, inline: true },
                { name: 'Version', value: version, inline: true },
                { name: 'Créateur', value: createur, inline: true },
                { name: 'Description', value: description, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Merci de m\'avoir mentionné !' });

        message.channel.send({ embeds: [embed] });
    }
});

client.login(process.env.BOT_TOKEN);
