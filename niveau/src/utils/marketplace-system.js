/**
 * ============================================
 * SYSTÈME DE MARKETPLACE - MAJ Mars 2026
 * ============================================
 * 
 * Permet la vente P2P d'items entre joueurs.
 * 
 * RÈGLES :
 * - Maximum 5 articles en vente à la fois par joueur
 * - On peut vendre pour des Starss, pour d'autres items, ou Starss contre items
 * - Plusieurs fois le même item dans une annonce, mais pas plusieurs items différents
 * - Les listings expirent après 7 jours
 * - Niveau minimum requis pour accéder au marketplace
 */

const db = require('../database/database');
const logger = require('./logger');
const { getItem, ITEMS } = require('./items');

// ==========================================
// CONFIGURATION
// ==========================================

const MAX_ACTIVE_LISTINGS = 5;
const LISTING_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
const MIN_LEVEL_MARKETPLACE = 25; // Niveau minimum pour accéder
const MIN_PRICE_STARSS = 1000; // Prix minimum en starss
const MAX_PRICE_STARSS = 50000000; // Prix maximum en starss (50M)

// Items non vendables au marketplace
const NON_SELLABLE_ITEMS = [
    'couscous',       // Easter egg
    'bague_mariage',  // Saint-Valentin
    'ami_chiant',     // Saint-Valentin
    'coeur_rouge',    // Saint-Valentin
];

// ==========================================
// REQUÊTES PRÉPARÉES
// ==========================================

const getActiveListingsStmt = db.prepare(`
    SELECT * FROM marketplace_listings 
    WHERE status = 'active' AND expires_at > ? 
    ORDER BY created_at DESC
`);

const getUserActiveListingsStmt = db.prepare(`
    SELECT * FROM marketplace_listings 
    WHERE seller_id = ? AND status = 'active' AND expires_at > ?
`);

const getListingByIdStmt = db.prepare(`
    SELECT * FROM marketplace_listings WHERE id = ?
`);

const createListingStmt = db.prepare(`
    INSERT INTO marketplace_listings 
    (seller_id, item_id, quantity, price_type, price_item_id, price_amount, created_at, expires_at, status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
`);

const cancelListingStmt = db.prepare(`
    UPDATE marketplace_listings SET status = 'cancelled' WHERE id = ? AND seller_id = ?
`);

const buyListingStmt = db.prepare(`
    UPDATE marketplace_listings SET status = 'sold', buyer_id = ?, bought_at = ? WHERE id = ?
`);

const getListingsByItemStmt = db.prepare(`
    SELECT * FROM marketplace_listings 
    WHERE item_id = ? AND status = 'active' AND expires_at > ?
    ORDER BY price_amount ASC
`);

const expireOldListingsStmt = db.prepare(`
    UPDATE marketplace_listings SET status = 'expired' 
    WHERE status = 'active' AND expires_at <= ?
`);

const getUserSalesHistoryStmt = db.prepare(`
    SELECT * FROM marketplace_listings 
    WHERE seller_id = ? AND status = 'sold'
    ORDER BY bought_at DESC
    LIMIT 20
`);

const getUserPurchaseHistoryStmt = db.prepare(`
    SELECT * FROM marketplace_listings 
    WHERE buyer_id = ? AND status = 'sold'
    ORDER BY bought_at DESC
    LIMIT 20
`);

// ==========================================
// FONCTIONS PRINCIPALES
// ==========================================

/**
 * Vérifie si un item est vendable sur le marketplace
 * @param {string} itemId
 * @returns {boolean}
 */
function isItemSellable(itemId) {
    if (NON_SELLABLE_ITEMS.includes(itemId)) return false;
    const item = getItem(itemId);
    if (!item) return false;
    // Les boosts permanents ne sont pas vendables (ils sont achetables en boutique)
    if (item.type === 'boost') return false;
    // Les items de type valentin ne sont pas vendables
    if (item.type === 'valentin') return false;
    return true;
}

