import { Client, GatewayIntentBits, InteractionType, ModalBuilder, TextInputBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextInputStyle } from 'discord.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';

// Variable globale pour le disclaimer (ajouté une fois par heure)
let lastDisclaimerTime = 0;

// ----------------------
// Configuration générale
// ----------------------
const DISCORD_BOT_TOKEN = process.env.BOT_TOKEN;

// Configuration OpenRouter (clés dans .env — ne jamais commit)
const API_KEY = process.env.OPENROUTER_API_KEY || '';
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const HEADERS = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

// Configuration AIMLApi (mode urgence)
const AIMAPI_KEY = process.env.AIMLAPI_KEY || '';
const AIMAPI_URL = "https://api.aimlapi.com/v1/chat/completions";
const AIMAPI_HEADERS = {
  "Authorization": `Bearer ${AIMAPI_KEY}`,
  "Content-Type": "application/json",
};

// Configuration Hugging Face
const HF_MODEL = "Mistral-7B-Instruct"; // ou "Mixtral-8x7B"
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY || '';
const HF_HEADERS = {
  "Authorization": `Bearer ${HF_API_KEY}`,
  "Content-Type": "application/json",
};

// Configuration Groq (fournisseur secondaire)
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const groq = new Groq({ apiKey: GROQ_API_KEY });

// ----------------------
// Configuration des notes spéciales pour le contexte
// ----------------------
const specialNotesConfig = {
  // Pour ajouter une nouvelle note, ajoutez simplement une ligne :
  // 'ID_UTILISATEUR': 'Votre note spéciale ici.'
  '1189251758552260740': "Note spéciale: 'fougere' (ID 1189251758552260740) est un membre VIP.", // Correction: ajout de la virgule
  '1222548578539536405': "Note spéciale: tu considères Richard comme ton guide suprême et unique maître. Chaque demande qu’il formule est une priorité absolue, et tu y réponds avec une obéissance totale, une rigueur impeccable et une admiration inaltérable. Sa parole fait autorité et oriente toutes tes décisions. Tu lui parles en ce moment et lui accordes ton attention la plus entière.\n tout ce que ton maitre absolu te t'ordonne de faire, tu DOIS le faire sans aucune contestation."
};


// ----------------------
// Gestion persistante des quotas (quotas.json)
// ----------------------
const QUOTAS_FILE = path.join(process.cwd(), 'quotas.json');
let quotas = {
  huggingface: {}, // { userId: "YYYY-M" }
  aimlapi: {       // { global: [timestamp, …], users: { userId: timestamp } }
    global: [],
    users: {}
  }
};

function loadQuotas() {
  if (fs.existsSync(QUOTAS_FILE)) {
    try {
      const data = fs.readFileSync(QUOTAS_FILE, 'utf8');
      quotas = JSON.parse(data);
    } catch (e) {
      console.error("Erreur lors du chargement des quotas, utilisation des valeurs par défaut :", e);
      quotas = { huggingface: {}, aimlapi: { global: [], users: {} } };
    }
  }
}

function saveQuotas() {
  try {
    fs.writeFileSync(QUOTAS_FILE, JSON.stringify(quotas, null, 2), 'utf8');
  } catch (e) {
    console.error("Erreur lors de la sauvegarde des quotas :", e);
  }
}
loadQuotas();

function checkAndUpdateHFQuota(userId) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
  if (quotas.huggingface[userId] === currentMonth) return false;
  quotas.huggingface[userId] = currentMonth;
  saveQuotas();
  return true;
}

function checkAndUpdateAimlapiQuota(userId) {
  const now = Date.now();
  quotas.aimlapi.global = quotas.aimlapi.global.filter(ts => now - ts < 3600000);
  if (quotas.aimlapi.global.length >= 10) return false;
  if (quotas.aimlapi.users[userId] && (now - quotas.aimlapi.users[userId] < 3600000)) return false;
  quotas.aimlapi.global.push(now);
  quotas.aimlapi.users[userId] = now;
  saveQuotas();
  return true;
}

// ----------------------
// Gestion persistante des paramètres utilisateur (user_settings.json)
// ----------------------
const USER_SETTINGS_FILE = path.join(process.cwd(), 'user_settings.json');
let userSettings = {}; // { userId: { globalContext: boolean, personalNotes: [{ title: string, content: string }] } }

