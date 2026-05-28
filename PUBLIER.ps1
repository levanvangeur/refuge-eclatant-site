# PUBLIER.ps1 — Déploiement vers Netlify
# Exécuter depuis le dossier du site : .\PUBLIER.ps1

param(
  [string]$Message = "Mise à jour du site"
)

Write-Host ""
Write-Host "=== Déploiement Netlify ===" -ForegroundColor Cyan
Write-Host ""

# Vérifie que git est initialisé
if (-not (Test-Path ".git")) {
  Write-Host "⚠  Pas de dépôt git. Initialisation..." -ForegroundColor Yellow
  git init
  git branch -M main
}

# Vérifie qu'un remote GitHub est configuré
$remote = git remote get-url origin 2>$null
if (-not $remote) {
  Write-Host "❌  Aucun remote GitHub configuré." -ForegroundColor Red
  Write-Host "    Créez un dépôt sur github.com puis exécutez :"
  Write-Host "    git remote add origin https://github.com/VOTRE-COMPTE/NOM-DU-DEPOT.git"
  exit 1
}

Write-Host "📦  Ajout des fichiers..." -ForegroundColor Gray
git add -A

$status = git status --short
if (-not $status) {
  Write-Host "✓  Aucune modification détectée — rien à publier." -ForegroundColor Green
  exit 0
}

Write-Host "💬  Commit : $Message" -ForegroundColor Gray
git commit -m $Message

Write-Host "🚀  Envoi vers GitHub (déclenche Netlify)..." -ForegroundColor Gray
git push origin main

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "✅  Publié ! Netlify va déployer automatiquement." -ForegroundColor Green
  Write-Host "    Suivez l'avancement sur : https://app.netlify.com" -ForegroundColor Cyan
} else {
  Write-Host ""
  Write-Host "❌  Échec du push. Vérifiez vos droits GitHub." -ForegroundColor Red
}
Write-Host ""
