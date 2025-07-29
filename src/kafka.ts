// src/kafka.ts
import { Kafka, Producer, Consumer } from 'kafkajs';

const kafka = new Kafka({
    clientId: 'ebra-orchestrator',
    brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
});

export const kafkaProducer: Producer = kafka.producer();
export const kafkaConsumer: Consumer = kafka.consumer({ groupId: 'call-workers' });

export async function startKafkaProducer(retries = 5, delayMs = 2000): Promise<void> {
    for (let i = 0; i < retries; i++) {
        try {
            await kafkaProducer.connect();
            console.log('✅ Kafka producer connected');
            return;
        } catch (err) {
            console.warn(`[Kafka] Retry ${i + 1}/${retries}...`);
            if (i === retries - 1) throw err;
            await new Promise((res) => setTimeout(res, delayMs));
        }
    }
}

export async function startKafkaConsumer(
    retries = 10,
    delayMs = 2000
): Promise<void> {
    for (let i = 0; i < retries; i++) {
        try {
            await kafkaConsumer.connect();
            console.log('✅ Kafka consumer connected');
            return;
        } catch (err) {
            console.warn(`[Kafka] Consumer retry ${i + 1}/${retries}...`);
            if (i === retries - 1) throw err;
            await new Promise((res) => setTimeout(res, delayMs));
        }
    }
}


export default kafka;

