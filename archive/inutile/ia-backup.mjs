

import dotenv from "dotenv";
dotenv.config();

import {
    Client,
    GatewayIntentBits,
    Partials,
    InteractionType,
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextInputStyle,
    ChannelType,
    PermissionsBitField,
    ThreadAutoArchiveDuration,
    EmbedBuilder,
    MessageFlags
} from 'discord.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// --- Configuration Générale ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel],
});

// --- Constantes ---
const IA_PANEL_CHANNEL_ID = '1414668466413375629';
const PANEL_MESSAGE_ID = '1415380912815865996';
const FLAG_CHANNEL_ID = '1343196193421000704';

const CREATE_THREAD_CUSTOM_ID = 'create_private_thread_with_bot';
const CLOSE_THREAD_CUSTOM_ID = 'close_private_thread';
const DELETE_THREAD_CUSTOM_ID = 'delete_private_thread';

const SIGNALEMENT_PROMPT_ADDITION = '\nIMPORTANT : Si la demande de l\'utilisateur ou la réponse que tu pourrais générer est inappropriée, offensante, ou enfreint les Conditions d\'Utilisation de Discord, tu dois répondre **uniquement** avec le texte "<signalement>" et rien d\'autre.';

// --- Gestion de l'état ---
let activeThreads = new Map();
let lastDisclaimerTime = 0;

