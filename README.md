# FLUX Task Manager

A task management application designed for AuADHD neurotypes, featuring the "Stream & Stone" design philosophy.

## Architecture

```
flux-app/
├── frontend/          # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/  # UI components (Card, Current, etc.)
│   │   ├── App.jsx      # Main application
│   │   └── index.css    # Global styles
│   └── dist/            # Production build output
│
├── backend/           # Express + SQLite
│   ├── server.js      # API routes
│   ├── database.js    # SQLite setup
│   └── tasks.db       # SQLite database file
│
└── package.json       # Unified npm scripts
```

## Quick Start

```bash
# Initial setup
npm run install:all

# Start development
npm run dev
```

**Frontend**: http://localhost:5173  
**Backend API**: http://localhost:3000

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend dev servers |
| `npm run build` | Build frontend for production |
| `npm run lint` | Run ESLint on frontend |
| `npm run start` | Start backend in production mode |
| `npm run clean` | Remove node_modules, dist, and database |
| `npm run install:all` | Install deps for root, frontend, and backend |

## API Endpoints

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/tasks` | Create a new task |
| `GET` | `/api/tasks/bundle` | Get a bundle of tasks (Airlock) |
| `PATCH` | `/api/tasks/:id` | Update task status |
| `POST` | `/api/tasks/breakdown` | Break down a task into steps |
| `POST` | `/api/tasks/jettison` | Reset all active tasks to inbox |

### Create Task
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"content": "Buy groceries"}'
```

### Get Bundle
```bash
curl http://localhost:3000/api/tasks/bundle?gravity=standard
```

## Core Concepts

- **Vault**: Low-friction task capture
- **Airlock**: Energy-calibrated task bundling  
- **Current**: Single-focus task execution view
- **Jettison**: Safety valve to reset when overwhelmed

## Environment Variables

Copy the template and customize:
```bash
cp backend/.env.example backend/.env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Backend server port |
| `NODE_ENV` | `development` | Environment mode |

## Docker (Optional)

```bash
# Start with Docker Compose
docker-compose up

# Rebuild after changes
docker-compose up --build
```
