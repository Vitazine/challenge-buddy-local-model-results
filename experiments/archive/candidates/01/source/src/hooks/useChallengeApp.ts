import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Challenge,
  CreateChallengeInput,
  Session,
} from "../../shared/contracts";
import { api } from "../api";
import { telegram } from "../telegram";
type View =
  | { type: "list" }
  | { type: "create" }
  | { type: "detail"; challenge: Challenge };
export function useChallengeApp() {
  const [view, setView] = useState<View>({ type: "list" });
  const [items, setItems] = useState<Challenge[]>([]);
  const [session, setSession] = useState<Session>();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mutationLock = useRef(false);
  const main = useRef<HTMLElement>(null);
  const load = useCallback(
    () =>
      Promise.all([api.session(), api.list(page)])
        .then(([currentSession, list]) => {
          setError("");
          setSession(currentSession);
          setItems(list.items);
          setTotal(list.total);
        })
        .catch((cause: unknown) => {
          setError(
            cause instanceof Error
              ? cause.message
              : "Не удалось загрузить челленджи.",
          );
        })
        .finally(() => setLoading(false)),
    [page],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [view.type]);
  const back = useCallback(() => {
    setView({ type: "list" });
    setError("");
    setNotice("");
    void load();
  }, [load]);
  useEffect(() => {
    const button = telegram?.BackButton;
    if (!telegram?.initData || !button) return;
    if (view.type === "list") button.hide();
    else button.show();
    button.onClick(back);
    return () => button.offClick(back);
  }, [view.type, back]);
  // Refresh server-derived dates when the app is resumed and around midnight.
  const selectedId = view.type === "detail" ? view.challenge.id : undefined;
  useEffect(() => {
    const refresh = async () => {
      if (document.hidden || mutationLock.current) return;
      try {
        if (selectedId) {
          const challenge = await api.get(selectedId);
          setView((current) =>
            current.type === "detail" && current.challenge.id === selectedId
              ? { type: "detail", challenge }
              : current,
          );
        } else if (view.type === "list") {
          const list = await api.list(page);
          setItems(list.items);
          setTotal(list.total);
        }
      } catch {
        /* A foreground action presents actionable errors. */
      }
    };
    const timer = window.setInterval(() => void refresh(), 60_000);
    const onVisible = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [selectedId, view.type, page]);
  async function mutate(operation: () => Promise<Challenge>, message: string) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const challenge = await operation();
      setView({ type: "detail", challenge });
      setNotice(message);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось сохранить. Попробуй еще раз.",
      );
    } finally {
      mutationLock.current = false;
      setPending(false);
    }
  }
  const create = (input: CreateChallengeInput) =>
    mutate(() => api.create(input), "Челлендж создан. Твой первый шаг вперед!");
  const archive = () =>
    mutate(api.archive(), "Челлендж перемещён в архив.");
  const unarchive = () =>
    mutate(api.unarchive(), "Челлендж возвращён из архива.");
  return {
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
  };
}