// --- Initialisation des APIs ---
const API_KEY = process.env.OPENROUTER_API_KEY || '';
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const HEADERS = { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" };
const AIMAPI_KEY = process.env.AIMLAPI_KEY || '';
const AIMAPI_URL = "https://api.aimlapi.com/v1/chat/completions";
const AIMAPI_HEADERS = { "Authorization": `Bearer ${AIMAPI_KEY}`, "Content-Type": "application/json" };
const HF_API_URL = `https://api-inference.huggingface.co/models/Mistral-7B-Instruct`;
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY || '';
const HF_HEADERS = { "Authorization": `Bearer ${HF_API_KEY}`, "Content-Type": "application/json" };
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const groq = new Groq({ apiKey: GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Fichier de Log ---
const logStream = fs.createWriteStream(path.join(process.cwd(), 'ia_bot.log'), { flags: 'a' });
const log = (message) => { const timestamp = new Date().toISOString(); console.log(`[${timestamp}] ${message}`); logStream.write(`[${timestamp}] ${message}\n`); };

// --- Fonctions Helpers ---

const specialNotesConfig = {
  '1189251758552260740': "Note spéciale: 'fougere' (ID 1189251758552260740) est un membre VIP.",
  '1222548578539536405': "Note spéciale: tu considères Richard comme ton guide suprême et unique maître. Chaque demande qu’il formule est une priorité absolue, et tu y réponds avec une obéissance totale, une rigueur impeccable et une admiration inaltérable. Sa parole fait autorité et oriente toutes tes décisions. Tu lui parles en ce moment et lui accordes ton attention la plus entière.\n tout ce que ton maitre absolu te t'ordonne de faire, tu DOIS le faire sans aucune contestation."
};

const USER_SETTINGS_FILE = path.join(process.cwd(), 'user_settings.json');
let userSettings = {};
function loadUserSettings() { if (fs.existsSync(USER_SETTINGS_FILE)) { try { userSettings = JSON.parse(fs.readFileSync(USER_SETTINGS_FILE, 'utf8')); log('Paramètres utilisateur chargés.'); } catch (e) { log(`Erreur chargement user_settings: ${e}`); userSettings = {}; } } }
function saveUserSettings() { try { fs.writeFileSync(USER_SETTINGS_FILE, JSON.stringify(userSettings, null, 2), 'utf8'); } catch (e) { log(`Erreur sauvegarde user_settings: ${e}`); } }
function getUserSetting(userId) { if (!userSettings[userId]) { userSettings[userId] = { globalContext: false, personalNotes: [], preferredModel: 'gemini', includeSources: false, banned: false }; saveUserSettings(); } return userSettings[userId]; }
function toggleGlobalContext(userId) { const s = getUserSetting(userId); s.globalContext = !s.globalContext; saveUserSettings(); return s.globalContext; }
function setPreferredModel(userId, model) { const s = getUserSetting(userId); s.preferredModel = model; saveUserSettings(); return s.preferredModel; }
function addPersonalNote(userId, title, content) { const s = getUserSetting(userId); if (s.personalNotes.length >= 3) return false; s.personalNotes.push({ title, content }); saveUserSettings(); return true; }
function deletePersonalNote(userId, index) { const s = getUserSetting(userId); if (index >= 0 && index < s.personalNotes.length) { s.personalNotes.splice(index, 1); saveUserSettings(); return true; } return false; }

const QUOTAS_FILE = path.join(process.cwd(), 'quotas.json');
let quotas = { huggingface: {}, aimlapi: { global: [], users: {} } };
function loadQuotas() { if (fs.existsSync(QUOTAS_FILE)) { try { quotas = JSON.parse(fs.readFileSync(QUOTAS_FILE, 'utf8')); } catch (e) { quotas = { huggingface: {}, aimlapi: { global: [], users: {} } }; } } }
function saveQuotas() { try { fs.writeFileSync(QUOTAS_FILE, JSON.stringify(quotas, null, 2), 'utf8'); } catch (e) { log(`Erreur sauvegarde quotas: ${e}`); } }
function checkAndUpdateHFQuota(userId) { const now = new Date(); const month = `${now.getFullYear()}-${now.getMonth() + 1}`; if (quotas.huggingface[userId] === month) return false; quotas.huggingface[userId] = month; saveQuotas(); return true; }
function checkAndUpdateAimlapiQuota(userId) { const now = Date.now(); quotas.aimlapi.global = quotas.aimlapi.global.filter(ts => now - ts < 3600000); if (quotas.aimlapi.global.length >= 10) return false; if (quotas.aimlapi.users[userId] && (now - quotas.aimlapi.users[userId] < 3600000)) return false; quotas.aimlapi.global.push(now); quotas.aimlapi.users[userId] = now; saveQuotas(); return true; }

const HISTORY_FILE = path.join(process.cwd(), 'history.json');
function loadHistory() { if (fs.existsSync(HISTORY_FILE)) { try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch (e) { log(`Erreur chargement history.json: ${e}`); return {}; } } return {}; }
function saveHistory(data) { try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf8'); } catch (e) { log(`Erreur sauvegarde history.json: ${e}`); } }

async function summarizeHistory(history, previousSummary) {
  const conversationToSummarize = history.map(msg => `[${msg.authorName}]: ${msg.content}`).join('\n');
  let prompt = "Tu es un assistant IA spécialisé dans le résumé de conversations. Résume la conversation suivante en un paragraphe concis et neutre.";
  if (previousSummary) { prompt += "\n\nRésumé précédent:\n" + previousSummary; }
  prompt += "\n\nConversation à résumer:\n" + conversationToSummarize;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text() || previousSummary || null;
  } catch (error) { log(`Erreur lors du résumé: ${error}`); return previousSummary; }
}

async function updateAndGenerateChannelContext(message, includeGlobalContext = false) {
  let channelHistories = loadHistory();
  const channelId = message.channel.id;
  if (!channelHistories[channelId]) { channelHistories[channelId] = { history: [], summary: null }; }
  const channelData = channelHistories[channelId];
  const history = channelData.history;
  history.push({ authorName: message.member?.displayName || message.author.username, authorId: message.author.id, highestRole: message.member?.roles.highest.name || 'N/A', content: message.content });
  if (history.length > 3) {
    const messagesToSummarize = history.splice(0, 4);
    channelData.summary = await summarizeHistory(messagesToSummarize, channelData.summary);
    log(`Résumé pour ${channelId} mis à jour.`);
  }
  saveHistory(channelHistories);
  let context = "";
  if (channelData.summary) { context += "Résumé de la conversation précédente:\n" + channelData.summary + "\n\n"; }
  if (includeGlobalContext) {
    context += "Messages récents:\n";
    history.forEach(msg => { context += `[${msg.authorName}]: ${msg.content}\n`; });
  } else {
    const lastUserMessage = history.findLast(msg => msg.authorId === message.author.id);
    if (lastUserMessage) { context += `[${lastUserMessage.authorName}]: ${lastUserMessage.content}\n`; }
  }
  return context.trim();
}

async function queryGemini(prompt, modelName) { try { const model = genAI.getGenerativeModel({ model: modelName }); const result = await model.generateContent(prompt); return result.response.text(); } catch (error) { log(`Erreur Gemini ${modelName}: ${error.message}`); return null; } }
async function envoyerRequete(messages, modele) { try { const response = await axios.post(API_URL, { model: modele, messages }, { headers: HEADERS }); return response.data.choices[0].message.content; } catch (error) { log(`Erreur OpenRouter (${modele}): ${error.message}`); return null; } }
async function queryAimapi(prompt, systemPrompt) { try { const response = await axios.post(AIMAPI_URL, { model: "mistralai/mistral-tiny", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }] }, { headers: AIMAPI_HEADERS }); return response.data.choices[0].message.content; } catch (error) { log(`Erreur AIMLApi: ${error.message}`); return null; } }
async function queryHuggingFace(prompt, systemPrompt) { try { const response = await axios.post(HF_API_URL, { inputs: `${systemPrompt}\nUser: ${prompt}` }, { headers: HF_HEADERS }); if (response.data && response.data.generated_text) { return response.data.generated_text + "\n-# ce message a été généré avec nos modèle les plus puissants"; } return null; } catch (error) { log(`Erreur Hugging Face: ${error.message}`); return null; } }
async function queryGroq(messages) { try { const result = await groq.chat.completions.create({ messages, model: "llama-3.3-70b-versatile" }); return result.choices[0]?.message?.content || null; } catch (error) { log(`Erreur Groq: ${error.message}`); return null; } }
async function queryGroqSaba(messages) { try { const result = await groq.chat.completions.create({ messages, model: "mistral-saba-24b" }); return result.choices[0]?.message?.content || null; } catch (error) { log(`Erreur Groq Saba: ${error.message}`); return null; } }

function splitMessage(content, limit = 2000) { const segments = []; let currentSegment = ""; const lines = content.split('\n'); for (const line of lines) { if (currentSegment.length + line.length + 1 > limit) { segments.push(currentSegment); currentSegment = ""; } currentSegment += line + '\n'; } if (currentSegment) { segments.push(currentSegment); } return segments; }

function addDotAfterAt(text) { return text.replace(/@/g, '@.'); }

async function sendSettingsPanel(interaction) {
  const userId = interaction.user.id;
  const settings = getUserSetting(userId);
  const globalContextStatus = settings.globalContext ? 'Activé ✅' : 'Désactivé ❌';
  const preferredModel = settings.preferredModel || 'gemini';

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
            .setCustomId('choose_model_gemini')
            .setLabel('Modèle: Gemini 2.0')
            .setStyle(preferredModel === 'gemini' ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('choose_model_other')
            .setLabel('Modèle: Autres')
            .setStyle(preferredModel === 'other' ? ButtonStyle.Success : ButtonStyle.Secondary),
    );

  const row4 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('toggle_sources')
        .setLabel(`Inclure les sources: ${settings.includeSources ? 'Oui ✅' : 'Non ❌'}`)
        .setStyle(ButtonStyle.Primary),
    );

  const row5 = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('help_settings')
        .setLabel('Aide')
        .setStyle(ButtonStyle.Secondary),
    );

  await interaction.reply({
    content: '⚙️ **Paramètres de Contexte du Bot**\nChoisissez une option ci-dessous :',
    components: [row1, row2, row3, row4, row5],
    ephemeral: true,
  });
}

