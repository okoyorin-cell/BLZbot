#!/usr/bin/env node
/**
 * À chaque édition (Write / Tab) ou fin de tour agent : add → commit → push.
 * Verrou pour sérialiser les appels. Ne pas utiliser process.exit() avant libération du verrou.
 * Désactiver : CURSOR_AUTO_SYNC=0
 */
const { execFileSync, execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const LOCK_WAIT_MS = 20000;
const LOCK_SPIN_MS = 120;

function gitRoot() {
    let d = process.cwd();
    for (;;) {
        if (fs.existsSync(path.join(d, '.git'))) return d;
        const p = path.dirname(d);
        if (p === d) return process.cwd();
        d = p;
    }
}

function pickPath(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const keys = ['file_path', 'filePath', 'path', 'file', 'uri'];
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === 'string' && v.length) {
            return v.replace(/^file:\/\//, '').replace(/\\/g, path.sep);
        }
    }
    return null;
}

function acquireLock(lockPath) {
    const deadline = Date.now() + LOCK_WAIT_MS;
    while (Date.now() < deadline) {
        try {
            fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
            return true;
        } catch {
            const t = Date.now();
            while (Date.now() - t < LOCK_SPIN_MS) {
                /* spin */
            }
        }
    }
    return false;
}

function releaseLock(lockPath) {
    try {
        fs.unlinkSync(lockPath);
    } catch {
        /* ignore */
    }
}

function readStdin() {
    try {
        return fs.readFileSync(0, 'utf8');
    } catch {
        return '';
    }
}

function main() {
    if (['0', 'false', 'no', 'off'].includes(String(process.env.CURSOR_AUTO_SYNC || '').toLowerCase())) {
        return;
    }

    const root = gitRoot();
    if (!fs.existsSync(path.join(root, '.git'))) {
        return;
    }

    const raw = readStdin();
    let singlePath = null;
    try {
        singlePath = pickPath(JSON.parse(raw || '{}'));
    } catch {
        /* stop hook : stdin souvent vide → add -A */
    }

    const lockPath = path.join(
        os.tmpdir(),
        `blzbot-cursor-push-${crypto.createHash('md5').update(root).digest('hex').slice(0, 12)}.lock`
    );

    if (!acquireLock(lockPath)) {
        console.error('[cursor-auto-push] Verrou occupé — prochain hook réessaiera.');
        return;
    }

    try {
        process.chdir(root);

        if (singlePath) {
            const abs = path.isAbsolute(singlePath)
                ? path.normalize(singlePath)
                : path.normalize(path.join(root, singlePath));
            if (fs.existsSync(abs)) {
                const relToRoot = path.relative(root, abs);
                if (relToRoot && !relToRoot.startsWith('..') && !path.isAbsolute(relToRoot)) {
                    try {
                        execFileSync('git', ['add', '--', relToRoot], { stdio: 'pipe' });
                    } catch {
                        execFileSync('git', ['add', '-A'], { stdio: 'pipe' });
                    }
                } else {
                    execFileSync('git', ['add', '-A'], { stdio: 'pipe' });
                }
            } else {
                execFileSync('git', ['add', '-A'], { stdio: 'pipe' });
            }
        } else {
            execFileSync('git', ['add', '-A'], { stdio: 'pipe' });
        }

        const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim();
        if (!staged) {
            return;
        }

        const msg = `sync(cursor): ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;
        execFileSync('git', ['commit', '-m', msg], { stdio: 'inherit' });
        execFileSync('git', ['push'], { stdio: 'inherit' });
        console.error('[cursor-auto-push] Poussé sur GitHub.');
    } catch (e) {
        console.error('[cursor-auto-push]', e.message || e);
    } finally {
        releaseLock(lockPath);
    }
}

main();