/**
 * Crée une nouvelle annonce sur le marketplace
 * @param {string} sellerId - ID du vendeur
 * @param {string} itemId - ID de l'item à vendre
 * @param {number} quantity - Quantité à vendre
 * @param {number} priceAmount - Prix demandé
 * @param {string} priceType - 'starss' ou 'item'
 * @param {string|null} priceItemId - ID de l'item demandé en échange (si priceType === 'item')
 * @returns {{ success: boolean, message: string, listingId?: number }}
 */
function createListing(sellerId, itemId, quantity, priceAmount, priceType = 'starss', priceItemId = null) {
    // Vérifications
    if (!isItemSellable(itemId)) {
        return { success: false, message: '❌ Cet item ne peut pas être vendu sur le marketplace.' };
    }

    const item = getItem(itemId);
    if (!item) {
        return { success: false, message: '❌ Item inconnu.' };
    }

    if (quantity < 1) {
        return { success: false, message: '❌ La quantité doit être au moins 1.' };
    }

    // Vérifier le nombre d'annonces actives
    const now = Date.now();
    const activeListings = getUserActiveListingsStmt.all(sellerId, now);
    if (activeListings.length >= MAX_ACTIVE_LISTINGS) {
        return { success: false, message: `❌ Vous avez déjà **${MAX_ACTIVE_LISTINGS}** annonces actives. Annulez-en une avant d'en créer une nouvelle.` };
    }

    // Vérifier le prix
    if (priceType === 'starss') {
        if (priceAmount < MIN_PRICE_STARSS) {
            return { success: false, message: `❌ Le prix minimum est de **${MIN_PRICE_STARSS.toLocaleString('fr-FR')} Starss**.` };
        }
        if (priceAmount > MAX_PRICE_STARSS) {
            return { success: false, message: `❌ Le prix maximum est de **${MAX_PRICE_STARSS.toLocaleString('fr-FR')} Starss**.` };
        }
    } else if (priceType === 'item') {
        if (!priceItemId || !getItem(priceItemId)) {
            return { success: false, message: '❌ L\'item demandé en échange est invalide.' };
        }
        if (priceAmount < 1) {
            return { success: false, message: '❌ La quantité demandée en échange doit être au moins 1.' };
        }
    } else {
        return { success: false, message: '❌ Type de prix invalide. Utilisez "starss" ou "item".' };
    }

    // Vérifier que le vendeur possède l'item
    const { checkUserInventory } = require('./db-users');
    const owned = checkUserInventory(sellerId, itemId);
    if (owned < quantity) {
        return { success: false, message: `❌ Vous ne possédez que **${owned}x ${item.name}** mais vous voulez en vendre **${quantity}**.` };
    }

    // Retirer l'item du vendeur (mis en escrow)
    const { removeUserItem } = require('./db-users');
    removeUserItem(sellerId, itemId, quantity);

    // Créer l'annonce
    const expiresAt = now + LISTING_DURATION_MS;
    const result = createListingStmt.run(sellerId, itemId, quantity, priceType, priceItemId, priceAmount, now, expiresAt);

    logger.info(`[MARKETPLACE] Nouvelle annonce #${result.lastInsertRowid} par ${sellerId}: ${quantity}x ${itemId} pour ${priceAmount} ${priceType}`);

    return {
        success: true,
        message: `✅ Annonce créée ! **${quantity}x ${item.name}** mis en vente pour **${priceAmount.toLocaleString('fr-FR')} ${priceType === 'starss' ? 'Starss' : getItem(priceItemId)?.name || priceItemId}**.`,
        listingId: result.lastInsertRowid,
    };
}

/**
 * Achète un listing du marketplace
 * @param {string} buyerId - ID de l'acheteur
 * @param {number} listingId - ID de l'annonce
 * @returns {{ success: boolean, message: string }}
 */
