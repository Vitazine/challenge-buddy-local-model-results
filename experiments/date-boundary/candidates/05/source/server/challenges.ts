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
      canCheckIn:
        record.archivedAt === null &&
        today >= record.startDate &&
        today <= endDate,
      status:
        today < record.startDate
          ? "upcoming"
          : today > endDate
            ? "finished"
            : "active",
    };
  }
  list(ownerId: string, page: number, pageSize: number, archived = false) {
    return {
      items: this.repository
        .list(ownerId, pageSize, (page - 1) * pageSize, archived)
        .map((row) => this.present(row)),
      page,
      pageSize,
      total: this.repository.count(ownerId, archived),
    };
  }
  create(ownerId: string, input: CreateChallengeInput): Challenge {
    // Проверка: startDate должен быть не позже сегодня + 7 дней включительно в часовом поясе челленджа
    const today = todayInZone(input.timeZone, this.clock());
    const maxStartDate = addDays(today, 7);
    
    if (input.startDate > maxStartDate) {
      throw new AppError(
        422,
        "INVALID_START_DATE",
        `Дата старта (${input.startDate}) должна быть не позже ${maxStartDate}.`,
      );
    }
    
    return this.present(this.repository.create(ownerId, input, this.clock()));
  }
  get(ownerId: string, id: string): Challenge {
    const record = this.repository.find(id, ownerId);
    if (!record) throw new AppError(404, "NOT_FOUND", "Челлендж не найден.");
    return this.present(record);
  }
  archive(ownerId: string, id: string): Challenge {
    this.get(ownerId, id);
    this.repository.archive(id, ownerId, this.clock());
    return this.get(ownerId, id);
  }
  checkIn(ownerId: string, id: string, marked: boolean): Challenge {
    const challenge = this.get(ownerId, id);
    if (challenge.archivedAt !== null)
      throw new AppError(
        409,
        "CHALLENGE_ARCHIVED",
        "В архиве нельзя добавлять и отменять отметки.",
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
}
