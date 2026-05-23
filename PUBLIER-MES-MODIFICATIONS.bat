@echo off
cd /d "%~dp0"
echo Publication en cours...
echo.
git add -A
git commit -m "Mise a jour - %date%"
git push
echo.
echo Termine ! Le site se met a jour en ligne (2-3 min).
pause