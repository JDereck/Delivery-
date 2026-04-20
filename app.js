// ============================================================
//  CONFIGURAÇÕES — edite aqui para personalizar o sistema
// ============================================================
const CONFIG = {
  whatsapp:            "5500000000000",   // Número com DDI+DDD (sem espaços ou traços)
  taxaEntrega:         5.00,              // Taxa de entrega em R$
  horarioAbertura:     "18:00",           // Horário de abertura HH:MM
  horarioFechamento:   "23:00",           // Horário de fechamento HH:MM
  diasFechado:         ["segunda"],       // Dias fechados: domingo|segunda|terça|quarta|quinta|sexta|sábado
  nomeEstabelecimento: "Delivery",        // Nome exibido no topo da página
  sheetsUrl:           "",               // URL do Google Apps Script (deixe "" para desativar)
};

// ============================================================
//  NOTAS POR CATEGORIA (exibidas abaixo do título da seção)
// ============================================================
const NOTAS = {
  "🍔 Sanduíches":        "Adicional de ingredientes (carne, queijo, ovo, bacon ou frango): R$ 3,00 cada — informe nas observações",
  "🥟 Pastéis & Merendas": "Adicional para pastéis (azeitona, milho, frango etc.): R$ 2,00 cada — informe nas observações",
  "🥤 Bebidas":           "Vitaminas: informe o sabor nas observações — Manga, Maracujá, Cajá, Acerola, Graviola, Goiaba, Açaí ou Guaraná",
};

