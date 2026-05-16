# dropshippingPage

## Connexion Supabase

Le formulaire du site envoie les leads vers `/api/lead`. Cette API enregistre ensuite chaque lead dans Supabase, dans la table `leads`.

### 1. Créer la table dans Supabase

Dans Supabase :

1. Ouvre ton projet.
2. Va dans `SQL Editor`.
3. Clique sur `New query`.
4. Colle ce SQL.
5. Clique sur `Run`.

```sql
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  source text not null default 'masterclass',
  email_verified_at timestamptz,
  email_verification_code_hash text,
  email_verification_expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.leads
  add column if not exists email_verified_at timestamptz,
  add column if not exists email_verification_code_hash text,
  add column if not exists email_verification_expires_at timestamptz;

update public.leads
set email = lower(trim(email)),
    phone = case
      when regexp_replace(phone, '[^0-9+]', '', 'g') like '+%' then regexp_replace(phone, '[^0-9+]', '', 'g')
      when length(regexp_replace(phone, '[^0-9]', '', 'g')) = 9 then '+34' || regexp_replace(phone, '[^0-9]', '', 'g')
      when length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10 and left(regexp_replace(phone, '[^0-9]', '', 'g'), 1) = '0' then '+34' || substring(regexp_replace(phone, '[^0-9]', '', 'g') from 2)
      when length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 10 then '+' || regexp_replace(phone, '[^0-9]', '', 'g')
      else regexp_replace(phone, '[^0-9+]', '', 'g')
    end;

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create unique index if not exists leads_email_unique_idx on public.leads (lower(trim(email)));
create unique index if not exists leads_phone_unique_idx on public.leads (phone);
```

Le même SQL est aussi disponible dans `supabase.sql`.

Si Supabase refuse de créer les index uniques, c'est qu'il existe déjà des doublons dans la table. Il faut supprimer ou fusionner les anciennes lignes en double, puis relancer le SQL.

### 2. Ajouter les variables dans Vercel

Dans Vercel :

1. Ouvre ton projet.
2. Va dans `Settings`.
3. Va dans `Environment Variables`.
4. Ajoute ces variables :

```txt
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=....
SUPABASE_LEADS_TABLE=leads
```

Tu trouves ces valeurs dans Supabase :

```txt
SUPABASE_URL = Project Settings > API > Project URL
SUPABASE_SERVICE_ROLE_KEY = Project Settings > API > service_role key
```

Important : `SUPABASE_SERVICE_ROLE_KEY` doit rester côté serveur uniquement. Ne la mets jamais dans `index.html`, `script.js` ou un fichier public.

### 3. Redéployer

Après avoir ajouté les variables dans Vercel, redéploie le site pour que `/api/lead` puisse les utiliser.

### Vérification email et téléphone

Le formulaire vérifie les données côté serveur avant d'enregistrer le lead. Les deux vérifications sont lancées en parallèle avec un timeout court pour éviter de faire attendre les clients.

Service choisi : Abstract API, car il permet de vérifier email et téléphone avec une intégration simple et rapide.

Ajoute ces variables dans Vercel :

```txt
ABSTRACT_EMAIL_API_KEY=...
ABSTRACT_PHONE_API_KEY=...
```

À créer ici :

```txt
Email validation: https://www.abstractapi.com/email-verification-validation-api
Phone validation: https://www.abstractapi.com/phone-validation-api
```

Important : sans ces variables, le formulaire continue de fonctionner, mais la vérification externe est ignorée. Pour vérifier qu'une personne possède vraiment son numéro, il faut ajouter ensuite un code SMS OTP, par exemple avec Twilio Verify. C'est plus sûr, mais ça ralentit l'inscription.

Le formulaire vérifie aussi la possession de l'email avec un code à 6 chiffres. Le client ne reçoit l'accès à la masterclass qu'après avoir saisi le code envoyé par email.

Variable optionnelle recommandée :

```txt
VERIFICATION_SECRET=une_longue_valeur_secrete
```

Important : comme le code est envoyé par email, un service email SMTP ou Resend doit être configuré. Sinon le client ne pourra pas confirmer son email.

### Emails sans domaine avec Gmail

Le formulaire envoie une notification admin par défaut à `ecomsanz01@gmail.com`.

Si tu n'as pas de domaine, utilise Gmail SMTP :

```txt
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=ecomsanz01@gmail.com
SMTP_PASS=mot_de_passe_application_google
FROM_EMAIL=Kevin Sanz <ecomsanz01@gmail.com>
ADMIN_EMAIL=ecomsanz01@gmail.com
```

Pour créer `SMTP_PASS` :

1. Va dans ton compte Google.
2. Active la validation en 2 étapes.
3. Va dans `Sécurité > Mots de passe des applications`.
4. Crée un mot de passe pour l'application `Mail`.
5. Copie le code de 16 caractères dans `SMTP_PASS`.

N'utilise pas ton vrai mot de passe Gmail dans Vercel.

### Emails Resend avec domaine

Si tu achètes un domaine plus tard, tu peux aussi utiliser Resend. Dans ce cas, ajoute :

```txt
RESEND_API_KEY=...
FROM_EMAIL=Kevin Sanz <noreply@ton-domaine.com>
ADMIN_EMAIL=ecomsanz01@gmail.com
```

Si aucun service email n'est configuré, le lead sera quand même enregistré dans Supabase, mais aucun email ne sera envoyé.
