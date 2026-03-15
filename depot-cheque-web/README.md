# DepotCheque

Application web responsive Angular pour authentifier un utilisateur, prendre ou selectionner une photo de cheque, puis l'envoyer vers Google Cloud Storage via une Google Cloud Function HTTP.

## Objectif

L'application permet a un groupe restreint d'utilisateurs autorises de :

1. ouvrir l'application dans le navigateur
2. saisir un identifiant partage et un mot de passe commun
3. choisir une photo depuis l'appareil ou prendre une photo avec la camera
4. envoyer l'image au backend
5. enregistrer le fichier dans un bucket Google Cloud Storage

Il ne s'agit pas encore d'une vraie gestion d'utilisateurs. L'authentification repose sur des identifiants partages, mais la verification est effectuee cote backend et pas uniquement dans le frontend.

## Stack

- `Angular 21` standalone
- `Angular Material`
- authentification partagee via `Basic Authorization`
- `Google Cloud Function` HTTP en `Node.js 20`
- `Google Cloud Storage`

## Etat actuel

Configuration deja en place :

- nom provisoire de l'application : `DepotCheque`
- identifiant du projet GCP : `my-sc70`
- region Google Cloud : `europe-west9` (Paris)
- bucket GCS : `sc70-cheques`
- identifiant partage : `sc70`
- frontend local : `http://localhost:4200`
- Cloud Function deployee : `https://europe-west9-my-sc70.cloudfunctions.net/uploadCheque`

Fichiers d'environnement Angular actuellement utilises :

- `src/environments/environment.development.ts`
- `src/environments/environment.ts`

Ils pointent deja vers la Cloud Function deployee :

```ts
backend: {
  authCheckUrl: 'https://europe-west9-my-sc70.cloudfunctions.net/uploadCheque?action=auth-check',
  uploadUrl: 'https://europe-west9-my-sc70.cloudfunctions.net/uploadCheque?action=upload',
}
```

Points a definir plus tard :

- le nom final de l'application
- l'URL de production du frontend
- un renforcement eventuel de la securite

## Structure du projet

- `src/app/features/auth`
  page de connexion
- `src/app/features/upload`
  page d'envoi, selection de fichier, apercu et camera
- `src/app/core/auth`
  service d'authentification, garde de route et intercepteur
- `src/app/core/upload`
  service HTTP d'envoi
- `src/environments`
  configuration du frontend
- `backend/upload-cheque-function`
  backend Google Cloud Function

## Flux applicatif

1. L'utilisateur ouvre l'application.
2. Il saisit l'identifiant partage et le mot de passe.
3. Le frontend appelle `auth-check` sur la Cloud Function.
4. Si les identifiants sont valides, l'utilisateur accede a la page d'envoi.
5. L'utilisateur choisit une photo ou en prend une avec la camera du navigateur.
6. Le frontend envoie le fichier a l'action `upload`.
7. La Cloud Function verifie a nouveau les identifiants.
8. Le backend enregistre le fichier dans `sc70-cheques`.
9. Le backend retourne `fileId`, `storagePath` et `gsUri`.

## Frontend

### Lancement en local

```bash
cd depot-cheque-web
npm install
npm start
```

L'application est disponible sur :

- `http://localhost:4200`

### Build

```bash
cd depot-cheque-web
npm run build
```

### Variables frontend

Fichiers a verifier :

- `src/environments/environment.development.ts`
- `src/environments/environment.ts`

Champs principaux :

- `appName`
- `backend.authCheckUrl`
- `backend.uploadUrl`
- `upload.maxFileSizeMb`
- `upload.acceptedMimeTypes`

## Camera

La page d'envoi propose deux actions :

- `Choisir une photo`
- `Prendre une photo`

La seconde utilise `navigator.mediaDevices.getUserMedia`, donc :

- elle fonctionne sur `localhost`
- elle fonctionne sur un site `https`
- elle peut ne pas fonctionner si le navigateur n'a pas l'autorisation d'utiliser la camera
- sur ordinateur, elle ouvre la webcam ; sur mobile, elle utilise la camera de l'appareil si le navigateur le permet