// ============================================================
//  CARDÁPIO
//  Cada item pode ter:
//    cat  — categoria
//    nome — nome do produto
//    p    — preço fixo (sem variantes)
//    vs   — array de variantes: [{ l: "Label", p: preço }, ...]
//    tag  — badge visual (para pizzas): "tradicional"|"especial"|"premium"|"doce"
//    desc — descrição curta exibida no card
// ============================================================
const PRODUTOS = [

  // ---- SANDUÍCHES ----
  { id:  1, cat: "🍔 Sanduíches", nome: "Misto Quente",  vs: [{ l: "Pão Bola", p: 8  }, { l: "Pão Árabe", p: 9  }] },
  { id:  2, cat: "🍔 Sanduíches", nome: "Hambúrguer",    vs: [{ l: "Pão Bola", p: 8  }, { l: "Pão Árabe", p: 9  }] },
  { id:  3, cat: "🍔 Sanduíches", nome: "Americano",     vs: [{ l: "Pão Bola", p: 11 }, { l: "Pão Árabe", p: 12 }] },
  { id:  4, cat: "🍔 Sanduíches", nome: "X-Frango",      vs: [{ l: "Pão Bola", p: 11 }, { l: "Pão Árabe", p: 12 }] },
  { id:  5, cat: "🍔 Sanduíches", nome: "X-Burguer",     vs: [{ l: "Pão Bola", p: 11 }, { l: "Pão Árabe", p: 12 }] },
  { id:  6, cat: "🍔 Sanduíches", nome: "Bauru",         vs: [{ l: "Pão Bola", p: 13 }, { l: "Pão Árabe", p: 14 }] },
  { id:  7, cat: "🍔 Sanduíches", nome: "X-Calabresa",   vs: [{ l: "Pão Bola", p: 15 }, { l: "Pão Árabe", p: 16 }] },
  { id:  8, cat: "🍔 Sanduíches", nome: "X-Bacon",       vs: [{ l: "Pão Bola", p: 15 }, { l: "Pão Árabe", p: 16 }] },
  { id:  9, cat: "🍔 Sanduíches", nome: "X-Tudo",        vs: [{ l: "Pão Bola", p: 17 }, { l: "Pão Árabe", p: 18 }] },

  // ---- PIZZAS — Tradicionais ----
  { id: 10, cat: "🍕 Pizzas", nome: "Mussarela",            p: 27, tag: "tradicional" },
  { id: 11, cat: "🍕 Pizzas", nome: "Mista",                p: 27, tag: "tradicional" },
  { id: 12, cat: "🍕 Pizzas", nome: "Calabresa",            p: 27, tag: "tradicional" },
  { id: 13, cat: "🍕 Pizzas", nome: "Bacon",                p: 27, tag: "tradicional" },
  { id: 14, cat: "🍕 Pizzas", nome: "Portuguesa",           p: 27, tag: "tradicional" },
  { id: 15, cat: "🍕 Pizzas", nome: "3 Queijos",            p: 27, tag: "tradicional" },
  { id: 16, cat: "🍕 Pizzas", nome: "Caipira",              p: 27, tag: "tradicional" },
  { id: 17, cat: "🍕 Pizzas", nome: "Frango c/ Queijo",     p: 27, tag: "tradicional" },
  // Especiais
  { id: 18, cat: "🍕 Pizzas", nome: "Frango c/ Catupiry",  p: 30, tag: "especial"    },
  { id: 19, cat: "🍕 Pizzas", nome: "Frango c/ Cheddar",   p: 30, tag: "especial"    },
  // Premium & Doces
  { id: 20, cat: "🍕 Pizzas", nome: "Carne do Sol",         p: 32, tag: "premium"    },
  { id: 21, cat: "🍕 Pizzas", nome: "Chocolate",            p: 32, tag: "doce"       },

  // ---- BATATAS FRITAS ----
  { id: 22, cat: "🍟 Batatas Fritas", nome: "Simples",   vs: [{ l: "Pequena", p: 7  }, { l: "Grande", p: 12 }] },
  { id: 23, cat: "🍟 Batatas Fritas", nome: "Calabresa", vs: [{ l: "Pequena", p: 10 }, { l: "Grande", p: 15 }] },
  { id: 24, cat: "🍟 Batatas Fritas", nome: "Bacon",     vs: [{ l: "Pequena", p: 10 }, { l: "Grande", p: 15 }] },
  { id: 25, cat: "🍟 Batatas Fritas", nome: "Cheddar",   vs: [{ l: "Pequena", p: 10 }, { l: "Grande", p: 15 }] },
  { id: 26, cat: "🍟 Batatas Fritas", nome: "Catupiry",  vs: [{ l: "Pequena", p: 10 }, { l: "Grande", p: 15 }] },

  // ---- REFEIÇÕES ----
  { id: 27, cat: "🍲 Refeições", nome: "Creme de Galinha",        vs: [{ l: "Pequeno", p: 10 }, { l: "Grande", p: 15 }] },
  { id: 28, cat: "🍲 Refeições", nome: "Vatapá",                  vs: [{ l: "Pequeno", p: 10 }, { l: "Grande", p: 15 }] },
  { id: 29, cat: "🍲 Refeições", nome: "Baião c/ Carne",          vs: [{ l: "Pequeno", p: 10 }, { l: "Grande", p: 15 }] },
  { id: 30, cat: "🍲 Refeições", nome: "Lasanha",                 vs: [{ l: "Pequena", p: 10 }, { l: "Grande", p: 15 }] },
  { id: 31, cat: "🍲 Refeições", nome: "Macarronada à Bolonhesa", vs: [{ l: "Pequena", p: 10 }, { l: "Grande", p: 15 }] },

  // ---- PASTÉIS & MERENDAS ----
  { id: 32, cat: "🥟 Pastéis & Merendas", nome: "Pastel de Queijo",               p: 8  },
  { id: 33, cat: "🥟 Pastéis & Merendas", nome: "Pastel de Carne",                p: 8  },
  { id: 34, cat: "🥟 Pastéis & Merendas", nome: "Pastel de Frango",               p: 8  },
  { id: 35, cat: "🥟 Pastéis & Merendas", nome: "Pastel Misto",                   p: 8  },
  { id: 36, cat: "🥟 Pastéis & Merendas", nome: "Pastel Carne c/ Queijo",         p: 10 },
  { id: 37, cat: "🥟 Pastéis & Merendas", nome: "Pastel Frango c/ Queijo",        p: 10 },
  { id: 38, cat: "🥟 Pastéis & Merendas", nome: "Pastel Carne do Sol",            p: 10 },
  { id: 39, cat: "🥟 Pastéis & Merendas", nome: "Pastel Carne do Sol c/ Queijo",  p: 12 },
  { id: 40, cat: "🥟 Pastéis & Merendas", nome: "Pastel Doce de Chocolate",       p: 10 },
  { id: 41, cat: "🥟 Pastéis & Merendas", nome: "Pastel Mistão",                  p: 14 },
  { id: 42, cat: "🥟 Pastéis & Merendas", nome: "Salgado",                        p: 4  },
  { id: 43, cat: "🥟 Pastéis & Merendas", nome: "Empada",                         p: 5  },
  { id: 44, cat: "🥟 Pastéis & Merendas", nome: "Torta de Frango",                p: 6  },

  // ---- TAPIOCAS ----
  { id: 45, cat: "🌮 Tapiocas", nome: "Manteiga",               p: 4 },
  { id: 46, cat: "🌮 Tapiocas", nome: "Frango c/ Queijo",       p: 7 },
  { id: 47, cat: "🌮 Tapiocas", nome: "Queijo",                 p: 7 },
  { id: 48, cat: "🌮 Tapiocas", nome: "Queijo e Presunto",      p: 7 },
  { id: 49, cat: "🌮 Tapiocas", nome: "Carne do Sol c/ Queijo", p: 9 },
  { id: 50, cat: "🌮 Tapiocas", nome: "Chocolate",              p: 7 },

  // ---- BEBIDAS ----
  { id: 51, cat: "🥤 Bebidas", nome: "Vitamina",   p: 10, desc: "Manga · Maracujá · Cajá · Acerola · Graviola · Goiaba · Açaí · Guaraná — informe o sabor nas observações" },
  { id: 52, cat: "🥤 Bebidas", nome: "Suco",       vs: [{ l: "400ml",  p: 4  }, { l: "1 Litro",  p: 12 }] },
  { id: 53, cat: "🥤 Bebidas", nome: "Coca-Cola",  vs: [{ l: "Lata",   p: 5  }, { l: "1 Litro",  p: 9  }, { l: "2 Litros", p: 15 }] },
  { id: 54, cat: "🥤 Bebidas", nome: "Guaraná 1L", p: 7  },
  { id: 55, cat: "🥤 Bebidas", nome: "Pitchula",   p: 4  },
];

