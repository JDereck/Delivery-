// ============================================================
//  CONFIG — mesma URL usada em app.js
// ============================================================
const CONFIG = {
  sheetsUrl:            "https://script.google.com/macros/s/AKfycbwFULG1apfUznb-STLdBkL2GCLYSvPOZlFHqOVVdNxheXxr1sFVVSda4KDdbWLaZlK_/exec",         // ← cole aqui a URL do Apps Script
  nomeEstabelecimento:  "Delivery",
  horarioAbertura:      "18:00",
  horarioFechamento:    "23:00",
  diasFechado:          ["segunda"],
  intervaloAtualizacao: 30,         // segundos entre cada refresh automático
};

// ============================================================
//  ESTADO
// ============================================================
let todosOsPedidos   = [];
let filtroAtual      = "todos";
let pendenteCancelar = null;
let idsConhecidos    = new Set();
let primeiraLeitura  = true;
let abaAtual         = "pedidos";

const DIAS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// ============================================================
//  VERIFICAÇÃO DE HORÁRIO
// ============================================================
function verificarHorario() {
  const agora   = new Date();
  const diaNome = DIAS_PT[agora.getDay()];
  if (CONFIG.diasFechado.includes(diaNome)) return false;
  const [hA, mA] = CONFIG.horarioAbertura.split(":").map(Number);
  const [hF, mF] = CONFIG.horarioFechamento.split(":").map(Number);
  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  return minAgora >= hA * 60 + mA && minAgora < hF * 60 + mF;
}

// ============================================================
//  TROCA DE ABAS
// ============================================================
function ativarAba(aba) {
  abaAtual = aba;

  document.querySelectorAll(".tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.aba === aba));

  document.getElementById("sec-pedidos").classList.toggle("hidden", aba !== "pedidos");
  document.getElementById("sec-cardapio").classList.toggle("hidden", aba !== "cardapio");
  document.getElementById("sec-clientes").classList.toggle("hidden", aba !== "clientes");
  document.getElementById("sec-config").classList.toggle("hidden", aba !== "config");

  document.getElementById("btn-refresh").style.display = aba === "pedidos" ? "" : "none";

  if (aba === "cardapio") carregarCardapioEditor();
  if (aba === "clientes") carregarClientes();
  if (aba === "config")   carregarConfig();
}

document.querySelectorAll(".tab-btn").forEach(btn =>
  btn.addEventListener("click", () => ativarAba(btn.dataset.aba)));

// ============================================================
//  API
// ============================================================
async function apiGet(params) {
  const url = CONFIG.sheetsUrl + "&" + new URLSearchParams(params).toString();

  const res  = await fetch(url);
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Resposta inválida:", text);
    throw new Error("Resposta não é JSON válida");
  }
}

async function fetchPedidos()            { return apiGet({ action: "pedidos" }); }
async function apiStatus(row, status)    { return apiGet({ action: "status",   row, status }); }
async function apiCancelar(row, motivo)  { return apiGet({ action: "cancelar", row, motivo }); }

// ============================================================
//  SOM DE NOTIFICAÇÃO
// ============================================================
function tocarNotificacao() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.18].forEach(delay => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.4);
    });
  } catch (_) {}
}

// ============================================================
//  ATUALIZAÇÃO DE PEDIDOS
// ============================================================
async function atualizar() {
  if (!CONFIG.sheetsUrl) {
    document.getElementById("pedidos-grid").innerHTML =
      '<p class="empty">⚙️ Configure <code>sheetsUrl</code> em <strong>painel.js</strong> para começar.</p>';
    return;
  }
  try {
    const data = await fetchPedidos();
    if (!data.ok) throw new Error(data.erro);
    todosOsPedidos = data.pedidos;

    if (!primeiraLeitura) {
      const novos = data.pedidos.filter(p => !idsConhecidos.has(p.row) && p.status === "Novo");
      if (novos.length > 0) tocarNotificacao();
    }
    data.pedidos.forEach(p => idsConhecidos.add(p.row));
    primeiraLeitura = false;

    renderResumo(data.pedidos);
    renderPedidos();
    atualizarTimestamp();
  } catch (err) {
    console.error("Erro ao atualizar:", err);
    document.getElementById("ultima-atualizacao").textContent = "⚠️ Falha ao atualizar";
  }
}

