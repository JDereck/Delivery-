// ============================================================
//  GOOGLE APPS SCRIPT — Registro de Pedidos + Cardápio Vivo
//
//  COMO INSTALAR:
//  1. Acesse script.google.com e crie um novo projeto vinculado
//     à sua planilha (Extensões > Apps Script)
//  2. Cole este código substituindo o conteúdo padrão
//  3. Execute criarAbaCardapio() manualmente para criar a aba "Cardápio"
//     com o cabeçalho já formatado
//  4. Clique em "Implantar" > "Nova implantação"
//     - Tipo: App da Web
//     - Executar como: Eu mesmo
//     - Quem tem acesso: Qualquer pessoa
//  5. Cole a URL gerada no campo sheetsUrl do CONFIG em app.js
// ============================================================

// ---- Cabeçalho da aba Pedidos ----
const CAB_PEDIDOS = [
  "Data/Hora", "Nome", "Endereço", "Pagamento", "Troco",
  "Itens", "Subtotal (R$)", "Taxa Entrega (R$)", "Total (R$)", "Observações",
];

// ---- Cabeçalho da aba Cardápio ----
const CAB_CARDAPIO = [
  "Categoria", "Nome", "Preço",
  "V1 Nome", "V1 Preço", "V1 Disp",
  "V2 Nome", "V2 Preço", "V2 Disp",
  "V3 Nome", "V3 Preço", "V3 Disp",
  "Tag", "Descrição", "Disponível",
];

// ============================================================
//  GET — Serve o cardápio como JSON para o site
// ============================================================
function doGet(e) {
  if (e && e.parameter && e.parameter.action === "cardapio") {
    return servirCardapio();
  }
  return ContentService
    .createTextOutput("✅ Script ativo e funcionando!")
    .setMimeType(ContentService.MimeType.TEXT);
}

function servirCardapio() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Cardápio");

  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erro: 'Aba "Cardápio" não encontrada. Execute criarAbaCardapio() primeiro.' }))
      .setMimeType(ContentService.MimeType.JSON);
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
    if (String(disponivel).toUpperCase().trim() === "NÃO") continue;

    const prod = { id: i, cat: String(cat), nome: String(nome) };

    // Produto com variantes
    if (v1n && v1p !== "") {
      const vs = [];
      if (v1n && v1p !== "" && String(v1d).toUpperCase().trim() !== "NÃO")
        vs.push({ l: String(v1n), p: Number(v1p) });
      if (v2n && v2p !== "" && String(v2d).toUpperCase().trim() !== "NÃO")
        vs.push({ l: String(v2n), p: Number(v2p) });
      if (v3n && v3p !== "" && String(v3d).toUpperCase().trim() !== "NÃO")
        vs.push({ l: String(v3n), p: Number(v3p) });

      if (vs.length === 0) continue; // todas variantes desativadas = oculta produto
      prod.vs = vs;
    } else {
      // Produto simples
      if (preco === "" || preco === null) continue;
      prod.p = Number(preco);
    }

    if (tag  && String(tag).trim())  prod.tag  = String(tag).trim().toLowerCase();
    if (desc && String(desc).trim()) prod.desc = String(desc).trim();

    produtos.push(prod);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, produtos }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  POST — Registra pedido na aba Pedidos
// ============================================================
function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    let sheet   = ss.getSheetByName("Pedidos") || ss.getActiveSheet();

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(CAB_PEDIDOS);
      sheet.getRange(1, 1, 1, CAB_PEDIDOS.length)
        .setFontWeight("bold")
        .setBackground("#f97316")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    }

    const itensTexto = dados.itens
      .map(i => `${i.nome} x${i.qty} (R$${(i.preco * i.qty).toFixed(2)})`)
      .join(" | ");

    sheet.appendRow([
      new Date(),
      dados.nome,
      dados.endereco,
      dados.pagamento,
      dados.troco,
      itensTexto,
      dados.subtotal.toFixed(2),
      dados.taxaEntrega.toFixed(2),
      dados.total.toFixed(2),
      dados.obs,
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
//  AUXILIAR — Execute manualmente no editor para criar a aba
// ============================================================
function criarAbaCardapio() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (ss.getSheetByName("Cardápio")) {
    SpreadsheetApp.getUi().alert('Aba "Cardápio" já existe!');
    return;
  }

  const sheet = ss.insertSheet("Cardápio");
  sheet.appendRow(CAB_CARDAPIO);

  const header = sheet.getRange(1, 1, 1, CAB_CARDAPIO.length);
  header.setFontWeight("bold").setBackground("#1f2937").setFontColor("#f97316");
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);  // Categoria
  sheet.setColumnWidth(2, 180);  // Nome
  sheet.setColumnWidth(14, 260); // Descrição

  // Exemplo: X-Burguer com V1 SIM e V2 NÃO
  sheet.appendRow(["🍔 Sanduíches", "X-Burguer", "", "Pão Bola", 11, "SIM", "Pão Árabe", 12, "NÃO", "", "", "", "", "", "SIM"]);
  // Exemplo: produto simples
  sheet.appendRow(["🍕 Pizzas", "Mussarela", 27, "", "", "", "", "", "", "", "", "", "tradicional", "", "SIM"]);

  SpreadsheetApp.getUi().alert('Aba "Cardápio" criada com exemplos! Edite à vontade.');
}
