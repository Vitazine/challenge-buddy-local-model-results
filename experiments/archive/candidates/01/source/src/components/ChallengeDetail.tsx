import type { Challenge } from "../../shared/contracts";
import { addDays, formatDate } from "../../shared/dates";
import { Progress } from "./Progress";

export function ChallengeDetail({
  challenge,
  pending,
  onToggle,
}: {
  challenge: Challenge;
  pending: boolean;
  onToggle: () => void;
}) {
  const checked = challenge.checkIns.includes(challenge.today);
  const days = Array.from({ length: challenge.duration }, (_, index) =>
    addDays(challenge.startDate, index),
  );

  if (challenge.archivedAt != null) {
    return (
      <section>
        <p className="eyebrow">АРХИВ</p>
        <h1 className="detail-title">{challenge.title}</h1>
        <p className="intro">
          Этот челлендж архивирован. История и прогресс сохранены.
          <br />
          {formatDate(challenge.startDate)} — {formatDate(challenge.endDate)} ·{" "}
          {challenge.duration} дней
        </p>
        <div className="detail-grid">
          <section className="today-card" aria-label="Архивированный челлендж">
            <div className="today-icon" aria-hidden="true">📦</div>
            <div>
              <p className="eyebrow">АРХИВИРОВАНО</p>
              <h2>Челлендж перемещён в архив</h2>
              <p>
                Отметки недоступны. История и прогресс сохранены.
                <br />
                {challenge.status === "upcoming"
                  ? `Первая отметка была доступна ${formatDate(challenge.startDate)}.`
                  : challenge.status === "finished"
                    ? "Твоя история и прогресс останутся здесь."
                    : checked
                      ? "Отметка сохранена. До завтра!"
                      : "Выполни свое действие и отметь этот день."}
              </p>
            </div>
          </section>
          <section className="calendar-section">
            <h2>Твоя история</h2>
            <p className="muted">
              Каждая отметка — день, который ты посвятил себе.
            </p>
            <ol className="calendar">
              {days.map((date, index) => {
                const marked = challenge.checkIns.includes(date);
                return (
                  <li
                    key={date}
                    className={`${marked ? "marked" : ""} ${date === challenge.today ? "is-today" : ""}`}
                    aria-label={`День ${index + 1}, ${formatDate(date)}: ${marked ? "выполнено" : "без отметки"}${date === challenge.today ? ", сегодня" : ""}`}
                  >
                    <span className="day-number">
                      {marked ? "✓" : index + 1}
                    </span>
                    <small>{formatDate(date)}</small>
                  </li>
                );
              })}
            </ol>
            <div className="legend">
              <span>✓ Выполнено</span>
              <span>Обводка — сегодня</span>
            </div>
          </section>
        </div>
        <aside className="progress-panel">
          <p className="eyebrow">В ОБЩЕМ РИТМЕ</p>
          <p className="big-number">
            {challenge.progress}
            <span>%</span>
          </p>
          <Progress value={challenge.progress} />
          <p>
            <strong>{challenge.checkIns.length}</strong> из {challenge.duration}{" "}
            дня отмечено
          </p>
          <hr />
          <p className="muted">
            Не нужно идеально.
            <br />
            Главное — продолжать.
          </p>
          <p className="hint">Часовой пояс: {challenge.timeZone}</p>
        </aside>
      </section>
    );
  }

  return (
    <section>
      <p className="eyebrow">ТВОЙ ЧЕЛЛЕНДЖ</p>
      <h1 className="detail-title">{challenge.title}</h1>
      <p className="intro">
        {formatDate(challenge.startDate)} — {formatDate(challenge.endDate)} ·{" "}
        {challenge.duration} дней
      </p>
      <div className="detail-grid">
        <div className="detail-main">
          <section
            className={`today-card ${checked ? "checked" : ""}`}
            aria-label={
              checked
                ? "Сегодня выполнено"
                : challenge.status === "upcoming"
                  ? "Челлендж ещё не начался"
                  : "Сегодня предстоит выполнить действие"
            }
          >
            <div className="today-icon" aria-hidden="true">
              {checked ? "✓" : "↗"}
            </div>
            <div>
              <p className="eyebrow">{formatDate(challenge.today)} · СЕГОДНЯ</p>
              <h2>
                {challenge.status === "upcoming"
                  ? "Всё начинается скоро"
                  : challenge.status === "finished"
                    ? "Челлендж завершен"
                    : checked
                      ? "Еще один шаг сделан!"
                      : "Один маленький шаг"}
              </h2>
              <p>
                {challenge.status === "upcoming"
                  ? `Первая отметка будет доступна ${formatDate(challenge.startDate)}.`
                  : challenge.status === "finished"
                    ? "Твоя история и прогресс останутся здесь."
                    : checked
                      ? "Отметка сохранена. До завтра!"
                      : "Выполни свое действие и отметь этот день."}
              </p>
            </div>
            {challenge.canCheckIn && (
              <button
                className={checked ? "secondary full" : "primary full"}
                disabled={pending}
                onClick={onToggle}
              >
                {pending
                  ? "Сохраняем…"
                  : checked
                    ? "Отменить отметку за сегодня"
                    : "✓  Я сделал это сегодня"}
              </button>
            )}
          </section>
          <section className="calendar-section">
            <h2>Твоя история</h2>
            <p className="muted">
              Каждая отметка — день, который ты посвятил себе.
            </p>
            <ol className="calendar">
              {days.map((date, index) => {
                const marked = challenge.checkIns.includes(date);
                return (
                  <li
                    key={date}
                    className={`${marked ? "marked" : ""} ${date === challenge.today ? "is-today" : ""}`}
                    aria-label={`День ${index + 1}, ${formatDate(date)}: ${marked ? "выполнено" : "без отметки"}${date === challenge.today ? ", сегодня" : ""}`}
                  >
                    <span className="day-number">
                      {marked ? "✓" : index + 1}
                    </span>
                    <small>{formatDate(date)}</small>
                  </li>
                );
              })}
            </ol>
            <div className="legend">
              <span>✓ Выполнено</span>
              <span>Обводка — сегодня</span>
            </div>
          </section>
        </div>
        <aside className="progress-panel">
          <p className="eyebrow">В ОБЩЕМ РИТМЕ</p>
          <p className="big-number">
            {challenge.progress}
            <span>%</span>
          </p>
          <Progress value={challenge.progress} />
          <p>
            <strong>{challenge.checkIns.length}</strong> из {challenge.duration}{" "}
            дней отмечено
          </p>
          <hr />
          <p className="muted">
            Не нужно идеально.
            <br />
            Главное — продолжать.
          </p>
          <p className="hint">Часовой пояс: {challenge.timeZone}</p>
        </aside>
      </div>
    </section>
  );
}
