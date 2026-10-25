import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { CreateChallengeInput } from "../shared/contracts";

export interface ChallengeRecord extends CreateChallengeInput {
  id: string;
  ownerId: string;
  createdAt: string;
  archivedAt: string | null;
}

export class ChallengeRepository {
  private db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    try {
      const version = Number(
        this.db.prepare("PRAGMA user_version").get()!.user_version,
      );
      const supportedVersion = 2;
      if (version > supportedVersion || version < 0) {
        throw new Error(
          `Неподдерживаемая версия схемы SQLite: ${version}; поддерживается до ${supportedVersion}.`,
        );
      }
      this.db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
      if (version < supportedVersion) {
        this.db.exec("BEGIN IMMEDIATE");
        try {
          if (version === 0) {
            this.db.exec(`
              CREATE TABLE challenges (
                id TEXT PRIMARY KEY, ownerId TEXT NOT NULL, title TEXT NOT NULL,
                startDate TEXT NOT NULL, duration INTEGER NOT NULL CHECK(duration BETWEEN 1 AND 30),
                timeZone TEXT NOT NULL, createdAt TEXT NOT NULL, archivedAt TEXT
              );
              CREATE INDEX challenges_owner ON challenges(ownerId, createdAt);
              CREATE TABLE check_ins (
                challengeId TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
                date TEXT NOT NULL, PRIMARY KEY(challengeId, date)
              );
            `);
          } else if (version === 1) {
            this.db.exec("ALTER TABLE challenges ADD COLUMN archivedAt TEXT;");
          }
          this.db.exec("PRAGMA user_version = 2; COMMIT;");
        } catch (cause) {
          this.db.exec("ROLLBACK");
          throw cause;
        }
      }
      this.db.exec("PRAGMA journal_mode = WAL;");
    } catch (cause) {
      this.db.close();
      throw cause;
    }
  }
  create(
    ownerId: string,
    input: CreateChallengeInput,
    now: Date,
  ): ChallengeRecord {
    const record = {
      ...input,
      id: randomUUID(),
      ownerId,
      createdAt: now.toISOString(),
      archivedAt: null,
    };
    this.db
      .prepare(
        "INSERT INTO challenges (id, ownerId, title, startDate, duration, timeZone, createdAt, archivedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        record.id,
        ownerId,
        input.title,
        input.startDate,
        input.duration,
        input.timeZone,
        record.createdAt,
        record.archivedAt,
      );
    return record;
  }
  list(
    ownerId: string,
    limit: number,
    offset: number,
    archived = false,
  ): ChallengeRecord[] {
    return this.db
      .prepare(
        "SELECT * FROM challenges WHERE ownerId = ? AND (archivedAt IS NOT NULL) = ? ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?",
      )
      .all(
        ownerId,
        Number(archived),
        limit,
        offset,
      ) as unknown as ChallengeRecord[];
  }
  count(ownerId: string, archived = false): number {
    return Number(
      this.db
        .prepare(
          "SELECT COUNT(*) AS count FROM challenges WHERE ownerId = ? AND (archivedAt IS NOT NULL) = ?",
        )
        .get(ownerId, Number(archived))!.count,
    );
  }
  find(id: string, ownerId: string): ChallengeRecord | undefined {
    return this.db
      .prepare("SELECT * FROM challenges WHERE id = ? AND ownerId = ?")
      .get(id, ownerId) as unknown as ChallengeRecord | undefined;
  }
  archive(id: string, ownerId: string, now: Date): void {
    this.db
      .prepare(
        "UPDATE challenges SET archivedAt = COALESCE(archivedAt, ?) WHERE id = ? AND ownerId = ?",
      )
      .run(now.toISOString(), id, ownerId);
  }
  dates(id: string): string[] {
    return this.db
      .prepare("SELECT date FROM check_ins WHERE challengeId = ? ORDER BY date")
      .all(id)
      .map((row) => String(row.date));
  }
  mark(id: string, date: string): void {
    this.db
      .prepare(
        "INSERT INTO check_ins (challengeId, date) VALUES (?, ?) ON CONFLICT DO NOTHING",
      )
      .run(id, date);
  }
  unmark(id: string, date: string): void {
    this.db
      .prepare("DELETE FROM check_ins WHERE challengeId = ? AND date = ?")
      .run(id, date);
  }
  close(): void {
    this.db.close();
  }
}