function buyListing(buyerId, listingId) {
    const listing = getListingByIdStmt.get(listingId);
    if (!listing) {
        return { success: false, message: '❌ Cette annonce n\'existe pas.' };
    }

    if (listing.status !== 'active') {
        return { success: false, message: '❌ Cette annonce n\'est plus disponible.' };
    }

    if (listing.expires_at <= Date.now()) {
        return { success: false, message: '❌ Cette annonce a expiré.' };
    }

    if (listing.seller_id === buyerId) {
        return { success: false, message: '❌ Vous ne pouvez pas acheter votre propre annonce. Utilisez `/marketplace annuler` pour la retirer.' };
    }

    const { checkUserInventory, removeUserItem, addItemToInventory } = require('./db-users');
    const item = getItem(listing.item_id);

    // Vérifier que l'acheteur peut payer
    if (listing.price_type === 'starss') {
        const buyer = db.prepare('SELECT stars FROM users WHERE id = ?').get(buyerId);
        if (!buyer || buyer.stars < listing.price_amount) {
            return { success: false, message: `❌ Vous n'avez pas assez de Starss. Il vous faut **${listing.price_amount.toLocaleString('fr-FR')} Starss**.` };
        }

        // Effectuer la transaction
        db.transaction(() => {
            // Prendre les starss de l'acheteur
            db.prepare('UPDATE users SET stars = stars - ? WHERE id = ?').run(listing.price_amount, buyerId);
            // Donner les starss au vendeur
            db.prepare('UPDATE users SET stars = stars + ? WHERE id = ?').run(listing.price_amount, listing.seller_id);
            // Donner l'item à l'acheteur
            addItemToInventory(buyerId, listing.item_id, listing.quantity);
            // Marquer comme vendu
            buyListingStmt.run(buyerId, Date.now(), listingId);
        })();
    } else if (listing.price_type === 'item') {
        // Vérifier que l'acheteur possède l'item demandé
        const owned = checkUserInventory(buyerId, listing.price_item_id);
        if (owned < listing.price_amount) {
            const priceItem = getItem(listing.price_item_id);
            return { success: false, message: `❌ Vous ne possédez que **${owned}x ${priceItem?.name || listing.price_item_id}** mais il en faut **${listing.price_amount}**.` };
        }

        // Effectuer la transaction
        db.transaction(() => {
            // Prendre l'item de paiement de l'acheteur
            removeUserItem(buyerId, listing.price_item_id, listing.price_amount);
            // Donner l'item de paiement au vendeur
            addItemToInventory(listing.seller_id, listing.price_item_id, listing.price_amount);
            // Donner l'item vendu à l'acheteur
            addItemToInventory(buyerId, listing.item_id, listing.quantity);
            // Marquer comme vendu
            buyListingStmt.run(buyerId, Date.now(), listingId);
        })();
    }

    logger.info(`[MARKETPLACE] Vente #${listingId}: ${buyerId} achète ${listing.quantity}x ${listing.item_id} de ${listing.seller_id}`);

    return {
        success: true,
        message: `✅ Achat effectué ! Vous avez obtenu **${listing.quantity}x ${item?.name || listing.item_id}**.`,
    };
}

/**
 * Annule une annonce et rend l'item au vendeur
 * @param {string} sellerId - ID du vendeur
 * @param {number} listingId - ID de l'annonce
 * @returns {{ success: boolean, message: string }}
 */
function cancelListing(sellerId, listingId) {
    const listing = getListingByIdStmt.get(listingId);
    if (!listing) {
        return { success: false, message: '❌ Cette annonce n\'existe pas.' };
    }

    if (listing.seller_id !== sellerId) {
        return { success: false, message: '❌ Cette annonce ne vous appartient pas.' };
    }

    if (listing.status !== 'active') {
        return { success: false, message: '❌ Cette annonce n\'est plus active.' };
    }

    // Rendre l'item au vendeur
    const { addItemToInventory } = require('./db-users');

    db.transaction(() => {
        cancelListingStmt.run(listingId, sellerId);
        addItemToInventory(sellerId, listing.item_id, listing.quantity);
    })();

    const item = getItem(listing.item_id);
    logger.info(`[MARKETPLACE] Annonce #${listingId} annulée par ${sellerId}`);

    return {
        success: true,
        message: `✅ Annonce annulée. **${listing.quantity}x ${item?.name || listing.item_id}** vous a été rendu.`,
    };
}