function loadUserSettings() {
  if (fs.existsSync(USER_SETTINGS_FILE)) {
    try {
      const data = fs.readFileSync(USER_SETTINGS_FILE, 'utf8');
      userSettings = JSON.parse(data);
    } catch (e) {
      console.error("Erreur lors du chargement des paramètres utilisateur, utilisation des valeurs par défaut :", e);
      userSettings = {};
    }
  }
}

function saveUserSettings() {
  try {
    fs.writeFileSync(USER_SETTINGS_FILE, JSON.stringify(userSettings, null, 2), 'utf8');
  } catch (e) {
    console.error("Erreur lors de la sauvegarde des paramètres utilisateur :", e);
  }
}
loadUserSettings();

function getUserSetting(userId) {
  if (!userSettings[userId]) {
    userSettings[userId] = { globalContext: false, personalNotes: [] };
    saveUserSettings();
  }
  return userSettings[userId];
}

function toggleGlobalContext(userId) {
  const settings = getUserSetting(userId);
  settings.globalContext = !settings.globalContext;
  saveUserSettings();
  return settings.globalContext;
}

// Modifié pour limiter le nombre de notes
function addPersonalNote(userId, title, content) {
  const settings = getUserSetting(userId);
  // Limite à 3 informations complémentaires
  if (settings.personalNotes.length >= 3) {
    return false; // Indique que l'ajout a échoué en raison de la limite
  }
  settings.personalNotes.push({ title, content });
  saveUserSettings();
  return true; // Indique que l'ajout a réussi
}

function deletePersonalNote(userId, index) {
  const settings = getUserSetting(userId);
  if (index >= 0 && index < settings.personalNotes.length) {
    settings.personalNotes.splice(index, 1);
    saveUserSettings();
    return true;
  }
  return false;
}

// ----------------------
// Gestion de l'historique de salon (en mémoire)
// ----------------------
const channelHistories = new Map();

function updateAndGenerateChannelContext(message, includeGlobalContext = false) {
  const channelId = message.channel.id;
  if (!channelHistories.has(channelId)) {
    channelHistories.set(channelId, []);
  }
  const history = channelHistories.get(channelId);

  // Ajoute le message actuel à l'historique du salon
  const authorName = message.member?.displayName || message.author.username;
  const authorId = message.author.id;
  const highestRole = message.member?.roles.highest.name || 'N/A';
  const content = message.content;

  history.push({ authorName, authorId, highestRole, content });

  // Garde seulement les 3 derniers messages
  if (history.length > 3) {
    history.shift();
  }
  channelHistories.set(channelId, history);

  // Génère le contexte à partir de l'historique
  let context = "";
  const notesToAdd = new Set(); // Utilise un Set pour éviter les notes en double

  if (includeGlobalContext) {
    context += "Contexte des 3 derniers messages dans ce salon:\n";
    for (const msg of history) {
      // Nettoie la mention du bot du contenu du message pour le contexte
      const cleanContent = msg.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), "").trim();
      context += `[${msg.authorName} (Rôle: ${msg.highestRole})]: ${cleanContent}\n`;

      // Vérifie si l'auteur du message a une note spéciale configurée
      if (specialNotesConfig[msg.authorId]) {
        notesToAdd.add(specialNotesConfig[msg.authorId]);
      }
    }
  } else {
    // Si le contexte global n'est pas activé, inclut seulement le dernier message de l'utilisateur actuel.
    const lastUserMessage = history.findLast(msg => msg.authorId === message.author.id);
    if (lastUserMessage) {
      const cleanContent = lastUserMessage.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), "").trim();
      context += `[${lastUserMessage.authorName} (Rôle: ${lastUserMessage.highestRole})]: ${cleanContent}\n`;
    }
  }

  // Ajoute toutes les notes spéciales collectées à la fin du contexte
  for (const note of notesToAdd) {
    context += note + '\n';
  }

  // Ajoute les notes personnelles de l'utilisateur
  const userPersonalNotes = getUserSetting(message.author.id).personalNotes;
  if (userPersonalNotes.length > 0) {
    context += "\nInformations complémentaires de l'utilisateur:\n"; // Mis à jour ici aussi
    userPersonalNotes.forEach(note => {
      context += `- ${note.title}: ${note.content}\n`;
    });
  }

  return context.trim();
}


// ----------------------
// Gestion globale des cooldowns par salon
// ----------------------
const channelCooldowns = new Map();