// ============================================================
//  RENDERIZAÇÃO — RESUMO
// ============================================================
function renderResumo(pedidos) {
  const hoje  = new Date().toDateString();
  const doDia = pedidos.filter(p => p.dataHora && new Date(p.dataHora).toDateString() === hoje);

  const faturamento = doDia
    .filter(p => p.status !== "Cancelado")
    .reduce((s, p) => s + p.total, 0);

  document.getElementById("total-pedidos").textContent     = doDia.length;
  document.getElementById("total-faturamento").textContent = fmt(faturamento);
  document.getElementById("total-aberto").textContent =
    doDia.filter(p => ["Novo","Em Preparo","Saiu pra Entrega"].includes(p.status)).length;
  document.getElementById("total-cancelados").textContent =
    doDia.filter(p => p.status === "Cancelado").length;
}

// ============================================================
//  RENDERIZAÇÃO — PEDIDOS
// ============================================================
function renderPedidos() {
  const grid  = document.getElementById("pedidos-grid");
  const lista = filtroAtual === "todos"
    ? todosOsPedidos
    : todosOsPedidos.filter(p => p.status === filtroAtual);

  grid.innerHTML = lista.length === 0
    ? '<p class="empty">Nenhum pedido encontrado.</p>'
    : lista.map(renderCard).join("");
}

const TIPO_ICON = { entrega: "🛵", retirada: "🏪", local: "🍽️" };
const TIPO_LABEL = { entrega: "Entrega", retirada: "Retirada", local: "No local" };

function renderCard(p) {
  const num      = `#${String(p.row - 1).padStart(3, "0")}`;
  const hora     = p.dataHora ? formatarHora(p.dataHora) : "—";
  const tipo     = p.tipo || "entrega";
  const tipoHtml = `<span class="tipo-badge tipo-${esc(tipo)}">${TIPO_ICON[tipo] || "🛵"} ${TIPO_LABEL[tipo] || tipo}</span>`;
  const itensHtml = p.itens.split(" | ")
    .map(i => `<span class="card-item-linha">${esc(i)}</span>`).join("");
  const obsHtml  = (p.obs && p.obs !== "-")
    ? `<div class="card-obs">${esc(p.obs)}</div>` : "";
  const motivoHtml = (p.status === "Cancelado" && p.motivo)
    ? `<div class="motivo-cancelamento">${esc(p.motivo)}</div>` : "";
  const enderecoHtml = tipo === "entrega"
    ? `<div class="card-endereco">📍 ${esc(p.endereco)}</div>` : "";

  return `
    <div class="pedido-card" data-row="${p.row}">
      <div class="card-top">
        <div>
          <span class="card-num">Pedido ${num}</span>
          <span class="card-hora"> · ${hora}</span>
        </div>
        <div style="display:flex;gap:.4rem;align-items:center">
          ${tipoHtml}
          <span class="status-pill status-${esc(p.status)}">${esc(p.status)}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="card-cliente">${esc(p.nome)}</div>
        ${enderecoHtml}
        <div class="card-itens">${itensHtml}</div>
        ${obsHtml}
      </div>
      <div class="card-footer">
        <div>
          <div class="card-total">${fmt(p.total)}</div>
          <div class="card-pagamento">💰 ${esc(p.pagamento)}${p.troco && p.troco !== "-" ? ` · Troco: ${esc(p.troco)}` : ""}</div>
        </div>
      </div>
      ${renderAcoes(p)}
      ${motivoHtml}
    </div>`;
}

function renderAcoes(p) {
  if (p.status === "Entregue" || p.status === "Cancelado") return "";
  const proximo = {
    "Novo":             { label: "▶ Em Preparo",       classe: "azul",  valor: "Em Preparo" },
    "Em Preparo":       { label: "🛵 Saiu pra Entrega", classe: "roxo",  valor: "Saiu pra Entrega" },
    "Saiu pra Entrega": { label: "✅ Entregue",          classe: "verde", valor: "Entregue" },
  }[p.status];
  if (!proximo) return "";
  return `
    <div class="card-acoes">
      <button class="btn-avancar ${proximo.classe}"
        onclick="avancarStatus(${p.row}, '${proximo.valor}')">
        ${proximo.label}
      </button>
      <button class="btn-cancelar"
        onclick="abrirModalCancelar(${p.row}, '${esc(p.nome)}')">
        Cancelar
      </button>
    </div>`;
}

