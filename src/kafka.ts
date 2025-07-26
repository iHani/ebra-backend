// src/kafka.ts
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
    clientId: 'ebra-orchestrator',
    brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
});

export default kafka;