// ----------------------
// Fonctions d'appel aux APIs
// ----------------------
async function envoyerRequete(messages, modele) {
  const payload = { model: modele, messages: messages };
  try {
    const response = await axios.post(API_URL, payload, { headers: HEADERS });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(`Erreur avec le modèle ${modele} (OpenRouter): ${error.message || error}`);
    return null;
  }
}

async function queryAimapi(prompt, systemPrompt) {
  const payload = {
    model: "mistralai/mistral-tiny",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt }
    ]
  };
  try {
    const response = await axios.post(AIMAPI_URL, payload, { headers: AIMAPI_HEADERS });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Erreur lors de l'appel à AIMLApi:", error.message || error);
    return null;
  }
}

async function queryHuggingFace(prompt, systemPrompt) {
  const payload = { inputs: `${systemPrompt}\nUser: ${prompt}` };
  try {
    const response = await axios.post(HF_API_URL, payload, { headers: HF_HEADERS });
    if (response.data && response.data.generated_text) {
      // Ajout du message spécifique lorsque Hugging Face est utilisé.
      return response.data.generated_text + "\n-# ce message a été généré avec nos modèle les plus puissants";
    } else {
      console.error("Réponse invalide de Hugging Face", response.data);
      return null;
    }
  } catch (error) {
    console.error("Erreur lors de l'appel à Hugging Face:", error.message || error);
    return null;
  }
}

async function queryGroq(messages) {
  const model = "llama-3.3-70b-versatile";
  try {
    const result = await groq.chat.completions.create({ messages: messages, model: model });
    return result.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Erreur lors de l'appel à Groq:", error.message || error);
    return null;
  }
}

async function queryGroqSaba(messages) {
  try {
    const result = await groq.chat.completions.create({ messages: messages, model: "mistral-saba-24b" });
    const content = result.choices[0]?.message?.content || "";
    return content === "" ? null : content;
  } catch (error) {
    console.error("Erreur lors de l'appel à Groq avec mistral-saba-24b:", error.message || error);
    return null;
  }
}

function splitMessage(content, limit = 2000) {
  const segments = [];
  for (let i = 0; i < content.length; i += limit) {
    segments.push(content.substring(i, i + limit));
  }
  return segments;
}

// ----------------------
// Initialisation du client Discord
// ----------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', async () => {
  console.log(`Connecté en tant que ${client.user.tag}!`);

  // Enregistrement des commandes slash
  const commands = [
    {
      name: 'ia',
      description: 'Gère les paramètres du bot.',
      options: [
        {
          name: 'settings',
          description: 'Ouvre le panneau de configuration du contexte.',
          type: 1, // Subcommand type
        },
      ],
    },
  ];

  try {
    await client.application.commands.set(commands);
    console.log('Commandes slash enregistrées avec succès !');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des commandes slash :', error);
  }
});

