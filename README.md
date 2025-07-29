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
# after seeing the api container up and running, do:
docker-compose exec api npx prisma migrate dev --name init
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
displays the number of calls in each status- refreshed every second

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


Live‑Updating Metrics Using a Bash Loop + Python

```bash
while true; do
  clear
  echo "=== Metrics @ $(date '+%T') ==="
  curl -s http://localhost:3000/api/v1/metrics | python -m json.tool
  sleep 1
done
```

Bulk Stress Test (100 Calls)

```bash
for i in $(seq 1 100); do
  curl -s -X POST http://localhost:3000/api/v1/calls \
       -H "Content-Type: application/json" \
       -d '{
             "to": "+96650'"$(printf "%05d" $i)"'",
             "scriptId": "stressTest"
           }' \
    &   # background each request
done
wait
```

# 1) Immediate success
curl -s -X POST http://localhost:3000/api/v1/calls \
  -H "Content-Type: application/json" \
  -d '{"to":"+966501234567","scriptId":"stressTest","metadata":{"override":"FORCE_SUCCESS"}}' \
| python -m json.tool

# 2) Two fails then success (Wait ~45 s for the two 20 s retries to run through before checking its final state.)

curl -s -X POST http://localhost:3000/api/v1/calls \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+966-FAIL_THEN_SUCCESS_NUMBERS",
    "scriptId": "stressTest"
  }' | python -m json.tool


# 3) Permanent failure
curl -s -X POST http://localhost:3000/api/v1/calls \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+966-PERM_FAIL_NUMBERS",
    "scriptId": "stressTest"
  }' | python -m json.tool

