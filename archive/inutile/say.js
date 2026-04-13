const { Client, GatewayIntentBits } = require('discord.js');
const { loadEnvVariables } = require('./config');
const readline = require('readline');

loadEnvVariables();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

client.once('ready', () => {
    console.log(`Connecté en tant que ${client.user.tag}!`);

    rl.question('Entrez la commande: ', (input) => {
        const args = input.split(' ');
        if (args[0] === '/say') {
            const channelId = args[1];
            const message = args.slice(2).join(' ').replace(/^"(.*)"$/, '$1');
            
            const channel = client.channels.cache.get(channelId);
            if (channel) {
                channel.send(message)
                    .then(() => console.log('Message envoyé!'))
                    .catch(console.error);
            } else {
                console.log('Canal non trouvé.');
            }
        } else {
            console.log('Commande inconnue.');
        }
        rl.close();
        client.destroy();
    });
});

client.login(process.env.BOT_TOKEN);
