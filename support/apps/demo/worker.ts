import { setTimeout as delay } from "node:timers/promises";
import { ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import * as storage from "./storage.ts";

await storage.initialize(); await storage.health();
console.log("ワーカーを起動しました");
while (true) {
  let jobId: string | undefined;
  try {
    if (storage.isSQL) {
      const message = await (await storage.redis()).brPop("exports", 3);
      if (!message) continue;
      jobId = message.element; await storage.processJob(jobId);
    } else {
      const { client, url } = await storage.queue();
      const response = await client.send(new ReceiveMessageCommand({ QueueUrl: url, MaxNumberOfMessages: 1, WaitTimeSeconds: 5, VisibilityTimeout: 30 }));
      for (const message of response.Messages || []) {
        const body = JSON.parse(message.Body!) as { job_id: string }; jobId = body.job_id;
        await storage.processJob(jobId);
        await client.send(new DeleteMessageCommand({ QueueUrl: url, ReceiptHandle: message.ReceiptHandle! }));
      }
      if (!response.Messages?.length) continue;
    }
    console.log("ジョブを処理しました", jobId);
  } catch (error) {
    console.error("ジョブ処理に失敗しました", error);
    // SQSは削除せず再配信。Redisの単純なリストには同じ保証はありません。
    if (storage.isSQL && jobId) {
      try { await storage.updateJob(jobId, "failed", String(error)); } catch (saveError) { console.error(saveError); }
    }
    await delay(2000);
  }
}
