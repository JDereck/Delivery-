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
let enviandoPedido = false; 

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

function limparTelefone(v) {
  return String(v || "").replace(/\D/g, "");
}

// ============================================================
// BUSCAR CARDÁPIO — (CORRIGIDO: Acessando a chave .produtos)
// ============================================================
async function carregarCardapio() {
  try {
    const res = await fetch(CONFIG.sheetsUrl + "?action=cardapio"); 
    const dados = await res.json();

    if (dados.ok) {
      cardapio = dados.produtos; // Define o estado com a lista vinda do backend
      renderCardapio();
      // montarCategorias(); // Ative se tiver a função de navegação por categorias
    } else {
      console.error("Erro ao carregar cardápio:", dados.erro);
    }
  } catch (err) {
    console.error("Erro na requisição do cardápio:", err);
  }
}

// ============================================================
// RENDER CARDÁPIO
// ============================================================
function renderCardapio() {
  const container = document.getElementById("cardapio");
  if (!container) return;
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
// AGRUPAR CATEGORIAS — (CORRIGIDO: Usando 'cat' do backend)
// ============================================================
function agruparPorCategoria(lista) {
  return lista.reduce((acc, item) => {
    const categoria = item.cat || "Geral"; 
    if (!acc[categoria]) acc[categoria] = [];
    acc[categoria].push(item);
    return acc;
  }, {});
}

// ============================================================
// PRODUTO CARD — (CORRIGIDO: Mapeando 'desc' e 'p')
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

      <div class="produto-desc">${esc(p.desc || "")}</div>

      <div class="produto-footer">
        <strong>${fmt(p.p)}</strong>
        <button onclick="adicionarCarrinho('${p.id}')" class="btn-add">
          + Adicionar
        </button>
      </div>
    </div>
  `;
}

// ============================================================
// CARRINHO — (CORRIGIDO: Preço agora vem da chave 'p')
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
      preco: Number(prod.p), // Mapeia o 'p' do backend para 'preco' no carrinho
      qtd: 1,
    });
  }

  atualizarCarrinho();
}

function removerItem(id) {
  carrinho = carrinho.filter((i) => i.id !== id);
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
    if (badge) badge.classList.add("hidden");
    return;
  }

  if (badge) {
    badge.classList.remove("hidden");
    badge.textContent = carrinho.reduce((a, b) => a + b.qtd, 0);
  }

  let subtotal = 0;

  box.innerHTML = carrinho
    .map((i) => {
      subtotal += i.preco * i.qtd;

      return `
        <div class="item-carrinho">
          <span>${esc(i.nome)}</span>
          <span>${i.qtd}x</span>
          <strong>${fmt(i.preco * i.qtd)}</strong>
          <button onclick="removerItem('${i.id}')" style="background:none; border:none; cursor:pointer;">❌</button>
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

  if (enviandoPedido) return; 

  if (carrinho.length === 0) {
    alert("Carrinho vazio");
    return;
  }

  const nome = document.getElementById("campo-nome").value.trim();
  const whatsapp = limparTelefone(document.getElementById("campo-whatsapp").value);
  const endereco = document.getElementById("campo-endereco").value.trim();
  const pagamento = document.getElementById("campo-pagamento").value;
  const obs = document.getElementById("campo-obs").value;

  if (!nome || !whatsapp || !pagamento) {
    alert("Preencha os campos obrigatórios");
    return;
  }

  enviandoPedido = true;

  const btn = document.getElementById("btn-finalizar");
  btn.disabled = true;
  btn.textContent = "Enviando...";

  const itensParaEnvio = carrinho.map((i) => ({
    nome: i.nome,
    qty: i.qtd,
    preco: i.preco
  }));

  const subtotal = carrinho.reduce((a, b) => a + b.preco * b.qtd, 0);

  const pedido = {
    nome,
    whatsapp,
    endereco,
    pagamento,
    obs,
    itens: itensParaEnvio,
    subtotal: subtotal,
    taxaEntrega: 0, // Pode ser integrado com a aba Config futuramente
    total: subtotal
  };

  try {
    const response = await fetch(CONFIG.sheetsUrl, {
      method: "POST",
      body: JSON.stringify(pedido),
    });

    const result = await response.json();

    if (result.ok) {
      alert("Pedido enviado com sucesso!");
      carrinho = [];
      atualizarCarrinho();
      document.getElementById("form-pedido").reset();
    } else {
      throw new Error(result.erro);
    }

  } catch (err) {
    console.error(err);
    alert("Erro ao enviar pedido. Verifique a conexão.");
  }

  enviandoPedido = false;
  btn.disabled = false;
  btn.textContent = "🚀 Enviar pedido agora";
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  carregarCardapio();

  const form = document.getElementById("form-pedido");
  if (form) {
    form.addEventListener("submit", enviarPedido);
  }
});