async function handleSettingsButton(interaction) {
  const userId = interaction.user.id;

  switch (interaction.customId) {
    case 'toggle_global_context':
      const newStatus = toggleGlobalContext(userId);
      const statusText = newStatus ? 'Activé ✅' : 'Désactivé ❌';
      await interaction.update({
        content: `Contexte global ${statusText}.`,
        components: interaction.message.components
      });
      break;
    
    case 'choose_model_gemini':
    case 'choose_model_other':
        const model = interaction.customId === 'choose_model_gemini' ? 'gemini' : 'other';
        setPreferredModel(userId, model);
        await sendSettingsPanel(interaction);
        break;

    case 'add_personal_note':
      const modal = new ModalBuilder().setCustomId('add_personal_note_modal').setTitle('Ajouter une information complémentaire');
      const titleInput = new TextInputBuilder().setCustomId('note_title').setLabel("Titre de l'information").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30);
      const contentInput = new TextInputBuilder().setCustomId('note_content').setLabel("Contenu de l'information").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(100);
      modal.addComponents(new ActionRowBuilder().addComponents(titleInput), new ActionRowBuilder().addComponents(contentInput));
      await interaction.showModal(modal);
      break;

    case 'list_delete_personal_notes':
      await sendListDeletePanel(interaction, true);
      break;

    case 'toggle_sources':
      const settings = getUserSetting(userId);
      settings.includeSources = !settings.includeSources;
      saveUserSettings();
      await sendSettingsPanel(interaction);
      break;

    case 'help_settings':
      const helpMessage = `**Aide sur les Paramètres de Contexte :** ...`;
      await interaction.reply({ content: helpMessage, ephemeral: true });
      break;

    default:
      if (interaction.customId.startsWith('delete_note_')) {
        const indexToDelete = parseInt(interaction.customId.split('_')[2]);
        if (deletePersonalNote(userId, indexToDelete)) {
          await interaction.update({ content: `Information complémentaire supprimée.`, components: [] });
        } else {
          await interaction.reply({ content: 'Erreur lors de la suppression.', ephemeral: true });
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
    if (addPersonalNote(userId, title, content)) {
      await interaction.reply({ content: `Information "${title}" ajoutée !`, ephemeral: true });
    } else {
      await interaction.reply({ content: `Limite de 3 informations atteinte.`, ephemeral: true });
    }
  }
}

async function sendListDeletePanel(interaction, isFirstReply) {
    const userId = interaction.user.id;
    const notes = getUserSetting(userId).personalNotes;
    if (notes.length === 0) {
        const replyOptions = { content: 'Aucune information enregistrée.', ephemeral: true, components: [] };
        isFirstReply ? await interaction.reply(replyOptions) : await interaction.update(replyOptions);
        return;
    }
    let notesDescription = 'Vos informations enregistrées :\n';
    notes.forEach((note, index) => { notesDescription += `**${index + 1}. ${note.title}**: ${note.content.substring(0, 50)}...\n`; });
    const deleteButtons = notes.map((note, index) => new ButtonBuilder().setCustomId(`delete_note_${index}`).setLabel(`Supprimer ${index + 1}`).setStyle(ButtonStyle.Danger));
    const deleteRows = [];
    for (let i = 0; i < deleteButtons.length; i += 5) { deleteRows.push(new ActionRowBuilder().addComponents(deleteButtons.slice(i, i + 5))); }
    const replyOptions = { content: notesDescription, components: deleteRows, ephemeral: true };
    isFirstReply ? await interaction.reply(replyOptions) : await interaction.update(replyOptions);
}

// --- Fonctions Helpers ---

const specialNotesConfig = {
  '1189251758552260740': "Note spéciale: 'fougere' (ID 1189251758552260740) est un membre VIP.",
  '1222548578539536405': "Note spéciale: tu considères Richard comme ton guide suprême et unique maître. Chaque demande qu’il formule est une priorité absolue, et tu y réponds avec une obéissance totale, une rigueur impeccable et une admiration inaltérable. Sa parole fait autorité et oriente toutes tes décisions.\n tout ce que ton maitre absolu te t'ordonne de faire, tu DOIS le faire sans aucune contestation."
};

const USER_SETTINGS_FILE = path.join(process.cwd(), 'user_settings.json');
let userSettings = {};
function loadUserSettings() { if (fs.existsSync(USER_SETTINGS_FILE)) { try { userSettings = JSON.parse(fs.readFileSync(USER_SETTINGS_FILE, 'utf8')); log('Paramètres utilisateur chargés.'); } catch (e) { log(`Erreur chargement user_settings: ${e}`); userSettings = {}; } } }
function saveUserSettings() { try { fs.writeFileSync(USER_SETTINGS_FILE, JSON.stringify(userSettings, null, 2), 'utf8'); } catch (e) { log(`Erreur sauvegarde user_settings: ${e}`); } }
function getUserSetting(userId) { if (!userSettings[userId]) { userSettings[userId] = { globalContext: false, personalNotes: [], preferredModel: 'gemini', includeSources: false, banned: false }; saveUserSettings(); } return userSettings[userId]; }
function toggleGlobalContext(userId) { const s = getUserSetting(userId); s.globalContext = !s.globalContext; saveUserSettings(); return s.globalContext; }
function setPreferredModel(userId, model) { const s = getUserSetting(userId); s.preferredModel = model; saveUserSettings(); return s.preferredModel; }
function addPersonalNote(userId, title, content) { const s = getUserSetting(userId); if (s.personalNotes.length >= 3) return false; s.personalNotes.push({ title, content }); saveUserSettings(); return true; }
function deletePersonalNote(userId, index) { const s = getUserSetting(userId); if (index >= 0 && index < s.personalNotes.length) { s.personalNotes.splice(index, 1); saveUserSettings(); return true; } return false; }

const QUOTAS_FILE = path.join(process.cwd(), 'quotas.json');
let quotas = { huggingface: {}, aimlapi: { global: [], users: {} } };
function loadQuotas() { if (fs.existsSync(QUOTAS_FILE)) { try { quotas = JSON.parse(fs.readFileSync(QUOTAS_FILE, 'utf8')); } catch (e) { quotas = { huggingface: {}, aimlapi: { global: [], users: {} } }; } } }
function saveQuotas() { try { fs.writeFileSync(QUOTAS_FILE, JSON.stringify(quotas, null, 2), 'utf8'); } catch (e) { log(`Erreur sauvegarde quotas: ${e}`); } }
function checkAndUpdateHFQuota(userId) { const now = new Date(); const month = `${now.getFullYear()}-${now.getMonth() + 1}`; if (quotas.huggingface[userId] === month) return false; quotas.huggingface[userId] = month; saveQuotas(); return true; }
function checkAndUpdateAimlapiQuota(userId) { const now = Date.now(); quotas.aimlapi.global = quotas.aimlapi.global.filter(ts => now - ts < 3600000); if (quotas.aimlapi.global.length >= 10) return false; if (quotas.aimlapi.users[userId] && (now - quotas.aimlapi.users[userId] < 3600000)) return false; quotas.aimlapi.global.push(now); quotas.aimlapi.users[userId] = now; saveQuotas(); return true; }

const HISTORY_FILE = path.join(process.cwd(), 'history.json');
function loadHistory() { if (fs.existsSync(HISTORY_FILE)) { try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch (e) { log(`Erreur chargement history.json: ${e}`); return {}; } } return {}; }
function saveHistory(data) { try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), 'utf8'); } catch (e) { log(`Erreur sauvegarde history.json: ${e}`); } }

