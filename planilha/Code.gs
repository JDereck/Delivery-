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
  "Status", "Motivo Cancelamento",
];

const CAB_CARDAPIO = [
  "Categoria", "Nome", "Preço",
  "V1 Nome", "V1 Preço", "V1 Disp",
  "V2 Nome", "V2 Preço", "V2 Disp",
  "V3 Nome", "V3 Preço", "V3 Disp",
  "Tag", "Descrição", "Disponível",
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

  return ContentService
    .createTextOutput("✅ Script ativo e funcionando!")
    .setMimeType(ContentService.MimeType.TEXT);
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
      dados.endereco,
      dados.pagamento,
      dados.troco      || "-",
      itensTexto,
      Number(dados.subtotal).toFixed(2),
      Number(dados.taxaEntrega).toFixed(2),
      Number(dados.total).toFixed(2),
      dados.obs        || "-",
      "Novo",
      "",
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

  const { produtos } = lerProdutos(sheet, false);
  return jsonResp({ ok: true, produtos });
}

// ============================================================
//  CARDÁPIO EDITOR — todos os produtos (inclusive NÃO disponíveis)
// ============================================================
function servirCardapioEditor() {
  const sheet = getCardapioSheet();
  if (!sheet) return jsonResp({ ok: false, erro: 'Aba "Cardápio" não encontrada.' });

  const { produtos } = lerProdutos(sheet, true);
  return jsonResp({ ok: true, produtos });
}

// ============================================================
//  HELPER — lê produtos do Cardápio
//  Se incluirIndisponiveis = true, inclui os NÃO disponíveis
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

    const prod = {
      id:         i,
      row:        i + 1,
      cat:        String(cat),
      nome:       String(nome),
      disponivel: dispProd,
    };

    if (v1n && v1p !== "") {
      const vs = [];
      if (v1n && v1p !== "") vs.push({ l: String(v1n), p: Number(v1p), disp: norm(v1d) !== "NÃO", vcol: 6 });
      if (v2n && v2p !== "") vs.push({ l: String(v2n), p: Number(v2p), disp: norm(v2d) !== "NÃO", vcol: 9 });
      if (v3n && v3p !== "") vs.push({ l: String(v3n), p: Number(v3p), disp: norm(v3d) !== "NÃO", vcol: 12 });
      prod.vs = vs;
    } else {
      if (preco === "" || preco === null) continue;
      prod.p    = Number(preco);
      prod.pcol = 3; // coluna Preço no Cardápio
    }

    if (tag  && String(tag).trim())  prod.tag  = String(tag).trim().toLowerCase();
    if (desc && String(desc).trim()) prod.desc = String(desc).trim();

    produtos.push(prod);
  }

  return { produtos };
}

// ============================================================
//  TOGGLE PRODUTO — col 15 (Disponível)
// ============================================================
function toggleProd(p) {
  const row   = parseInt(p.row);
  const valor = p.valor;
  if (!row || !["SIM", "NÃO"].includes(valor))
    return jsonResp({ ok: false, erro: "Parâmetros inválidos" });
  getCardapioSheet().getRange(row, 15).setValue(valor);
  return jsonResp({ ok: true });
}

// ============================================================
//  TOGGLE VARIANTE — col 6, 9 ou 12 (V1/V2/V3 Disp)
// ============================================================
function toggleVar(p) {
  const row  = parseInt(p.row);
  const vcol = parseInt(p.vcol);
  const valor = p.valor;
  if (!row || ![6, 9, 12].includes(vcol) || !["SIM", "NÃO"].includes(valor))
    return jsonResp({ ok: false, erro: "Parâmetros inválidos" });
  getCardapioSheet().getRange(row, vcol).setValue(valor);
  return jsonResp({ ok: true });
}

// ============================================================
//  UPDATE PREÇO — col 3, 5, 8 ou 11 (Preço/V1/V2/V3)
// ============================================================
function updatePreco(p) {
  const row  = parseInt(p.row);
  const col  = parseInt(p.col);
  const val  = parseFloat(p.valor);
  if (!row || ![3, 5, 8, 11].includes(col) || isNaN(val) || val < 0)
    return jsonResp({ ok: false, erro: "Parâmetros inválidos" });
  getCardapioSheet().getRange(row, col).setValue(val);
  return jsonResp({ ok: true });
}

// ============================================================
//  CONFIG — lê aba Config
// ============================================================
function getConfig() {
  const sheet = getConfigSheet();
  if (!sheet) return jsonResp({ ok: false, erro: 'Aba "Config" não encontrada.' });

  const rows   = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < rows.length; i++) {
    const [chave, valor] = rows[i];
    if (chave) config[String(chave)] = String(valor);
  }

  // Converte tipos
  if (config.taxaEntrega)  config.taxaEntrega = Number(config.taxaEntrega);
  if (config.diasFechado)  config.diasFechado = config.diasFechado.split(",").map(d => d.trim()).filter(Boolean);

  return jsonResp({ ok: true, config });
}