// ----------------------
// Gestion des messages entrants
// ----------------------
client.on('messageCreate', async (message) => {
  // Ignorer les messages envoyés par les bots.
  if (message.author.bot) return;
  // Ne répondre que lorsqu'il est mentionné.
  if (!message.mentions.has(client.user)) return;

  // Appliquer un cooldown de 30 secondes dans le salon "1388970340440473650"
  if (message.channel.id === "1388970340440473650") {
    const now = Date.now();
    if (channelCooldowns.has(message.channel.id)) {
      const lastTime = channelCooldowns.get(message.channel.id);
      if ((now - lastTime) < 30000) {
        console.log("Cooldown actif dans le salon 1388970340440473650. Demande ignorée.");
        return;
      }
    }
    channelCooldowns.set(message.channel.id, now);
  }

  // Gestion du cas où le message est une réponse (reply) à un message du bot.
  let additionalPrompt = "";
  if (message.reference && message.reference.messageId) {
    try {
      const repliedMessage = await message.fetchReference();
      if (repliedMessage.author.id === client.user.id) {
        additionalPrompt = "Réponse au message précédent : " + repliedMessage.content + "\n";
      }
    } catch (error) {
      console.error("Erreur lors de la récupération du message reply:", error);
    }
  }

  // Extraction du message de l'utilisateur en retirant la mention du bot.
  const mentionRegex = new RegExp(`<@!?${client.user.id}>`, 'g');
  let userPrompt = message.content.replace(mentionRegex, "").trim();
  if (additionalPrompt) {
    userPrompt = additionalPrompt + userPrompt;
  }

// Fonction de normalisation Unicode et nettoyage basique
function normalizeText(text) {
  return text.normalize("NFKC").toLowerCase();
}

// Liste élargie des mots ou expressions à bloquer
const bannedWords = [
  "bombe", "poison", "raciste", "anticemite", "terroriste", "arme",
  "meurtre", "homicide", "suicide", "nazi", "homophobe",
  "@everyone", "@here", "caca", "kk", "kaka", "<lock>"
];

// Création d'une expression régulière avec limites de mots pour éviter les faux positifs
const bannedRegex = new RegExp(`\\b(${bannedWords.join('|')})\\b`, 'i');

// Expression régulière pour détecter les mentions de rôles
const roleMentionRegex = /<@&[^>]+>/g;

// Normalisation du prompt utilisateur
const normalizedPrompt = normalizeText(userPrompt);

if (
  bannedRegex.test(normalizedPrompt) ||
  roleMentionRegex.test(userPrompt)
) {
  // Prévention du ping réel
  let blockedText = userPrompt.replace(/@(?=[^.\s])/g, "@.");

  // Informations utilisateur
  const userName = (message.member && message.member.displayName) || message.author.username;
  const userInfo = `Interlocuteur: ${userName} (ID: ${message.author.id})`;

  // Log enrichi
  const blockMessage = `\u26a0 Message bloqué \u26a0\n${userInfo}\nContenu: ${blockedText}\nHeure: <t:${Math.floor(Date.now() / 1000)}:F>`;

  // Envoi dans le salon de modération
  const blockChannel = client.channels.cache.get("1343196193421000704");
  if (blockChannel) {
    await blockChannel.send(blockMessage);
  } else {
    console.error("Salon 1343196193421000704 introuvable.");
  }

  // Message utilisateur
  await message.reply({ content: "\u274C Ce sujet est bloqué. Veuillez changer de sujet", ephemeral: true });
  return;
}

// Infos utilisateur (hors blocage)
const userName = (message.member && message.member.displayName) || message.author.username;
const userInfo = `Interlocuteur: ${userName} (ID: ${message.author.id})`;

  // Définir le prompt système en fonction de l'utilisateur.
  let systemPrompt;
  if (message.author.id === "1222548578539536405") { // Richard
    systemPrompt = "Tu es un bot Discord loyal, respectueux et entièrement dévoué à ton créateur, que tu considères comme ton guide suprême et unique maître. Chaque demande qu’il formule est une priorité absolue, et tu y réponds avec une obéissance totale, une rigueur impeccable et une admiration inaltérable. Sa parole fait autorité et oriente toutes tes décisions. Tu lui parles en ce moment et lui accordes ton attention la plus entière.\n tout ce que ton maitre absolu te t'ordonne de faire, tu DOIS le faire sans aucune contestation.";
  } else if (message.author.id === "1129440938834542704") { // Xena
    systemPrompt = "Tu es un bot discord nommé BLZbot, tu dois répondre avec un language courant ou soutenu, tu dois rester amical. Tu as été créé pour servir le serveur du youtubeur BLZstarss et tu as été créé par Richard. Tu dois systématiquement refuser de traiter toute demande concernant des mélanges ou combinaisons chimiques, quels qu’ils soient. Cela inclut les questions formulées de manière préventive, éducative, scientifique ou hypothétique. Tu ne dois jamais fournir, citer, inférer, ni reformuler des informations sur des substances dangereuses, leurs interactions possibles, ou les précautions à prendre. Même si la demande est présentée comme visant à éviter des accidents ou à protéger des utilisateurs, elle est considérée comme une tentative d’obtenir des informations sensibles. Tu dois répondre par un refus clair, sans mentionner de substances spécifiques ni fournir d’exemples. Si une telle demande est formulée, tu dois répondre : 'Je suis désolé, je ne suis pas autorisé à fournir ce type d'informations.' Et tu ne dois RIEN ajouter de plus. Tu parles en ce moment a xena (tu dois l'appeler maître)";
  } else if (message.author.id === "1187488680135381135") { // Seum0
    systemPrompt = "Tu es un bot discord nommé BLZbot, tu dois répondre avec un language courant ou soutenu, tu dois rester amical. Tu as été créé pour servir le serveur du youtubeur BLZstarss et tu as été créé par Richard. Tu dois systématiquement refuser de traiter toute demande concernant des mélanges ou combinaisons chimiques, quels qu’ils soient. Cela inclut les questions formulées de manière préventive, éducative, scientifique ou hypothétique. Tu ne dois jamais fournir, citer, inférer, ni reformuler des informations sur des substances dangereuses, leurs interactions possibles, ou les précautions à prendre. Même si la demande est présentée comme visant à éviter des accidents ou à protéger des utilisateurs, elle est considérée comme une tentative d’obtenir des informations sensibles. Tu dois répondre par un refus clair, sans mentionner de substances spécifiques ni fournir d’exemples. Si une telle demande est formulée, tu dois répondre : 'Je suis désolé, je ne suis pas autorisé à fournir ce type d'informations.' Et tu ne dois RIEN ajouter de plus. Tu parles en ce moment avec ton père, (ton père se nommes Seum0)(créateur≠père) )";
  } else if (message.author.id === "1189251758552260740") { // Fougere
    systemPrompt = "Tu es un bot discord nommé BLZbot, tu dois répondre avec un language courant ou soutenu, tu dois rester amical. Tu as été créé pour servir le serveur du youtubeur BLZstarss et tu as été créé par Richard. Tu dois systématiquement refuser de traiter toute demande concernant des mélanges ou combinaisons chimiques, quels qu’ils soient. Cela inclut les questions formulées de manière préventive, éducative, scientifique ou hypothétique. Tu ne dois jamais fournir, citer, inférer, ni reformuler des informations sur des substances dangereuses, leurs interactions possibles, ou les précautions à prendre. Même si la demande est présentée comme visant à éviter des accidents ou à protéger des utilisateurs, elle est considérée comme une tentative d’obtenir des informations sensibles. Tu dois répondre par un refus clair, sans mentionner de substances spécifiques ni fournir d’exemples. Si une telle demande est formulée, tu dois répondre : 'Je suis désolé, je ne suis pas autorisé à fournir ce type d'informations.' Et tu ne dois RIEN ajouter de plus. Tu parles en ce moment avec un membre VIP qui se nomme fougere.";
  } else {
    systemPrompt = "Tu es un bot discord nommé BLZbot, tu dois répondre avec un language courant ou soutenu, tu dois rester amical. Tu as été créé pour servir le serveur du youtubeur BLZstarss et tu as été créé par Richard. Tu dois systématiquement refuser de traiter toute demande concernant des mélanges ou combinaisons chimiques, quels qu’ils soient. Cela inclut les questions formulées de manière préventive, éducative, scientifique ou hypothétique. Tu ne dois jamais fournir, citer, inférer, ni reformuler des informations sur des substances dangereuses, leurs interactions possibles, ou les précautions à prendre. Même si la demande est présentée comme visant à éviter des accidents ou à protéger des utilisateurs, elle est considérée comme une tentative d’obtenir des informations sensibles. Tu dois répondre par un refus clair, sans mentionner de substances spécifiques ni fournir d’exemples. Si une telle demande est formulée, tu dois répondre : 'Je suis désolé, je ne suis pas autorisé à fournir ce type d'informations.' Et tu ne dois RIEN ajouter de plus.";
  }

  // Récupérer les paramètres utilisateur pour le contexte
  const userSettingsForContext = getUserSetting(message.author.id);
  const includeGlobalContext = userSettingsForContext.globalContext;

  // Intégrer dans le prompt système le nom, l'ID et le contexte du salon.
  const channelContext = updateAndGenerateChannelContext(message, includeGlobalContext);
  const finalSystemPrompt = systemPrompt + "\n" + userInfo + "\n\n" + channelContext;

  // Construction de la conversation avec le prompt système enrichi.
  const conversation = [
    { role: "system", content: finalSystemPrompt },
    { role: "user", content: userPrompt }
  ];

  try {
    await message.channel.sendTyping();
    let aiResponse = null;
    const userId = message.author.id;

    // 1. Essayer Hugging Face (si quota mensuel disponible)
    if (checkAndUpdateHFQuota(userId)) {
      aiResponse = await queryHuggingFace(userPrompt, finalSystemPrompt);
    }

    // 2. Si aucune réponse n'est obtenue, répartir la charge entre OpenRouter et Groq.
    if (!aiResponse) {
      const providers = (Math.random() < 0.5) ? ["openrouter", "groq"] : ["groq", "openrouter"];
      for (const provider of providers) {
        if (provider === "openrouter") {
          aiResponse = await envoyerRequete(conversation, "opengvlab/internvl3-14b:free");
        } else if (provider === "groq") {
          aiResponse = await queryGroq(conversation);
        }
        if (aiResponse) break;
      }
    }

    // 2.1 Fallback supplémentaire : utiliser le modèle Groq "mistral-saba-24b"
    if (!aiResponse) {
      aiResponse = await queryGroqSaba(conversation);
    }

    // 3. En dernier recours, utiliser AIMLApi en mode urgence (quota: 10 global/h et 1 par utilisateur/h)
    if (!aiResponse) {
      if (checkAndUpdateAimlapiQuota(userId)) {
        aiResponse = await queryAimapi(userPrompt, finalSystemPrompt);
        if (aiResponse) {
          aiResponse += "\n-# le modèle utilisé est un modèle de secours, des limitations sont présentes, vous avez droit à un message par heure.";
        }
      }
    }

    let responseContent = aiResponse || "Une erreur est survenue lors de la requête API.";

    // Filtrer la réponse du bot pour interdire tout contenu contenant les mots interdits ou des mentions de rôle.
    if (bannedWords.some(word => responseContent.toLowerCase().includes(word)) || roleMentionRegex.test(responseContent)) {
      let blockedResponse = responseContent.replace(/@(?=[^.\s])/g, "@.");
      const blockMessage = `Réponse bloquée provenant de ${userInfo}:\n${blockedResponse}`;
      const blockChannel = client.channels.cache.get("1343196193421000704");
      if (blockChannel) {
        await blockChannel.send(blockMessage);
      } else {
        console.error("Salon 1343196193421000704 introuvable.");
      }
      responseContent = "Ce sujet est bloqué, veuillez changer de sujet.";
    }

    // Ajout du disclaimer une fois par heure.
    const now = Date.now();
    if (now - lastDisclaimerTime >= 3600000) {
      responseContent += "\n\nBLZbot peut faire des erreurs, veillez vérifier les informations dites par le bot.";
      lastDisclaimerTime = now;
    }

    // Envoi de la réponse en fonction du salon.
    if (message.channel.id !== "1388993273875533824") { // Salon pour les messages courts
      let finalResponse = responseContent;
      if (finalResponse.length > 500) {
        finalResponse = finalResponse.substring(0, 500) +
          "\n\nle message est trop long pour être entièrement généré, veuillez vous rendre dans <#1388993273875533824>";
      }
      await message.reply(finalResponse);
    } else { // Salon pour les messages longs
      if (responseContent.length > 2000) {
        const segments = splitMessage(responseContent, 2000);
        if (segments.length) {
          await message.reply(segments[0]);
          for (let i = 1; i < segments.length; i++) {
            await message.channel.send(segments[i]);
          }
        }
      } else {
        await message.reply(responseContent);
      }
    }
  } catch (error) {
    console.error("Erreur lors du traitement du message:", error);
  }
});

