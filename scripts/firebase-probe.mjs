// Диагностика Firebase для porfo-ddb46 (только чтение, публичный apiKey).
const API_KEY = "AIzaSyCmX0CUAZZ6HCRRNfqXPGMjZRBp3NQvVAI";
const PROJECT = "porfo-ddb46";
const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

async function probe(name, url) {
  try {
    const r = await fetch(url);
    const text = await r.text();
    let info = "";
    if (r.ok) {
      try { const j = JSON.parse(text); info = j.documents ? `docs=${j.documents.length}` : (j.fields ? `fields=${Object.keys(j.fields).join(",")}` : "ok"); } catch { info = "body"; }
    } else {
      try { info = JSON.parse(text).error?.message?.slice(0, 120) || ""; } catch { info = ""; }
    }
    console.log(`${name}: HTTP ${r.status} ${info}`);
  } catch (e) {
    console.log(`${name}: ERR ${e.message}`);
  }
}

await probe("siteContent/locales", `${base}/siteContent/locales?key=${API_KEY}`);
await probe("cases (list)", `${base}/cases?key=${API_KEY}`);
await probe("leads (list, must be denied)", `${base}/leads?key=${API_KEY}`);