// ============================================================
//  AÇÕES DE PEDIDO
// ============================================================
async function avancarStatus(row, novoStatus) {
  const btn = document.querySelector(`[data-row="${row}"] .btn-avancar`);
  if (btn) { btn.disabled = true; btn.textContent = "⏳"; }
  const data = await apiStatus(row, novoStatus);
  if (data.ok) {
    const idx = todosOsPedidos.findIndex(p => p.row === row);
    if (idx !== -1) todosOsPedidos[idx].status = novoStatus;
    renderPedidos(); renderResumo(todosOsPedidos);
  } else {
    if (btn) { btn.disabled = false; btn.textContent = "Erro — tente novamente"; }
  }
}

function abrirModalCancelar(row, nome) {
  pendenteCancelar = { row, nome };
  document.getElementById("modal-nome-pedido").textContent = `Pedido de ${nome}`;
  document.getElementById("motivo-cancelamento").value = "";
  document.getElementById("modal-cancelar").classList.remove("hidden");
}

function fecharModal() {
  pendenteCancelar = null;
  document.getElementById("modal-cancelar").classList.add("hidden");
}

async function confirmarCancelamento() {
  if (!pendenteCancelar) return;
  const motivo = document.getElementById("motivo-cancelamento").value.trim() || "Sem motivo informado";
  const btnEl  = document.getElementById("btn-confirmar-cancelar");
  btnEl.disabled = true; btnEl.textContent = "⏳ Cancelando...";

  const data = await apiCancelar(pendenteCancelar.row, motivo);
  fecharModal();
  if (data.ok) {
    const idx = todosOsPedidos.findIndex(p => p.row === pendenteCancelar?.row);
    if (idx !== -1) { todosOsPedidos[idx].status = "Cancelado"; todosOsPedidos[idx].motivo = motivo; }
    renderPedidos(); renderResumo(todosOsPedidos);
  }
  btnEl.disabled = false; btnEl.textContent = "Confirmar cancelamento";
}

// ============================================================
//  CARDÁPIO EDITOR
// ============================================================
let produtosEditor = [];

async function carregarCardapioEditor() {
  const grid = document.getElementById("editor-grid");
  grid.innerHTML = '<p class="loading">⏳ Carregando cardápio...</p>';

  if (!CONFIG.sheetsUrl) {
    grid.innerHTML = '<p class="empty">⚙️ Configure <code>sheetsUrl</code> em painel.js</p>';
    return;
  }

  try {
    const data = await apiGet({ action: "cardapioeditor" });
    if (!data.ok) throw new Error(data.erro);
    produtosEditor = data.produtos;
    renderCardapioEditor();
  } catch (err) {
    grid.innerHTML = `<p class="empty">⚠️ Erro ao carregar: ${esc(err.message)}</p>`;
  }
}

function renderCardapioEditor() {
  const grid = document.getElementById("editor-grid");
  if (produtosEditor.length === 0) {
    grid.innerHTML = '<p class="empty">Nenhum produto encontrado na planilha.</p>';
    return;
  }

  // Agrupa por categoria
  const grupos = {};
  produtosEditor.forEach(p => {
    if (!grupos[p.cat]) grupos[p.cat] = [];
    grupos[p.cat].push(p);
  });

  let html = "";
  for (const [cat, prods] of Object.entries(grupos)) {
    html += `<div class="editor-cat-title">${esc(cat)}</div>`;
    prods.forEach(p => { html += renderEditorCard(p); });
  }
  grid.innerHTML = html;
}

