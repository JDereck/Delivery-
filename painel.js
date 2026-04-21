// ============================================================
//  CONFIG — mesma URL usada em app.js
// ============================================================
const CONFIG = {
  sheetsUrl: "https://script.google.com/macros/s/AKfycbwFULG1apfUznb-STLdBkL2GCLYSvPOZlFHqOVVdNxheXxr1sFVVSda4KDdbWLaZlK_/exec",
  nomeEstabelecimento: "Delivery",
  horarioAbertura: "18:00",
  horarioFechamento: "23:00",
  diasFechado: ["segunda"],
  intervaloAtualizacao: 30,
};

// ============================================================
//  ESTADO
// ============================================================
let todosOsPedidos = [];
let filtroAtual = "todos";
let pendenteCancelar = null;
let idsConhecidos = new Set();
let primeiraLeitura = true;
let abaAtual = "pedidos";

const DIAS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// ============================================================
//  VERIFICAÇÃO DE HORÁRIO
// ============================================================
function verificarHorario() {
  const agora = new Date();
  const diaNome = DIAS_PT[agora.getDay()];
  if (CONFIG.diasFechado.includes(diaNome)) return false;

  const [hA, mA] = CONFIG.horarioAbertura.split(":").map(Number);
  const [hF, mF] = CONFIG.horarioFechamento.split(":").map(Number);

  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  return minAgora >= hA * 60 + mA && minAgora < hF * 60 + mF;
}

// ============================================================
//  FUNÇÕES QUE FALTAVAM (CORREÇÃO IMPORTANTE)
// ============================================================

function formatarHora(data) {
  const d = new Date(data);
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function esc(str) {
  return (str || "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAcoes(p) {
  return `
    <div class="card-acoes">
      <button onclick="alert('Pedido ${p.row}')">Ver</button>
    </div>
  `;
}

async function apiCancelar(row, motivo) {
  const url = CONFIG.sheetsUrl +
    "?action=cancelar&row=" + row +
    "&motivo=" + encodeURIComponent(motivo);

  const res = await fetch(url);
  return await res.json();
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
  if (aba === "config") carregarConfig();
}

document.querySelectorAll(".tab-btn").forEach(btn =>
  btn.addEventListener("click", () => ativarAba(btn.dataset.aba)));

// ============================================================
//  API GET
// ============================================================
async function apiGet(params) {
  const base = CONFIG.sheetsUrl;
  const sep = base.includes("?") ? "&" : "?";
  const url = base + sep + new URLSearchParams(params).toString();

  const res = await fetch(url);
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Resposta inválida:", text);
    throw new Error("Resposta não é JSON válida");
  }
}

// ============================================================
//  SOM
// ============================================================
function tocarNotificacao() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    [0, 0.18].forEach(delay => {
      const osc = ctx.createOscillator();
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
//  RESUMO
// ============================================================
function renderResumo(pedidos) {
  const hoje = new Date().toDateString();

  const doDia = pedidos.filter(p =>
    p.dataHora && new Date(p.dataHora).toDateString() === hoje
  );

  const faturamento = doDia
    .filter(p => p.status !== "Cancelado")
    .reduce((s, p) => s + (p.total || 0), 0);

  document.getElementById("total-pedidos").textContent = doDia.length;
  document.getElementById("total-faturamento").textContent = fmt(faturamento);

  document.getElementById("total-aberto").textContent =
    doDia.filter(p =>
      ["Novo", "Em Preparo", "Saiu pra Entrega"].includes(p.status)
    ).length;

  document.getElementById("total-cancelados").textContent =
    doDia.filter(p => p.status === "Cancelado").length;
}

// ============================================================
//  CARD PEDIDO (CORRIGIDO STATUS)
// ============================================================
function renderCard(p) {

  const num = `#${String(p.row - 1).padStart(3, "0")}`;
  const hora = p.dataHora ? formatarHora(p.dataHora) : "—";
  const tipo = p.tipo || "entrega";

  const statusClass = (p.status || "novo")
    .toLowerCase()
    .replace(/ /g, "-");

  const itensHtml = (p.itens || "")
    .split(" | ")
    .filter(Boolean)
    .map(i => `<span class="card-item-linha">${esc(i)}</span>`).join("");

  const obsHtml = (p.obs && p.obs !== "-")
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

        <span class="status-pill status-${statusClass}">
          ${esc(p.status)}
        </span>
      </div>

      <div class="card-body">
        <div class="card-cliente">${esc(p.nome)}</div>
        ${enderecoHtml}
        <div class="card-itens">${itensHtml}</div>
        ${obsHtml}
      </div>

      ${renderAcoes(p)}
      ${motivoHtml}
    </div>
  `;
}

// ============================================================
//  CANCELAMENTO
// ============================================================
async function confirmarCancelamento() {
  if (!pendenteCancelar || !pendenteCancelar.row) return;

  const row = pendenteCancelar.row;
  const motivo =
    document.getElementById("motivo-cancelamento").value.trim() ||
    "Sem motivo informado";

  const btnEl = document.getElementById("btn-confirmar-cancelar");
  btnEl.disabled = true;
  btnEl.textContent = "⏳ Cancelando...";

  const data = await apiCancelar(row, motivo);

  fecharModal();

  if (data.ok) {
    const idx = todosOsPedidos.findIndex(p => p.row === row);
    if (idx !== -1) {
      todosOsPedidos[idx].status = "Cancelado";
      todosOsPedidos[idx].motivo = motivo;
    }
    renderPedidos();
    renderResumo(todosOsPedidos);
  }

  btnEl.disabled = false;
  btnEl.textContent = "Confirmar cancelamento";
}

// ============================================================
//  CLIENTES
// ============================================================
function renderClienteCard(c) {

  const statusCls = `status-pill-${c.status}`;

  const enderecos = (c.enderecos || []).slice(0, 3)
    .map(e => `<div class="cli-end-item">${esc(e)}</div>`).join("");

  const msgPromo = encodeURIComponent(
    `Olá ${c.nome.split(" ")[0]}! 👋 Promoções especiais para você.`
  );

  const wppLink = `https://wa.me/${c.whatsapp}?text=${msgPromo}`;

  return `
    <div class="cliente-card">

      <div class="cli-top">
        <div>
          <div class="cli-nome">${esc(c.nome)}</div>
          <div class="cli-wpp">${esc(c.whatsapp)}</div>
        </div>

        <span class="status-pill ${statusCls}">
          ${c.status}
        </span>
      </div>

      <div class="cli-stats">
        <div class="cli-stat">
          <span class="cli-stat-label">Pedidos</span>
          <span class="cli-stat-val">${c.qtdPedidos}</span>
        </div>

        <div class="cli-stat">
          <span class="cli-stat-label">Total gasto</span>
          <span class="cli-stat-val">${fmt(c.totalGasto)}</span>
        </div>
      </div>

      ${enderecos ? `<div class="cli-enderecos">${enderecos}</div>` : ""}

      <div class="cli-acoes">
        <a href="${wppLink}" target="_blank" class="btn-wpp-promo">
          💬 Enviar promoção
        </a>
      </div>
    </div>
  `;
}
