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
//  UTILITÁRIOS
// ============================================================
const fmt = (v) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

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
//  API (GET / STATUS / CANCELAR)
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

async function mudarStatus(row, novoStatus) {
  try {
    const data = await apiGet({ action: "status", row: row, status: novoStatus });
    if (data.ok) {
      // Atualiza localmente para dar feedback rápido
      const idx = todosOsPedidos.findIndex(p => p.row === row);
      if (idx !== -1) todosOsPedidos[idx].status = novoStatus;
      
      renderPedidos();
      renderResumo(todosOsPedidos);
    }
  } catch (err) {
    alert("Erro ao atualizar status.");
  }
}

async function apiCancelar(row, motivo) {
  return await apiGet({ action: "cancelar", row: row, motivo: motivo });
}

// ============================================================
//  RENDERIZAÇÃO DE PEDIDOS
// ============================================================
function renderAcoes(p) {
  if (p.status === "Entregue" || p.status === "Cancelado") return "";

  return `
    <div class="card-acoes">
      <button onclick="mudarStatus(${p.row}, 'Em Preparo')" class="btn-preparo">👨‍🍳 Preparar</button>
      <button onclick="mudarStatus(${p.row}, 'Saiu pra Entrega')" class="btn-entrega">🛵 Enviar</button>
      <button onclick="mudarStatus(${p.row}, 'Entregue')" class="btn-ok">✅ Entregue</button>
      <button onclick="abrirModalCancelamento(${p.row})" class="btn-cancel">❌</button>
    </div>
  `;
}

function renderCard(p) {
  const num = `#${String(p.row - 1).padStart(3, "0")}`;
  const hora = p.dataHora ? formatarHora(p.dataHora) : "—";
  const tipo = p.tipo || "entrega";
  const statusClass = (p.status || "novo").toLowerCase().replace(/ /g, "-");

  const itensHtml = (p.itens || "").split(" | ").filter(Boolean)
    .map(i => `<span class="card-item-linha">${esc(i)}</span>`).join("");

  const obsHtml = (p.obs && p.obs !== "-") ? `<div class="card-obs">${esc(p.obs)}</div>` : "";
  const motivoHtml = (p.status === "Cancelado" && p.motivo) ? `<div class="motivo-cancelamento">${esc(p.motivo)}</div>` : "";
  const enderecoHtml = tipo === "entrega" ? `<div class="card-endereco">📍 ${esc(p.endereco)}</div>` : "";

  return `
    <div class="pedido-card" data-row="${p.row}">
      <div class="card-top">
        <div>
          <span class="card-num">Pedido ${num}</span>
          <span class="card-hora"> · ${hora}</span>
        </div>
        <span class="status-pill status-${statusClass}">${esc(p.status)}</span>
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

function renderPedidos() {
  const container = document.getElementById("grid-pedidos");
  if (!container) return;

  const filtrados = todosOsPedidos.filter(p => 
    filtroAtual === "todos" || p.status.toLowerCase() === filtroAtual.toLowerCase()
  );

  container.innerHTML = filtrados.map(renderCard).join("");
}

// ============================================================
//  MODAL CANCELAMENTO
// ============================================================
function abrirModalCancelamento(row) {
  pendenteCancelar = { row };
  document.getElementById("modal-cancelar").classList.remove("hidden");
  document.getElementById("motivo-cancelamento").value = "";
}

function fecharModal() {
  document.getElementById("modal-cancelar").classList.add("hidden");
  pendenteCancelar = null;
}

async function confirmarCancelamento() {
  if (!pendenteCancelar) return;
  
  const motivo = document.getElementById("motivo-cancelamento").value.trim() || "Sem motivo";
  const btn = document.getElementById("btn-confirmar-cancelar");
  
  btn.disabled = true;
  const data = await apiCancelar(pendenteCancelar.row, motivo);
  
  if (data.ok) {
    const idx = todosOsPedidos.findIndex(p => p.row === pendenteCancelar.row);
    if (idx !== -1) {
      todosOsPedidos[idx].status = "Cancelado";
      todosOsPedidos[idx].motivo = motivo;
    }
    renderPedidos();
    renderResumo(todosOsPedidos);
    fecharModal();
  }
  btn.disabled = false;
}

// ============================================================
//  CLIENTES & RESUMO
// ============================================================
function renderResumo(pedidos) {
  const hoje = new Date().toDateString();
  const doDia = pedidos.filter(p => p.dataHora && new Date(p.dataHora).toDateString() === hoje);
  const faturamento = doDia.filter(p => p.status !== "Cancelado").reduce((s, p) => s + (p.total || 0), 0);

  document.getElementById("total-pedidos").textContent = doDia.length;
  document.getElementById("total-faturamento").textContent = fmt(faturamento);
  document.getElementById("total-aberto").textContent = doDia.filter(p => ["Novo", "Em Preparo", "Saiu pra Entrega"].includes(p.status)).length;
  document.getElementById("total-cancelados").textContent = doDia.filter(p => p.status === "Cancelado").length;
}

function renderClienteCard(c) {
  const statusCls = `status-pill-${c.status}`;
  const wppLink = `https://wa.me/${c.whatsapp}?text=Olá ${c.nome.split(" ")[0]}!`;

  return `
    <div class="cliente-card">
      <div class="cli-top">
        <div>
          <div class="cli-nome">${esc(c.nome)}</div>
          <div class="cli-wpp">${esc(c.whatsapp)}</div>
        </div>
        <span class="status-pill ${statusCls}">${c.status}</span>
      </div>
      <div class="cli-stats">
        <div class="cli-stat"><span>Pedidos</span><strong>${c.qtdPedidos}</strong></div>
        <div class="cli-stat"><span>Total</span><strong>${fmt(c.totalGasto)}</strong></div>
      </div>
      <div class="cli-acoes"><a href="${wppLink}" target="_blank" class="btn-wpp-promo">💬 Promoção</a></div>
    </div>
  `;
}

