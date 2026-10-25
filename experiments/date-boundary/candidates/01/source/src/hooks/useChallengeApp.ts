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
  const [archived, setArchived] = useState(false);
  const [items, setItems] = useState<Challenge[]>([]);
  const [session, setSession] = useState<Session>();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mutationLock = useRef(false);
  // Navigation and mutations invalidate every earlier list/detail response.
  const requestVersion = useRef(0);
  const main = useRef<HTMLElement>(null);
  const load = useCallback(() => {
    const version = ++requestVersion.current;
    return Promise.all([api.session(), api.list(page, archived)])
      .then(([currentSession, list]) => {
        if (version !== requestVersion.current) return;
        const lastPage = Math.max(1, Math.ceil(list.total / list.pageSize));
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setError("");
        setSession(currentSession);
        setItems(list.items);
        setTotal(list.total);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (version !== requestVersion.current) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Не удалось загрузить челленджи.",
        );
        setLoading(false);
      });
  }, [page, archived]);
  useEffect(() => {
    const versionRef = requestVersion;
    void load();
    return () => {
      versionRef.current++;
    };
  }, [load]);
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [view.type, archived]);
  const back = useCallback(() => {
    if (mutationLock.current) return;
    setView({ type: "list" });
    setError("");
    setNotice("");
    setLoading(true);
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
  const selectedId = view.type === "detail" ? view.challenge.id : undefined;
  useEffect(() => {
    let canceled = false;
    const refresh = async () => {
      if (document.hidden || mutationLock.current || loading) return;
      const version = requestVersion.current;
      try {
        if (selectedId) {
          const challenge = await api.get(selectedId);
          if (
            canceled ||
            version !== requestVersion.current ||
            mutationLock.current
          )
            return;
          setView((current) =>
            current.type === "detail" && current.challenge.id === selectedId
              ? { type: "detail", challenge }
              : current,
          );
        } else if (view.type === "list") {
          const list = await api.list(page, archived);
          if (
            canceled ||
            version !== requestVersion.current ||
            mutationLock.current
          )
            return;
          const lastPage = Math.max(1, Math.ceil(list.total / list.pageSize));
          if (page > lastPage) {
            setLoading(true);
            setPage(lastPage);
            return;
          }
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
      canceled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [selectedId, view.type, page, archived, loading]);
  function navigate(next: View) {
    if (mutationLock.current) return;
    requestVersion.current++;
    // The invalidated list request no longer owns a loading state on this screen.
    setLoading(false);
    setView(next);
    setError("");
    setNotice("");
  }
  function switchArchive(next: boolean) {
    if (mutationLock.current || next === archived) return;
    requestVersion.current++;
    setArchived(next);
    setPage(1);
    setItems([]);
    setTotal(0);
    setLoading(true);
    setError("");
    setNotice("");
    setView({ type: "list" });
  }
  function changePage(next: number) {
    if (mutationLock.current || next === page) return;
    requestVersion.current++;
    setLoading(true);
    setPage(next);
  }
  async function mutate(operation: () => Promise<Challenge>, message: string) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    requestVersion.current++;
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
  return {
    view,
    navigate,
    archived,
    switchArchive,
    items,
    session,
    page,
    changePage,
    total,
    loading,
    setLoading,
    pending,
    error,
    notice,
    main,
    load,
    back,
    create,
    mutate,
  };
}
