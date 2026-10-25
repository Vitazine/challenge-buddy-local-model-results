import type { Challenge, CreateChallengeInput } from "../shared/contracts";
import { addDays, todayInZone } from "../shared/dates";
import { AppError } from "./errors";
import { ChallengeRepository, type ChallengeRecord } from "./repository";

export class ChallengeService {
  constructor(
    private repository: ChallengeRepository,
    private clock: () => Date = () => new Date(),
  ) {}
  private present(record: ChallengeRecord): Challenge {
    const { ownerId: _ownerId, ...publicRecord } = record;
    void _ownerId;
    const endDate = addDays(record.startDate, record.duration - 1);
    const today = todayInZone(record.timeZone, this.clock());
    const checkIns = this.repository.dates(record.id);
    return {
      ...publicRecord,
      endDate,
      today,
      checkIns,
      progress: Math.round((checkIns.length / record.duration) * 100),
      canCheckIn: today >= record.startDate && today <= endDate,
      status:
        today < record.startDate
          ? "upcoming"
          : today > endDate
            ? "finished"
            : "active",
      archivedAt: record.archivedAt ?? null,
    };
  }
  list(ownerId: string, page: number, pageSize: number) {
    return {
      items: this.repository
        .list(ownerId, pageSize, (page - 1) * pageSize)
        .map((row) => this.present(row)),
      page,
      pageSize,
      total: this.repository.count(ownerId),
    };
  }
  create(ownerId: string, input: CreateChallengeInput): Challenge {
    return this.present(this.repository.create(ownerId, input, this.clock()));
  }
  get(ownerId: string, id: string): Challenge {
    const record = this.repository.find(id, ownerId);
    if (!record) throw new AppError(404, "NOT_FOUND", "Челлендж не найден.");
    return this.present(record);
  }
  checkIn(ownerId: string, id: string, marked: boolean): Challenge {
    const challenge = this.get(ownerId, id);
    if (challenge.archivedAt != null)
      throw new AppError(
        409,
        "ARCHIVED",
        "Челлендж архивирован. Отметки недоступны.",
      );
    if (!challenge.canCheckIn)
      throw new AppError(
        409,
        "OUTSIDE_PERIOD",
        "Сегодня вне срока этого челленджа.",
      );
    if (marked) this.repository.mark(id, challenge.today);
    else this.repository.unmark(id, challenge.today);
    return this.get(ownerId, id);
  }
  archive(ownerId: string, id: string): Challenge {
    const record = this.repository.archive(id, ownerId);
    if (!record) throw new AppError(404, "NOT_FOUND", "Челлендж не найден.");
    return this.present(record);
  }
  unarchive(ownerId: string, id: string): Challenge {
    const record = this.repository.unarchive(id, ownerId);
    if (!record) throw new AppError(404, "NOT_FOUND", "Челлендж не найден.");
    return this.present(record);
  }
}
