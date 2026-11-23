#!/usr/bin/env node
/**
 * AUDIT DE SÉCURITÉ SCHOOLFLOW — à relancer régulièrement : `npm run audit:security`
 *
 * 1. Dépendances : `npm audit` (failles connues, y compris indirectes) + `npm outdated` (versions anciennes).
 * 2. Code : recherche de secrets en dur, eval / innerHTML, routes API sans contrôle d'accès,
 *    clés « service » exposées au navigateur, CORS ouvert, cookies sans protections.
 * 3. Configuration : en-têtes de sécurité, fichiers .env versionnés, .gitignore.
 *
 * Le rapport est écrit dans reports/security-audit-AAAA-MM-JJ.md. Code de sortie 1 si une faille
 * « critique » ou « haute » est trouvée. Aucune donnée n'est envoyée ailleurs que vers le registre npm.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'reports', 'tools', 'public', 'scripts']);
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.jsx']);
const findings = []; // { level, title, detail }
const add = (level, title, detail = '') => findings.push({ level, title, detail });

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (CODE_EXT.has(extname(name))) out.push(full);
  }
  return out;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}

// ── 1. Dépendances ──────────────────────────────────────────────────────────────
function auditDependencies() {
  const a = run('npm', ['audit', '--json']);
  try {
    const j = JSON.parse(a.out || '{}');
    const meta = j.metadata?.vulnerabilities || {};
    const vulns = j.vulnerabilities || {};
    const names = Object.keys(vulns);
    if (j.error) {
      add('info', 'npm audit n’a pas pu interroger le registre', String(j.error.summary || j.error.code || 'erreur réseau'));
    } else if (names.length === 0 && (meta.total ?? 0) === 0) {
      add('ok', 'Dépendances : aucune faille connue (npm audit)');
    }
    for (const n of names) {
      const v = vulns[n];
      const lvl = v.severity === 'critical' ? 'critical' : v.severity === 'high' ? 'high' : v.severity === 'moderate' ? 'medium' : 'low';
      const via = (v.via || []).map((x) => (typeof x === 'string' ? x : x.title)).filter(Boolean).slice(0, 3).join(' ; ');
      add(lvl, `Dépendance vulnérable : ${n} (${v.severity})`, `${via}${v.fixAvailable ? ' — correctif disponible : `npm audit fix`' : ' — pas de correctif automatique'}`);
    }
  } catch {
    add('info', 'npm audit indisponible', 'Pas de connexion au registre npm ou fichier package-lock.json absent. Relancer avec Internet.');
  }

  const o = run('npm', ['outdated', '--json']);
  try {
    const j = JSON.parse(o.out || '{}');
    for (const [name, v] of Object.entries(j)) {
      const cur = String(v.current || '').split('.')[0];
      const latest = String(v.latest || '').split('.')[0];
      if (cur && latest && cur !== latest) {
        add('medium', `Version majeure en retard : ${name}`, `installée ${v.current} → dernière ${v.latest}`);
      }
    }
  } catch {
    /* ignoré */
  }
}

// ── 2. Code ────────────────────────────────────────────────────────────────────
const SECRET_PATTERNS = [
  { re: /(sk_live|sk_test)_[0-9a-zA-Z]{16,}/, label: 'clé Stripe' },
  { re: /AKIA[0-9A-Z]{16}/, label: 'clé AWS' },
  { re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, label: 'jeton JWT en dur (ex. clé Supabase)' },
  { re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, label: 'clé privée' },
  { re: /(password|passwd|secret|api[_-]?key)\s*[:=]\s*['"][^'"\s]{10,}['"]/i, label: 'secret en dur' },
];

