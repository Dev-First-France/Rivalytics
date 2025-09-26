# Guide d'installation et de démarrage du projet Backend NestJS

## Prérequis

- Node.js installé
- PostgreSQL installé et en cours d'exécution

## Structure du projet

Vision rapide de l'organisation des fichiers :

```
backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   └── users.controller.ts
│   └── auth/
│       ├── auth.module.ts
│       ├── auth.service.ts
│       └── auth.controller.ts
├── .env
├── package.json
```

## 1. Installer NestJS CLI

```bash
npm i -g @nestjs/cli
```

## 2. Créer un nouveau projet NestJS

```bash
nest new backend
```

## 3. Installer les dépendances du projet

Placez-vous dans le dossier du projet :

```bash
cd backend
npm install
```
> Installe toutes les dépendances nécessaires.

## 4. Installer Prisma et initialiser la configuration

```bash
npm install @prisma/client
npm install -D prisma
npx prisma init
```
> Crée le dossier `prisma` et le fichier `prisma/schema.prisma`.

## 5. Configurer la connexion à la base de données

Dans `prisma/schema.prisma` :

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

Dans `.env` :

```env
DATABASE_URL="postgresql://user:password@localhost:5432/rivalytics"
```

## 5.1 Créer une table User dans schema.prisma

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
}
```

## 6. Synchroniser Prisma avec la base de données

Après avoir défini vos modèles dans `schema.prisma`, exécutez :

```bash
npx prisma migrate dev --name init
```
> Crée les tables dans PostgreSQL selon votre schéma.

Générez ensuite le client Prisma :

```bash
npx prisma generate
```

## 7. Démarrer le serveur NestJS

```bash
npm run start:dev
```
> Vérifiez que le serveur démarre correctement.

## 8. Créer les modules Users et Auth

```bash
nest g module users
nest g module auth
nest g service auth
nest g controller auth
```

## 9. Mettre en place l'authentification JWT

Installez les dépendances nécessaires :

```bash
npm install @nestjs/passport passport passport-local @nestjs/jwt passport-jwt bcrypt
```

- Le dossier `users` gère les comptes utilisateurs.
- Le dossier `auth` gère les fonctionnalités de login et d'inscription.

## 10. Outils utiles pour la base de données

### Prisma Studio

Pour explorer et modifier vos tables via une interface graphique :

```bash
npx prisma studio
```

---

Pour plus d'informations, consultez la [documentation officielle NestJS](https://docs.nestjs.com/) et [Prisma](https://www.prisma.io/docs).