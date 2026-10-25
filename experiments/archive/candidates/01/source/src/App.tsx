import { api } from "./api";
import { Dashboard } from "./components/Dashboard";
import { CreateChallenge } from "./components/CreateChallenge";
import { ChallengeDetail } from "./components/ChallengeDetail";
import { useChallengeApp } from "./hooks/useChallengeApp";
export function App() {
  const {
    view,
    setView,
    items,
    session,
    page,
    setPage,
    total,
    loading,
    setLoading,
    pending,
    error,
    notice,
    setNotice,
    main,
    load,
    back,
    create,
    archive,
    unarchive,
  } = useChallengeApp();
  const onArchive = async () => {
    try {
      const challenge = await api.archive();
      setView({ type: "detail", challenge });
      setNotice("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось архивировать. Попробуй еще раз.",
      );
    }
  };
  const onUnarchive = async () => {
    try {
      const challenge = await api.unarchive();
      setView({ type: "detail", challenge });
      setNotice("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось восстановить. Попробуй еще раз.",
      );
    }
  };
  return (
    <div className="app-shell">
      <header className="header">
        <button
          className="brand"
          onClick={back}
          disabled={pending}
          aria-label="Challenge Buddy — мои челленджи"
        >
          <span className="brand-icon" aria-hidden="true">
            ✓
          </span>
          <span>
            challenge<span className="brand-light">buddy</span>
          </span>
        </button>
        <span className="header-note">Маленький шаг. Каждый день.</span>
        <span className="edition">ТВОЙ РИТМ</span>
      </header>
      <main ref={main} tabIndex={-1}>
        {view.type !== "list" && (
          <button className="back" onClick={back} disabled={pending}>
            ← Мои челленджи
          </button>
        )}
        {session?.mode === "development" && (
          <p className="dev-label">Локальная версия · тестовый профиль</p>
        )}
        {error && (
          <div role="alert" className="error-box">
            <p>{error}</p>
            {view.type === "list" && (
              <button
                className="secondary"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
              >
                Попробовать снова
              </button>
            )}
          </div>
        )}
        <div role="status" className={notice ? "notice" : "sr-only"}>
          {notice}
        </div>
        {view.type === "list" && (
          <Dashboard
            items={items}
            total={total}
            page={page}
            loading={loading}
            error={error}
            ready={Boolean(session)}
            onCreate={() => {
              setView({ type: "create" });
              setNotice("");
            }}
            onOpen={(challenge) => {
              setView({ type: "detail", challenge });
              setNotice("");
            }}
            onPage={(next) => {
              setLoading(true);
              setPage(next);
            }}
          />
        )}
        {view.type === "create" && (
          <CreateChallenge onCreate={create} pending={pending} />
        )}
        {view.type === "detail" && (
          <ChallengeDetail
            challenge={view.challenge}
            pending={pending}
            onToggle={() => {
              const checked = view.challenge.checkIns.includes(
                view.challenge.today,
              );
              void mutate(
                () => api.checkIn(view.challenge.id, !checked),
                checked
                  ? "Отметка отменена."
                  : "Готово! Отметка за сегодня сохранена.",
              );
            }}
          />
        )}
      </main>
      <footer>
        <span>challengebuddy</span>
        <span>У каждого шага есть значение.</span>
      </footer>
    </div>
  );
}