// ============================================================
//  ESTADO DO CARRINHO
//  key: `${produto.id}-${variantLabel || "default"}`
//  value: { nome, preco, qty }
// ============================================================
let carrinho = {};

// ============================================================
//  UTILITÁRIOS
// ============================================================

function fmt(valor) {
  return "R$ " + valor.toFixed(2).replace(".", ",");
}

function slugCat(cat) {
  return cat.replace(/\s+/g, "-").replace(/[^\w-]/g, "").toLowerCase();
}

// ============================================================
//  VERIFICAÇÃO DE HORÁRIO
// ============================================================

const DIAS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function verificarHorario() {
  const agora  = new Date();
  const diaNome = DIAS_PT[agora.getDay()];

  if (CONFIG.diasFechado.includes(diaNome)) {
    const diasStr = CONFIG.diasFechado.join(", ");
    return { aberto: false, msg: `Fechado às ${diasStr}. Voltamos em breve! 🙏` };
  }

  const [hA, mA] = CONFIG.horarioAbertura.split(":").map(Number);
  const [hF, mF] = CONFIG.horarioFechamento.split(":").map(Number);
  const minAbertura   = hA * 60 + mA;
  const minFechamento = hF * 60 + mF;
  const minAgora      = agora.getHours() * 60 + agora.getMinutes();

  if (minAgora < minAbertura) {
    return { aberto: false, msg: `Ainda fechado. Abrimos às ${CONFIG.horarioAbertura}. Volte logo! 😊` };
  }
  if (minAgora >= minFechamento) {
    return { aberto: false, msg: `Fechamos às ${CONFIG.horarioFechamento}. Até amanhã! 🌙` };
  }

  return { aberto: true, msg: `Aberto até às ${CONFIG.horarioFechamento}` };
}

