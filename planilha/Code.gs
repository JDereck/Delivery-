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

// ============================================================
//  ROTEADOR GET
// ============================================================
function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};

  if (p.action === "cardapio") return servirCardapio();
  if (p.action === "pedidos")  return listarPedidos();
  if (p.action === "status")   return atualizarStatus(p);
  if (p.action === "cancelar") return cancelarPedido(p);

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

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erro: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
//  CARDÁPIO — serve JSON para o site
// ============================================================
function servirCardapio() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Cardápio");

  if (!sheet) {
    return jsonResp({ ok: false, erro: 'Aba "Cardápio" não encontrada. Execute criarAbas() primeiro.' });
  }

  const rows     = sheet.getDataRange().getValues();
  const produtos = [];

  for (let i = 1; i < rows.length; i++) {
    const [cat, nome, preco,
           v1n, v1p, v1d,
           v2n, v2p, v2d,
           v3n, v3p, v3d,
           tag, desc, disponivel] = rows[i];

    if (!nome) continue;
    if (norm(disponivel) === "NÃO") continue;

    const prod = { id: i, cat: String(cat), nome: String(nome) };

    if (v1n && v1p !== "") {
      const vs = [];
      if (v1n && v1p !== "" && norm(v1d) !== "NÃO") vs.push({ l: String(v1n), p: Number(v1p) });
      if (v2n && v2p !== "" && norm(v2d) !== "NÃO") vs.push({ l: String(v2n), p: Number(v2p) });
      if (v3n && v3p !== "" && norm(v3d) !== "NÃO") vs.push({ l: String(v3n), p: Number(v3p) });
      if (vs.length === 0) continue;
      prod.vs = vs;
    } else {
      if (preco === "" || preco === null) continue;
      prod.p = Number(preco);
    }

    if (tag  && String(tag).trim())  prod.tag  = String(tag).trim().toLowerCase();
    if (desc && String(desc).trim()) prod.desc = String(desc).trim();

    produtos.push(prod);
  }

  return jsonResp({ ok: true, produtos });
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
    if (!r[1]) continue; // sem nome = linha vazia

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

  pedidos.reverse(); // mais recentes primeiro
  return jsonResp({ ok: true, pedidos });
}

// ============================================================
//  STATUS — atualiza status de um pedido
// ============================================================
function atualizarStatus(p) {
  const row    = parseInt(p.row);
  const status = p.status;
  const VALIDOS = ["Novo", "Em Preparo", "Saiu pra Entrega", "Entregue", "Cancelado"];

  if (!row || !VALIDOS.includes(status)) {
    return jsonResp({ ok: false, erro: "Parâmetros inválidos" });
  }

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
//  AUXILIARES
// ============================================================
function getPedidosSheet() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName("Pedidos") || ss.getActiveSheet();

  // Garante que coluna Status existe
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

function norm(val) {
  return String(val || "").toUpperCase().trim();
}

function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  SETUP — execute manualmente no editor para criar as abas
// ============================================================
function criarAbas() {
  criarAbaPedidos();
  criarAbaCardapio();
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
