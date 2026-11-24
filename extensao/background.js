// Confere 1x por dia (e ao abrir o navegador) se saiu versão nova no GitHub.
// Só lê a página pública de versões; nada sobre você é enviado.
const BSP_RELEASES = "https://api.github.com/repos/lucasbeezerra/bloqueador-de-spoiler/releases/latest";

function bspMaior(a, b) {
  const pa = String(a).replace(/^v/, "").split(".").map(Number);
  const pb = String(b).replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

async function bspConferir() {
  try {
    const r = await fetch(BSP_RELEASES, { cache: "no-store" });
    if (!r.ok) return;
    const ultima = String((await r.json()).tag_name || "").replace(/^v/, "");
    const atual = chrome.runtime.getManifest().version;
    const temNova = !!ultima && bspMaior(ultima, atual);
    await chrome.storage.local.set({ versaoNova: temNova ? ultima : "" });
    chrome.action.setBadgeText({ text: temNova ? "NOVA" : "" });
    if (temNova) chrome.action.setBadgeBackgroundColor({ color: "#1b7a3a" });
  } catch (e) {
    // sem internet: tenta de novo na próxima
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("conferirVersao", { periodInMinutes: 24 * 60 });
  bspConferir();
});
chrome.runtime.onStartup.addListener(bspConferir);
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "conferirVersao") bspConferir(); });
chrome.runtime.onMessage.addListener((msg) => { if (msg === "conferirVersao") bspConferir(); });
