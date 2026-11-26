import {KEY, json} from "./_shared.js";
import {dbReady} from "./_db.js";
import {googleReady} from "./google.js";
// Arayuz bu cevaba gore anahtar ekranini, hesap ve Google girisini gosterir.
export function GET() {
  // netlify: herkese acik OAuth istemci kimligi (gizli degil); bossa "tek tikla yayinla" gizlenir, surukle-birak secenekleri kalir.
  return json({shared: Boolean(KEY), accounts: dbReady, google: dbReady && googleReady(), netlify: process.env.NETLIFY_CLIENT_ID || ""});
}
