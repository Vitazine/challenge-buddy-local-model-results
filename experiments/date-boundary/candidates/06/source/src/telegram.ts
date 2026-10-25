interface TelegramWebApp {
  initData: string;
  ready(): void;
  expand(): void;
  BackButton?: {
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
}
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}
export const telegram = window.Telegram?.WebApp;
export function prepareTelegram() {
  telegram?.ready();
  if (telegram?.initData) telegram.expand();
}
