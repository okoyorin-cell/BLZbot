#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys

# Lire le fichier avec UTF-8
with open('deban.js', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Remplacer les séquences corrompues
replacements = {
    'dÃ©faut': 'défaut',
    'dÃ©fauts': 'défauts',
    'dÃ©bannissement': 'débannissement',
    'ModÃ©rateur': 'Modérateur',
    'modÃ©rateurs': 'modérateurs',
    'QualitÃ©s': 'Qualités',
    'Ã©tre': 'être',
    'GÃ¨re': 'Gère',
    'mÃ©moire': 'mémoire',
    'rÃ©ponses': 'réponses',
    'clÃ©': 'clé',
    'lâ€™': "'",
    'â€™': "'",
    'Preuves': 'Preuves',
    'ancien': 'ancien',
}

for old, new in replacements.items():
    content = content.replace(old, new)

# Réécrire le fichier en UTF-8
with open('deban.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fichier corrigé !")
sys.exit(0)
