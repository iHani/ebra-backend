// src/kafka.ts
import { Kafka, Producer } from 'kafkajs';

const kafka = new Kafka({
    clientId: 'ebra-orchestrator',
    brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
});

const kafkaProducer: Producer = kafka.producer();

export async function startKafkaProducer() {
    await kafkaProducer.connect();
    console.log('✅ Kafka producer connected');
}

export { kafkaProducer };
export default kafka;
