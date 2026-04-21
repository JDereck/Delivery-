// ============================================================
//  GOOGLE APPS SCRIPT — Delivery System Backend
//
//  COMO INSTALAR:
//  1. Abra sua planilha → Extensões → Apps Script
//  2. Cole este código substituindo o conteúdo padrão
//  3. Execute criarAbas() manualmente para criar as abas formatadas
//  4. Implantar → Nova implantação → App da Web
//     - Executar como: Eu mesmo
//     - Quem tem acesso: Qualquer pessoa
//  5. Cole a URL no campo sheetsUrl do CONFIG em app.js e painel.js
// ============================================================

const CAB_PEDIDOS = [
  "Data/Hora", "Nome", "Endereço", "Pagamento", "Troco",
  "Itens", "Subtotal (R$)", "Taxa Entrega (R$)", "Total (R$)", "Observações",
  "Status", "Motivo Cancelamento", "Tipo",
];

const CAB_CARDAPIO = [
  "Categoria", "Nome", "Preço",
  "V1 Nome", "V1 Preço", "V1 Disp",
  "V2 Nome", "V2 Preço", "V2 Disp",
  "V3 Nome", "V3 Preço", "V3 Disp",
  "Tag", "Descrição", "Disponível",
];

const CAB_CLIENTES = [
  "WhatsApp", "Nome", "Endereços",
  "Qtd Pedidos", "Total Gasto (R$)",
  "Primeiro Pedido", "Último Pedido",
];

const CONFIG_KEYS = [
  "whatsapp", "taxaEntrega", "horarioAbertura",
  "horarioFechamento", "diasFechado", "nomeEstabelecimento",
];

// ============================================================
//  ROTEADOR GET
// ============================================================
function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};

  if (p.action === "cardapio")       return servirCardapio();
  if (p.action === "cardapioeditor") return servirCardapioEditor();
  if (p.action === "pedidos")        return listarPedidos();
  if (p.action === "status")         return atualizarStatus(p);
  if (p.action === "cancelar")       return cancelarPedido(p);
  if (p.action === "config")         return getConfig();
  if (p.action === "saveconfig")     return saveConfig(p);
  if (p.action === "toggleprod")     return toggleProd(p);
  if (p.action === "togglevar")      return toggleVar(p);
  if (p.action === "updatepreco")    return updatePreco(p);
  if (p.action === "cliente")        return buscarCliente(p);
  if (p.action === "salvarcliente")  return salvarCliente(p);
  if (p.action === "listarclientes") return listarClientes();

  return jsonResp({ ok: true, msg: "Script ativo" });
}

// ============================================================
//  ROTEADOR POST — Registro de novo pedido
// ============================================================
function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    const sheet = getPedidosSheet();

    const itensTexto = dados.itens
      .map(i => `${i.nome} x${i.qty} (R$${(i.preco * i.qty).toFixed(2)})`)
      .join(" | ");

    sheet.appendRow([
      new Date(),
      dados.nome,
      dados.endereco   || "—",
      dados.pagamento,
      dados.troco      || "-",
      itensTexto,
      Number(dados.subtotal).toFixed(2),
      Number(dados.taxaEntrega).toFixed(2),
      Number(dados.total).toFixed(2),
      dados.obs        || "-",
      "Novo",
      "",
      dados.tipo       || "entrega",
    ]);

    return jsonResp({ ok: true });

  } catch (err) {
    return jsonResp({ ok: false, erro: err.toString() });
  }
}

// ============================================================
//  CARDÁPIO — serve JSON para o site (apenas disponíveis)
// ============================================================
function servirCardapio() {
  const sheet = getCardapioSheet();
  if (!sheet) return jsonResp({ ok: false, erro: 'Aba "Cardápio" não encontrada.' });
  return jsonResp({ ok: true, produtos: lerProdutos(sheet, false).produtos });
}

// ============================================================
//  CARDÁPIO EDITOR — todos os produtos (inclusive NÃO disponíveis)
// ============================================================
function servirCardapioEditor() {
  const sheet = getCardapioSheet();
  if (!sheet) return jsonResp({ ok: false, erro: 'Aba "Cardápio" não encontrada.' });
  return jsonResp({ ok: true, produtos: lerProdutos(sheet, true).produtos });
}

