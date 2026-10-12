import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

export const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

export const generationQueue = new Queue("problem-generation", { connection });
export const diagnosisQueue = new Queue("mistake-diagnosis", { connection });

export const generationEvents = new QueueEvents("problem-generation", { connection });
export const diagnosisEvents = new QueueEvents("mistake-diagnosis", { connection });