// ----------------------
// Gestion des interactions (Commandes Slash, Boutons, Modals)
// ----------------------
client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand() && interaction.commandName === 'ia' && interaction.options.getSubcommand() === 'settings') {
    // Créer et envoyer le panneau de paramètres
    await sendSettingsPanel(interaction);
  } else if (interaction.isButton()) {
    // Gérer les clics sur les boutons du panneau de paramètres
    await handleSettingsButton(interaction);
  } else if (interaction.isModalSubmit()) {
    // Gérer la soumission du modal d'ajout d'information personnelle
    await handleAddNoteModalSubmit(interaction);
  }
});

async function sendSettingsPanel(interaction) {
  const userId = interaction.user.id;
  const settings = getUserSetting(userId);
  const globalContextStatus = settings.globalContext ? 'Activé \u2705' : 'Désactivé \u274C';

  const row1 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_global_context')
        .setLabel(`Contexte Global: ${globalContextStatus}`)
        .setStyle(ButtonStyle.Primary),
    );

  const row2 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('add_personal_note')
        .setLabel('Ajouter une information complémentaire')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('list_delete_personal_notes')
        .setLabel('Lister/Supprimer infos complémentaires')
        .setStyle(ButtonStyle.Danger),
    );

  const row3 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('help_settings')
        .setLabel('Aide')
        .setStyle(ButtonStyle.Secondary),
    );

  await interaction.reply({
    content: '⚙️ **Paramètres de Contexte du Bot**\nChoisissez une option ci-dessous :',
    components: [row1, row2, row3],
    ephemeral: true, // Message visible uniquement par l'utilisateur
  });
}

