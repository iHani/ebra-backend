#!/bin/sh

# Wait until Api is ready
echo "⏳ Waiting for Api to be ready..."

while ! nc -z api 9092; do
  sleep 1
done

echo "✅ Api is ready. Starting worker..."
exec "$@"
