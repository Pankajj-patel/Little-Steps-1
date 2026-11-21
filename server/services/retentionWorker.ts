import type { LittleStepsRepository } from '../repositories/index.ts';
import type { MediaStorageAdapter } from '../storage/mediaStorage.ts';

export class RetentionWorker {
  private timer: NodeJS.Timeout | null = null;
  public lastSweepAt: string | null = null;
  private readonly repo: LittleStepsRepository;
  private readonly storage: MediaStorageAdapter;

  constructor(repo: LittleStepsRepository, storage: MediaStorageAdapter) {
    this.repo = repo;
    this.storage = storage;
  }

  async runSweep(): Promise<{ purgedCount: number; sweptAt: string }> {
    const expired = this.repo.listExpiredActiveSubmissions();
    let purgedCount = 0;

    for (const item of expired) {
      await this.storage.deleteObject(item.storage_key);
      this.repo.markSubmissionVideoDeleted(item.id, 'retention_30d');
      this.repo.logMediaAudit(null, 'system', item.id, 'auto_purge');
      purgedCount += 1;
    }

    this.lastSweepAt = new Date().toISOString();
    return { purgedCount, sweptAt: this.lastSweepAt };
  }

  startHourlySchedule(): void {
    if (this.timer) return;
    void this.runSweep();
    this.timer = setInterval(() => {
      void this.runSweep();
    }, 60 * 60 * 1000);
    this.timer.unref();
  }
}
