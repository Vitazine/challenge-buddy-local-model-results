import type {
  ApiError,
  Challenge,
  ChallengeList,
  CreateChallengeInput,
  Session,
} from "../shared/contracts";
import { telegram } from "./telegram";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    signal: AbortSignal.timeout(15_000),
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(telegram?.initData
        ? { Authorization: `tma ${telegram.initData}` }
        : { "X-Local-Development": "true" }),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(
      body?.error?.message ??
        "Не удалось связаться с сервером. Попробуйте еще раз.",
    );
  }
  return response.json() as Promise<T>;
}
export const api = {
  session: () => request<Session>("/session"),
  list: (page = 1) => request<ChallengeList>(`/challenges?page=${page}`),
  get: (id: string) => request<Challenge>(`/challenges/${id}`),
  create: (input: CreateChallengeInput) =>
    request<Challenge>("/challenges", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  checkIn: (id: string, checked: boolean) =>
    request<Challenge>(`/challenges/${id}/check-ins/today`, {
      method: checked ? "PUT" : "DELETE",
    }),
  archive: () => request<Challenge>("/challenges/:id/archive", {
    method: "PUT",
  }),
  unarchive: () => request<Challenge>("/challenges/:id/archive", {
    method: "DELETE",
  }),
};