// ============================================================
//  SAVE CONFIG — salva parâmetros na aba Config
// ============================================================
function saveConfig(p) {
  const sheet = getConfigSheet();
  if (!sheet) return jsonResp({ ok: false, erro: 'Aba "Config" não encontrada.' });

  const rows = sheet.getDataRange().getValues();

  CONFIG_KEYS.forEach(key => {
    if (p[key] === undefined) return;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === key) {
        sheet.getRange(i + 1, 2).setValue(decodeURIComponent(p[key]));
        return;
      }
    }
    // Chave não existe → adicionar
    sheet.appendRow([key, decodeURIComponent(p[key])]);
  });

  return jsonResp({ ok: true });
}

// ============================================================
//  PEDIDOS — lista todos para o painel
// ============================================================
function listarPedidos() {
  const sheet = getPedidosSheet();
  const rows  = sheet.getDataRange().getValues();
  const pedidos = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1]) continue;
    pedidos.push({
      row:       i + 1,
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
    });
  }

  pedidos.reverse();
  return jsonResp({ ok: true, pedidos });
}

// ============================================================
//  STATUS — atualiza status de um pedido
// ============================================================
function atualizarStatus(p) {
  const row    = parseInt(p.row);
  const status = p.status;
  const VALIDOS = ["Novo", "Em Preparo", "Saiu pra Entrega", "Entregue", "Cancelado"];
  if (!row || !VALIDOS.includes(status))
    return jsonResp({ ok: false, erro: "Parâmetros inválidos" });
  getPedidosSheet().getRange(row, 11).setValue(status);
  return jsonResp({ ok: true });
}

// ============================================================
//  CANCELAR — marca como cancelado + motivo
// ============================================================
function cancelarPedido(p) {
  const row    = parseInt(p.row);
  const motivo = p.motivo || "Sem motivo informado";
  if (!row) return jsonResp({ ok: false, erro: "Row inválido" });
  const sheet = getPedidosSheet();
  sheet.getRange(row, 11).setValue("Cancelado");
  sheet.getRange(row, 12).setValue(decodeURIComponent(motivo));
  return jsonResp({ ok: true });
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

function getCardapioSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Cardápio");
}

function getConfigSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
}

function norm(val) { return String(val || "").toUpperCase().trim(); }

function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  SETUP — execute criarAbas() manualmente no editor
// ============================================================
function criarAbas() {
  criarAbaPedidos();
  criarAbaCardapio();
  criarAbaConfig();
}

function criarAbaPedidos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName("Pedidos")) return;
  const sheet = ss.insertSheet("Pedidos");
  sheet.appendRow(CAB_PEDIDOS);
  sheet.getRange(1, 1, 1, CAB_PEDIDOS.length)
    .setFontWeight("bold").setBackground("#1f2937").setFontColor("#f97316");
  sheet.setFrozenRows(1);
}

function criarAbaCardapio() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName("Cardápio")) {
    SpreadsheetApp.getUi().alert('Aba "Cardápio" já existe!');
    return;
  }
  const sheet = ss.insertSheet("Cardápio");
  sheet.appendRow(CAB_CARDAPIO);
  sheet.getRange(1, 1, 1, CAB_CARDAPIO.length)
    .setFontWeight("bold").setBackground("#1f2937").setFontColor("#f97316");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(14, 260);
  sheet.appendRow(["🍔 Sanduíches", "X-Burguer", "", "Pão Bola", 11, "SIM", "Pão Árabe", 12, "NÃO", "", "", "", "", "", "SIM"]);
  sheet.appendRow(["🍕 Pizzas", "Mussarela", 27, "", "", "", "", "", "", "", "", "", "tradicional", "", "SIM"]);
  SpreadsheetApp.getUi().alert('Aba "Cardápio" criada com exemplos!');
}

function criarAbaConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName("Config")) return;
  const sheet = ss.insertSheet("Config");
  sheet.appendRow(["Chave", "Valor"]);
  sheet.getRange(1, 1, 1, 2)
    .setFontWeight("bold").setBackground("#1f2937").setFontColor("#f97316");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 300);
  // Valores padrão
  sheet.appendRow(["whatsapp",            "5500000000000"]);
  sheet.appendRow(["taxaEntrega",         "5.00"]);
  sheet.appendRow(["horarioAbertura",     "18:00"]);
  sheet.appendRow(["horarioFechamento",   "23:00"]);
  sheet.appendRow(["diasFechado",         "segunda"]);
  sheet.appendRow(["nomeEstabelecimento", "Delivery"]);
}