function renderEditorCard(p) {
  const inativo  = !p.disponivel ? "inativo" : "";
  const checked  = p.disponivel  ? "checked" : "";

  let precoHtml = "";
  if (p.vs) {
    // Produto com variantes
    const varsHtml = p.vs.map(v => `
      <div class="editor-var-row">
        <span class="editor-var-nome">${esc(v.l)}</span>
        <div class="editor-var-right">
          <span class="editor-preco-val"
            onclick="iniciarEdicaoPreco(this, ${p.row}, ${v.vcol}, ${v.p})"
            data-row="${p.row}" data-col="${v.vcol}">
            ${fmt(v.p)}
          </span>
          <label class="toggle" title="${v.disp ? "Desativar" : "Ativar"}">
            <input type="checkbox" ${v.disp ? "checked" : ""}
              onchange="onToggleVar(this, ${p.row}, ${v.vcol})">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>`).join("");
    precoHtml = `<div class="editor-vars">${varsHtml}</div>`;
  } else {
    precoHtml = `
      <div class="editor-preco-wrap">
        <span class="editor-preco-label">Preço:</span>
        <span class="editor-preco-val"
          onclick="iniciarEdicaoPreco(this, ${p.row}, ${p.pcol}, ${p.p})"
          data-row="${p.row}" data-col="${p.pcol}">
          ${fmt(p.p)}
        </span>
      </div>`;
  }

  return `
    <div class="editor-card ${inativo}" data-row="${p.row}">
      <div class="editor-card-top">
        <span class="editor-nome">${esc(p.nome)}</span>
        <div class="toggle-wrap">
          <span class="toggle-label">${p.disponivel ? "Ativo" : "Inativo"}</span>
          <label class="toggle" title="${p.disponivel ? "Desativar produto" : "Ativar produto"}">
            <input type="checkbox" ${checked}
              onchange="onToggleProd(this, ${p.row})">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      ${precoHtml}
    </div>`;
}

// Toggle produto inteiro
async function onToggleProd(el, row) {
  el.disabled = true;
  const valor = el.checked ? "SIM" : "NÃO";
  const data  = await apiGet({ action: "toggleprod", row, valor });
  el.disabled = false;
  if (data.ok) {
    const idx = produtosEditor.findIndex(p => p.row === row);
    if (idx !== -1) {
      produtosEditor[idx].disponivel = el.checked;
      // Atualiza visual sem re-renderizar tudo
      const card = document.querySelector(`.editor-card[data-row="${row}"]`);
      if (card) {
        card.classList.toggle("inativo", !el.checked);
        const lbl = card.querySelector(".toggle-label");
        if (lbl) lbl.textContent = el.checked ? "Ativo" : "Inativo";
      }
    }
  } else {
    el.checked = !el.checked; // reverte
  }
}

// Toggle variante
async function onToggleVar(el, row, vcol) {
  el.disabled = true;
  const valor = el.checked ? "SIM" : "NÃO";
  const data  = await apiGet({ action: "togglevar", row, vcol, valor });
  el.disabled = false;
  if (!data.ok) el.checked = !el.checked; // reverte em caso de erro
}

// Edição inline de preço
function iniciarEdicaoPreco(el, row, col, precoAtual) {
  if (el.querySelector("input")) return; // já editando

  const span = el;
  const val  = String(precoAtual).replace(",", ".");
  span.innerHTML = `<input class="editor-preco-input" type="number" value="${val}"
    min="0" step="0.50" autofocus
    onclick="event.stopPropagation()"
    onkeydown="onPrecoKeydown(event, this, ${row}, ${col})"
    onblur="confirmarPreco(this, ${row}, ${col})">`;
  span.querySelector("input").select();
}

function onPrecoKeydown(e, input, row, col) {
  if (e.key === "Enter")  { e.preventDefault(); confirmarPreco(input, row, col); }
  if (e.key === "Escape") { carregarCardapioEditor(); } // recarrega cancelando
}

async function confirmarPreco(input, row, col) {
  const val = parseFloat(input.value);
  if (isNaN(val) || val < 0) { carregarCardapioEditor(); return; }

  const span = input.closest(".editor-preco-val");
  if (span) span.textContent = "⏳";

  const data = await apiGet({ action: "updatepreco", row, col, valor: val.toFixed(2) });
  if (data.ok) {
    // Atualiza estado local
    const idx = produtosEditor.findIndex(p => p.row === row);
    if (idx !== -1) {
      const prod = produtosEditor[idx];
      if (prod.vs) {
        const vi = prod.vs.findIndex(v => v.vcol === col);
        if (vi !== -1) prod.vs[vi].p = val;
      } else {
        prod.p = val;
      }
    }
    if (span) span.textContent = fmt(val);
    // Restaura onclick
    if (span) span.setAttribute("onclick", `iniciarEdicaoPreco(this, ${row}, ${col}, ${val})`);
  } else {
    carregarCardapioEditor(); // recarrega em caso de erro
  }
}

