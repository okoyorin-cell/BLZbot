/**
 * Badge → Role mapping configuration.
 * Each badge has an ID (matching the PNG filename in assets/badges/)
 * and an array of Discord role IDs. A user only needs ONE of the roles to earn the badge.
 */
const BADGE_ROLE_MAP = [
    { badgeId: 'chef_guilde', roleIds: ['1409715843444768869'] },
    { badgeId: 'chef_guilde_ult', roleIds: ['1409715845235609722'] },
    { badgeId: 'GOATV5', roleIds: ['1432466045167210506'] },
    { badgeId: 'halloween', roleIds: ['1451955208174174370', '1429906617431884023', '1429906792238026884'] },
    { badgeId: 'LV100_V4', roleIds: ['1409715847588479149'] },
    { badgeId: 'LV100_V5', roleIds: ['1432468237886558308'] },
    { badgeId: 'mega_pirate', roleIds: ['1432469785551310919'] },
    { badgeId: 'noel', roleIds: ['1451955208174174370', '1429971192994992149', '1432470859926343690', '1432472351492280350'] },
    { badgeId: 'puant_V2', roleIds: ['1322759664777039902'] },
    { badgeId: 'riche_V4', roleIds: ['1409843471480520806'] },
    { badgeId: 'riche_V5', roleIds: ['1442209574919606509'] },
];

module.exports = { BADGE_ROLE_MAP };
