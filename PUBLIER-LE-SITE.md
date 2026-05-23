# Guide Clair-Obscur — Comment ça marche

## L'idée générale

Vous configurez tout **sur votre ordinateur** (en local), puis vous envoyez les modifications sur le site en ligne. C'est simple et gratuit !

```
Votre ordi  →  GitHub  →  Site en ligne (Render)
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

### 1. Configurer le site
1. Double-cliquez `DEMARRER-EN-LOCAL.bat`
2. Allez sur http://localhost:3000/admin
3. Modifiez ce que vous voulez (photos, pièces, règles...)
4. Fermez la fenêtre noire quand vous avez terminé

### 2. Publier en ligne
1. Double-cliquez **`PUBLIER-MES-MODIFICATIONS.bat`**
2. Attendez 2-3 minutes que Render redéploie
3. Votre site en ligne est à jour !

---

## Points importants

- **L'admin du site en ligne ne sauvegarde pas** — faites toujours vos modifications en local
- **Les photos et les données sont dans Git** — elles ne se perdent plus entre les redémarrages
- Le site en ligne est en lecture seule pour les voyageurs

---

## Le site en ligne

Adresse : https://clair-obscur-site.onrender.com

> Sur le plan gratuit, le serveur "s'endort" apres 15 min sans visiteur.
> Le premier visiteur attend ~20 secondes. C'est normal.

---

## Mot de passe admin

**Par défaut : `azerty`** — changez-le dès que possible dans l'espace admin local → Paramètres.

---

## Premiere installation de GitHub Desktop (si pas encore fait)

Si vous n'avez pas encore GitHub Desktop :
1. Téléchargez sur https://desktop.github.com
2. Connectez-vous avec votre compte GitHub
3. Fichier → Cloner un dépôt → clair-obscur-site
4. Choisissez l'emplacement sur votre ordinateur

Ensuite les scripts `.bat` s'occupent de tout !