// ============================================================
//  CONFIGURAÇÕES
// ============================================================
async function carregarConfig() {
  if (!CONFIG.sheetsUrl) {
    mostrarMsgConfig("⚙️ Configure sheetsUrl em painel.js primeiro.", "err");
    return;
  }
  try {
    const data = await apiGet({ action: "config" });
    if (!data.ok) throw new Error(data.erro);
    const c = data.config;
    if (c.whatsapp)            document.getElementById("cfg-whatsapp").value  = c.whatsapp;
    if (c.nomeEstabelecimento) document.getElementById("cfg-nome").value      = c.nomeEstabelecimento;
    if (c.taxaEntrega !== undefined) document.getElementById("cfg-taxa").value = c.taxaEntrega;
    if (c.horarioAbertura)     document.getElementById("cfg-abertura").value   = c.horarioAbertura;
    if (c.horarioFechamento)   document.getElementById("cfg-fechamento").value = c.horarioFechamento;

    // Dias fechados
    const dias = Array.isArray(c.diasFechado) ? c.diasFechado : [];
    document.querySelectorAll(".dia-check input").forEach(cb => {
      cb.checked = dias.includes(cb.value);
    });
  } catch (err) {
    mostrarMsgConfig("⚠️ Erro ao carregar config: " + err.message, "err");
  }
}

async function salvarConfig() {
  const btn = document.getElementById("btn-salvar-config");
  btn.disabled = true; btn.textContent = "⏳ Salvando...";
  mostrarMsgConfig("", "");

  const diasMarcados = Array.from(document.querySelectorAll(".dia-check input:checked"))
    .map(cb => cb.value).join(",");

  const params = {
    action:              "saveconfig",
    whatsapp:            document.getElementById("cfg-whatsapp").value.trim(),
    nomeEstabelecimento: document.getElementById("cfg-nome").value.trim(),
    taxaEntrega:         document.getElementById("cfg-taxa").value,
    horarioAbertura:     document.getElementById("cfg-abertura").value,
    horarioFechamento:   document.getElementById("cfg-fechamento").value,
    diasFechado:         diasMarcados,
  };

  try {
    const data = await apiGet(params);
    if (!data.ok) throw new Error(data.erro);
    mostrarMsgConfig("✅ Configurações salvas!", "ok");
  } catch (err) {
    mostrarMsgConfig("⚠️ Erro: " + err.message, "err");
  }

  btn.disabled = false; btn.textContent = "💾 Salvar configurações";
}

function mostrarMsgConfig(txt, tipo) {
  const el = document.getElementById("config-msg");
  el.textContent = txt;
  el.className   = "config-msg " + tipo;
}

// ============================================================
//  UTILITÁRIOS
// ============================================================
function fmt(v) { return "R$ " + Number(v).toFixed(2).replace(".", ","); }

function esc(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function formatarHora(iso) {
  const d    = new Date(iso);
  const hoje = new Date().toDateString();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoje) return hora;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + hora;
}

function atualizarTimestamp() {
  const t = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  document.getElementById("ultima-atualizacao").textContent = `Atualizado às ${t}`;
}

// ============================================================
//  STATUS DA LOJA NO HEADER
// ============================================================
function renderStatusLoja() {
  const el     = document.getElementById("status-loja");
  const aberto = verificarHorario();
  el.textContent = aberto ? "🟢 Aberta" : "🔴 Fechada";
  el.className   = "badge-status " + (aberto ? "aberto" : "fechado");
}

// ============================================================
//  CLIENTES
// ============================================================
let todosOsClientes  = [];
let filtroCliAtual   = "todos";

async function carregarClientes() {
  const grid = document.getElementById("clientes-grid");
  grid.innerHTML = '<p class="loading">⏳ Carregando clientes...</p>';

  if (!CONFIG.sheetsUrl) {
    grid.innerHTML = '<p class="empty">⚙️ Configure <code>sheetsUrl</code> em painel.js</p>';
    return;
  }

  try {
    const data = await apiGet({ action: "listarclientes" });
    if (!data.ok) throw new Error(data.erro);
    todosOsClientes = data.clientes;
    renderResumoClientes();
    renderClientes();
  } catch (err) {
    grid.innerHTML = `<p class="empty">⚠️ ${esc(err.message)}</p>`;
  }
}

