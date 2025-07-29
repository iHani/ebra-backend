# Ebra Call Orchestrator

A backend service that manages AI-driven phone call requests. It provides:

- A REST API to enqueue call jobs
- A background worker to invoke an external AI call provider
- A webhook receiver for call status updates
- A metrics endpoint for real-time service visibility
- A Redis cache for locking phone numbers
- A Kafka queue for receiving call requests

---

## Tech Stack

- Node.js (TypeScript)
- Express.js
- PostgreSQL
- Prisma ORM
- Docker & Docker Compose
- Redis
- Kafka

---

## Getting Started

Run the full stack with a single command:

```bash
docker-compose up --build
# then
docker-compose run --rm api npx prisma migrate deploy
```


Check server health http://localhost:3000/health


### Create a Call

```bash
curl -X POST http://localhost:3000/api/v1/calls \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+966501234567",
    "scriptId": "welcomeFlow",
    "metadata": { "customerId": "12345" }
  }'

  ```


### Get Call Metrics

```bash
curl http://localhost:3000/api/v1/metrics
// or
curl -s http://localhost:3000/api/v1/metrics | python -m json.tool

```

```json
{
  "PENDING": 2,
  "IN_PROGRESS": 1,
  "COMPLETED": 4,
  "FAILED": 0,
  "EXPIRED": 0
}
```

#### Database GUI

Run prisma studio 

```bash
docker-compose run --rm -p 5555:5555 api npx prisma studio
```