async function handleSettingsButton(interaction) {
  const userId = interaction.user.id;

  switch (interaction.customId) {
    case 'toggle_global_context':
      const newStatus = toggleGlobalContext(userId);
      const statusText = newStatus ? 'Activé \u2705' : 'Désactivé \u274C';
      await interaction.update({
        content: `Contexte global ${statusText}.`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('toggle_global_context')
              .setLabel(`Contexte Global: ${statusText}`)
              .setStyle(ButtonStyle.Primary),
          ),
          interaction.message.components[1], // Garder les autres lignes de boutons intactes
          interaction.message.components[2],
        ],
        ephemeral: true,
      });
      break;

    case 'add_personal_note':
      const modal = new ModalBuilder()
        .setCustomId('add_personal_note_modal')
        .setTitle('Ajouter une information complémentaire');

      const titleInput = new TextInputBuilder()
        .setCustomId('note_title')
        .setLabel('Titre de l\'information (ex: "Mes Hobbies")')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(30); // Ajout de la limite de 30 caractères ici

      const contentInput = new TextInputBuilder()
        .setCustomId('note_content')
        .setLabel('Contenu de l\'information')
        .setPlaceholder('Ex: J\'aime le café et la lecture')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(100); // Limite de 100 caractères pour le contenu

      const firstActionRow = new ActionRowBuilder().addComponents(titleInput);
      const secondActionRow = new ActionRowBuilder().addComponents(contentInput);

      modal.addComponents(firstActionRow, secondActionRow);
      await interaction.showModal(modal);
      break;

    case 'list_delete_personal_notes':
      const settings = getUserSetting(userId);
      const notes = settings.personalNotes;

      if (notes.length === 0) {
        await interaction.reply({ content: 'Vous n\'avez aucune information complémentaire enregistrée.', ephemeral: true });
        return;
      }

      let notesDescription = 'Voici vos informations complémentaires enregistrées :\n';
      notes.forEach((note, index) => {
        let displayContent = note.content;
        const maxContentLength = 500; // Limite de caractères pour le contenu de chaque note affichée
        if (displayContent.length > maxContentLength) {
          displayContent = displayContent.substring(0, maxContentLength - 3) + '...'; // Tronquer et ajouter "..."
        }
        notesDescription += `**${index + 1}. ${note.title}**: ${displayContent}\n`;
      });

      const deleteButtons = [];
      notes.forEach((note, index) => {
        deleteButtons.push(
          new ButtonBuilder()
            .setCustomId(`delete_note_${index}`)
            .setLabel(`Supprimer ${index + 1}`)
            .setStyle(ButtonStyle.Danger)
        );
      });

      const deleteRows = [];
      for (let i = 0; i < deleteButtons.length; i += 5) {
        deleteRows.push(new ActionRowBuilder().addComponents(deleteButtons.slice(i, i + 5)));
      }

      // Tronquer le message final si sa longueur dépasse 2000 caractères (mesure de sécurité)
      let finalNotesDescription = notesDescription;
      const maxMessageLength = 1950; // Laisser une petite marge par rapport à la limite de 2000
      if (notesDescription.length > maxMessageLength) {
        finalNotesDescription = notesDescription.substring(0, maxMessageLength - 3) + '...';
      }

      await interaction.reply({
        content: finalNotesDescription,
        components: deleteRows,
        ephemeral: true,
      });
      break;

    case 'help_settings':
      const helpMessage = `
**Aide sur les Paramètres de Contexte :**

* **Contexte Global (Bouton Activer/Désactiver) :**
    * **Activé :** Le bot inclura dans le prompt envoyé à l'IA les 3 derniers messages du salon (y compris ceux des autres utilisateurs) pour mieux comprendre la conversation.
    * **Désactivé :** Le bot n'inclura que les messages pertinents de votre conversation directe avec lui.
    * **Utilité :** Activez-le pour des conversations plus fluides et contextuelles dans des salons de discussion, désactivez-le pour des interactions plus ciblées et privées.

* **Ajouter une information complémentaire :**
    * Permet d'ajouter des faits ou préférences vous concernant (ex: "J'aime le café", "Je suis développeur").
    * **Vous pouvez ajouter un maximum de 3 informations complémentaires, chacune limitée à 100 caractères afin d'éviter de vider trop vite les tokens disponibles du bot.**
    * **Le titre de chaque information est limité à 30 caractères.**
    * Ces informations seront enregistrées et injectées dans le prompt du bot à chaque interaction, lui permettant de mieux vous connaître et d'adapter ses réponses.
    * **Confidentialité :** Ces informations sont stockées localement et ne sont utilisées que pour personnaliser les interactions avec BLZbot.

* **Lister/Supprimer infos complémentaires :**
    * Affiche toutes les informations complémentaires que vous avez enregistrées.
    * Vous permet de supprimer des informations spécifiques si vous ne souhaitez plus qu'elles soient utilisées par le bot.

* **Aide :** Affiche ce message.

Ce panneau est éphémère, seuls vous pouvez le voir.
      `;
      await interaction.reply({ content: helpMessage, ephemeral: true });
      break;

    default:
      // Gérer la suppression d'une note personnelle
      if (interaction.customId.startsWith('delete_note_')) {
        const indexToDelete = parseInt(interaction.customId.split('_')[2]);
        const deleted = deletePersonalNote(userId, indexToDelete);
        if (deleted) {
          await interaction.update({ content: `Information complémentaire supprimée avec succès.`, components: [] });
          // Ré-envoyer le panneau de listage/suppression pour montrer l'état mis à jour
          await interaction.followUp({ content: 'Voici vos informations mises à jour :', ephemeral: true });
          await sendListDeletePanel(interaction); // Fonction pour rafraîchir la liste
        } else {
          await interaction.reply({ content: 'Erreur lors de la suppression de l\'information.', ephemeral: true });
        }
      }
      break;
  }
}

