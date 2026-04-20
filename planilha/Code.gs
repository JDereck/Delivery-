// ============================================================
//  GOOGLE APPS SCRIPT — Registro de Pedidos
//
//  COMO INSTALAR:
//  1. Acesse script.google.com e crie um novo projeto
//  2. Cole este código substituindo o conteúdo padrão
//  3. Clique em "Implantar" > "Nova implantação"
//  4. Tipo: "App da Web"
//     - Executar como: Eu mesmo
//     - Quem tem acesso: Qualquer pessoa
//  5. Clique em "Implantar" e copie a URL gerada
//  6. Cole a URL no campo sheetsUrl do CONFIG em app.js
// ============================================================

const CABECALHO = [
  "Data/Hora", "Nome", "Endereço", "Pagamento", "Troco",
  "Itens", "Subtotal (R$)", "Taxa Entrega (R$)", "Total (R$)", "Observações"
];

function doPost(e) {
  try {
    const dados    = JSON.parse(e.postData.contents);
    const planilha = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (planilha.getLastRow() === 0) {
      planilha.appendRow(CABECALHO);
      planilha.getRange(1, 1, 1, CABECALHO.length)
        .setFontWeight("bold")
        .setBackground("#f97316")
        .setFontColor("#ffffff");
      planilha.setFrozenRows(1);
    }

    const itensTexto = dados.itens
      .map(i => `${i.nome} x${i.qty} (R$${(i.preco * i.qty).toFixed(2)})`)
      .join(" | ");

    planilha.appendRow([
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

// Teste manual: execute doGet() no editor para verificar se o script funciona
function doGet() {
  return ContentService
    .createTextOutput("✅ Script ativo e funcionando!")
    .setMimeType(ContentService.MimeType.TEXT);
}
