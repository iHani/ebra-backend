// src/types/index.ts
import { CallStatus } from '@prisma/client';

export interface CreateCallInput {
    to: string;
    scriptId: string;
    metadata?: Record<string, any>;
}

export interface UpdateCallPayload {
    scriptId?: string;
    metadata?: Record<string, any>;
}

export interface CallQuery {
    status?: CallStatus;
}

export interface CallStatusPayload {
    callId: string;
    status: CallStatus;
    completedAt: string;
}

export interface CallRecord {
    id: string;
    to: string;
    scriptId: string;
    attempts: number;
}

