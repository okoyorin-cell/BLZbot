/**
 * Déploiement manuel des commandes slash globales (/verify, /setup-verification).
 * Utile si tu veux pousser les commandes sans démarrer le bot complet.
 *
 * Usage : `npm run deploy-commands` (depuis verification/)
 */
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { buildSlashCommands } = require('../src/bot');

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error(`Variable manquante : ${name}`);
    process.exit(1);
  }
  return String(v).trim();
}

async function main() {
  const token = requireEnv('BOT_TOKEN');
  const clientId = requireEnv('DISCORD_CLIENT_ID');

  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationCommands(clientId), { body: buildSlashCommands() });
  console.log('✅ Commandes globales enregistrées : /verify, /setup-verification');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
