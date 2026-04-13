const { Client, GatewayIntentBits } = require('discord.js');
const { config } = require('dotenv');
const { Collection } = require('discord.js');
const fs = require('fs');

config();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers // Nécessaire pour gérer les membres du serveur
    ]
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const MODS_ROLE_ID = '1342845503653810247';
const TOP_ROLE_ID = '1344691386540101674';
const COOLDOWN_TIME = 3600000;

client.cooldowns = new Collection();

client.once('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
    updateTopPlayerRole();
    setInterval(updateTopPlayerRole, COOLDOWN_TIME);
});

client.on('messageCreate', message => {
    if (message.content.includes('@mods')) {
        const now = Date.now();
        const cooldownAmount = COOLDOWN_TIME;

        if (client.cooldowns.has(message.author.id)) {
            const expirationTime = client.cooldowns.get(message.author.id) + cooldownAmount;

            if (now < expirationTime) {
                const timeLeft = Math.floor((expirationTime - now) / 1000);
                return message.reply(`vous pourrez à nouveau mentionner le staff dans <t:${Math.floor((Date.now() + timeLeft * 1000) / 1000)}:R>`);
            }
        }

        message.reply(`<@${message.author.id}> a ping <@&${MODS_ROLE_ID}>`);
        client.cooldowns.set(message.author.id, now);
    }
});

async function updateTopPlayerRole() {
    try {
        const data = fs.readFileSync('points.json', 'utf8');
        const points = JSON.parse(data);

        let topUserId = null;
        let maxPoints = -Infinity;
        for (const userId in points) {
            if (points[userId] > maxPoints) {
                maxPoints = points[userId];
                topUserId = userId;
            }
        }

        const guild = client.guilds.cache.first();
        if (!guild) return console.log('Le bot n\'est sur aucun serveur.');

        const role = guild.roles.cache.get(TOP_ROLE_ID);
        if (!role) return console.log('Rôle introuvable.');

        guild.members.cache.forEach(async (guildMember) => {
            if (guildMember.roles.cache.has(TOP_ROLE_ID)) {
                await guildMember.roles.remove(TOP_ROLE_ID);
                console.log(`Rôle retiré de ${guildMember.user.tag}`);
            }
        });

        if (topUserId) {
            const member = await guild.members.fetch(topUserId);
            if (!member) return console.log('Membre introuvable.');

            await member.roles.add(TOP_ROLE_ID);
            console.log(`Rôle attribué à ${member.user.tag}`);
        }
    } catch (err) {
        console.error(err);
    }
}

client.login(BOT_TOKEN);
