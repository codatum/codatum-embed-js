import { existsSync, readFileSync } from "node:fs";

export const loadConfig = <T>(path: string): T => {
  if (!existsSync(path)) {
    throw new Error(`Config file not found: ${path}`);
  }
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as T;
};

const CODATUM_ISSUE_TOKEN_URL = "https://api.codatum.com/api/notebook/issueToken";

export type IssueTokenPayload = {
  api_key: string;
  api_secret: string;
  integration_id: string;
  page_id: string;
  token_user_id: string;
  params: { param_id: string; param_value: string }[];
  expires_in?: number;
  cache_max_age?: number;
};

export const issueToken = async (payload: IssueTokenPayload): Promise<{ token: string }> => {
  const res = await fetch(CODATUM_ISSUE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as { token?: string; message?: string };
  if (!res.ok) {
    throw new Error(data.message ?? "Failed to issue token");
  }
  if (!data.token) {
    throw new Error("No token in response");
  }
  return { token: data.token };
};
