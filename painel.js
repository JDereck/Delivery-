// ============================================================
//  CONFIG — mesma URL usada em app.js
// ============================================================
const CONFIG = {
  sheetsUrl:           "",        // ← cole aqui a URL do Apps Script
  nomeEstabelecimento: "Delivery",
  horarioAbertura:     "18:00",
  horarioFechamento:   "23:00",
  diasFechado:         ["segunda"],
  intervaloAtualizacao: 30,       // segundos entre cada refresh automático
};

// ============================================================
//  ESTADO
// ============================================================
let todosOsPedidos   = [];
let filtroAtual      = "todos";
let pendenteCancelar = null; // { row, nome }
let idsConhecidos    = new Set();
let primeiraLeitura  = true;

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
//  API
// ============================================================
async function fetchPedidos() {
  const res  = await fetch(`${CONFIG.sheetsUrl}?action=pedidos`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.erro || "Erro ao buscar pedidos");
  return data.pedidos;
}

async function apiStatus(row, status) {
  const url = `${CONFIG.sheetsUrl}?action=status&row=${row}&status=${encodeURIComponent(status)}`;
  const res  = await fetch(url);
  const data = await res.json();
  return data.ok;
}

async function apiCancelar(row, motivo) {
  const url = `${CONFIG.sheetsUrl}?action=cancelar&row=${row}&motivo=${encodeURIComponent(motivo)}`;
  const res  = await fetch(url);
  const data = await res.json();
  return data.ok;
}

// ============================================================
//  SOM DE NOTIFICAÇÃO
// ============================================================
function tocarNotificacao() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
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
//  ATUALIZAÇÃO PRINCIPAL
// ============================================================
async function atualizar() {
  if (!CONFIG.sheetsUrl) {
    document.getElementById("pedidos-grid").innerHTML =
      '<p class="empty">⚙️ Configure <code>sheetsUrl</code> em <strong>painel.js</strong> para começar.</p>';
    return;
  }

  try {
    const pedidos = await fetchPedidos();
    todosOsPedidos = pedidos;

    // Detecta pedidos novos após primeira leitura
    if (!primeiraLeitura) {
      const novos = pedidos.filter(p => !idsConhecidos.has(p.row) && p.status === "Novo");
      if (novos.length > 0) tocarNotificacao();
    }
    pedidos.forEach(p => idsConhecidos.add(p.row));
    primeiraLeitura = false;

    renderResumo(pedidos);
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
  const hoje = new Date().toDateString();
  const doDia = pedidos.filter(p => p.dataHora && new Date(p.dataHora).toDateString() === hoje);

  const faturamento = doDia
    .filter(p => p.status !== "Cancelado")
    .reduce((s, p) => s + p.total, 0);

  const emAberto = doDia.filter(p => ["Novo","Em Preparo","Saiu pra Entrega"].includes(p.status)).length;
  const cancelados = doDia.filter(p => p.status === "Cancelado").length;

  document.getElementById("total-pedidos").textContent    = doDia.length;
  document.getElementById("total-faturamento").textContent = fmt(faturamento);
  document.getElementById("total-aberto").textContent     = emAberto;
  document.getElementById("total-cancelados").textContent = cancelados;
}

// ============================================================
//  RENDERIZAÇÃO — CARDS DE PEDIDO
// ============================================================
function renderPedidos() {
  const grid = document.getElementById("pedidos-grid");

  let lista = filtroAtual === "todos"
    ? todosOsPedidos
    : todosOsPedidos.filter(p => p.status === filtroAtual);

  if (lista.length === 0) {
    grid.innerHTML = '<p class="empty">Nenhum pedido encontrado.</p>';
    return;
  }

  grid.innerHTML = lista.map(renderCard).join("");
}

function renderCard(p) {
  const num   = `#${String(p.row - 1).padStart(3, "0")}`;
  const hora  = p.dataHora ? formatarHora(p.dataHora) : "—";
  const itensHtml = p.itens
    .split(" | ")
    .map(i => `<span class="card-item-linha">${esc(i)}</span>`)
    .join("");

  const obsHtml = (p.obs && p.obs !== "-")
    ? `<div class="card-obs">${esc(p.obs)}</div>`
    : "";

  const motivoHtml = (p.status === "Cancelado" && p.motivo)
    ? `<div class="motivo-cancelamento">${esc(p.motivo)}</div>`
    : "";

  const acoes = renderAcoes(p);

  return `
    <div class="pedido-card" data-row="${p.row}">
      <div class="card-top">
        <div>
          <span class="card-num">Pedido ${num}</span>
          <span class="card-hora"> · ${hora}</span>
        </div>
        <span class="status-pill status-${esc(p.status)}">${esc(p.status)}</span>
      </div>
      <div class="card-body">
        <div class="card-cliente">${esc(p.nome)}</div>
        <div class="card-endereco">📍 ${esc(p.endereco)}</div>
        <div class="card-itens">${itensHtml}</div>
        ${obsHtml}
      </div>
      <div class="card-footer">
        <div>
          <div class="card-total">${fmt(p.total)}</div>
          <div class="card-pagamento">💰 ${esc(p.pagamento)}${p.troco && p.troco !== "-" ? ` · Troco: ${esc(p.troco)}` : ""}</div>
        </div>
      </div>
      ${acoes}
      ${motivoHtml}
    </div>`;
}

function renderAcoes(p) {
  if (p.status === "Entregue" || p.status === "Cancelado") return "";

  const proximo = {
    "Novo":              { label: "▶ Em Preparo",      classe: "azul",  valor: "Em Preparo"       },
    "Em Preparo":        { label: "🛵 Saiu pra Entrega", classe: "roxo",  valor: "Saiu pra Entrega" },
    "Saiu pra Entrega":  { label: "✅ Entregue",         classe: "verde", valor: "Entregue"         },
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
//  AÇÕES
// ============================================================
async function avancarStatus(row, novoStatus) {
  const btn = document.querySelector(`[data-row="${row}"] .btn-avancar`);
  if (btn) { btn.disabled = true; btn.textContent = "⏳"; }

  const ok = await apiStatus(row, novoStatus);
  if (ok) {
    const idx = todosOsPedidos.findIndex(p => p.row === row);
    if (idx !== -1) todosOsPedidos[idx].status = novoStatus;
    renderPedidos();
    renderResumo(todosOsPedidos);
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
  const { row } = pendenteCancelar;

  document.getElementById("btn-confirmar-cancelar").disabled = true;
  document.getElementById("btn-confirmar-cancelar").textContent = "⏳ Cancelando...";

  const ok = await apiCancelar(row, motivo);
  fecharModal();

  if (ok) {
    const idx = todosOsPedidos.findIndex(p => p.row === row);
    if (idx !== -1) {
      todosOsPedidos[idx].status = "Cancelado";
      todosOsPedidos[idx].motivo = motivo;
    }
    renderPedidos();
    renderResumo(todosOsPedidos);
  }

  document.getElementById("btn-confirmar-cancelar").disabled = false;
  document.getElementById("btn-confirmar-cancelar").textContent = "Confirmar cancelamento";
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
  const d = new Date(iso);
  const hoje = new Date().toDateString();
  if (d.toDateString() === hoje) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function atualizarTimestamp() {
  const t = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  document.getElementById("ultima-atualizacao").textContent = `Atualizado às ${t}`;
}

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
//  INICIALIZAÇÃO
// ============================================================
document.title = CONFIG.nomeEstabelecimento + " — Painel";

renderStatusLoja();
setInterval(renderStatusLoja, 60_000);

atualizar();
setInterval(atualizar, CONFIG.intervaloAtualizacao * 1000);
