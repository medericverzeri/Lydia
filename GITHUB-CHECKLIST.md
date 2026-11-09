# C’est bon, arrêtez-vous là

Votre dépôt avec `src/` et `package.json` suffit.

N’ajoutez rien : pas de `.gitignore`, pas de `package-lock.json`, pas de `public`, pas de `.env.example`.

Dans Vercel : importez le dépôt, ajoutez les 3 variables `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, puis cliquez sur **Deploy**. Ensuite, toutes les modifications se font dans `/admin` avec **Enregistrer**, sans redéploiement.