// ============================================================
//  RENDERIZAÇÃO DO CARDÁPIO
// ============================================================

function renderCardapio() {
  const el = document.getElementById("cardapio");
  const nav = document.getElementById("nav-categorias");

  // Agrupa produtos por categoria, mantendo ordem de inserção
  const categorias = [];
  const mapaCat = {};
  for (const p of PRODUTOS) {
    if (!mapaCat[p.cat]) {
      mapaCat[p.cat] = [];
      categorias.push(p.cat);
    }
    mapaCat[p.cat].push(p);
  }

  // Navega por categorias
  nav.innerHTML = categorias.map(c =>
    `<a href="#cat-${slugCat(c)}">${c}</a>`
  ).join("");

  // Renderiza seções
  el.innerHTML = categorias.map(cat => {
    const slug  = slugCat(cat);
    const nota  = NOTAS[cat] ? `<p class="categoria-nota">⚠️ ${NOTAS[cat]}</p>` : "";
    const cards = mapaCat[cat].map(renderCard).join("");
    return `
      <section class="categoria-secao" id="cat-${slug}">
        <h2 class="categoria-titulo">${cat}</h2>
        ${nota}
        <div class="produtos-grid">${cards}</div>
      </section>`;
  }).join("");

  // Intersection Observer para destacar nav
  const sections = el.querySelectorAll(".categoria-secao");
  const navLinks  = nav.querySelectorAll("a");

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(a => a.classList.remove("active"));
        const link = nav.querySelector(`a[href="#${entry.target.id}"]`);
        if (link) link.classList.add("active");
      }
    });
  }, { rootMargin: "-60px 0px -60% 0px", threshold: 0 });

  sections.forEach(s => observer.observe(s));
}