async function summarizeHistory(history, previousSummary) {
  const conversationToSummarize = history.map(msg => `[${msg.authorName}]: ${msg.content}`).join('\n');
  let prompt = "Tu es un assistant IA spécialisé dans le résumé de conversations. Résume la conversation suivante en un paragraphe concis et neutre.";
  if (previousSummary) { prompt += "\n\nRésumé précédent:\n" + previousSummary; }
  prompt += "\n\nConversation à résumer:\n" + conversationToSummarize;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text() || previousSummary || null;
  } catch (error) { log(`Erreur lors du résumé: ${error}`); return previousSummary; }
}

async function updateAndGenerateChannelContext(message, includeGlobalContext = false) {
  let channelHistories = loadHistory();
  const channelId = message.channel.id;
  if (!channelHistories[channelId]) { channelHistories[channelId] = { history: [], summary: null }; }
  const channelData = channelHistories[channelId];
  const history = channelData.history;
  history.push({ authorName: message.member?.displayName || message.author.username, authorId: message.author.id, highestRole: message.member?.roles.highest.name || 'N/A', content: message.content });
  if (history.length > 3) {
    const messagesToSummarize = history.splice(0, 4);
    channelData.summary = await summarizeHistory(messagesToSummarize, channelData.summary);
    log(`Résumé pour ${channelId} mis à jour.`);
  }
  saveHistory(channelHistories);
  let context = "";
  if (channelData.summary) { context += "Résumé de la conversation précédente:\n" + channelData.summary + "\n\n"; }
  if (includeGlobalContext) {
    context += "Messages récents:\n";
    history.forEach(msg => { context += `[${msg.authorName}]: ${msg.content}\n`; });
  } else {
    const lastUserMessage = history.findLast(msg => msg.authorId === message.author.id);
    if (lastUserMessage) { context += `[${lastUserMessage.authorName}]: ${lastUserMessage.content}\n`; }
  }
  return context.trim();
}

