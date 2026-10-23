export const severityLabels: Record<string, string> = { info: "Інформація", warning: "Увага", error: "Помилка", critical: "Критично" };
export const sourceLabels: Record<string, string> = { marstek: "Marstek", freelancehunt: "Freelancehunt", system: "Система" };
export const deliveryLabels: Record<string, string> = { pending: "Очікує", processing: "Надсилається", sent: "Надіслано", failed: "Помилка", cancelled: "Скасовано", unknown: "Результат невідомий" };
export const eventTypeLabels: Record<string, string> = {
  "marstek.battery_low": "Низький заряд", "marstek.battery_recovered": "Заряд відновився", "marstek.fully_charged": "Батарею заряджено",
  "marstek.device_offline": "Пристрій недоступний", "marstek.device_online": "Пристрій знову доступний",
  "marstek.grid_lost": "Електромережу втрачено", "marstek.grid_restored": "Електромережу відновлено",
  "freelancehunt.project_created": "Новий проєкт", "freelancehunt.message_received": "Нове повідомлення",
  "system.service_unavailable": "Сервіс недоступний", "system.service_restored": "Сервіс відновлено",
};
