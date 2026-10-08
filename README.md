# ÉcoleFacile RDC

Plateforme SaaS de gestion scolaire pour les écoles privées de la RDC. Cette première version (MVP) couvre le cœur
« argent » de l'école : élèves, classes, frais scolaires, encaissements, reçus numérotés, impayés et caisse du jour.

- **Interface en français**, pensée pour un téléphone Android et une connexion faible (pages légères, aucun graphique en JavaScript, pas de police à télécharger).
- **Multi-écoles** : chaque école a son espace privé, toutes les requêtes sont filtrées par école.
- **Montants exacts** : stockés en centimes, en USD ou en CDF, jamais convertis ni additionnés entre devises.

## Fonctionnalités du MVP

| Module | Ce qui est fait |
| --- | --- |
| Connexion et rôles | Connexion par e-mail, sessions signées (JWT en cookie httpOnly), mots de passe chiffrés (bcrypt), limite de tentatives. Rôles : administrateur plateforme, directeur, secrétaire/caissier. |
| Inscription d'une école | Formulaire (nom, adresse, ville, téléphone, e-mail, directeur, logo, année scolaire), création automatique de l'espace et du compte directeur, 30 jours d'essai. |
| Élèves | Ajout, modification, archivage/transfert/réactivation, recherche par nom, matricule ou téléphone, matricule automatique, **import Excel** avec modèle, export Excel. |
| Classes | Création, modification, section/option, nombre d'élèves, suppression d'une classe vide. |
| Frais scolaires | Inscription, minerval, mensuels (génération automatique de septembre à juin), transport, examen, autres. Par classe ou pour toute l'école, en USD ou CDF, date limite. |
| Paiements | Espèces, Airtel Money, M-Pesa, Orange Money, virement, autre. Montant pré-rempli avec le reste à payer, refus des trop-perçus, verrou contre les doubles encaissements simultanés. Annulation (jamais de suppression) réservée au directeur, avec motif. |
| Reçus | Numéro unique par école (ex. `LV-2026-000123`), logo et coordonnées, solde restant au moment du paiement, PDF, impression, message WhatsApp pré-rempli au parent. |
| Impayés | Liste par classe, option « date limite dépassée », rappel WhatsApp par élève, export Excel. |
| Caisse du jour | Totaux par devise, par moyen de paiement et par agent ; le caissier voit sa caisse, le directeur celle de l'école. Impression et export. |
| Tableau de bord | Élèves, classes, encaissé, reste à percevoir, encaissé du jour, paiements par mois, élèves par classe, derniers paiements et inscriptions, alertes. |
| Utilisateurs | Le directeur crée des comptes caissier ou directeur, les désactive, change leur mot de passe. |
| Abonnements | Formules Basic / Standard / Premium, date de fin, bandeau 7 jours avant expiration, lecture seule après expiration, suspension par l'administrateur. |
| Administration | Statistiques globales, liste des écoles, changement de statut, de formule et de date de fin. |
| Journal d'audit | Connexions, créations, modifications, paiements et annulations dans `audit_logs`. |

Prévu pour la suite (le schéma et les rôles sont prêts) : présences, notes et bulletins, espace parent et enseignant, SMS,
paiement en ligne Mobile Money, saisie hors ligne.

## Technologies

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL (client `postgres`) ·
`jose` (JWT) · `bcryptjs` · `pdf-lib` (reçus PDF) · `exceljs` (import/export Excel).

## Installation en local

Prérequis : Node.js 20.9 ou plus récent, PostgreSQL 14 ou plus récent.

```bash
git clone <url-du-depot> ecolefacile-rdc
cd ecolefacile-rdc
npm install
cp .env.example .env        # puis renseignez DATABASE_URL et AUTH_SECRET
createdb ecolefacile        # ou créez la base avec votre outil habituel
npm run db:migrate          # crée les tables
npm run db:seed             # facultatif : données de démonstration
npm run dev                 # http://localhost:3000
```

Comptes de démonstration créés par `npm run db:seed` :

| Rôle | E-mail | Mot de passe |
| --- | --- | --- |
| Administrateur plateforme | admin@ecolefacile.cd | Admin1234! |
| Directeur (Complexe Scolaire La Victoire) | directeur@demo.cd | Demo1234! |
| Caissier | caisse@demo.cd | Demo1234! |

Changez ou supprimez ces comptes avant toute mise en production.

## Mise en production

Recommandé : base PostgreSQL hébergée (Supabase, Neon…) et application sur Vercel ou un serveur Node.

1. Créez la base et récupérez l'URL de connexion. Avec Supabase, prenez l'URL du *Session pooler* (port 5432) ;
   l'application fonctionne aussi avec le *Transaction pooler* (6543) car les requêtes préparées sont désactivées.
2. Lancez les migrations depuis votre poste : `DATABASE_URL=... npm run db:migrate`.
3. Déclarez les variables d'environnement `DATABASE_URL` et `AUTH_SECRET` (48 caractères aléatoires) chez l'hébergeur.
4. Déployez (`npm run build` puis `npm start`, ou import du dépôt dans Vercel).
5. Créez votre compte administrateur plateforme (voir ci-dessous) et activez les sauvegardes automatiques de la base
   (incluses chez Supabase et Neon).

Créer un administrateur plateforme en production :

```bash
node -e "require('bcryptjs').hash(process.argv[1], 10).then(console.log)" 'VotreMotDePasse'
# puis, dans la base :
# insert into users (name, email, password_hash, role) values ('Admin', 'vous@domaine.cd', '<hash>', 'super_admin');
```

## Structure du code

```
db/migrations/        Schéma SQL versionné (appliqué par scripts/migrate.ts)
scripts/              Migration et données de démonstration
src/proxy.ts          Redirection vers /connexion sans session
src/lib/              Accès base, sessions et rôles, calcul des soldes, paiements, PDF, Excel
src/components/       Composants d'interface (formulaires, tableaux, menu latéral)
src/app/(auth)/       Connexion et inscription
src/app/(app)/        Espace école : tableau de bord, élèves, classes, frais, paiements, reçus, impayés, caisse, utilisateurs, paramètres
src/app/admin/        Administration de la plateforme
src/app/api/          Exports Excel, reçus PDF, logo
```

Règles de sécurité appliquées partout : chaque page et chaque action commence par `requireSchoolUser` /
`requireWriteAccess` (rôle, école suspendue, abonnement expiré), et toutes les requêtes filtrent sur `school_id`.

Le guide pour les écoles est dans [docs/GUIDE-UTILISATEUR.md](docs/GUIDE-UTILISATEUR.md).