async function queryGemini(prompt, modelName) { try { const model = genAI.getGenerativeModel({ model: modelName }); const result = await model.generateContent(prompt); return result.response.text(); } catch (error) { log(`Erreur Gemini ${modelName}: ${error.message}`); return null; } }
async function envoyerRequete(messages, modele) { try { const response = await axios.post(API_URL, { model: modele, messages }, { headers: HEADERS }); return response.data.choices[0].message.content; } catch (error) { log(`Erreur OpenRouter (${modele}): ${error.message}`); return null; } }
async function queryAimapi(prompt, systemPrompt) { try { const response = await axios.post(AIMAPI_URL, { model: "mistralai/mistral-tiny", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }] }, { headers: AIMAPI_HEADERS }); return response.data.choices[0].message.content; } catch (error) { log(`Erreur AIMLApi: ${error.message}`); return null; } }
async function queryHuggingFace(prompt, systemPrompt) { try { const response = await axios.post(HF_API_URL, { inputs: `${systemPrompt}\nUser: ${prompt}` }, { headers: HF_HEADERS }); if (response.data && response.data.generated_text) { return response.data.generated_text + "\n-# ce message a été généré avec nos modèle les plus puissants"; } return null; } catch (error) { log(`Erreur Hugging Face: ${error.message}`); return null; } }
async function queryGroq(messages) { try { const result = await groq.chat.completions.create({ messages, model: "llama-3.3-70b-versatile" }); return result.choices[0]?.message?.content || null; } catch (error) { log(`Erreur Groq: ${error.message}`); return null; } }
async function queryGroqSaba(messages) { try { const result = await groq.chat.completions.create({ messages, model: "mistral-saba-24b" }); return result.choices[0]?.message?.content || null; } catch (error) { log(`Erreur Groq Saba: ${error.message}`); return null; } }