// ============================================================
//  HELPER — lê produtos do Cardápio
// ============================================================
function lerProdutos(sheet, incluirIndisponiveis) {
  const rows     = sheet.getDataRange().getValues();
  const produtos = [];

  for (let i = 1; i < rows.length; i++) {
    const [cat, nome, preco,
           v1n, v1p, v1d,
           v2n, v2p, v2d,
           v3n, v3p, v3d,
           tag, desc, disponivel] = rows[i];

    if (!nome) continue;
    const dispProd = norm(disponivel) !== "NÃO";
    if (!incluirIndisponiveis && !dispProd) continue;

    const prod = { id: i, row: i + 1, cat: String(cat), nome: String(nome), disponivel: dispProd };

    if (v1n && v1p !== "") {
      const vs = [];
      if (v1n && v1p !== "") vs.push({ l: String(v1n), p: Number(v1p), disp: norm(v1d) !== "NÃO", vcol: 6 });
      if (v2n && v2p !== "") vs.push({ l: String(v2n), p: Number(v2p), disp: norm(v2d) !== "NÃO", vcol: 9 });
      if (v3n && v3p !== "") vs.push({ l: String(v3n), p: Number(v3p), disp: norm(v3d) !== "NÃO", vcol: 12 });
      prod.vs = vs;
    } else {
      if (preco === "" || preco === null) continue;
      prod.p = Number(preco); prod.pcol = 3;
    }

    if (tag  && String(tag).trim())  prod.tag  = String(tag).trim().toLowerCase();
    if (desc && String(desc).trim()) prod.desc = String(desc).trim();
    produtos.push(prod);
  }
  return { produtos };
}

// ============================================================
//  TOGGLE / UPDATE — Cardápio
// ============================================================
function toggleProd(p) {
  const row = parseInt(p.row); const valor = p.valor;
  if (!row || !["SIM", "NÃO"].includes(valor)) return jsonResp({ ok: false, erro: "Parâmetros inválidos" });
  getCardapioSheet().getRange(row, 15).setValue(valor);
  return jsonResp({ ok: true });
}

function toggleVar(p) {
  const row = parseInt(p.row); const vcol = parseInt(p.vcol); const valor = p.valor;
  if (!row || ![6,9,12].includes(vcol) || !["SIM","NÃO"].includes(valor)) return jsonResp({ ok: false, erro: "Parâmetros inválidos" });
  getCardapioSheet().getRange(row, vcol).setValue(valor);
  return jsonResp({ ok: true });
}

function updatePreco(p) {
  const row = parseInt(p.row); const col = parseInt(p.col); const val = parseFloat(p.valor);
  if (!row || ![3,5,8,11].includes(col) || isNaN(val) || val < 0) return jsonResp({ ok: false, erro: "Parâmetros inválidos" });
  getCardapioSheet().getRange(row, col).setValue(val);
  return jsonResp({ ok: true });
}

// ============================================================
//  CONFIG
// ============================================================
function getConfig() {
  const sheet = getConfigSheet();
  if (!sheet) return jsonResp({ ok: false, erro: 'Aba "Config" não encontrada.' });
  const rows = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < rows.length; i++) {
    const [chave, valor] = rows[i];
    if (chave) config[String(chave)] = String(valor);
  }
  if (config.taxaEntrega) config.taxaEntrega = Number(config.taxaEntrega);
  if (config.diasFechado) config.diasFechado = config.diasFechado.split(",").map(d => d.trim()).filter(Boolean);
  return jsonResp({ ok: true, config });
}

function saveConfig(p) {
  const sheet = getConfigSheet();
  if (!sheet) return jsonResp({ ok: false, erro: 'Aba "Config" não encontrada.' });
  const rows = sheet.getDataRange().getValues();
  CONFIG_KEYS.forEach(key => {
    if (p[key] === undefined) return;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === key) { sheet.getRange(i + 1, 2).setValue(decodeURIComponent(p[key])); return; }
    }
    sheet.appendRow([key, decodeURIComponent(p[key])]);
  });
  return jsonResp({ ok: true });
}

// ============================================================
//  PEDIDOS
// ============================================================
function listarPedidos() {
  const sheet = getPedidosSheet();
  const rows  = sheet.getDataRange().getValues();
  const pedidos = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1]) continue;
    pedidos.push({
      row: i + 1,
      dataHora:  r[0] ? new Date(r[0]).toISOString() : null,
      nome:      String(r[1]  || ""),
      endereco:  String(r[2]  || ""),
      pagamento: String(r[3]  || ""),
      troco:     String(r[4]  || ""),
      itens:     String(r[5]  || ""),
      subtotal:  Number(r[6]  || 0),
      taxa:      Number(r[7]  || 0),
      total:     Number(r[8]  || 0),
      obs:       String(r[9]  || ""),
      status:    String(r[10] || "Novo"),
      motivo:    String(r[11] || ""),
      tipo:      String(r[12] || "entrega"),
    });
  }
  pedidos.reverse();
  return jsonResp({ ok: true, pedidos });
}