function renderCard(p) {
  const tagHtml = p.tag
    ? `<span class="produto-tag tag-${p.tag}">${p.tag.charAt(0).toUpperCase() + p.tag.slice(1)}</span>`
    : "";

  const descHtml = p.desc
    ? `<p class="produto-desc">${p.desc}</p>`
    : "";

  if (p.vs) {
    const btns = p.vs.map(v =>
      `<button class="btn-add-variant"
         onclick="adicionarItem(${p.id}, '${escHtml(v.l)}', ${v.p})"
         data-pid="${p.id}" data-v="${escHtml(v.l)}">
         ${escHtml(v.l)}<span class="v-preco">${fmt(v.p)}</span>
       </button>`
    ).join("");

    return `
      <div class="produto-card">
        <div class="produto-top">
          <span class="produto-nome">${escHtml(p.nome)}</span>
          ${tagHtml}
        </div>
        ${descHtml}
        <div class="produto-variantes">${btns}</div>
      </div>`;
  }

  return `
    <div class="produto-card">
      <div class="produto-top">
        <span class="produto-nome">${escHtml(p.nome)}</span>
        ${tagHtml}
      </div>
      ${descHtml}
      <div class="produto-acao">
        <span class="produto-preco">${fmt(p.p)}</span>
        <button class="btn-add"
          onclick="adicionarItem(${p.id}, null, ${p.p})"
          data-pid="${p.id}">
          + Adicionar
        </button>
      </div>
    </div>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================================
//  LÓGICA DO CARRINHO
// ============================================================

function adicionarItem(produtoId, variantLabel, preco) {
  const produto = PRODUTOS.find(p => p.id === produtoId);
  if (!produto) return;

  const key  = `${produtoId}-${variantLabel || "default"}`;
  const nome = variantLabel ? `${produto.nome} (${variantLabel})` : produto.nome;

  if (carrinho[key]) {
    carrinho[key].qty += 1;
  } else {
    carrinho[key] = { nome, preco, qty: 1 };
  }

  renderCarrinho();
  animarBotao(produtoId, variantLabel);
}

function alterarQty(key, delta) {
  if (!carrinho[key]) return;
  carrinho[key].qty += delta;
  if (carrinho[key].qty <= 0) delete carrinho[key];
  renderCarrinho();
}

function removerItem(key) {
  delete carrinho[key];
  renderCarrinho();
}

function calcularSubtotal() {
  return Object.values(carrinho).reduce((s, i) => s + i.preco * i.qty, 0);
}

function animarBotao(produtoId, variantLabel) {
  let btn;
  if (variantLabel) {
    btn = document.querySelector(`[data-pid="${produtoId}"][data-v="${variantLabel}"]`);
  } else {
    btn = document.querySelector(`[data-pid="${produtoId}"]`);
  }
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = "✓ Adicionado!";
  btn.style.background = "var(--success)";
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.background = "";
    btn.disabled = false;
  }, 1000);
}

// ============================================================
//  RENDERIZAÇÃO DO CARRINHO
// ============================================================

function renderCarrinho() {
  const itensEl   = document.getElementById("itens-carrinho");
  const resumoEl  = document.getElementById("resumo");
  const formEl    = document.getElementById("form-pedido");
  const badgeMob  = document.getElementById("badge-mobile");
  const keys      = Object.keys(carrinho);
  const totalItens = Object.values(carrinho).reduce((s, i) => s + i.qty, 0);

  // badge mobile
  if (totalItens > 0) {
    badgeMob.textContent = totalItens;
    badgeMob.classList.remove("hidden");
  } else {
    badgeMob.classList.add("hidden");
  }

  if (keys.length === 0) {
    itensEl.innerHTML = `<p class="carrinho-vazio">Nenhum item adicionado ainda.</p>`;
    resumoEl.classList.add("hidden");
    formEl.classList.add("hidden");
    return;
  }

  // Items list
  itensEl.innerHTML = keys.map(key => {
    const item = carrinho[key];
    const sub  = item.preco * item.qty;
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-nome" title="${escHtml(item.nome)}">${escHtml(item.nome)}</div>
          <div class="cart-item-preco">${fmt(sub)}</div>
        </div>
        <div class="cart-qty">
          <button class="btn-qty" onclick="alterarQty('${key}', -1)">−</button>
          <span class="cart-qty-num">${item.qty}</span>
          <button class="btn-qty" onclick="alterarQty('${key}', +1)">+</button>
        </div>
        <button class="btn-remove" onclick="removerItem('${key}')" title="Remover">✕</button>
      </div>`;
  }).join("");

  // Resumo
  const subtotal = calcularSubtotal();
  const total    = subtotal + CONFIG.taxaEntrega;
  document.getElementById("subtotal").textContent     = fmt(subtotal);
  document.getElementById("taxa-entrega").textContent = fmt(CONFIG.taxaEntrega);
  document.getElementById("total").textContent        = fmt(total);
  resumoEl.classList.remove("hidden");
  formEl.classList.remove("hidden");
}

// ============================================================
//  STATUS DE HORÁRIO
// ============================================================

function renderStatus() {
  const el     = document.getElementById("status-horario");
  const avisoEl = document.getElementById("aviso-fechado");
  const textoEl = document.getElementById("texto-fechado");
  const btnFin  = document.getElementById("btn-finalizar");
  const { aberto, msg } = verificarHorario();

  el.textContent = aberto ? "🟢 Aberto" : "🔴 Fechado";
  el.className   = "badge-status " + (aberto ? "aberto" : "fechado");

  if (!aberto) {
    avisoEl.classList.remove("hidden");
    textoEl.textContent = msg;
    btnFin.disabled = true;
  } else {
    avisoEl.classList.add("hidden");
    btnFin.disabled = false;
  }
}

