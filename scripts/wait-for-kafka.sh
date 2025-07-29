#!/bin/sh

# Wait until api container is up and running
echo "⏳ Waiting for api to be ready..."

while ! nc -z api 9092; do
  sleep 1
done

echo "✅ api is ready. Starting worker..."
exec "$@"