function atualizarStatus(p) {
  const row = parseInt(p.row); const status = p.status;
  const VALIDOS = ["Novo","Em Preparo","Saiu pra Entrega","Entregue","Cancelado"];
  if (!row || !VALIDOS.includes(status)) return jsonResp({ ok: false, erro: "Parâmetros inválidos" });
  getPedidosSheet().getRange(row, 11).setValue(status);
  return jsonResp({ ok: true });
}

function cancelarPedido(p) {
  const row = parseInt(p.row); const motivo = p.motivo || "Sem motivo informado";
  if (!row) return jsonResp({ ok: false, erro: "Row inválido" });
  const sheet = getPedidosSheet();
  sheet.getRange(row, 11).setValue("Cancelado");
  sheet.getRange(row, 12).setValue(decodeURIComponent(motivo));
  return jsonResp({ ok: true });
}

// ============================================================
//  CLIENTES
// ============================================================
function buscarCliente(p) {
  const wpp   = String(p.whatsapp || "").replace(/\D/g, "");
  if (!wpp) return jsonResp({ ok: true, cliente: null });

  const sheet = getClientesSheet();
  if (!sheet) return jsonResp({ ok: true, cliente: null });

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const wppRow = String(rows[i][0] || "").replace(/\D/g, "");
    if (wppRow === wpp) {
      const enderecos = String(rows[i][2] || "")
        .split("|").map(e => e.trim()).filter(Boolean);
      return jsonResp({
        ok: true,
        cliente: { nome: String(rows[i][1] || ""), enderecos }
      });
    }
  }
  return jsonResp({ ok: true, cliente: null });
}

function salvarCliente(p) {
  const wpp     = String(p.whatsapp || "").replace(/\D/g, "");
  const nome    = decodeURIComponent(p.nome    || "").trim();
  const endereco = decodeURIComponent(p.endereco || "").trim();
  const total   = Number(p.total || 0);
  if (!wpp || !nome) return jsonResp({ ok: false, erro: "Parâmetros inválidos" });

  const sheet = getClientesSheet();
  if (!sheet) return jsonResp({ ok: false, erro: 'Aba "Clientes" não encontrada.' });

  const rows = sheet.getDataRange().getValues();
  const hoje = new Date();

  for (let i = 1; i < rows.length; i++) {
    const wppRow = String(rows[i][0] || "").replace(/\D/g, "");
    if (wppRow !== wpp) continue;

    // Cliente existe — atualiza
    const enderecosAtuais = String(rows[i][2] || "")
      .split("|").map(e => e.trim()).filter(Boolean);
    const jaTemEnd = enderecosAtuais.some(e => e.toLowerCase() === endereco.toLowerCase());
    if (endereco && !jaTemEnd) enderecosAtuais.unshift(endereco); // novo endereço no topo

    sheet.getRange(i + 1, 2).setValue(nome);
    sheet.getRange(i + 1, 3).setValue(enderecosAtuais.join(" | "));
    sheet.getRange(i + 1, 4).setValue(Number(rows[i][3] || 0) + 1);
    sheet.getRange(i + 1, 5).setValue((Number(rows[i][4] || 0) + total).toFixed(2));
    sheet.getRange(i + 1, 7).setValue(hoje);
    return jsonResp({ ok: true });
  }

  // Cliente novo — cria
  sheet.appendRow([wpp, nome, endereco, 1, total.toFixed(2), hoje, hoje]);
  return jsonResp({ ok: true });
}

