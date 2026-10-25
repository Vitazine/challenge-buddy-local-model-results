import type { Challenge } from "../../shared/contracts";
import { formatDate } from "../../shared/dates";
import { Progress } from "./Progress";

export function ChallengeCard({
  challenge,
  onOpen,
  onArchive,
}: {
  challenge: Challenge;
  onOpen: () => void;
  onArchive?: () => void;
}) {
  const checked = challenge.checkIns.includes(challenge.today);
  const status =
    challenge.status === "upcoming"
      ? "Скоро старт"
      : challenge.status === "finished"
        ? "Завершен"
        : checked
          ? "Сегодня сделано"
          : "Ждет твоего шага";
  return (
    <li>
      <button className="challenge-card" onClick={onOpen}>
        <div className="card-top">
          <span className={`status ${checked ? "status-done" : ""}`}>
            {checked ? "✓ " : ""}
            {status}
          </span>
          <span aria-hidden="true">↗</span>
          {!challenge.archivedAt && (
            <button
              className="archive-button"
              onClick={(e) => {
                e.stopPropagation();
                onArchive?.();
              }}
              title="Архивировать челлендж"
            >
              📦
            </button>
          )}
        </div>
        <h3>{challenge.title}</h3>
        <p className="muted">
          {formatDate(challenge.startDate)} — {formatDate(challenge.endDate)}
        </p>
        <Progress value={challenge.progress} />
        <div className="progress-caption">
          <span>
            {challenge.checkIns.length} из {challenge.duration} дней
          </span>
          <strong>{challenge.progress}%</strong>
        </div>
      </button>
    </li>
  );
}