// ============================================================
//  CONTROLE DE ABAS E CARREGAMENTO
// ============================================================
async function atualizarDados() {
  try {
    const res = await apiGet({ action: "pedidos" });
    if (res.ok) {
      todosOsPedidos = res.pedidos;
      
      // Lógica de Notificação para novos pedidos
      if (!primeiraLeitura) {
         const novos = todosOsPedidos.filter(p => p.status === "Novo" && !idsConhecidos.has(p.row));
         if (novos.length > 0) tocarNotificacao();
      }
      
      todosOsPedidos.forEach(p => idsConhecidos.add(p.row));
      primeiraLeitura = false;
      
      renderPedidos();
      renderResumo(todosOsPedidos);
      document.getElementById("ultima-atualizacao").textContent = new Date().toLocaleTimeString();
    }
  } catch (err) { console.error("Erro ao atualizar:", err); }
}

function ativarAba(aba) {
  abaAtual = aba;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.aba === aba));
  document.getElementById("sec-pedidos").classList.toggle("hidden", aba !== "pedidos");
  document.getElementById("sec-clientes").classList.toggle("hidden", aba !== "clientes");
  // ... adicione outras abas conforme necessário
  if (aba === "pedidos") atualizarDados();
}

function tocarNotificacao() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  [0, 0.2].forEach(d => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 600;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.5);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.5);
  });
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  atualizarDados();
  setInterval(atualizarDados, CONFIG.intervaloAtualizacao * 1000);
  
  document.querySelectorAll(".tab-btn").forEach(btn => 
    btn.addEventListener("click", () => ativarAba(btn.dataset.aba))
  );

  document.getElementById("btn-confirmar-cancelar")?.addEventListener("click", confirmarCancelamento);
  document.getElementById("btn-refresh")?.addEventListener("click", atualizarDados);
});
