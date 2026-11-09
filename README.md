# Matériosol — site éditable

Réplique fidèle de la structure visuelle du site de référence, adaptée à **Lydia Charpentier**, chargée de développement **Matériosol**. Le logo Déchèt’Lab de l’accueil est remplacé par le logo Matériosol fourni.

## Fonctionnalités

- Site public avec la CSS originale : accueil, présentation, carrousel du réseau, galerie, albums, lightbox, horaires, mentions légales, formulaire de contact.
- Toutes les données viennent de PostgreSQL via Drizzle ORM : textes, couleurs, navigation, images, albums, entreprises, contact, libellés et pages privées.
- Administration sécurisée à `/admin` : mot de passe serveur, session HMAC signée et cookie `httpOnly`.
- **Le site public ne change qu’en cliquant sur « Enregistrer ».** L’éditeur travaille sur un brouillon local. Un bouton distinct permet d’enregistrer uniquement le brouillon sans publier.
- Édition structurée de toutes les sections + éditeur **JSON avancé** pour les moindres propriétés.
- Galerie média et téléversement d’images JPG/PNG/WebP/GIF/AVIF et de PDF. Les fichiers sont enregistrés **dans PostgreSQL** et servis par `/api/media/<id>` : pas de lien externe, pas de stockage objet payant.
- Pages privées à `/p/<slug>` : absentes du menu, absentes du `robots.txt` et `noindex`. Chaque section de navigation peut aussi être retirée du menu et transformée en page privée.
- Messages du formulaire visibles et gérables dans l’administration.
- Sauvegarde/import JSON du contenu.

## Démarrage local

```bash
npm install
npx drizzle-kit push   # facultatif : les tables sont aussi créées automatiquement au premier accès
npm run dev
```

Variables dans `.env` :

```env
DATABASE_URL=postgresql://...
ADMIN_PASSWORD="un-mot-de-passe-long"
ADMIN_SESSION_SECRET="une-cle-aleatoire-d-au-moins-24-caracteres"
```

Le mot de passe et la clé de session ne sont jamais écrits dans le code client. **Sur Vercel**, définissez `ADMIN_PASSWORD` et `ADMIN_SESSION_SECRET` dans *Project Settings* : ils sont obligatoires. **Dans l’aperçu local**, si ces variables sont absentes, la page `/admin` propose une seule fois de créer le mot de passe ; son hash et une clé de session aléatoire sont alors stockés dans PostgreSQL. Aucun identifiant de démonstration n’est nécessaire dans un fichier `.env.local`.

## Dépôt minimal : ce qui suffit vraiment

**Le dossier `src/` et `package.json` suffisent.** Les fichiers `public/`, `.gitignore`, `.env.example`, `package-lock.json` et `next-env.d.ts` ne sont pas nécessaires pour déployer : n’essayez pas de les ajouter.

Les 56 images et le PDF sont déjà embarqués dans `src/`. Au premier lancement, ils sont restaurés automatiquement dans PostgreSQL.

Un seul contrôle après déploiement : ouvrez `/api/health`. Si la réponse contient `ok: true` et `embeddedMediaInBuild: 56`, tout est bon.

## Publication gratuite sur Vercel — une seule fois

1. Créez une base PostgreSQL gratuite chez **Neon** (ou Supabase) et copiez sa chaîne de connexion. Elle doit être **externe et persistante** : c’est elle qui permet d’enregistrer en direct sans redéploiement.
2. Poussez ce projet sur GitHub tel qu’il est. Ne publiez jamais de fichier `.env` : les secrets se saisissent directement dans Vercel à l’étape 4.
3. Dans Vercel : *Add New → Project*, importez le dépôt, laissez Next.js être détecté.
4. Dans *Project Settings → Environment Variables*, ajoutez pour **Production** :
   - `DATABASE_URL` : l’URL Neon (avec `?sslmode=require` si demandé)
   - `ADMIN_PASSWORD` : une phrase longue et unique
   - `ADMIN_SESSION_SECRET` : générée avec `openssl rand -hex 32`
5. Cliquez sur **Deploy**. Les tables et le contenu initial sont créés automatiquement au premier accès. Aucune migration manuelle n’est obligatoire.
6. Ouvrez `/api/health` : si vous voyez `ok: true`, c’est terminé. Ouvrez ensuite `/admin` et connectez-vous.

L’onglet **Publication & Vercel** de l’administration contient ce pas-à-pas, un bouton pour copier les variables et un diagnostic de la configuration.

## Modifier le site en direct, sans redéployer

Une fois le site déployé, **ne touchez plus au déploiement pour le contenu** :

1. Ouvrez `https://votre-site.vercel.app/admin`.
2. Modifiez textes, couleurs, navigation, galerie, photos ou PDF.
3. Téléversez les nouveaux fichiers depuis l’admin : ils sont enregistrés dans PostgreSQL, pas sur le disque éphémère de Vercel.
4. Cliquez sur **Enregistrer** (ou « Enregistrer et publier » dans l’onglet Publication & Vercel).
5. C’est en ligne : les pages sont rendues dynamiquement depuis la base. Les pages déjà ouvertes détectent la nouvelle version en moins de 12 secondes et se rafraîchissent seules ; les autres visiteurs voient immédiatement la nouvelle version.

`Enregistrer le brouillon` garde le travail sur le serveur **sans modifier le site public**. `Restaurer la version publiée` annule les modifications non publiées.

**Sans redéploiement** : tous les textes, thèmes, boutons de navigation, horaires, entreprises, galeries, albums, contacts, pages privées, photos et PDF téléversés, messages.

**Redéploiement nécessaire uniquement pour le code** : modifier un composant React, la CSS, changer les variables d’environnement ou mettre à jour le projet. Dans ce cas : `git push` → Vercel redéploie automatiquement.

Aucune API payante ni service de stockage d’images n’est nécessaire. Les médias sont restaurés dans la table `media_assets` ; les nouveaux téléversements arrivent dans cette même table.

## Sécurité

- Tous les endpoints `/api/admin/*` vérifient la session signée côté serveur.
- Le mot de passe est comparé en temps constant après hachage.
- Les téléversements sont limités à 15 Mo, filtrés par type MIME/extension et par signature binaire.
- Les fichiers servis depuis la base utilisent `X-Content-Type-Options: nosniff`.
- `/admin`, `/p/*` et `/api/*` sont exclus des robots ; l’administration et les pages privées sont en `noindex`.
- Le formulaire public comprend un honeypot anti-spam et des validations serveur.

## Pages cachées

Dans *Identité & thème → Navigation & sections masquables*, décochez « Afficher dans le menu » et cochez « Page privée » pour retirer une section de la page principale. Le bouton « Lien privé » copie son URL `/p/<slug>`.

Dans *Pages masquées*, créez des pages de documents avec PDF et choisissez si leur bouton apparaît ou non dans la navigation. Une page d’exemple est disponible à `/p/espace-pro` avec une plaquette PDF locale.
