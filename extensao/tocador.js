// Toca o som do aviso de confirmação ("Tem certeza, Big?").
// Se existir um musica.mp3 nesta pasta, toca ele. Se não, toca o "escracho":
// efeitos sonoros feitos aqui mesmo, por código (sem arquivo e sem direito autoral).

// ---------- Escracho: cada efeito é desenhado nota por nota ----------
function bspEscracho(ctx, saida, t0) {
  function nota(freq, ini, dur, tipo, vol, vib) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t0 + ini);
    f.type = "lowpass"; f.frequency.value = 1800;
    g.gain.setValueAtTime(0, t0 + ini);
    g.gain.linearRampToValueAtTime(vol, t0 + ini + 0.02);
    g.gain.setValueAtTime(vol, t0 + ini + dur * 0.75);
    g.gain.linearRampToValueAtTime(0, t0 + ini + dur);
    if (vib) { // vibrato: a nota "treme" (trombone chorando)
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = vib[0]; lg.gain.value = vib[1];
      l.connect(lg).connect(o.frequency);
      l.start(t0 + ini); l.stop(t0 + ini + dur);
    }
    o.connect(f).connect(g).connect(saida);
    o.start(t0 + ini); o.stop(t0 + ini + dur + 0.05);
    return o;
  }
  function deslize(f1, f2, ini, dur, tipo, vol, vib) {
    const o = nota(f1, ini, dur, tipo, vol, vib);
    o.frequency.exponentialRampToValueAtTime(f2, t0 + ini + dur);
  }

  // 1) Fanfarra de circo, rapidinha
  [523, 659, 784, 1047, 784, 1047].forEach((f, i) => nota(f, i * 0.11, 0.1, "square", 0.12));
  // 2) Buzina de palhaço: fom-fom!
  deslize(360, 300, 0.75, 0.16, "sawtooth", 0.28);
  deslize(360, 300, 0.97, 0.22, "sawtooth", 0.28);
  // 3) Boiiing
  deslize(110, 700, 1.35, 0.55, "sine", 0.35, [14, 40]);
  // 4) Apito subindo e descendo (fiuuu-fiu)
  deslize(500, 1700, 2.05, 0.45, "sine", 0.18);
  deslize(1700, 400, 2.55, 0.35, "sine", 0.18);
  // 5) Trombone triste: uón, uón, uón, uóóóóón...
  nota(294, 3.05, 0.42, "sawtooth", 0.22);
  nota(277, 3.5, 0.42, "sawtooth", 0.22);
  nota(262, 3.95, 0.42, "sawtooth", 0.22);
  nota(247, 4.4, 1.3, "sawtooth", 0.22, [6, 7]);
  return 6.2; // duração da rodada, com uma pausinha no fim
}

// ---------- Tocador ----------
const audio = document.getElementById("musica");
// Ordem do que toca:
//  1) musica.mp3 (se você colocar um na pasta; não vai para o GitHub): só o trecho TRECHO_INICIO a TRECHO_FIM
//  2) som-do-capitao.mp3 (a cantarolada original que vem com a extensão): inteiro, repetindo
//  3) o escracho feito por código
const TRECHO_INICIO = 45; // 0:45
const TRECHO_FIM = 76;    // 1:16
let fonte = null; // "musica" | "capitao" | "escracho"
let ctx = null, volume = null, timer = null;

audio.addEventListener("timeupdate", () => {
  if (fonte !== "musica") return;
  if (audio.currentTime >= TRECHO_FIM || audio.currentTime < TRECHO_INICIO - 1) audio.currentTime = TRECHO_INICIO;
});
audio.addEventListener("ended", () => {
  audio.currentTime = fonte === "musica" ? TRECHO_INICIO : 0;
  audio.play().catch(() => {});
});

async function carregar(arquivo) {
  try {
    const r = await fetch(arquivo);
    if (!r.ok) return false;
    // Carrega o arquivo inteiro na memória: assim dá para pular direto para o trecho.
    audio.src = URL.createObjectURL(await r.blob());
    await new Promise((ok) => { audio.addEventListener("loadedmetadata", ok, { once: true }); setTimeout(ok, 3000); });
    return true;
  } catch (e) { return false; }
}

async function escolherFonte() {
  if (fonte) return fonte;
  if (await carregar("musica.mp3")) fonte = "musica";
  else if (await carregar("som-do-capitao.mp3")) fonte = "capitao";
  else fonte = "escracho";
  return fonte;
}

function rodada() {
  const dur = bspEscracho(ctx, volume, ctx.currentTime + 0.05);
  timer = setTimeout(rodada, dur * 1000);
}

function pararEscracho() {
  clearTimeout(timer); timer = null;
  if (volume) { volume.disconnect(); volume = null; }
}

async function tocar() {
  if ((await escolherFonte()) !== "escracho") {
    audio.currentTime = fonte === "musica" ? TRECHO_INICIO : 0;
    return audio.play().catch(() => {});
  }
  pararEscracho();
  ctx = ctx || new AudioContext();
  await ctx.resume();
  volume = ctx.createGain();
  volume.gain.value = 2.2;
  volume.connect(ctx.destination);
  rodada();
}

function parar() {
  audio.pause();
  pararEscracho();
}

if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg, _de, responder) => {
    if (!msg || msg.alvo !== "tocador") return;
    if (msg.musica === "tocar") {
      tocar().then(() => responder({ fonte }), () => responder({ fonte }));
      return true; // resposta chega depois
    }
    if (msg.musica === "parar") parar();
  });
}