function listarClientes() {
  const sheet = getClientesSheet();
  if (!sheet) return jsonResp({ ok: false, erro: 'Aba "Clientes" não encontrada.' });

  const rows     = sheet.getDataRange().getValues();
  const clientes = [];
  const agora    = new Date();

  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    const ultimoPedido = rows[i][6] ? new Date(rows[i][6]) : null;
    const diasSemPedir = ultimoPedido
      ? Math.floor((agora - ultimoPedido) / 86400000) : 999;

    const status = diasSemPedir <= 14 ? "Ativo"
                 : diasSemPedir <= 30 ? "Morno"
                 : "Inativo";

    clientes.push({
      whatsapp:      String(rows[i][0] || ""),
      nome:          String(rows[i][1] || ""),
      enderecos:     String(rows[i][2] || "").split("|").map(e => e.trim()).filter(Boolean),
      qtdPedidos:    Number(rows[i][3] || 0),
      totalGasto:    Number(rows[i][4] || 0),
      primeiroPedido: rows[i][5] ? new Date(rows[i][5]).toISOString() : null,
      ultimoPedido:  ultimoPedido ? ultimoPedido.toISOString() : null,
      diasSemPedir,
      status,
    });
  }

  clientes.sort((a, b) => (b.ultimoPedido || "") > (a.ultimoPedido || "") ? 1 : -1);
  return jsonResp({ ok: true, clientes });
}

// ============================================================
//  SHEET HELPERS
// ============================================================
function getPedidosSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName("Pedidos") || ss.getActiveSheet();
  if (sheet.getLastRow() > 0) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!headers.includes("Status")) {
      const col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col    ).setValue("Status").setFontWeight("bold");
      sheet.getRange(1, col + 1).setValue("Motivo Cancelamento").setFontWeight("bold");
      const last = sheet.getLastRow();
      if (last > 1) sheet.getRange(2, col, last - 1, 1).setValue("Novo");
    }
  }
  return sheet;
}
function getCardapioSheet()  { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Cardápio"); }
function getConfigSheet()    { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config"); }
function getClientesSheet()  { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Clientes"); }

function norm(val)     { return String(val || "").toUpperCase().trim(); }
function jsonResp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  SETUP — execute criarAbas() manualmente no editor
// ============================================================
function criarAbas() {
  criarAbaPedidos();
  criarAbaCardapio();
  criarAbaConfig();
  criarAbaClientes();
}

function criarAbaPedidos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName("Pedidos")) return;
  const sheet = ss.insertSheet("Pedidos");
  sheet.appendRow(CAB_PEDIDOS);
  sheet.getRange(1, 1, 1, CAB_PEDIDOS.length).setFontWeight("bold").setBackground("#1f2937").setFontColor("#f97316");
  sheet.setFrozenRows(1);
}

function criarAbaCardapio() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName("Cardápio")) { SpreadsheetApp.getUi().alert('Aba "Cardápio" já existe!'); return; }
  const sheet = ss.insertSheet("Cardápio");
  sheet.appendRow(CAB_CARDAPIO);
  sheet.getRange(1, 1, 1, CAB_CARDAPIO.length).setFontWeight("bold").setBackground("#1f2937").setFontColor("#f97316");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160); sheet.setColumnWidth(2, 180); sheet.setColumnWidth(14, 260);
  sheet.appendRow(["🍔 Sanduíches","X-Burguer","","Pão Bola",11,"SIM","Pão Árabe",12,"NÃO","","","","","","SIM"]);
  sheet.appendRow(["🍕 Pizzas","Mussarela",27,"","","","","","","","","","tradicional","","SIM"]);
  SpreadsheetApp.getUi().alert('Aba "Cardápio" criada com exemplos!');
}

function criarAbaConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName("Config")) return;
  const sheet = ss.insertSheet("Config");
  sheet.appendRow(["Chave","Valor"]);
  sheet.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#1f2937").setFontColor("#f97316");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 200); sheet.setColumnWidth(2, 300);
  sheet.appendRow(["whatsapp",            "5500000000000"]);
  sheet.appendRow(["taxaEntrega",         "5.00"]);
  sheet.appendRow(["horarioAbertura",     "18:00"]);
  sheet.appendRow(["horarioFechamento",   "23:00"]);
  sheet.appendRow(["diasFechado",         "segunda"]);
  sheet.appendRow(["nomeEstabelecimento", "Delivery"]);
}

function criarAbaClientes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName("Clientes")) return;
  const sheet = ss.insertSheet("Clientes");
  sheet.appendRow(CAB_CLIENTES);
  sheet.getRange(1, 1, 1, CAB_CLIENTES.length).setFontWeight("bold").setBackground("#1f2937").setFontColor("#f97316");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 150); // WhatsApp
  sheet.setColumnWidth(2, 180); // Nome
  sheet.setColumnWidth(3, 320); // Endereços
}
