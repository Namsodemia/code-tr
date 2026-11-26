import {KEY, json} from "./_shared.js";
import {dbReady} from "./_db.js";
import {googleReady} from "./google.js";
// Arayuz bu cevaba gore anahtar ekranini, hesap ve Google girisini gosterir.
export function GET() {
  return json({shared: Boolean(KEY), accounts: dbReady, google: dbReady && googleReady()});
}