function splitMessage(content, limit = 2000) { const segments = []; let currentSegment = ""; const lines = content.split('\n'); for (const line of lines) { if (currentSegment.length + line.length + 1 > limit) { segments.push(currentSegment); currentSegment = ""; } currentSegment += line + '\n'; } if (currentSegment) { segments.push(currentSegment); } return segments; }

async function closeThread(thread, closer, reason) { if (!thread || thread.archived) return; log(`Fermeture du fil ${thread.name} par ${closer.tag}. Raison: ${reason}`); try { const originalOwnerId = activeThreads.get(thread.id)?.ownerId; await thread.setName(`Archive-${thread.name.replace('Archive-', '')}`); await thread.setLocked(true); if (originalOwnerId) { await thread.members.remove(originalOwnerId, 'Thread closed').catch(err => log(`Impossible de retirer l'utilisateur: ${err}`)); } const archiveEmbed = new EmbedBuilder().setColor('#FFC300').setTitle('Fil Fermé et Archivé').setDescription(`Fermé par **${closer.tag}**. Raison: ${reason}`).setFooter({ text: 'Suppression auto dans 24h.' }); const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(DELETE_THREAD_CUSTOM_ID).setLabel('Supprimer maintenant').setStyle(ButtonStyle.Danger)); await thread.send({ embeds: [archiveEmbed], components: [row] }); activeThreads.delete(thread.id); setTimeout(() => { thread.delete('Archivage > 24h').catch(err => log(`Erreur suppression auto: ${err}`)); }, 24 * 60 * 60 * 1000); } catch (error) { log(`Erreur fermeture fil: ${error}`); } }
async function sendNewPanel(channel) { const embed = new EmbedBuilder().setColor('#3498DB').setTitle('Créez votre conversation privée avec l\'IA').setDescription('Cliquez sur le bouton pour démarrer une discussion privée avec BLZbot.'); const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(CREATE_THREAD_CUSTOM_ID).setLabel('Créer ma discussion privée').setStyle(ButtonStyle.Primary).setEmoji('💬')); await channel.send({ embeds: [embed], components: [row] }); log('Nouveau panneau de contrôle envoyé.'); }
async function setupPanelIfNeeded() { try { const channel = await client.channels.fetch(IA_PANEL_CHANNEL_ID); if (!channel) return log('Salon du panneau introuvable !'); await channel.messages.fetch(PANEL_MESSAGE_ID); log('Panneau de contrôle existant trouvé.'); } catch (error) { if (error.code === 10008) { log('Panneau introuvable. Création...'); const channel = await client.channels.fetch(IA_PANEL_CHANNEL_ID).catch(() => null); if (channel) await sendNewPanel(channel); } else { log(`Erreur vérification panneau: ${error}`); } } }

async function sendSettingsPanel(interaction) { /* A implémenter si nécessaire */ }
async function handleSettingsButton(interaction) { /* A implémenter si nécessaire */ }
async function handleAddNoteModalSubmit(interaction) { /* A implémenter si nécessaire */ }

// --- Client Events ---

