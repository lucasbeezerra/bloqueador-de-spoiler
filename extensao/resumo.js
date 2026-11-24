// Resumo SEM spoiler do que está escondido: antes de revelar, a extensão conta "do que se trata"
// (alguém morre, alguém volta, é um trailer...) sem dizer quem, como nem quando.
// Tudo é feito aqui no computador, lendo o próprio texto escondido. Nada é enviado para fora.
var BSP_RESUMIR = (() => {
  const normalizar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  // Cada tema: palavras que denunciam o assunto, a frase (vaga) que aparece e o "peso" do spoiler (1 a 3).
  const TEMAS = [
    { peso: 3, icone: "💀", frase: "Fala de um personagem que <b>morre</b> (quem e como: escondido)",
      palavras: ["morre", "morrem", "morreu", "morreram", "morte", "mortes", "morto", "morta", "mata", "matou", "matam", "assassinad", "sacrificio", "se sacrifica", "funeral", "luto", "adeus", "dies", "died", "death", "dead", "killed", "kills", "sacrifice", "rip"] },
    { peso: 3, icone: "🎬", frase: "Conta algo sobre o <b>final</b> da história",
      palavras: ["final", "finais", "desfecho", "ending", "ultima cena", "last scene", "como termina", "how it ends"] },
    { peso: 3, icone: "🍿", frase: "Fala de uma <b>cena pós-créditos</b>",
      palavras: ["pos-credito", "pos-creditos", "pos credito", "pos creditos", "post-credit", "post credit", "cena extra", "mid-credit", "end credits"] },
    { peso: 3, icone: "😱", frase: "Tem uma <b>revelação ou reviravolta</b>",
      palavras: ["revela", "revelado", "revelada", "revelacao", "reviravolta", "plot twist", "twist", "segredo", "verdadeira identidade", "revealed", "reveals", "surpresa"] },
    { peso: 3, icone: "🕵️", frase: "É um <b>vazamento</b> (coisa que ainda não era para saber)",
      palavras: ["vazou", "vazamento", "vazad", "leak", "leaked", "leaks", "set photos", "fotos do set", "insider", "rumor", "rumores", "rumors"] },
    { peso: 2, icone: "🔄", frase: "Fala de alguém que <b>volta</b> ou reaparece",
      palavras: ["volta", "voltou", "voltam", "retorno", "retorna", "retornou", "ressuscit", "revive", "reaparece", "de volta", "returns", "returning", "is back", "comeback", "brought back"] },
    { peso: 2, icone: "⚔️", frase: "Fala de uma <b>luta ou batalha</b>",
      palavras: ["luta", "lutam", "batalha", "confronto", "versus", "derrota", "derrotad", "vence", "venceu", "fight", "battle", "defeat", "defeated", "beats"] },
    { peso: 2, icone: "🦹", frase: "Fala do <b>vilão</b>",
      palavras: ["vilao", "viloes", "villain", "villains", "antagonista", "antagonist"] },
    { peso: 2, icone: "✨", frase: "Fala de um <b>personagem novo</b> ou de uma participação especial",
      palavras: ["cameo", "participacao especial", "aparicao", "aparece", "aparecem", "estreia de", "novo heroi", "nova heroina", "introduz", "introduced", "appears", "appearance", "debut"] },
    { peso: 1, icone: "🎞️", frase: "É sobre um <b>trailer</b>, teaser ou cena divulgada",
      palavras: ["trailer", "teaser", "clip", "clipe", "cena", "cenas", "scene", "footage", "promo", "spot", "tv spot"] },
    { peso: 1, icone: "🎭", frase: "Fala do <b>elenco</b> (atores e atrizes)",
      palavras: ["ator", "atriz", "atores", "elenco", "escalad", "interpreta", "actor", "actress", "cast", "casting", "plays"] },
    { peso: 1, icone: "🧠", frase: "É uma <b>teoria</b> de fã (pode estar certa ou não)",
      palavras: ["teoria", "teorias", "theory", "theories", "especulacao", "what if", "previsao", "prediction"] },
    { peso: 1, icone: "📅", frase: "Fala de <b>estreia, data ou bilheteria</b>",
      palavras: ["estreia", "estreou", "lancamento", "data de estreia", "bilheteria", "ingresso", "ingressos", "pre-venda", "release", "release date", "box office", "tickets", "premiere", "adiado", "delayed"] },
    { peso: 1, icone: "⭐", frase: "É uma <b>crítica ou opinião</b> sobre o filme",
      palavras: ["critica", "review", "reviews", "opiniao", "vale a pena", "assisti", "melhor filme", "pior filme", "rotten", "reaction", "reacao", "react"] }
  ];

  // Personagens: só para CONTAR quantos aparecem. O nome nunca é mostrado.
  const PERSONAGENS = [
    ["thanos"], ["doutor destino", "dr. destino", "dr destino", "doctor doom", "dr. doom", "dr doom", "victor von doom"],
    ["homem de ferro", "iron man", "tony stark"], ["capitao america", "captain america", "steve rogers"],
    ["sam wilson", "falcao", "falcon"], ["thor"], ["loki"], ["hulk", "bruce banner"], ["mulher-hulk", "she-hulk"],
    ["viuva negra", "black widow", "natasha", "yelena"], ["gaviao arqueiro", "hawkeye", "clint barton"],
    ["homem-aranha", "homem aranha", "spider-man", "spiderman", "peter parker"],
    ["doutor estranho", "doctor strange", "stephen strange"], ["pantera negra", "black panther", "tchalla", "shuri"],
    ["wanda", "feiticeira escarlate", "scarlet witch"], ["kang"], ["soldado invernal", "winter soldier", "bucky"],
    ["homem-formiga", "homem formiga", "ant-man", "scott lang"], ["capita marvel", "captain marvel", "carol danvers"],
    ["shang-chi"], ["wolverine", "logan"], ["deadpool"], ["magneto"], ["professor x", "professor xavier"],
    ["ciclope", "cyclops"], ["groot"], ["senhor das estrelas", "star-lord", "star lord"], ["gamora"], ["nebulosa", "nebula"],
    ["reed richards", "senhor fantastico", "mister fantastic"], ["tocha humana", "human torch"],
    ["mulher invisivel", "invisible woman", "sue storm"], ["galactus"], ["surfista prateado", "silver surfer"],
    ["sentinela", "sentry"], ["ultron"], ["visao", "vision"], ["nick fury"], ["mephisto"]
  ];

  const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Palavra inteira; termos que terminam em "d" (assassinad, vazad...) aceitam qualquer final.
  function regexDe(lista) {
    const partes = lista.map((p) => {
      const corpo = p.split(/[\s\-]+/).map(escapar).join("[\\s\\-]*");
      return /(?:ad|ssuscit|escalad)$/.test(p) ? corpo : corpo + "(?![\\p{L}\\p{N}])";
    });
    return new RegExp("(?<![\\p{L}\\p{N}])(?:" + partes.join("|") + ")", "u");
  }
  const TEMAS_RE = TEMAS.map((t) => ({ ...t, re: regexDe(t.palavras) }));
  const PERSONAGENS_RE = PERSONAGENS.map(regexDe);

  // Recebe o texto escondido e (opcional) o elemento; devolve { itens: [{icone, frase}], nivel: 1..3 }.
  return function resumir(texto, el) {
    const t = normalizar(texto);
    const itens = [];
    let nivel = 1;

    // Que tipo de coisa é
    const tag = el && el.tagName ? el.tagName.toLowerCase() : "";
    const tem = (sel) => !!(el && el.matches && (el.matches(sel) || el.querySelector(sel)));
    if (tag.includes("comment") || tem("ytd-comment-renderer, ytd-comment-view-model")) {
      itens.push({ icone: "💬", frase: "É um <b>comentário</b> de alguém" });
    } else if (tem("video, ytd-thumbnail, yt-thumbnail-view-model, [href*='/watch'], [href*='/shorts/']") || /youtube|youtu\.be/.test(location.hostname)) {
      itens.push({ icone: "▶️", frase: "É um <b>vídeo</b> (a miniatura também está escondida)" });
    } else if (tem("img, picture, svg image")) {
      itens.push({ icone: "🖼️", frase: "Tem <b>imagem</b> junto com o texto" });
    }

    // Quantos personagens aparecem (sem dizer quais)
    const qtd = PERSONAGENS_RE.filter((re) => re.test(t)).length;
    if (qtd === 1) itens.push({ icone: "🦸", frase: "Cita <b>1 personagem</b> (nome escondido)" });
    else if (qtd > 1) itens.push({ icone: "🦸", frase: "Cita <b>" + qtd + " personagens</b> (nomes escondidos)" });

    // Do que se trata
    for (const tema of TEMAS_RE) {
      if (tema.re.test(t)) {
        itens.push({ icone: tema.icone, frase: tema.frase });
        nivel = Math.max(nivel, tema.peso);
      }
      if (itens.length >= 6) break;
    }
    if (qtd >= 3) nivel = Math.max(nivel, 2);

    if (itens.length === 0 || (itens.length === 1 && qtd === 0)) {
      itens.push({ icone: "🤷", frase: "Só <b>cita</b> Vingadores / Marvel, sem dar pista do assunto" });
    }

    const palavras = t.split(/\s+/).filter(Boolean).length;
    if (palavras > 60) itens.push({ icone: "📄", frase: "Texto <b>longo</b> (uns " + Math.round(palavras / 10) * 10 + " palavras)" });

    return { itens, nivel };
  };
})();
