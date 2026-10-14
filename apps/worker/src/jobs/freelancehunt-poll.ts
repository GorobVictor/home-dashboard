import {
  saveFreelancehuntProjects,
  saveFreelancehuntThreads,
  type FreelancehuntSettingsInput,
} from "@home-dashboard/database";
import { FreelancehuntClient, sendTelegramMessage } from "@home-dashboard/integrations";

interface FreelancehuntPollSettings extends FreelancehuntSettingsInput {
  projectsInitialized: boolean;
  messagesInitialized: boolean;
}

function configuredTelegram(): { token: string; chatId: string } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  return token && chatId ? { token, chatId } : null;
}

function projectMessage(project: { name: string; url: string; budgetAmount: number | null; budgetCurrency: string | null }): string {
  const budget = project.budgetAmount === null ? "Бюджет не вказано" : `Бюджет: ${project.budgetAmount} ${project.budgetCurrency ?? ""}`.trim();
  return `Новий проєкт на Freelancehunt\n${project.name}\n${budget}\n${project.url}`;
}

function threadMessage(thread: { subject: string; url: string }): string {
  return `Нове повідомлення на Freelancehunt\n${thread.subject}\n${thread.url}`;
}

export async function pollFreelancehunt(settings: FreelancehuntPollSettings): Promise<void> {
  const token = process.env.FREELANCEHUNT_API_TOKEN?.trim();
  if (!settings.enabled || !token) return;
  const client = new FreelancehuntClient(token);
  const telegram = settings.telegramEnabled ? configuredTelegram() : null;

  if (settings.projectPollingEnabled) {
    const projects = await client.listProjects(settings.skillIds);
    const result = await saveFreelancehuntProjects(projects);
    if (telegram) {
      for (const project of result.projects) {
        await sendTelegramMessage(telegram.token, telegram.chatId, projectMessage(project));
      }
    }
    console.info("freelancehunt_projects_polled", { received: projects.length, discovered: result.projects.length });
  }

  if (settings.messagePollingEnabled) {
    const threads = await client.listThreads();
    const result = await saveFreelancehuntThreads(threads);
    if (telegram) {
      for (const thread of result.threads) {
        await sendTelegramMessage(telegram.token, telegram.chatId, threadMessage(thread));
      }
    }
    console.info("freelancehunt_threads_polled", { received: threads.length, discovered: result.threads.length });
  }
}
