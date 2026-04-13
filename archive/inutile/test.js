require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const webhookUrl = 'https://canary.discord.com/api/webhooks/1355719023266107493/TnTAPP0shYyNL-3cnlwOHByXXzIvM6y7s_5_JSVN6RA-TNtssDwdlncIU3KuYNA8w0oN';
const channelIds = ['1343221432582144040'];

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    for (const channelId of channelIds) {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            let messages = [];
            let lastMessageId = null;
            const limit = 100; // Limite par requête

            // Récupérer les messages par lots de 100
            for (let i = 0; i < 1; i++) {
                const options = { limit };
                if (lastMessageId) {
                    options.before = lastMessageId;
                }
                const fetchedMessages = await channel.messages.fetch(options);
                if (fetchedMessages.size === 0) break;
                messages.push(...fetchedMessages.values());
                lastMessageId = fetchedMessages.last().id;
            }

            const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            for (const message of sortedMessages) {
                await sendToWebhook(message, channel);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Délai de 2 secondes
            }
        }
    }
});

client.on('messageCreate', async message => {
    if (channelIds.includes(message.channelId)) {
        const channel = await client.channels.fetch(message.channelId);
        await sendToWebhook(message, channel);
    }
});

async function sendToWebhook(message, channel) {
    const payload = {
        content: `**Message from ${message.author.tag} in #${channel.name}:**\n${message.content}`,
    };

    try {
        await axios.post(webhookUrl, payload);
        console.log(`Sent message from ${message.author.tag} to webhook.`);
    } catch (error) {
        console.error('Error sending message to webhook:', error);
    }
}

client.login(process.env.BOT_TOKEN);
