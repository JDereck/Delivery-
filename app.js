// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
  sheetsUrl: "https://script.google.com/macros/s/AKfycbwFULG1apfUznb-STLdBkL2GCLYSvPOZlFHqOVVdNxheXxr1sFVVSda4KDdbWLaZlK_/exec",
};

// ============================================================
// ESTADO
// ============================================================
let cardapio = [];
let carrinho = [];

// ============================================================
// UTILITÁRIOS
// ============================================================
const fmt = (v) =>
  (Number(v || 0)).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const esc = (str) =>
  String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

function toast(msg) {
  console.log(msg); // você pode depois trocar por UI toast
}

// ============================================================
// BUSCAR CARDÁPIO
// ============================================================
async function carregarCardapio() {
  try {
    const res = await fetch(CONFIG.sheetsUrl + "?acao=cardapio");
    cardapio = await res.json();

    renderCardapio();
    montarCategorias();
  } catch (err) {
    console.error("Erro cardápio:", err);
  }
}

// ============================================================
// RENDER CARDÁPIO
// ============================================================
function renderCardapio() {
  const container = document.getElementById("cardapio");
  container.innerHTML = "";

  const grupos = agruparPorCategoria(cardapio);

  Object.keys(grupos).forEach((cat) => {
    const sec = document.createElement("section");
    sec.className = "categoria-secao";
    sec.id = cat;

    sec.innerHTML = `
      <h2 class="categoria-titulo">${esc(cat)}</h2>
      <div class="produtos-grid">
        ${grupos[cat].map(renderProduto).join("")}
      </div>
    `;

    container.appendChild(sec);
  });
}

// ============================================================
// AGRUPAR CATEGORIAS
// ============================================================
function agruparPorCategoria(lista) {
  return lista.reduce((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = [];
    acc[item.categoria].push(item);
    return acc;
  }, {});
}

// ============================================================
// PRODUTO CARD
// ============================================================
function renderProduto(p) {
  return `
    <div class="produto-card">
      <div class="produto-top">
        <div class="produto-nome">${esc(p.nome)}</div>
        <span class="produto-tag tag-${p.tag || "tradicional"}">
          ${p.tag || "Normal"}
        </span>
      </div>

      <div class="produto-desc">${esc(p.descricao || "")}</div>

      <div class="produto-footer">
        <strong>${fmt(p.preco)}</strong>
        <button onclick="adicionarCarrinho('${p.id}')" class="btn-add">
          + Adicionar
        </button>
      </div>
    </div>
  `;
}

// ============================================================
// CARRINHO
// ============================================================
function adicionarCarrinho(id) {
  const prod = cardapio.find((p) => p.id == id);
  if (!prod) return;

  const item = carrinho.find((i) => i.id == id);

  if (item) {
    item.qtd++;
  } else {
    carrinho.push({
      id: prod.id,
      nome: prod.nome,
      preco: Number(prod.preco),
      qtd: 1,
    });
  }

  atualizarCarrinho();
}

// ============================================================
// ATUALIZAR CARRINHO
// ============================================================
function atualizarCarrinho() {
  const box = document.getElementById("itens-carrinho");
  const badge = document.getElementById("badge-mobile");

  if (carrinho.length === 0) {
    box.innerHTML = `<p class="carrinho-vazio">Nenhum item adicionado ainda.</p>`;
    badge.classList.add("hidden");
    return;
  }

  badge.classList.remove("hidden");
  badge.textContent = carrinho.reduce((a, b) => a + b.qtd, 0);

  let subtotal = 0;

  box.innerHTML = carrinho
    .map((i) => {
      subtotal += i.preco * i.qtd;

      return `
        <div class="item-carrinho">
          <span>${esc(i.nome)}</span>
          <span>${i.qtd}x</span>
          <strong>${fmt(i.preco * i.qtd)}</strong>
        </div>
      `;
    })
    .join("");

  document.getElementById("subtotal").textContent = fmt(subtotal);
  document.getElementById("total").textContent = fmt(subtotal);
}

// ============================================================
// ENVIAR PEDIDO
// ============================================================
async function enviarPedido(event) {
  event.preventDefault();

  if (carrinho.length === 0) {
    alert("Carrinho vazio");
    return;
  }

  const nome = document.getElementById("campo-nome").value;
  const whatsapp = document.getElementById("campo-whatsapp").value;
  const endereco = document.getElementById("campo-endereco").value;
  const pagamento = document.getElementById("campo-pagamento").value;
  const obs = document.getElementById("campo-obs").value;

  if (!nome || !whatsapp || !pagamento) {
    alert("Preencha os campos obrigatórios");
    return;
  }

  const itens = carrinho
    .map((i) => `${i.nome} x${i.qtd}`)
    .join(" | ");

  const total = carrinho.reduce(
    (a, b) => a + b.preco * b.qtd,
    0
  );

  const pedido = {
    nome,
    whatsapp,
    endereco,
    pagamento,
    obs,
    itens,
    total,
  };

  try {
    await fetch(CONFIG.sheetsUrl, {
      method: "POST",
      body: JSON.stringify(pedido),
    });

    alert("Pedido enviado com sucesso!");
    carrinho = [];
    atualizarCarrinho();
  } catch (err) {
    console.error(err);
    alert("Erro ao enviar pedido");
  }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  carregarCardapio();

  document
    .getElementById("form-pedido")
    .addEventListener("submit", enviarPedido);
});
