# dropshippingPage

## API du formulaire

Le formulaire du site envoie les leads vers `/api/lead`.

La connexion Supabase est désactivée : l'API ne crée plus de client Supabase et n'enregistre plus les leads dans une table distante.

La connexion Resend est désactivée : l'API ne lit plus `RESEND_API_KEY` et n'appelle plus l'API Resend.

## Développement local

Pour développer localement :

1. Copie `.env.example` vers `.env`.
2. Remplis seulement les variables dont tu as besoin.
3. Lance `npm run dev`.

## Variables disponibles

Le formulaire peut fonctionner sans service externe. Si aucun SMTP n'est configuré, l'API accepte quand même le lead et ignore l'envoi email.

### Email SMTP optionnel

```txt
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=ecomsanz01@gmail.com
SMTP_PASS=mot_de_passe_application_google
FROM_EMAIL=Kevin Sanz <ecomsanz01@gmail.com>
ADMIN_EMAIL=ecomsanz01@gmail.com
```

Pour créer `SMTP_PASS` avec Gmail :

1. Va dans ton compte Google.
2. Active la validation en 2 étapes.
3. Va dans `Sécurité > Mots de passe des applications`.
4. Crée un mot de passe pour l'application `Mail`.
5. Copie le code de 16 caractères dans `SMTP_PASS`.

N'utilise pas ton vrai mot de passe Gmail dans Vercel.

### Validation externe optionnelle

Ces variables restent optionnelles. Sans elles, la validation externe est ignorée.

```txt
ABSTRACT_EMAIL_API_KEY=...
ABSTRACT_PHONE_API_KEY=...
```