/**
 * Récupère toutes les annonces actives du marketplace
 * @param {number} limit - Nombre max de résultats
 * @returns {Array}
 */
function getActiveListings(limit = 50) {
    const now = Date.now();
    // Expirer les vieux listings d'abord
    expireOldListingsStmt.run(now);
    
    const listings = db.prepare(`
        SELECT ml.*, u.username as seller_name 
        FROM marketplace_listings ml
        LEFT JOIN users u ON ml.seller_id = u.id
        WHERE ml.status = 'active' AND ml.expires_at > ?
        ORDER BY ml.created_at DESC
        LIMIT ?
    `).all(now, limit);

    return listings;
}

/**
 * Récupère les annonces actives d'un utilisateur
 * @param {string} userId
 * @returns {Array}
 */
function getUserListings(userId) {
    const now = Date.now();
    expireOldListingsStmt.run(now);
    return getUserActiveListingsStmt.all(userId, now);
}

/**
 * Récupère TOUTES les annonces d'un utilisateur (tous statuts)
 * @param {string} userId
 * @param {number} limit
 * @returns {Array}
 */
function getAllUserListings(userId, limit = 25) {
    const now = Date.now();
    expireOldListingsStmt.run(now);
    return db.prepare(`
        SELECT * FROM marketplace_listings 
        WHERE seller_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `).all(userId, limit);
}

/**
 * Recherche des annonces par item
 * @param {string} itemId
 * @returns {Array}
 */
function searchListingsByItem(itemId) {
    const now = Date.now();
    return getListingsByItemStmt.all(itemId, now);
}

/**
 * Nettoie les annonces expirées et rend les items aux vendeurs
 */
function cleanupExpiredListings() {
    const now = Date.now();
    const { addItemToInventory } = require('./db-users');

    const expired = db.prepare(`
        SELECT * FROM marketplace_listings 
        WHERE status = 'active' AND expires_at <= ?
    `).all(now);

    if (expired.length > 0) {
        db.transaction(() => {
            for (const listing of expired) {
                // Rendre l'item au vendeur
                addItemToInventory(listing.seller_id, listing.item_id, listing.quantity);
                // Marquer comme expiré
                db.prepare('UPDATE marketplace_listings SET status = ? WHERE id = ?').run('expired', listing.id);
            }
        })();

        logger.info(`[MARKETPLACE] ${expired.length} annonce(s) expirée(s) nettoyée(s), items rendus.`);
    }
}

/**
 * Obtient les stats du marketplace pour l'affichage
 * @returns {object}
 */
function getMarketplaceStats() {
    const now = Date.now();
    const activeCount = db.prepare('SELECT COUNT(*) as count FROM marketplace_listings WHERE status = ? AND expires_at > ?').get('active', now);
    const totalSold = db.prepare('SELECT COUNT(*) as count FROM marketplace_listings WHERE status = ?').get('sold');
    const totalVolume = db.prepare('SELECT COALESCE(SUM(price_amount), 0) as total FROM marketplace_listings WHERE status = ? AND price_type = ?').get('sold', 'starss');

    return {
        activeListings: activeCount?.count || 0,
        totalSold: totalSold?.count || 0,
        totalVolumeStarss: totalVolume?.total || 0,
    };
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    createListing,
    buyListing,
    cancelListing,
    getActiveListings,
    getUserListings,
    getAllUserListings,
    searchListingsByItem,
    cleanupExpiredListings,
    getMarketplaceStats,
    isItemSellable,

    // Constantes
    MAX_ACTIVE_LISTINGS,
    LISTING_DURATION_MS,
    MIN_LEVEL_MARKETPLACE,
    MIN_PRICE_STARSS,
    MAX_PRICE_STARSS,
    NON_SELLABLE_ITEMS,
};
