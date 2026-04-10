@echo off
cd /d "C:\Users\FORTUNE  PC\Desktop\OrderflowDesk\ORF\ofi-pro-frontend"
echo Checking git status...
git status
echo.
echo Adding remote...
git remote add origin https://github.com/fortune-johnson/ofi-pro.git 2>&1
echo.
echo Current remotes:
git remote -v
echo.
echo Pushing to GitHub...
git push -u origin main
pause