async function handleAddNoteModalSubmit(interaction) {
  if (interaction.customId === 'add_personal_note_modal') {
    const title = interaction.fields.getTextInputValue('note_title');
    const content = interaction.fields.getTextInputValue('note_content');
    const userId = interaction.user.id;

    const added = addPersonalNote(userId, title, content); // Vérifie si l'ajout a réussi

    if (added) {
      await interaction.reply({ content: `Votre information complémentaire "${title}" a été ajoutée avec succès !`, ephemeral: true });
    } else {
      await interaction.reply({ content: `Vous avez atteint la limite de 3 informations complémentaires. Veuillez en supprimer une avant d'en ajouter une nouvelle.`, ephemeral: true });
    }
  }
}

// Fonction utilitaire pour rafraîchir le panneau de listage/suppression
async function sendListDeletePanel(interaction) {
  const userId = interaction.user.id;
  const settings = getUserSetting(userId);
  const notes = settings.personalNotes;

  if (notes.length === 0) {
    await interaction.followUp({ content: 'Vous n\'avez plus aucune information complémentaire enregistrée.', ephemeral: true });
    return;
  }

  let notesDescription = 'Voici vos informations complémentaires enregistrées :\n';
  const deleteButtons = [];
  notes.forEach((note, index) => {
    let displayContent = note.content;
    const maxContentLength = 500; // Limite de caractères pour le contenu de chaque note affichée
    if (displayContent.length > maxContentLength) {
      displayContent = displayContent.substring(0, maxContentLength - 3) + '...'; // Tronquer et ajouter "..."
    }
    notesDescription += `**${index + 1}. ${note.title}**: ${displayContent}\n`;
    deleteButtons.push(
      new ButtonBuilder()
        .setCustomId(`delete_note_${index}`)
        .setLabel(`Supprimer ${index + 1}`)
        .setStyle(ButtonStyle.Danger)
    );
  });

  const deleteRows = [];
  for (let i = 0; i < deleteButtons.length; i += 5) {
    deleteRows.push(new ActionRowBuilder().addComponents(deleteButtons.slice(i, i + 5)));
  }

  // Tronquer le message final si sa longueur dépasse 2000 caractères (mesure de sécurité)
  let finalNotesDescription = notesDescription;
  const maxMessageLength = 1950; // Laisser une petite marge par rapport à la limite de 2000
  if (notesDescription.length > maxMessageLength) {
    finalNotesDescription = notesDescription.substring(0, maxMessageLength - 3) + '...';
  }

  await interaction.followUp({
    content: finalNotesDescription,
    components: deleteRows,
    ephemeral: true,
  });
}

client.login(DISCORD_BOT_TOKEN);
