# Manuale Utente Interattivo SAP WM — Biofarma Group

Applicazione web fullstack per la distribuzione e il tracciamento della lettura del Manuale SAP WM.

## Stack tecnico

- **Backend**: Node.js + Express + SQLite (better-sqlite3)
- **Auth**: JWT + bcrypt
- **Frontend**: HTML/CSS/JS vanilla (no framework)
- **Deploy**: Railway (Node.js + volume persistente per SQLite)

## Credenziali di default

| Email | Password | Ruolo |
|-------|----------|-------|
| admin@biofarma.it | Admin2026! | admin |

---

## Avvio in locale

```bash
cd backend
npm install
npm start
```

Il server parte su `http://localhost:3001`.
Le pagine frontend sono servite staticamente dallo stesso server:

| URL | Descrizione |
|-----|-------------|
| `http://localhost:3001/` | Login |
| `http://localhost:3001/manuale` | Manuale interattivo |
| `http://localhost:3001/admin` | Pannello amministrazione |

---

## Inserire il contenuto del manuale

Aprire `frontend/manuale.html` e modificare l'array `SECTIONS` a partire dalla riga con il commento `SEZIONI DEL MANUALE`:

```js
const SECTIONS = [
  {
    id: 'nome-sezione',       // identificatore unico (usato per analytics)
    title: 'Titolo Sezione',  // mostrato nella sidebar e nei grafici admin
    group: 'Gruppo',          // raggruppa più sezioni nella sidebar
    content: `<h1>...</h1><p>...</p>` // HTML della sezione
  },
  // ...
];
```

Se hai un file HTML del manuale esistente, puoi estrarne i contenuti e distribuirli nelle sezioni.

---

## API REST

### Auth
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login, restituisce JWT |
| POST | `/api/auth/logout` | Logout (invalida sessione) |
| GET  | `/api/auth/me` | Dati utente corrente |

### Analytics
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/analytics/ingresso` | Registra apertura sezione |
| POST | `/api/analytics/uscita` | Registra chiusura sezione + durata |
| GET  | `/api/analytics/mio-progresso` | Progresso dell'utente loggato |

### Admin (solo ruolo admin)
| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET  | `/api/admin/utenti` | Lista utenti con stats |
| POST | `/api/admin/utenti` | Crea nuovo utente |
| PATCH | `/api/admin/utenti/:id` | Modifica nome/ruolo/stato/password |
| DELETE | `/api/admin/utenti/:id` | Elimina utente |
| GET  | `/api/admin/utenti/:id/dettaglio` | Dettaglio letture di un utente |
| GET  | `/api/admin/statistiche` | Dashboard globale |

---

## Deploy su Railway

### 1. Preparazione

```bash
# Dalla root del progetto
git init
git add .
git commit -m "Initial commit"
```

### 2. Crea progetto su Railway

1. Vai su [railway.app](https://railway.app) e crea un nuovo progetto
2. Collega il repository GitHub oppure usa **Deploy from local** con la Railway CLI

### 3. Configura le variabili d'ambiente

Nel pannello Railway → **Variables**, aggiungi:

```
NODE_ENV=production
PORT=3001
JWT_SECRET=cambia_questo_con_una_stringa_casuale_lunga
DB_PATH=/data/biofarma.db
```

### 4. Volume persistente per SQLite

Nel pannello Railway → **Volumes**:
- Crea un volume e montalo su `/data`
- Questo garantisce che il database SQLite sopravviva ai redeploy

### 5. Root Directory

Nel pannello Railway → **Settings** → **Root Directory**:
- Imposta `backend`

### 6. Start Command

Railway rileverà automaticamente `npm start` da `package.json`.

### 7. Custom Domain (opzionale)

Nel pannello Railway → **Settings** → **Domains**, aggiungi il tuo dominio aziendale.

---

## Variabili d'ambiente

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `PORT` | `3001` | Porta del server |
| `JWT_SECRET` | *(stringa di fallback)* | **Cambiare in produzione!** |
| `JWT_EXPIRES` | `8h` | Scadenza token JWT |
| `DB_PATH` | `./data/biofarma.db` | Percorso database SQLite |
| `FRONTEND_URL` | `*` | Origin CORS consentito |

---

## Struttura file

```
manuale-biofarma/
├── backend/
│   ├── server.js          # Entry point Express
│   ├── database.js        # Init SQLite + schema + admin default
│   ├── routes/
│   │   ├── auth.js        # Login / logout / me
│   │   ├── analytics.js   # Tracciamento lettura
│   │   └── admin.js       # CRUD utenti + statistiche
│   └── package.json
├── frontend/
│   ├── login.html         # Schermata di accesso
│   ├── manuale.html       # Manuale interattivo (SECTIONS da compilare)
│   └── admin.html         # Dashboard amministrazione
└── README.md
```
