const $ = (id) => document.getElementById(id);

function mostrarEstado(ligado) {
  $("ligado").checked = ligado;
  $("estado").textContent = ligado ? "Ligado" : "Desligado";
}

function avisar(t) {
  $("aviso").textContent = t;
  setTimeout(() => ($("aviso").textContent = ""), 2000);
}

chrome.storage.sync.get(["ligado", "palavras"], (cfg) => {
  mostrarEstado(cfg.ligado !== false);
  $("palavras").value = (Array.isArray(cfg.palavras) ? cfg.palavras : BSP_PALAVRAS_PADRAO).join("\n");
});

$("ligado").addEventListener("change", () => {
  const ligado = $("ligado").checked;
  chrome.storage.sync.set({ ligado });
  mostrarEstado(ligado);
});

$("salvar").addEventListener("click", () => {
  const palavras = $("palavras").value.split("\n").map((s) => s.trim()).filter(Boolean);
  chrome.storage.sync.set({ palavras }, () => avisar("Salvo! Já vale nas abas abertas."));
});

// ---------- Desligar neste site ----------
chrome.tabs.query({ active: true, currentWindow: true }, (abas) => {
  let host = "";
  try {
    const u = new URL(abas[0].url);
    if (u.protocol === "http:" || u.protocol === "https:") host = u.hostname.replace(/^www\./, "");
  } catch (e) {}
  if (!host) return;
  $("site").textContent = host;
  $("linhaSite").style.display = "flex";
  $("dicaSite").style.display = "block";

  chrome.storage.sync.get("sitesLiberados", (cfg) => {
    const lista = Array.isArray(cfg.sitesLiberados) ? cfg.sitesLiberados : [];
    $("ativoSite").checked = !lista.some((s) => host === s || host.endsWith("." + s));
  });

  $("ativoSite").addEventListener("change", () => {
    chrome.storage.sync.get("sitesLiberados", (cfg) => {
      let lista = Array.isArray(cfg.sitesLiberados) ? cfg.sitesLiberados : [];
      if ($("ativoSite").checked) lista = lista.filter((s) => !(host === s || host.endsWith("." + s)));
      else if (!lista.includes(host)) lista.push(host);
      chrome.storage.sync.set({ sitesLiberados: lista }, () =>
        avisar($("ativoSite").checked ? "Bloqueio ligado neste site." : "Site liberado."));
    });
  });
});

$("padrao").addEventListener("click", () => {
  $("palavras").value = BSP_PALAVRAS_PADRAO.join("\n");
  chrome.storage.sync.remove("palavras", () => avisar("Lista original de volta."));
});