// ============================================================
//  INTEGRAÇÃO GOOGLE SHEETS
// ============================================================

async function registrarNaPlanilha(extras) {
  const subtotal = calcularSubtotal();
  const total    = subtotal + CONFIG.taxaEntrega;
  const payload  = {
    nome:        extras.nome,
    endereco:    extras.endereco,
    pagamento:   extras.pagamento,
    troco:       extras.troco  || "-",
    obs:         extras.obs    || "-",
    itens:       Object.values(carrinho).map(i => ({ nome: i.nome, qty: i.qty, preco: i.preco })),
    subtotal,
    taxaEntrega: CONFIG.taxaEntrega,
    total,
  };

  await fetch(CONFIG.sheetsUrl, {
    method:  "POST",
    mode:    "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body:    JSON.stringify(payload),
  });
}

// ============================================================
//  FORMULÁRIO & WHATSAPP
// ============================================================

document.getElementById("campo-pagamento").addEventListener("change", function () {
  const trocoEl = document.getElementById("campo-troco");
  if (this.value === "Dinheiro") {
    trocoEl.classList.remove("hidden");
  } else {
    trocoEl.classList.add("hidden");
    trocoEl.value = "";
  }
});

document.getElementById("form-pedido").addEventListener("submit", async function (e) {
  e.preventDefault();
  const erroEl = document.getElementById("msg-erro");
  erroEl.classList.add("hidden");

  const nome      = document.getElementById("campo-nome").value.trim();
  const endereco  = document.getElementById("campo-endereco").value.trim();
  const pagamento = document.getElementById("campo-pagamento").value;
  const troco     = document.getElementById("campo-troco").value.trim();
  const obs       = document.getElementById("campo-obs").value.trim();

  if (!nome)      { mostrarErro(erroEl, "Informe seu nome."); return; }
  if (!endereco)  { mostrarErro(erroEl, "Informe o endereço de entrega."); return; }
  if (!pagamento) { mostrarErro(erroEl, "Selecione a forma de pagamento."); return; }
  if (pagamento === "Dinheiro" && !troco) {
    mostrarErro(erroEl, "Informe o valor para o troco."); return;
  }

  const { aberto, msg } = verificarHorario();
  if (!aberto) { mostrarErro(erroEl, msg); return; }

  if (Object.keys(carrinho).length === 0) {
    mostrarErro(erroEl, "Adicione pelo menos um item ao carrinho."); return;
  }

  const btnFin = document.getElementById("btn-finalizar");

  if (CONFIG.sheetsUrl) {
    btnFin.disabled = true;
    btnFin.textContent = "⏳ Registrando pedido...";
    try {
      await registrarNaPlanilha({ nome, endereco, pagamento, troco, obs });
    } catch (err) {
      console.warn("Planilha indisponível:", err);
    }
    btnFin.textContent = "✅ Finalizar no WhatsApp";
    btnFin.disabled = false;
  }

  const mensagem = gerarMensagem(nome, endereco, pagamento, troco, obs);
  abrirWhatsApp(mensagem);
});

