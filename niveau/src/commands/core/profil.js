const { buildProfilV2Slash } = require('./profil-v2-factory');

/** Profil BLZ principal (carte 1024×381 + boutons quêtes / trophées / inventaire / guilde). */
module.exports = buildProfilV2Slash(
    'profil',
    'Profil BLZ : carte 1024×381, stats, guilde, badges exclusifs, titre staff sous ton avatar si applicable.',
    'profil'
);
