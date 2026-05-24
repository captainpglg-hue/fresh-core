# EAS Build - Premier APK Fresh-Core

## Prerequis (une seule fois)

1. Compte Expo : https://expo.dev/signup
2. npm install -g eas-cli
3. eas login

## Initialisation

    npm install
    eas init
    git add app.json
    git commit -m "chore(eas): inject EAS project id"
    git push

## Build preview (APK installable)

    npm run build:android:preview

## Iteration dev (hot reload)

    npm run build:android:dev
    npm run start:dev-client