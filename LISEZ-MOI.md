# Livret d'accueil numérique — Le Refuge Éclatant

Site **statique** (dossier `frontend/`) publié sur Netlify, avec un **éditeur local**
qui permet de tout modifier et de **publier en un clic**.

## Modifier & publier

1. Double-cliquez sur le raccourci **« Le Refuge Éclatant »** (ou lancez `DEMARRER.ps1`).
   L'éditeur s'ouvre dans le navigateur (`http://localhost:4003`).
2. Modifiez les textes, adresses et photos dans les rubriques de gauche.
   Tout est **enregistré automatiquement**.
3. Cliquez **« 👁 Aperçu du livret »** pour voir le rendu réel.
4. Cliquez **« ✦ Publier »** : un récapitulatif des changements s'affiche,
   vous confirmez, et le site en ligne se met à jour (même adresse qu'avant).

## Structure

- `frontend/` — le site public (ce qui est mis en ligne)
  - `index.html`, `content.json` (tout le contenu), `assets/`, `images/`
- `editor/` — l'interface d'édition locale (n'est **pas** mise en ligne)
- `netlify.toml` — configuration de publication (dossier `frontend`)

## Langues

Le contenu est rédigé en **français** (source unique). Sur le livret en ligne,
les **drapeaux** en haut à droite traduisent la page à la volée
(anglais, espagnol, allemand, italien).
