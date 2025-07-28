#!/bin/sh

# Wait until Kafka is ready
echo "⏳ Waiting for Kafka to be ready..."

while ! nc -z kafka 9092; do
  sleep 1
done

echo "✅ Kafka is ready. Starting worker..."
exec "$@"