function renderResumoClientes() {
  document.getElementById("cli-total").textContent   = todosOsClientes.length;
  document.getElementById("cli-ativos").textContent  = todosOsClientes.filter(c => c.status === "Ativo").length;
  document.getElementById("cli-mornos").textContent  = todosOsClientes.filter(c => c.status === "Morno").length;
  document.getElementById("cli-inativos").textContent= todosOsClientes.filter(c => c.status === "Inativo").length;
}

function renderClientes() {
  const grid  = document.getElementById("clientes-grid");
  const lista = filtroCliAtual === "todos"
    ? todosOsClientes
    : todosOsClientes.filter(c => c.status === filtroCliAtual);

  if (lista.length === 0) {
    grid.innerHTML = '<p class="empty">Nenhum cliente encontrado.</p>';
    return;
  }
  grid.innerHTML = lista.map(renderClienteCard).join("");
}

function renderClienteCard(c) {
  const statusCls  = `cli-status-${c.status}`;
  const ultimoTxt  = c.ultimoPedido
    ? `Último pedido: ${formatarHora(c.ultimoPedido)}` + (c.diasSemPedir > 0 ? ` (${c.diasSemPedir}d atrás)` : "")
    : "Sem pedidos";

  const enderecos  = (c.enderecos || []).slice(0, 3)
    .map(e => `<div class="cli-endereco-item">${esc(e)}</div>`).join("");

  const msgPromo   = encodeURIComponent(
    `Olá ${c.nome.split(" ")[0]}! 👋 Temos novidades e promoções especiais para você. Acesse nosso cardápio e peça agora!`
  );
  const wppLink    = `https://wa.me/${c.whatsapp}?text=${msgPromo}`;

  return `
    <div class="cliente-card">
      <div class="cli-top">
        <div>
          <div class="cli-nome">${esc(c.nome)}</div>
          <div class="cli-wpp">📱 ${esc(c.whatsapp)}</div>
        </div>
        <span class="status-pill ${statusCls}">${c.status}</span>
      </div>
      <div class="cli-stats">
        <div class="cli-stat">
          <span class="cli-stat-label">Pedidos</span>
          <span class="cli-stat-val">${c.qtdPedidos}</span>
        </div>
        <div class="cli-stat">
          <span class="cli-stat-label">Total gasto</span>
          <span class="cli-stat-val" style="color:var(--accent)">${fmt(c.totalGasto)}</span>
        </div>
      </div>
      ${enderecos ? `<div class="cli-enderecos">${enderecos}</div>` : ""}
      <div class="cli-ultimo">${ultimoTxt}</div>
      <div class="cli-acoes">
        <a href="${wppLink}" target="_blank" class="btn-wpp-promo">
          💬 Enviar promoção
        </a>
      </div>
    </div>`;
}

// Filtros de clientes
document.querySelectorAll("[data-cli-status]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-cli-status]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    filtroCliAtual = btn.dataset.cliStatus;
    renderClientes();
  });
});

// ============================================================
//  EVENTOS
// ============================================================
document.querySelectorAll(".filtro").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filtro").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    filtroAtual = btn.dataset.status;
    renderPedidos();
  });
});

document.getElementById("btn-refresh").addEventListener("click", atualizar);
document.getElementById("btn-fechar-modal").addEventListener("click", fecharModal);
document.getElementById("btn-confirmar-cancelar").addEventListener("click", confirmarCancelamento);
document.getElementById("modal-cancelar").addEventListener("click", e => {
  if (e.target === e.currentTarget) fecharModal();
});
document.getElementById("btn-salvar-config").addEventListener("click", salvarConfig);

// ============================================================
//  INICIALIZAÇÃO
// ============================================================
document.title = CONFIG.nomeEstabelecimento + " — Painel";

renderStatusLoja();
setInterval(renderStatusLoja, 60_000);

atualizar();
setInterval(atualizar, CONFIG.intervaloAtualizacao * 1000);
