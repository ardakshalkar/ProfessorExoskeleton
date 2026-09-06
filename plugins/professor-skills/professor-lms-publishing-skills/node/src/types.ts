export type Provider = "canvas" | "moodle" | "telegram";

export interface BaseProfile {
  type: Provider;
  token?: string;
  tokenEnv?: string;
}

export interface CanvasProfile extends BaseProfile {
  type: "canvas";
  baseUrl: string;
  courseId?: string;
}

export interface MoodleProfile extends BaseProfile {
  type: "moodle";
  baseUrl: string;
  courseId?: string;
  forumId?: string;
  wsFunction?: string;
}

export interface TelegramProfile extends BaseProfile {
  type: "telegram";
  chatId?: string;
  parseMode?: "HTML" | "MarkdownV2";
}

export type ConnectionProfile = CanvasProfile | MoodleProfile | TelegramProfile;

export interface ConnectionsFile {
  profiles: Record<string, ConnectionProfile>;
}

export interface Publication {
  kind: string;
  title?: string;
  content?: string;
  courseId?: string;
  forumId?: string;
  chatId?: string;
  filePath?: string;
  fileName?: string;
  published?: boolean;
}

export interface PublishResult {
  provider: Provider;
  id?: string;
  url?: string;
  raw: unknown;
}

export type FetchLike = typeof fetch;
