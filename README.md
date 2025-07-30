# Ebra Call Orchestrator

A backend service that manages AI-driven phone call requests using Kafka, Redis, and Prisma.

## Getting Started

1. **Build & run services**

   ```bash
   docker-compose up --build -d
   ```

2. **Apply database migrations**

   ```bash
   docker-compose exec api npx prisma migrate dev --name init
   ```

3. **Restart services**

   ```bash
   docker-compose up -d
   ```

4. **Verify health**

   ```bash
   curl http://localhost:3000/health
   ```

5. **View metrics**

   ```bash
   curl -s http://localhost:3000/api/v1/metrics | python -m json.tool
   ```

## API Usage

* **Enqueue a call**

This call will randomly pick any status, if not `COMPLETED`, then it will be proceeced again "up to 3 times" till it ends up either in `COMPLETED` or `FAILED`.

```bash
curl -X POST http://localhost:3000/api/v1/calls \
  -H "Content-Type: application/json" \
  -d '{"to":"+966501234567","scriptId":"welcomeFlow"}'
```

* **Fail‑twice → succeed**

```bash
curl -s -X POST http://localhost:3000/api/v1/calls \
  -H "Content-Type: application/json" \
  -d '{"to":"+966-FAIL_THEN_SUCCESS_NUMBERS","scriptId":"stressTest"}' \
  | python -m json.tool
  ```

* **Permanent failure**

```bash
curl -s -X POST http://localhost:3000/api/v1/calls \
  -H "Content-Type: application/json" \
  -d '{"to":"+966-PERM_FAIL_NUMBERS","scriptId":"stressTest"}' \
  | python -m json.tool
```

## Stress Testing

```bash
for i in $(seq 1 100); do
  curl -s -o /dev/null -X POST http://localhost:3000/api/v1/calls \
       -H "Content-Type: application/json" \
       -d "{\"to\":\"+96650$(printf '%05d' $i)\",\"scriptId\":\"stressTest\"}" &
done
wait
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