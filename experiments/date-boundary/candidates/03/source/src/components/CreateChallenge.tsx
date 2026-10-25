import { useState, type FormEvent } from "react";
import {
  createChallengeSchema,
  type CreateChallengeInput,
} from "../../shared/contracts";
import { todayInZone } from "../../shared/dates";

const suggestions = [
  "Учиться вайб-кодингу",
  "Читать 20 минут",
  "Гулять каждый день",
];
export function CreateChallenge({
  onCreate,
  pending,
}: {
  onCreate: (input: CreateChallengeInput) => Promise<void>;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(7);
  const [timeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [startDate, setStartDate] = useState(() => todayInZone(timeZone));
  const [error, setError] = useState("");
  
  // Вычисляем максимальную дату старта (сегодня + 7 дней) в часовом поясе пользователя
  const maxStartDate = addDays(todayInZone(timeZone), 7);
  
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    // Клиентская проверка даты старта перед отправкой
    if (startDate > maxStartDate) {
      setError(`Дата старта (${startDate}) должна быть не позже ${maxStartDate}.`);
      return;
    }
    
    const parsed = createChallengeSchema.safeParse({
      title,
      duration,
      startDate,
      timeZone,
    });
    if (!parsed.success) {
      setError("Проверь название, дату и длительность от 1 до 30 дней.");
      return;
    }
    setError("");
    await onCreate(parsed.data);
  }
  return (
    <section className="form-section">
      <p className="eyebrow">НОВОЕ НАЧАЛО</p>
      <h1>
        Какой будет
        <br />
        твой следующий шаг?
      </h1>
      <p className="intro">
        Выбери одно небольшое действие, которое хочется повторять каждый день.
      </p>
      <form onSubmit={submit} className="form-card">
        <fieldset disabled={pending}>
          <label htmlFor="title">Название челленджа</label>
          <input
            id="title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например, читать 20 минут"
            required
            maxLength={80}
            autoFocus
          />
          <div className="suggestions" aria-label="Идеи для челленджа">
            {suggestions.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                onClick={() => setTitle(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <p className="field-label">Сколько дней?</p>
          <div className="duration-options">
            {[7, 14, 21, 30].map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={duration === days}
                onClick={() => setDuration(days)}
              >
                {days}
              </button>
            ))}
          </div>
          <div className="form-row">
            <div>
              <label htmlFor="duration">Своя длительность</label>
              <input
                id="duration"
                type="number"
                min={1}
                max={30}
                required
                value={duration || ""}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
            </div>
            <div>
              <label htmlFor="startDate">Дата старта</label>
              <input
                id="startDate"
                type="date"
                required
                min={todayInZone(timeZone)}
                max={maxStartDate}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
              <p className="hint-small">
                Можно выбрать дату от {todayInZone(timeZone)} до {maxStartDate}.
              </p>
            </div>
          </div>
          <p className="hint">
            Часовой пояс: {timeZone}. Отметки привязаны к твоему календарному
            дню.
          </p>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <button className="primary full" type="submit">
            {pending ? "Создаем…" : "Начать челлендж"}{" "}
            <span aria-hidden="true">↗</span>
          </button>
        </fieldset>
      </form>
      <p className="footnote">
        Маленькая цель, которой ты уделяешь время, лучше большой, которую
        откладываешь.
      </p>
    </section>
  );
}
