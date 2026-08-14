// One-time interactive authorization. Run with: npm run auth
// Opens a browser, asks you to sign in / consent, then saves token.json.
import { authenticate } from "@google-cloud/local-auth";
import {
  SCOPES,
  CREDENTIALS_PATH,
  TOKEN_PATH,
  loadSavedCredentialsIfExist,
  saveCredentials,
} from "./auth.js";

async function main() {
  const existing = await loadSavedCredentialsIfExist();
  if (existing) {
    console.log(`Already authorized. Token at: ${TOKEN_PATH}`);
    console.log("Delete token.json and re-run if you want to re-authorize.");
    return;
  }

  const client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  if (client.credentials?.refresh_token) {
    await saveCredentials(client);
    console.log(`Authorized. Token saved to: ${TOKEN_PATH}`);
  } else {
    console.error(
      "No refresh_token returned. Revoke prior access at " +
        "https://myaccount.google.com/permissions and try again."
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
