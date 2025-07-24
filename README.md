# Ebra Call Orchestrator

This is a backend service for orchestrating AI-powered voice calls, built for the Ebra assessment. It handles incoming call requests, tracks their status, retries on failure, and simulates interaction with an external AI voice provider.

---

## 📦 Tech Stack

* **Node.js + TypeScript**
* **Express.js**
* **PostgreSQL**
* **Prisma ORM**
* **Docker + Docker Compose**
* **Mock AI Provider (simulated)**

---

## 🚀 Getting Started

### 1. Prerequisites

* [Docker](https://www.docker.com/products/docker-desktop/) installed and running
* (Optional) [Postman](https://www.postman.com/downloads/) or `curl` to test the API

---

### 2. Clone the repository

```bash
git clone https://github.com/ihani/ebra-backend.git ebra-backend
cd ebra-backend
```

---

### 3. Start the app with Docker


```bash
docker-compose up --build
```

---

### 4. Run Database Migrations

In a separate terminal, apply the DB schema and generate the Prisma client:

```bash
docker-compose run --rm api npx prisma migrate dev --name init
```

---

### 5. Open Prisma Studio (Database GUI)

Launch the GUI to view or edit DB records:

```bash
docker-compose run --rm -p 5555:5555 api npx prisma studio
```

Then open your browser at:

```
http://localhost:5555
```

---

## 🧪 API Testing

### Endpoint to create a call:

```http
POST /api/v1/calls
```

#### Example JSON Body:

```json
{
  "to": "+966500000001",
  "scriptId": "welcome-flow",
  "metadata": {
    "lang": "ar"
  }
}
```

---

### View call metrics:

```http
GET /api/v1/calls/metrics
```

---

## 📂 Project Structure

```
src/
├── api/
│   ├── calls.ts         # Call management routes
│   ├── callbacks.ts     # AI provider callback endpoint
│   └── mock-provider.ts # Simulated external AI call handler
├── jobs/
│   ├── worker.ts        # Background worker logic
│   └── index.ts         # Worker loop entry
└── index.ts             # Main Express app
```

---

## 📄 Environment Variables

Set in `docker-compose.yml`:

```env
DATABASE_URL=postgresql://ebra:password@db:5432/ebra_db
WEBHOOK_URL=http://api:3000/api/v1/callbacks/call-status
AI_PROVIDER_URL=http://mock-ai:4000/start
```

---

## 🚜 Cleanup

Stop all running containers:

```bash
docker-compose down
```

---

## ✅ Status

* [x] Dockerized PostgreSQL, API, and worker
* [x] Prisma setup with migrations and GUI
* [x] Mock AI call provider
* [x] Retry logic and metrics
