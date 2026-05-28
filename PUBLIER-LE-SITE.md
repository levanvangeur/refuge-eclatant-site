# Guide Refuge Éclatant — Comment ça marche

## L'idée générale

Vous configurez tout **sur votre ordinateur** (en local), puis vous envoyez les modifications en ligne.

```
Votre ordi  →  GitHub  →  Netlify (déploiement automatique)
```

---

## Démarrer le site en local

Double-cliquez sur **`DEMARRER-EN-LOCAL.bat`**

Le site s'ouvre automatiquement dans votre navigateur :
- Page voyageurs : http://localhost:3000
- Espace admin   : http://localhost:3000/admin  (admin / azerty)

> La première fois, l'installation prend 1-2 minutes.

---

## Workflow habituel

### 1. Configurer le contenu du site
Deux options possibles :

**Option A — Directement en ligne (recommandé)**
1. Allez sur https://refuge-eclatant.logementsparay.fr/admin
2. Connectez-vous (admin / votre mot de passe)
3. Modifiez photos, pièces, règles, etc.
4. Les changements sont sauvegardés immédiatement

**Option B — En local puis publier**
1. Double-cliquez `DEMARRER-EN-LOCAL.bat`
2. Allez sur http://localhost:3000/admin
3. Modifiez ce que vous voulez
4. Fermez la fenêtre noire quand vous avez terminé

### 2. Publier une modification de code
1. Double-cliquez **`PUBLIER-MES-MODIFICATIONS.bat`**
   (ou lancez `.\PUBLIER.ps1 "Description"` dans PowerShell)
2. Netlify redéploie automatiquement en ~1 minute
3. Votre site en ligne est à jour !

---

## Points importants

- **Les données et photos sont dans le cloud** (Turso + Cloudinary) — elles persistent entre les déploiements
- **L'admin en ligne fonctionne** — vous pouvez modifier le contenu directement sur le site
- **Aucun délai de démarrage** — Netlify Functions démarrent instantanément (contrairement à Render)

---

## Le site en ligne

Adresse : https://refuge-eclatant.logementsparay.fr

---

## Mot de passe admin

**Par défaut : `azerty`** — changez-le dès que possible dans l'espace admin → Paramètres → Sécurité.
