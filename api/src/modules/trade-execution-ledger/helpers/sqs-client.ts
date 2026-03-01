import { SQSClient } from '@aws-sdk/client-sqs';

/**
 * Creates a shared SQS client configuration used by trade execution modules.
 */
export const createSharedSqsClient = (): SQSClient =>
  new SQSClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