Si la camera ne s'ouvre pas :

- verifier les permissions du navigateur
- verifier que l'application tourne sur `http://localhost` ou `https`
- consulter la console du navigateur

## Backend

Le backend se trouve dans :

- `backend/upload-cheque-function`

### Installation des dependances backend

```bash
cd depot-cheque-web
npm run backend:install
```

### Build backend

```bash
cd depot-cheque-web
npm run backend:build
```

### Variables d'environnement backend

La fonction attend :

- `GCS_BUCKET_NAME`
- `ALLOWED_ORIGIN`
- `SHARED_USERNAME`
- `SHARED_PASSWORD`

Exemple local :

```bash
cd depot-cheque-web/backend/upload-cheque-function
export GCS_BUCKET_NAME="sc70-cheques"
export ALLOWED_ORIGIN="http://localhost:4200"
export SHARED_USERNAME="sc70"
export SHARED_PASSWORD="<mot-de-passe>"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
npm start
```

## Endpoint backend

La Cloud Function expose un seul endpoint avec deux actions :

- `POST ?action=auth-check`
- `POST ?action=upload`

### Verification des identifiants

Le frontend envoie :

- l'en-tete `Authorization: Basic <base64(username:password)>`

### Envoi du fichier

Le frontend envoie :

- `multipart/form-data`
- le champ fichier `image`

### Reponse d'envoi

```json
{
  "fileId": "1741962000000-uuid.jpg",
  "bucket": "sc70-cheques",
  "storagePath": "cheques/sc70/1741962000000-uuid.jpg",
  "gsUri": "gs://sc70-cheques/cheques/sc70/1741962000000-uuid.jpg",
  "contentType": "image/jpeg",
  "uploadedAt": "2026-03-14T16:00:00.000Z"
}
```

## Google Cloud

### Donnees du projet

- project ID : `my-sc70`
- region : `europe-west9`
- bucket : `sc70-cheques`

### Cloud Function actuelle

- URL publique : `https://europe-west9-my-sc70.cloudfunctions.net/uploadCheque`
- console GCP : [uploadCheque](https://console.cloud.google.com/functions/details/europe-west9/uploadCheque?project=my-sc70)

### Deploy

Commande de base :

```bash
cd depot-cheque-web
gcloud functions deploy uploadCheque \
  --gen2 \
  --runtime=nodejs20 \
  --region=europe-west9 \
  --source=backend/upload-cheque-function \
  --entry-point=uploadCheque \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars=GCS_BUCKET_NAME=sc70-cheques,ALLOWED_ORIGIN=http://localhost:4200,SHARED_USERNAME=sc70,SHARED_PASSWORD=<mot-de-passe>
```

Apres un nouveau deploy :

1. recuperer l'URL retournee par `gcloud`
2. mettre a jour `backend.authCheckUrl`
3. mettre a jour `backend.uploadUrl`
4. redemarrer le frontend

## Logs et debug

Des logs principaux ont ete ajoutes aux points clefs.

### Frontend

Verifier la console du navigateur pour suivre :

- l'envoi du formulaire de connexion
- la reussite ou l'echec de la connexion
- le fichier selectionne
- l'ouverture ou l'echec de la camera
- l'envoi du fichier
- la reussite ou l'echec de l'envoi

### Backend

La Cloud Function journalise :

- la requete entrante
- l'action demandee
- la validite des identifiants
- l'acceptation de l'envoi
- l'enregistrement du fichier dans le bucket
- les erreurs gerees et non gerees

Pour consulter les logs backend :

- ouvrir Google Cloud Console
- aller sur la fonction `uploadCheque`
- consulter `Logs`

## Securite

L'approche actuelle est volontairement simple, mais elle reste limitee :

- toutes les personnes partagent les memes identifiants
- le mot de passe ne doit pas etre stocke dans le code frontend
- le navigateur conserve la session localement
- en production, il faut utiliser `HTTPS`

Evolutions recommandees pour une version suivante :

- comptes individuels
- mots de passe distincts par utilisateur
- expiration de session cote backend
- stockage des secrets dans un gestionnaire dedie
- jetons de session plus robustes
