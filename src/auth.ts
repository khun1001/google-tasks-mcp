import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

// Full read/write access to Google Tasks.
export const SCOPES = ["https://www.googleapis.com/auth/tasks"];

// Store credentials next to the installed package (build/ -> project root),
// so paths don't depend on the process working directory the MCP host uses.
const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CREDENTIALS_PATH = path.join(PROJECT_ROOT, "credentials.json");
export const TOKEN_PATH = path.join(PROJECT_ROOT, "token.json");

/** Load a previously authorized client from token.json, or null if none exists. */
export async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH, "utf-8");
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials) as OAuth2Client;
  } catch {
    return null;
  }
}

/** Persist the refresh token so future runs don't need the browser flow. */
export async function saveCredentials(client: OAuth2Client): Promise<void> {
  const content = await fs.readFile(CREDENTIALS_PATH, "utf-8");
  const keys = JSON.parse(content);
  const key = keys.installed ?? keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}