function mostrarErro(el, texto) {
  el.textContent = texto;
  el.classList.remove("hidden");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function gerarMensagem(nome, endereco, pagamento, troco, obs) {
  const linhasItens = Object.values(carrinho).map(item => {
    const sub = item.preco * item.qty;
    return `  - ${item.nome} x${item.qty} — ${fmt(sub)}`;
  });

  const subtotal = calcularSubtotal();
  const total    = subtotal + CONFIG.taxaEntrega;

  let pagTxt = `💰 Pagamento: ${pagamento}`;
  if (pagamento === "Dinheiro" && troco) {
    pagTxt += `\n💵 Troco para: ${troco}`;
  }

  let msg = `🛒 *NOVO PEDIDO*\n\n`;
  msg += `👤 Nome: ${nome}\n`;
  msg += `📍 Endereço: ${endereco}\n\n`;
  msg += `🍔 *Itens:*\n${linhasItens.join("\n")}\n\n`;
  msg += `${pagTxt}\n`;
  msg += `🚚 Taxa de entrega: ${fmt(CONFIG.taxaEntrega)}\n\n`;
  msg += `💵 *Total: ${fmt(total)}*`;
  if (obs) msg += `\n\n📝 Obs: ${obs}`;

  return msg;
}

function abrirWhatsApp(mensagem) {
  const url = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

// ============================================================
//  MOBILE — ABERTURA/FECHAMENTO DO PAINEL
// ============================================================

const painelCarrinho = document.getElementById("painel-carrinho");
const overlay        = document.getElementById("overlay");

function abrirPainel() {
  painelCarrinho.classList.add("aberto");
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function fecharPainel() {
  painelCarrinho.classList.remove("aberto");
  overlay.classList.add("hidden");
  document.body.style.overflow = "";
}

document.getElementById("btn-carrinho-mobile").addEventListener("click", abrirPainel);
document.getElementById("btn-fechar-carrinho").addEventListener("click", fecharPainel);
overlay.addEventListener("click", fecharPainel);

// ============================================================
//  FASE 3 — CARDÁPIO DA PLANILHA
// ============================================================

async function carregarConfigPlanilha() {
  try {
    const res  = await fetch(`${CONFIG.sheetsUrl}?action=config`);
    const data = await res.json();
    if (data.ok && data.config) {
      const c = data.config;
      // Aplica todas as chaves exceto sheetsUrl (que precisa estar no código)
      if (c.whatsapp)            CONFIG.whatsapp            = c.whatsapp;
      if (c.taxaEntrega !== undefined) CONFIG.taxaEntrega   = Number(c.taxaEntrega);
      if (c.horarioAbertura)     CONFIG.horarioAbertura     = c.horarioAbertura;
      if (c.horarioFechamento)   CONFIG.horarioFechamento   = c.horarioFechamento;
      if (c.diasFechado)         CONFIG.diasFechado         = Array.isArray(c.diasFechado) ? c.diasFechado : [c.diasFechado];
      if (c.nomeEstabelecimento) CONFIG.nomeEstabelecimento = c.nomeEstabelecimento;
    }
  } catch (err) {
    console.warn("Config da planilha indisponível, usando valores locais:", err);
  }
}

async function carregarCardapio() {
  const cardapioEl = document.getElementById("cardapio");
  cardapioEl.innerHTML = '<p style="color:var(--subtext);padding:2rem 20px;text-align:center">⏳ Carregando cardápio...</p>';

  try {
    const res  = await fetch(`${CONFIG.sheetsUrl}?action=cardapio`);
    const data = await res.json();

    if (data.ok && Array.isArray(data.produtos) && data.produtos.length > 0) {
      PRODUTOS.length = 0;
      data.produtos.forEach(p => PRODUTOS.push(p));
    }
  } catch (err) {
    console.warn("Cardápio da planilha indisponível, usando dados locais:", err);
  }
}

// ============================================================
//  INICIALIZAÇÃO
// ============================================================

async function init() {
  if (CONFIG.sheetsUrl) {
    await carregarConfigPlanilha(); // config primeiro — pode mudar nomeEstabelecimento
    await carregarCardapio();
  }

  document.getElementById("nome-estabelecimento").textContent = CONFIG.nomeEstabelecimento;
  document.title = CONFIG.nomeEstabelecimento + " — Cardápio";

  renderCardapio();
  renderCarrinho();
  renderStatus();
  setInterval(renderStatus, 60_000);
}

init();
