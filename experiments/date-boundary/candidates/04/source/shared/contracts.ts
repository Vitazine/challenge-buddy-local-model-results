import { z } from "zod";

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Укажите существующую дату");

export const createChallengeSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Добавьте название")
      .max(80, "Не более 80 символов"),
    startDate: dateSchema,
    duration: z.number().int().min(1).max(30),
    timeZone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Неизвестный часовой пояс"),
  })
  .strict();

export const listChallengesSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    archived: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .strict();

export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;
export interface Challenge extends CreateChallengeInput {
  id: string;
  createdAt: string;
  archivedAt: string | null;
  endDate: string;
  checkIns: string[];
  today: string;
  progress: number;
  canCheckIn: boolean;
  status: "upcoming" | "active" | "finished";
}
export interface ChallengeList {
  items: Challenge[];
  page: number;
  pageSize: number;
  total: number;
}
export interface Session {
  mode: "development" | "telegram";
}
export interface ApiError {
  error: { code: string; message: string };
}
