git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/DEIN_NUTZERNAME/DEIN_REPO.git
git push -u origin main

git add package.json package-lock.json
git commit -m "Install dotenv"
git push origin main
