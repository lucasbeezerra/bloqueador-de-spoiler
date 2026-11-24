// Bloqueador de Spoiler — borra tudo que citar as palavras da lista.
// Clique em cima do que está borrado para revelar.
(() => {
  if (window.__bspCarregado) return;
  window.__bspCarregado = true;

  // "Cartões" comuns em sites: borramos o cartão inteiro (título + miniatura + texto).
  const CARTOES = [
    "article", "[role='article']", "li", "figure",
    // YouTube
    "ytd-rich-item-renderer", "ytd-video-renderer", "ytd-compact-video-renderer",
    "ytd-grid-video-renderer", "ytd-reel-item-renderer", "ytd-playlist-renderer",
    "ytd-radio-renderer", "ytd-compact-radio-renderer", "ytd-comment-thread-renderer",
    "ytm-shorts-lockup-view-model", "yt-lockup-view-model", "ytd-notification-renderer",
    "ytd-video-preview", "#video-preview",
    // X / Twitter, Reddit, Google
    "[data-testid='tweet']", "shreddit-post", "faceplate-tracker", ".MjjYud", ".g"
  ].join(",");

  const IGNORAR = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "TITLE", "HEAD"]);
  const LIMITE_CARTAO = 4000; // cartão com texto maior que isso é grande demais (página inteira, menu etc.)

  const normalizar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  let ligado = true;
  let regex = montarRegex(BSP_PALAVRAS_PADRAO);
  const paginasReveladas = new Set();

  function montarRegex(palavras) {
    const partes = (palavras || [])
      .map((p) => normalizar(String(p)).trim())
      .filter(Boolean)
      .map((p) => {
        const corpo = p.split(/[\s\-]+/).map(escapar).join("[\\s\\-]*");
        // Palavras curtas precisam terminar ali ("thor" não pega "thorough");
        // longas podem vir grudadas ("#AvengersDoomsday").
        const fim = p.replace(/[^a-z0-9]/g, "").length >= 7 ? "" : "(?![\\p{L}\\p{N}])";
        return corpo + fim;
      });
    if (!partes.length) return null;
    return new RegExp("(?<![\\p{L}\\p{N}])(?:" + partes.join("|") + ")", "u");
  }

  function temSpoiler(texto) {
    return !!(regex && texto && regex.test(normalizar(texto)));
  }

  // Nome do arquivo das fotos e vídeos ("avengers-doomsday-trailer.jpg" vira "avengers doomsday trailer jpg").
  // Só o caminho do endereço (sem o "?..." do final, que costuma ser código aleatório).
  function textoDoEndereco(url) {
    if (!url || /^(data|blob):/i.test(url)) return "";
    let caminho = url;
    try { caminho = new URL(url, location.href).pathname; } catch (e) {}
    try { caminho = decodeURIComponent(caminho); } catch (e) {}
    return " " + caminho.replace(/[-_/+.,%=]/g, " ");
  }

  function textoDosArquivos(el) {
    if (!el.getAttribute) return "";
    let t = textoDoEndereco(el.getAttribute("src")) + textoDoEndereco(el.getAttribute("poster"));
    const srcset = el.getAttribute("srcset");
    if (srcset) srcset.split(",").forEach((parte) => { t += textoDoEndereco(parte.trim().split(/\s+/)[0]); });
    return t;
  }

  const COM_ATRIBUTO = "img,source,video,[title],[aria-label]";

  function textoDoElemento(el) {
    let t = el.textContent || "";
    for (const a of ["alt", "title", "aria-label"]) if (el.getAttribute && el.getAttribute(a)) t += " " + el.getAttribute(a);
    t += textoDosArquivos(el);
    el.querySelectorAll && el.querySelectorAll(COM_ATRIBUTO).forEach((x) => {
      t += " " + (x.getAttribute("alt") || "") + " " + (x.getAttribute("title") || "") + " " + (x.getAttribute("aria-label") || "");
      t += textoDosArquivos(x);
    });
    return t;
  }

  // Áreas de escrita (e-mail, WhatsApp, formulários): nunca mexer nelas nem em quem as contém.
  const EDITAVEL = "[contenteditable=''],[contenteditable='true'],[contenteditable='plaintext-only'],textarea,input:not([type='hidden']),select";
  function temEditavel(x) {
    return !!x && (x.isContentEditable || x.matches(EDITAVEL) || !!x.querySelector(EDITAVEL));
  }

  // Escolhe o que borrar a partir do elemento onde a palavra apareceu.
  // Prefere o cartão inteiro; se ele tiver campo de escrita, borra só o trecho; se nem isso der, não borra.
  function escolherAlvo(el) {
    if (!el || el.isContentEditable) return null;
    const cartao = el.closest(CARTOES);
    if (cartao && cartao !== document.body && (cartao.textContent || "").length < LIMITE_CARTAO && !temEditavel(cartao)) return cartao;
    const bloco = blocoDe(el);
    if (!temEditavel(bloco)) return bloco;
    return temEditavel(el) ? null : el;
  }

  function blocoDe(el) {
    let b = el;
    while (b && b !== document.body) {
      const d = getComputedStyle(b).display;
      if (d !== "inline" && d !== "contents") break;
      b = b.parentElement;
    }
    if (!b || b === document.body || b === document.documentElement) return el;
    const link = b.closest("a");
    if (link && link.querySelector("img,video,picture") && (link.textContent || "").length < 600) return link;
    return b;
  }

  function borrar(alvo) {
    if (!alvo || alvo.closest(".bsp-borrado, .bsp-revelado, #bsp-capa")) return;
    alvo.classList.add("bsp-borrado");
    if (!alvo.hasAttribute("data-bsp-title")) alvo.setAttribute("data-bsp-title", alvo.getAttribute("title") || "");
    alvo.setAttribute("title", "Possível spoiler — clique para ver");
    if (alvo instanceof HTMLMediaElement) segurar(alvo);
    alvo.querySelectorAll("video, audio").forEach(segurar);
  }

  function desborrar(el) {
    el.classList.remove("bsp-borrado");
    const t = el.getAttribute("data-bsp-title");
    if (t) el.setAttribute("title", t); else el.removeAttribute("title");
    el.removeAttribute("data-bsp-title");
  }

  function conferirTexto(no) {
    const pai = no.parentElement;
    if (!pai || IGNORAR.has(pai.tagName) || pai.isContentEditable) return;
    if (pai.closest(".bsp-borrado, .bsp-revelado, #bsp-capa")) return;
    if (temSpoiler(no.nodeValue)) borrar(escolherAlvo(pai));
  }

  function conferirAtributos(el) {
    if (el.isContentEditable || el.closest(".bsp-borrado, .bsp-revelado, #bsp-capa")) return;
    const t = (el.getAttribute("alt") || "") + " " + (el.getAttribute("aria-label") || "") +
      " " + (el.hasAttribute("data-bsp-title") ? "" : el.getAttribute("title") || "") + textoDosArquivos(el);
    if (!temSpoiler(t)) return;
    // <source> fica dentro de <picture>/<video> e não aparece na tela: borra quem a contém.
    const base = el.tagName === "SOURCE" && el.parentElement ? el.parentElement : el;
    borrar(escolherAlvo(base));
  }

  function varrer(raiz) {
    if (!ligado || !regex || !raiz) return;
    if (raiz.nodeType === 3) return conferirTexto(raiz);
    if (raiz.nodeType !== 1 || IGNORAR.has(raiz.tagName)) return;
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) conferirTexto(n);
    if (raiz.matches(COM_ATRIBUTO)) conferirAtributos(raiz);
    raiz.querySelectorAll(COM_ATRIBUTO).forEach(conferirAtributos);
  }

  // Sites como o YouTube reaproveitam o mesmo cartão com outro vídeo: reconfere.
  function reconferir(el) {
    const b = el.closest && el.closest(".bsp-borrado");
    if (b && !temSpoiler(textoDoElemento(b))) desborrar(b);
    const r = el.closest && el.closest(".bsp-revelado");
    if (r && r.getAttribute("data-bsp-texto") !== normalizar(textoDoElemento(r))) {
      r.classList.remove("bsp-revelado");
      r.removeAttribute("data-bsp-texto");
      varrer(r);
    }
  }

  // ---------- Capa da página inteira (quando o título da página já é spoiler) ----------
  // A capa "gruda" no endereço: depois que aparece, só sai quando você clica em
  // "Mostrar mesmo assim" ou vai para outra página (o título do site mudando não faz ela piscar).
  let capaUrl = null;
  let capaAnimou = false;

  function paginaTemSpoiler() {
    let caminho = location.pathname;
    try { caminho = decodeURIComponent(caminho); } catch (e) {}
    caminho = caminho.replace(/[-_/+.]/g, " ");
    return temSpoiler(document.title) || temSpoiler(caminho);
  }

  function capaAtiva() {
    return capaUrl !== null && capaUrl === location.href;
  }

  function conferirPagina() {
    if (!ligado || !regex || paginasReveladas.has(location.href)) {
      capaUrl = null;
      return tirarCapa();
    }
    if (capaAtiva() || paginaTemSpoiler()) {
      if (capaUrl !== location.href) capaAnimou = false;
      capaUrl = location.href;
      porCapa();
    } else {
      capaUrl = null;
      tirarCapa();
    }
  }

  function porCapa() {
    segurarTodosOsVideos();
    const existente = document.getElementById("bsp-capa");
    if (existente && existente.isConnected) return;
    const capa = document.createElement("div");
    capa.id = "bsp-capa";
    if (capaAnimou) capa.classList.add("bsp-sem-animacao");
    capaAnimou = true;
    capa.innerHTML =
      '<div class="bsp-caixa"><div class="bsp-escudo">🛡️</div>' +
      "<b>Esta página pode ter spoiler</b>" +
      "<span>O título ou o endereço fala de Vingadores / Marvel.</span>" +
      '<div class="bsp-botoes"><button id="bsp-voltar">Voltar</button>' +
      '<button id="bsp-mostrar">Mostrar mesmo assim</button></div></div>';
    (document.body || document.documentElement).appendChild(capa);
    capa.querySelector("#bsp-mostrar").addEventListener("click", (e) => {
      e.stopPropagation();
      let caminho = location.pathname;
      try { caminho = decodeURIComponent(caminho); } catch (er) {}
      abrirConfirmacao(null, document.title + " " + caminho.replace(/[-_/+.]/g, " "), () => {
        paginasReveladas.add(location.href);
        capaUrl = null;
        tirarCapa();
        soltarVideos(document);
      });
    });
    capa.querySelector("#bsp-voltar").addEventListener("click", (e) => {
      e.stopPropagation();
      if (history.length > 1) history.back(); else location.href = "about:blank";
    });
  }

  function tirarCapa() {
    const c = document.getElementById("bsp-capa");
    if (c) c.remove();
  }

  // ---------- Vídeo e som: nada toca por trás do bloqueio ----------
  const pausadosPorMim = new Set();

  function precisaSegurar(midia) {
    if (!ligado || !regex) return false;
    return capaAtiva() || !!midia.closest(".bsp-borrado");
  }

  function segurar(midia) {
    try {
      if (!midia.paused) {
        midia.pause();
        pausadosPorMim.add(midia); // só o que estava tocando volta a tocar depois
      }
    } catch (e) {}
  }

  function segurarTodosOsVideos() {
    document.querySelectorAll("video, audio").forEach(segurar);
  }

  // Volta a tocar o que a extensão pausou (só dentro da área revelada).
  function soltarVideos(area) {
    for (const m of [...pausadosPorMim]) {
      if (!m.isConnected) { pausadosPorMim.delete(m); continue; }
      if (area !== document && !area.contains(m)) continue;
      pausadosPorMim.delete(m);
      if (!precisaSegurar(m)) {
        const p = m.play();
        if (p && p.catch) p.catch(() => {});
      }
    }
  }

  // Toda vez que um vídeo/som tenta tocar (o site insiste no "autoplay"), a extensão pausa de novo.
  for (const tipo of ["play", "playing"]) {
    document.addEventListener(tipo, (e) => {
      const m = e.target;
      if (m instanceof HTMLMediaElement && precisaSegurar(m)) segurar(m);
    }, true);
  }

  // ---------- Interface: etiqueta ao passar o mouse + caixinha de confirmação ----------
  // Fica num "Shadow DOM" para o visual do site não bagunçar os botões.
  const CSS_UI = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    .etiqueta {
      position: fixed; left: 0; top: 0; pointer-events: none;
      transform: translate(-50%, -50%) scale(.85); opacity: 0;
      transition: opacity .18s ease, transform .25s cubic-bezier(.34,1.56,.64,1);
      background: rgba(18, 20, 30, .9); color: #fff; font-size: 13px; font-weight: 600;
      padding: 8px 14px; border-radius: 999px; white-space: nowrap;
      box-shadow: 0 6px 20px rgba(0,0,0,.35); display: flex; align-items: center; gap: 6px;
    }
    .etiqueta.on { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    .fundo {
      position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
      background: rgba(10, 12, 20, .55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      opacity: 0; pointer-events: none; transition: opacity .2s ease;
    }
    .fundo.on { opacity: 1; pointer-events: auto; }
    .caixa {
      background: #fff; color: #1a1a1a; border-radius: 20px; padding: 26px 26px 22px;
      width: calc(100% - 32px); max-width: 340px; text-align: center;
      display: flex; flex-direction: column; gap: 8px; font-size: 15px; line-height: 1.4;
      box-shadow: 0 24px 70px rgba(0,0,0,.45);
      transform: scale(.8) translateY(14px); transition: transform .35s cubic-bezier(.34,1.56,.64,1);
    }
    .fundo.on .caixa { transform: none; }
    .icone { font-size: 44px; line-height: 1; margin-bottom: 4px; }
    .fundo.on .icone { animation: balanca .6s ease .1s; }
    @keyframes balanca { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-12deg) } 50% { transform: rotate(10deg) } 75% { transform: rotate(-5deg) } }
    b { font-size: 18px; }
    span { color: #5a5a5a; font-size: 14px; }
    .caixa { max-width: 390px; max-height: calc(100vh - 32px); overflow-y: auto; }
    .sub { font-size: 12.5px; margin-top: -4px; }
    .resumo { list-style: none; margin: 6px 0 0; padding: 0; text-align: left; display: flex; flex-direction: column; gap: 6px; }
    .resumo li { display: flex; gap: 10px; align-items: center; background: #f5f5f8; border-radius: 12px; padding: 8px 12px; font-size: 14px; }
    .resumo em { font-style: normal; font-size: 20px; line-height: 1; }
    .resumo p { margin: 0; }
    .resumo b { font-size: 14px; }
    .fundo.on .resumo li { animation: entra .35s ease both; }
    .fundo.on .resumo li:nth-child(2) { animation-delay: .06s; } .fundo.on .resumo li:nth-child(3) { animation-delay: .12s; }
    .fundo.on .resumo li:nth-child(4) { animation-delay: .18s; } .fundo.on .resumo li:nth-child(n+5) { animation-delay: .24s; }
    @keyframes entra { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .risco { text-align: left; margin-top: 4px; }
    .risco-txt { font-size: 13px; font-weight: 600; color: #333; }
    .barra { height: 8px; background: #ececf0; border-radius: 99px; overflow: hidden; margin-top: 5px; }
    .barra i { display: block; height: 100%; width: 0; border-radius: 99px; transition: width .6s cubic-bezier(.34,1.56,.64,1); }
    .pergunta { margin-top: 10px; }
    .big { font-size: 15px; font-weight: 700; color: #b3261e; margin-top: -4px; }
    .botoes { display: flex; gap: 8px; margin-top: 10px; }
    button {
      flex: 1; border: 0; border-radius: 12px; padding: 11px 12px; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: transform .12s ease, box-shadow .15s ease, background .15s ease;
    }
    button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,.15); }
    button:active { transform: scale(.94); box-shadow: none; }
    button:focus-visible { outline: 3px solid #f2a29c; outline-offset: 2px; }
    .nao { background: #efeff2; color: #333; }
    .nao:hover { background: #e4e4e9; }
    .sim { background: #b3261e; color: #fff; }
    .sim:hover { background: #9c1f18; }
    .sim:disabled { background: #d9a7a3; cursor: not-allowed; transform: none; box-shadow: none; }
    .credito { font-size: 11px; color: #8a8a92; line-height: 1.35; margin-top: 2px; }
    .credito[hidden] { display: none; }
  `;

  let ui = null;
  let emEspera = null; // elemento esperando a confirmação

  function pegarUI() {
    if (ui && ui.host.isConnected) return ui;
    const host = document.createElement("div");
    host.id = "bsp-ui";
    host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
    const raiz = host.attachShadow({ mode: "closed" });
    raiz.innerHTML =
      "<style>" + CSS_UI + "</style>" +
      '<div class="etiqueta">🛡️ Spoiler escondido · clique para ver</div>' +
      '<div class="fundo"><div class="caixa" role="dialog" aria-modal="true">' +
      '<div class="icone">🙈</div><b>Antes de mostrar, o que tem aí:</b>' +
      '<span class="sub">Resumo sem spoiler: nomes e detalhes ficam escondidos.</span>' +
      '<ul class="resumo"></ul>' +
      '<div class="risco"><span class="risco-txt"></span><div class="barra"><i></i></div></div>' +
      '<b class="pergunta">Você ainda quer ver?</b>' +
      '<span class="big">Tem certeza, Big? 🤨</span>' +
      '<span class="credito" hidden></span>' +
      '<div class="botoes"><button class="nao">Continuar escondido</button><button class="sim">Ficar de kwek</button></div>' +
      "</div></div>";
    document.documentElement.appendChild(host);
    ui = {
      host,
      etiqueta: raiz.querySelector(".etiqueta"),
      fundo: raiz.querySelector(".fundo"),
      resumo: raiz.querySelector(".resumo"),
      riscoTxt: raiz.querySelector(".risco-txt"),
      barra: raiz.querySelector(".barra i"),
      nao: raiz.querySelector(".nao"),
      sim: raiz.querySelector(".sim"),
      credito: raiz.querySelector(".credito")
    };
    ui.nao.addEventListener("click", fecharConfirmacao);
    ui.sim.addEventListener("click", () => {
      const b = emEspera, acao = aoConfirmar;
      fecharConfirmacao();
      if (acao) acao(); else if (b) revelar(b);
    });
    ui.fundo.addEventListener("click", (e) => { if (e.target === ui.fundo) fecharConfirmacao(); });
    raiz.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharConfirmacao(); });
    return ui;
  }

  // Monta o resumo sem spoiler (resumo.js) dentro da caixinha.
  const RISCOS = [null, ["🟢 Risco de spoiler: baixo", "33%", "#2e9d4f"], ["🟡 Risco de spoiler: médio", "66%", "#e0a100"], ["🔴 Risco de spoiler: alto", "100%", "#b3261e"]];
  function preencherResumo(u, texto, el) {
    let r = { itens: [{ icone: "🤷", frase: "Não deu para resumir, mas cita Vingadores / Marvel" }], nivel: 2 };
    try { if (typeof BSP_RESUMIR === "function") r = BSP_RESUMIR(texto, el); } catch (e) {}
    u.resumo.innerHTML = r.itens.map((i) => '<li><em>' + i.icone + "</em><p>" + i.frase + "</p></li>").join("");
    const [txt, larg, cor] = RISCOS[r.nivel] || RISCOS[2];
    u.riscoTxt.textContent = txt;
    u.barra.style.width = "0";
    u.barra.style.background = cor;
    setTimeout(() => { u.barra.style.width = larg; }, 120);
  }

  let aoConfirmar = null; // ação especial do "Sim" (capa da página inteira)

  // Música da confirmação: toca o arquivo musica.mp3 da pasta da extensão (se existir).
  const CREDITOS = {
    musica: "🎵 Song: Cartoon, Jéja - On &amp; On (feat. Daniel Levi) [NCS Release]<br>Music provided by NoCopyrightSounds · Free Download/Stream: ncs.io",
    capitao: "🎤 Cantarolada original, feita em casa para o Capitão Big"
  };
  let musicaTocando = false;
  window.addEventListener("pagehide", () => musica("parar"));
  function musica(acao) {
    if (acao === "tocar" ? musicaTocando : !musicaTocando) return;
    musicaTocando = acao === "tocar";
    if (ui) ui.credito.hidden = true;
    try {
      chrome.runtime.sendMessage({ musica: acao }).then((r) => {
        if (!ui || !musicaTocando || !r || !CREDITOS[r.fonte]) return;
        ui.credito.innerHTML = CREDITOS[r.fonte];
        ui.credito.hidden = false;
      }, () => {});
    } catch (e) {}
  }

  function abrirConfirmacao(b, texto, acao) {
    const u = pegarUI();
    esconderEtiqueta();
    if (emEspera) emEspera.classList.remove("bsp-escolhido");
    emEspera = b || null;
    aoConfirmar = acao || null;
    if (b) b.classList.add("bsp-escolhido");
    preencherResumo(u, texto !== undefined ? texto : textoDoElemento(b), b);
    u.fundo.classList.add("on");
    musica("tocar");
    setTimeout(() => u.nao.focus(), 50);
  }

  function fecharConfirmacao() {
    if (emEspera) emEspera.classList.remove("bsp-escolhido");
    emEspera = null;
    aoConfirmar = null;
    if (ui) ui.fundo.classList.remove("on");
    musica("parar");
  }

  function revelar(b) {
    desborrar(b);
    b.classList.add("bsp-revelado");
    b.setAttribute("data-bsp-texto", normalizar(textoDoElemento(b)));
    soltarVideos(b);
  }

  // Etiqueta "Spoiler escondido" no meio do item quando o mouse passa por cima.
  let sobMouse = null;
  function posicionarEtiqueta() {
    if (!sobMouse || !ui) return;
    if (!sobMouse.classList.contains("bsp-borrado") || !sobMouse.isConnected) return esconderEtiqueta();
    const r = sobMouse.getBoundingClientRect();
    const topo = Math.max(r.top, 0), baixo = Math.min(r.bottom, innerHeight);
    if (baixo <= topo) return esconderEtiqueta();
    ui.etiqueta.style.left = (r.left + r.width / 2) + "px";
    ui.etiqueta.style.top = ((topo + baixo) / 2) + "px";
    ui.etiqueta.classList.add("on");
  }
  function esconderEtiqueta() {
    sobMouse = null;
    if (ui) ui.etiqueta.classList.remove("on");
  }
  window.addEventListener("mouseover", (e) => {
    const b = e.target.closest && e.target.closest(".bsp-borrado");
    // Enquanto o mouse está num item borrado, as janelinhas de prévia do site ficam invisíveis.
    document.documentElement.classList.toggle("bsp-sem-previa", !!b);
    if (b === sobMouse) return;
    if (!b || (ui && ui.fundo.classList.contains("on"))) return esconderEtiqueta();
    pegarUI();
    sobMouse = b;
    posicionarEtiqueta();
  }, true);
  window.addEventListener("scroll", posicionarEtiqueta, { capture: true, passive: true });

  // O site não fica sabendo que o mouse passou por cima de um item borrado,
  // então não abre prévia de vídeo (YouTube, Shorts e outros sites que tocam vídeo ao passar o mouse).
  // Precisa vir DEPOIS do "mouseover" da etiqueta acima.
  function bloquearPassarMouse(e) {
    if (e.target.closest && e.target.closest(".bsp-borrado")) e.stopImmediatePropagation();
  }
  for (const tipo of ["mouseover", "mouseenter", "mousemove", "mouseout", "mouseleave",
    "pointerover", "pointerenter", "pointermove", "pointerout", "pointerleave", "focusin", "focus"]) {
    window.addEventListener(tipo, bloquearPassarMouse, true);
  }

  // ---------- Clique no borrado: pede confirmação ----------
  function aoClicar(e) {
    const b = e.target.closest && e.target.closest(".bsp-borrado");
    if (!b) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === "click") abrirConfirmacao(b);
  }
  for (const tipo of ["click", "mousedown", "pointerdown", "auxclick", "contextmenu"]) window.addEventListener(tipo, aoClicar, true);

  // ---------- Observa a página mudando (rolagem infinita, YouTube etc.) ----------
  const observador = new MutationObserver((mudancas) => {
    if (!ligado || !regex) return;
    let tituloMudou = false;
    for (const m of mudancas) {
      const alvoM = m.target;
      if (alvoM.nodeName === "TITLE" || (alvoM.parentNode && alvoM.parentNode.nodeName === "TITLE") ||
        [...m.addedNodes].some((n) => n.nodeName === "TITLE")) tituloMudou = true;
      if (m.type === "childList") {
        reconferir(m.target);
        m.addedNodes.forEach(varrer);
      } else if (m.type === "characterData") {
        if (m.target.parentElement) reconferir(m.target.parentElement);
        conferirTexto(m.target);
      } else if (m.type === "attributes") {
        if (m.attributeName === "title" && m.target.hasAttribute("data-bsp-title")) continue;
        reconferir(m.target);
        conferirAtributos(m.target);
      }
    }
    if (tituloMudou) conferirPagina(); // título da aba mudou: confere na hora, sem esperar
  });

  function ligarObservador() {
    observador.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["alt", "title", "aria-label", "src", "srcset", "poster"]
    });
  }

  function limparTudo() {
    fecharConfirmacao();
    esconderEtiqueta();
    document.querySelectorAll(".bsp-borrado").forEach(desborrar);
    document.querySelectorAll(".bsp-revelado").forEach((r) => {
      r.classList.remove("bsp-revelado");
      r.removeAttribute("data-bsp-texto");
    });
  }

  function aplicar() {
    limparTudo();
    conferirPagina();
    if (!ligado || !regex) return;
    varrer(document.documentElement);
  }

  // Sites que trocam de página sem recarregar (YouTube): confere título/endereço o tempo todo.
  // Também recoloca a capa se o site a apagar.
  setInterval(conferirPagina, 400);

  ligarObservador();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", aplicar);
  else aplicar();

  // ---------- Configurações (ligar/desligar e lista de palavras) ----------
  // Site liberado: o próprio site ou o site "de cima" (quando é um quadro embutido) está na lista.
  function siteLiberado(lista) {
    if (!Array.isArray(lista) || !lista.length) return false;
    const hosts = [location.hostname];
    try {
      for (const o of location.ancestorOrigins || []) hosts.push(new URL(o).hostname);
    } catch (e) {}
    return hosts.some((h) => {
      h = (h || "").replace(/^www\./, "");
      return lista.some((s) => h === s || h.endsWith("." + s));
    });
  }

  let ligadoGeral = true;
  let liberado = false;
  const atualizarLigado = () => { ligado = ligadoGeral && !liberado; };

  try {
    chrome.storage.sync.get(["ligado", "palavras", "sitesLiberados"], (cfg) => {
      ligadoGeral = cfg.ligado !== false;
      liberado = siteLiberado(cfg.sitesLiberados);
      atualizarLigado();
      regex = montarRegex(Array.isArray(cfg.palavras) ? cfg.palavras : BSP_PALAVRAS_PADRAO);
      aplicar();
    });
    chrome.storage.onChanged.addListener((mud) => {
      if (mud.ligado) ligadoGeral = mud.ligado.newValue !== false;
      if (mud.sitesLiberados) liberado = siteLiberado(mud.sitesLiberados.newValue);
      atualizarLigado();
      if (mud.palavras) regex = montarRegex(Array.isArray(mud.palavras.newValue) ? mud.palavras.newValue : BSP_PALAVRAS_PADRAO);
      capaUrl = null; // lista ou liga/desliga mudou: reavalia a capa do zero
      aplicar();
    });
  } catch (e) { /* fora da extensão (página de teste) */ }
})();
