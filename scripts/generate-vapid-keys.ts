// Prints the VAPID key pair used to sign push notifications.
// Run once:  npx tsx scripts/generate-vapid-keys.ts
// Then add the three lines to the server environment and restart the app.
import { generateVapidKeys } from "../server/web-push";

const { publicKey, privateKey } = generateVapidKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:admin@your-company.com");
console.log("\nKeep the private key secret. Changing the keys later disconnects every device that enabled notifications.");