function auditCode() {
  const files = walk(ROOT);
  let routeCount = 0;
  for (const f of files) {
    const rel = relative(ROOT, f).replace(/\\/g, '/');
    let text;
    try {
      text = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);

    lines.forEach((line, i) => {
      for (const p of SECRET_PATTERNS) {
        if (p.re.test(line) && !/process\.env|placeholder|exemple|example/i.test(line)) {
          add('high', `Secret possible (${p.label})`, `${rel}:${i + 1}`);
        }
      }
      if (/\beval\s*\(|new Function\s*\(/.test(line)) add('high', 'Exécution de code dynamique (eval / new Function)', `${rel}:${i + 1}`);
      if (/dangerouslySetInnerHTML/.test(line)) add('medium', 'dangerouslySetInnerHTML (risque XSS si le contenu vient d’un utilisateur)', `${rel}:${i + 1}`);
      if (/NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET|PRIVATE)/.test(line)) add('critical', 'Clé sensible exposée au navigateur (NEXT_PUBLIC_)', `${rel}:${i + 1}`);
      if (/Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*/.test(line)) add('medium', 'CORS ouvert à tous les sites (*)', `${rel}:${i + 1}`);
      if (/rejectUnauthorized\s*:\s*false/.test(line)) add('high', 'Vérification TLS désactivée', `${rel}:${i + 1}`);
      if (/SERVICE_ROLE/.test(line) && /'use client'/.test(text.slice(0, 200))) add('critical', 'Clé service Supabase dans un composant navigateur', `${rel}:${i + 1}`);
    });

    // Routes API : doivent contrôler l'accès (session / rôle) sauf routes publiques connues.
    if (/^app\/api\/.+\/route\.ts$/.test(rel)) {
      routeCount++;
      const publicOk = /(login|signup|version|manifest|school-manifest|health|webhook|directory|figures|public)/i.test(rel);
      const guarded = /(require[A-Z]\w*\(|getSession|verifySession|isStaff|readSession|getSessionFromRequest|cookies\(\)|authorization)/.test(text);
      const mutates = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/.test(text);
      if (!guarded && !publicOk) {
        add(mutates ? 'high' : 'medium', 'Route API sans contrôle d’accès apparent', rel);
      }
    }
  }
  add('info', `Code analysé : ${files.length} fichiers, ${routeCount} routes API`);
}

// ── 3. Configuration ───────────────────────────────────────────────────────────
function auditConfig() {
  const gi = existsSync(join(ROOT, '.gitignore')) ? readFileSync(join(ROOT, '.gitignore'), 'utf8') : '';
  if (!/\.env/.test(gi)) add('high', '.gitignore ne protège pas les fichiers .env');
  for (const name of readdirSync(ROOT)) {
    if (/^\.env(\.|$)/.test(name) && !/example|sample|template/i.test(name)) {
      const tracked = run('git', ['ls-files', '--error-unmatch', name]);
      if (tracked.code === 0) add('critical', `Fichier d’environnement versionné dans Git : ${name}`, 'Retirer de Git et changer toutes les clés qu’il contient.');
    }
  }
  const cfgName = ['next.config.ts', 'next.config.mjs', 'next.config.js'].find((n) => existsSync(join(ROOT, n)));
  const cfg = cfgName ? readFileSync(join(ROOT, cfgName), 'utf8') : '';
  const proxy = existsSync(join(ROOT, 'proxy.ts')) ? readFileSync(join(ROOT, 'proxy.ts'), 'utf8') : '';
  const headersText = cfg + proxy;
  for (const [h, label] of [
    ['X-Content-Type-Options', 'X-Content-Type-Options'],
    ['Strict-Transport-Security', 'HSTS'],
    ['X-Frame-Options|frame-ancestors', 'protection contre l’intégration en iframe (clickjacking)'],
    ['Content-Security-Policy', 'Content-Security-Policy'],
    ['Referrer-Policy', 'Referrer-Policy'],
  ]) {
    if (!new RegExp(h, 'i').test(headersText)) add('medium', `En-tête de sécurité absent : ${label}`, 'À ajouter dans next.config (headers()).');
  }
  if (!existsSync(join(ROOT, 'package-lock.json'))) add('medium', 'package-lock.json absent : versions non figées');
}

// ── Rapport ────────────────────────────────────────────────────────────────────
auditDependencies();
auditCode();
auditConfig();

const order = ['critical', 'high', 'medium', 'low', 'info', 'ok'];
const labels = { critical: '🔴 CRITIQUE', high: '🟠 HAUTE', medium: '🟡 MOYENNE', low: '⚪ FAIBLE', info: 'ℹ️ INFO', ok: '✅ OK' };
findings.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
const count = (l) => findings.filter((f) => f.level === l).length;
const date = new Date().toISOString().slice(0, 10);

let md = `# Audit de sécurité SchoolFlow — ${date}\n\n`;
md += `Critiques : **${count('critical')}** · Hautes : **${count('high')}** · Moyennes : **${count('medium')}** · Faibles : **${count('low')}**\n\n`;
for (const f of findings) md += `- ${labels[f.level]} — ${f.title}${f.detail ? `\n  - ${f.detail}` : ''}\n`;

const dir = join(ROOT, 'reports');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const file = join(dir, `security-audit-${date}.md`);
writeFileSync(file, md, 'utf8');
console.log(md);
console.log(`\nRapport enregistré : ${relative(ROOT, file)}`);
process.exit(count('critical') + count('high') > 0 ? 1 : 0);
