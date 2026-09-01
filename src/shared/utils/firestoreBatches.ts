import { writeBatch, type Firestore, type WriteBatch } from 'firebase/firestore';

export const MAX_FIRESTORE_BATCH_WRITES = 450;

export type FirestoreBatchOperation = (batch: WriteBatch) => void;

export async function commitFirestoreBatches(db: Firestore, operations: FirestoreBatchOperation[]) {
  for (let start = 0; start < operations.length; start += MAX_FIRESTORE_BATCH_WRITES) {
    const batch = writeBatch(db);
    operations.slice(start, start + MAX_FIRESTORE_BATCH_WRITES).forEach(operation => operation(batch));
    await batch.commit();
  }
}