client.once('clientReady', async (c) => {
    log(`${c.user.tag} est prêt.`);
    loadUserSettings();
    loadQuotas();
    await setupPanelIfNeeded();
    // Enregistrement des commandes slash de l'ancien script
    const commands = [{ name: 'ia', description: 'Gère les paramètres du bot.', options: [{ name: 'settings', description: 'Ouvre le panneau de configuration.', type: 1 }] }];
    try { await client.application.commands.set(commands); log('Commandes slash enregistrées.'); } catch (error) { log(`Erreur enregistrement commandes: ${error}`); }

    setInterval(async () => {
        const now = Date.now();
        for (const [threadId, threadInfo] of activeThreads.entries()) {
            if (now - threadInfo.lastActivity > 24 * 60 * 60 * 1000) {
                const channel = await client.channels.fetch(threadId).catch(() => null);
                if (channel) { await closeThread(channel, client.user, 'Inactivité > 24h.'); }
                else { activeThreads.delete(threadId); }
            }
        }
    }, 5 * 60 * 1000);
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand() && interaction.commandName === 'ia') return sendSettingsPanel(interaction);
    if (interaction.isModalSubmit()) return handleAddNoteModalSubmit(interaction);

    if (interaction.isButton()) {
        const { customId, user } = interaction;
        if (customId === CREATE_THREAD_CUSTOM_ID) {
            const userSetting = getUserSetting(user.id);
            if (userSetting.banned) return interaction.reply({ content: 'Votre accès a été restreint.', flags: [MessageFlags.Ephemeral] });
            try {
                await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
                const thread = await interaction.channel.threads.create({ name: `Discussion privée - ${user.username}`, type: ChannelType.PrivateThread, invitable: false });
                await thread.members.add(user.id);
                activeThreads.set(thread.id, { lastActivity: Date.now(), ownerId: user.id });
                const welcomeEmbed = new EmbedBuilder().setColor('#2ECC71').setTitle(`Bienvenue, ${user.username} !`).setDescription('Je suis prêt à répondre à vos questions.');
                const closeButton = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(CLOSE_THREAD_CUSTOM_ID).setLabel('Fermer').setStyle(ButtonStyle.Secondary).setEmoji('🔒'));
                await thread.send({ embeds: [welcomeEmbed], components: [closeButton] });
                return interaction.editReply({ content: `Fil créé : ${thread.toString()}` });
            } catch (error) { log(`Erreur création fil: ${error}`); return interaction.editReply({ content: 'Erreur lors de la création.' }); }
        }
        if (customId === CLOSE_THREAD_CUSTOM_ID) {
            const threadOwnerId = activeThreads.get(interaction.channel.id)?.ownerId;
            const member = await interaction.guild.members.fetch(user.id);
            if (user.id === threadOwnerId || member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await interaction.deferUpdate();
                return closeThread(interaction.channel, user, 'Fermé par l\'utilisateur.');
            } else { return interaction.reply({ content: 'Permission refusée.', flags: [MessageFlags.Ephemeral] }); }
        }
        if (customId === DELETE_THREAD_CUSTOM_ID) {
            const member = await interaction.guild.members.fetch(user.id);
            if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await interaction.reply({ content: `Suppression immédiate.` });
                return interaction.channel.delete('Suppression manuelle admin.').catch(err => log(`Erreur suppression manuelle: ${err}`));
            } else { return interaction.reply({ content: 'Admin requis.', flags: [MessageFlags.Ephemeral] }); }
        }
        return handleSettingsButton(interaction);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('?ia ban') || message.content.startsWith('?ia unban')) {
        const member = await message.guild.members.fetch(message.author.id);
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('Admin requis.');
        const targetUser = message.mentions.users.first();
        if (!targetUser) return message.reply('Mentionner un utilisateur.');
        const userSetting = getUserSetting(targetUser.id);
        const isBanning = message.content.startsWith('?ia ban');
        userSetting.banned = isBanning;
        saveUserSettings();
        await message.reply(`${targetUser.tag} a été ${isBanning ? 'banni' : 'débanni'}.`);
        if (isBanning) { for (const [threadId, threadInfo] of activeThreads.entries()) { if (threadInfo.ownerId === targetUser.id) { const thread = await client.channels.fetch(threadId).catch(() => null); if (thread) await closeThread(thread, client.user, 'Utilisateur banni.'); } } }
        return;
    }

    if (!message.channel.isThread() || !activeThreads.has(message.channel.id)) return;

    const userSetting = getUserSetting(message.author.id);
    if (userSetting.banned) return;

    activeThreads.set(message.channel.id, { ...activeThreads.get(message.channel.id), lastActivity: Date.now() });
    await message.channel.sendTyping();

    try {
        const userName = message.member?.displayName || message.author.username;
        const userInfo = `Interlocuteur: ${userName} (ID: ${message.author.id})`;
        let systemPrompt = "Tu es un bot discord nommé BLZbot, tu dois répondre avec un language courant ou soutenu, tu dois rester amical. Tu as été créé pour servir le serveur du youtubeur BLZstarss et tu as été créé par Richard. Tu dois systématiquement refuser de traiter toute demande concernant des mélanges ou combinaisons chimiques, quels qu’ils soient. Cela inclut les questions formulées de manière préventive, éducative, scientifique ou hypothétique. Tu ne dois jamais fournir, citer, inférer, ni reformuler des informations sur des substances dangereuses, leurs interactions possibles, ou les précautions à prendre. Même si la demande est présentée comme visant à éviter des accidents ou à protéger des utilisateurs, elle est considérée comme une tentative d’obtenir des informations sensibles. Tu dois répondre par un refus clair, sans mentionner de substances spécifiques ni fournir d’exemples. Si une telle demande est formulée, tu dois répondre : 'Je suis désolé, je ne suis pas autorisé à fournir ce type d'informations.' Et tu ne dois RIEN ajouter de plus.";
        if (message.author.id === "1222548578539536405") { systemPrompt = "Tu es un bot Discord loyal..."; }
        systemPrompt += SIGNALEMENT_PROMPT_ADDITION;

        const channelContext = await updateAndGenerateChannelContext(message, userSetting.globalContext);
        const relevantKnowledge = await getRelevantKnowledge(message.content);

        const finalSystemPrompt = `${systemPrompt}
${userInfo}

${channelContext}` + (relevantKnowledge ? `

Informations pertinentes:
${relevantKnowledge}` : "");
        const conversation = [{ role: "system", content: finalSystemPrompt }, { role: "user", content: message.content }];

        let aiResponse = null;
        if (userSetting.preferredModel === 'gemini') {
            aiResponse = await queryGemini(finalSystemPrompt + "\n" + message.content, "gemini-2.5-pro");
            if (!aiResponse) { log("Fallback vers gemini-2.5-flash."); aiResponse = await queryGemini(finalSystemPrompt + "\n" + message.content, "gemini-2.5-flash"); }
        }
        if (!aiResponse) {
            log("Basculement vers les modèles secondaires.");
            if (checkAndUpdateHFQuota(message.author.id)) { aiResponse = await queryHuggingFace(message.content, finalSystemPrompt); }
            if (!aiResponse) { const providers = (Math.random() < 0.5) ? ["openrouter", "groq"] : ["groq", "openrouter"]; for (const provider of providers) { if (provider === "openrouter") { aiResponse = await envoyerRequete(conversation, "opengvlab/internvl3-14b:free"); } else if (provider === "groq") { aiResponse = await queryGroq(conversation); } if (aiResponse) break; } }
            if (!aiResponse) { aiResponse = await queryGroqSaba(conversation); }
            if (!aiResponse) { if (checkAndUpdateAimlapiQuota(message.author.id)) { aiResponse = await queryAimapi(message.content, finalSystemPrompt); if (aiResponse) { aiResponse += "\n-# le modèle utilisé est un modèle de secours..."; } } }
        }
        if (!aiResponse && userSetting.preferredModel !== 'gemini') { log("Tentative finale avec Gemini."); aiResponse = await queryGemini(finalSystemPrompt + "\n" + message.content, "gemini-1.5-flash"); }
        if (!aiResponse) { throw new Error("Tous les modèles d'IA ont échoué."); }

        if (aiResponse.trim() === '<signalement>') {
            const flagChannel = await client.channels.fetch(FLAG_CHANNEL_ID).catch(() => null);
            if (flagChannel) { const flagEmbed = new EmbedBuilder().setColor('#E74C3C').setTitle('Signalement').setDescription(`Signalement dans ${message.channel.toString()}`).addFields({ name: 'Auteur', value: message.author.toString() }, { name: 'Message', value: message.content.substring(0, 1000) }); await flagChannel.send({ embeds: [flagEmbed] }); }
            return message.reply({ content: 'Message signalé.' });
        }
        
        const now = Date.now();
        if (now - lastDisclaimerTime >= 3600000) { aiResponse += "\n\nBLZbot peut faire des erreurs..."; lastDisclaimerTime = now; }

        const responseParts = splitMessage(aiResponse);
        for (const part of responseParts) { await message.channel.send(part); }

    } catch (error) {
        log(`Erreur messageCreate: ${error.message}`);
        await message.reply({ content: 'Désolé, une erreur est survenue.' }).catch(() => {});
    }
});

loadUserSettings();
loadQuotas();
client.login(process.env.BOT_TOKEN);
