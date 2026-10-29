// Impressão de receitas e documentos da ficha: abre uma janela só com o
// documento (cabeçalho da clínica, paciente, texto, assinatura) e imprime.

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

interface PrintableDocument {
  clinicName: string;
  title: string;
  body: string;
  patient: string;
  owner: string;
  date: string;
  signature?: string | null;
}

export function printClinicalDocument(doc: PrintableDocument) {
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) {
    alert('Permita pop-ups para imprimir o documento.');
    return;
  }
  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(doc.title)}</title>
<style>
  body { font-family: 'Nunito Sans', Arial, sans-serif; color: #132628; margin: 40px; }
  header { border-bottom: 2px solid #167C79; padding-bottom: 12px; margin-bottom: 24px; }
  header h1 { font-family: Nunito, Arial, sans-serif; color: #167C79; margin: 0; font-size: 22px; }
  .meta { display: flex; justify-content: space-between; gap: 16px; font-size: 14px; margin-bottom: 24px; }
  h2 { font-family: Nunito, Arial, sans-serif; text-align: center; font-size: 20px; margin: 0 0 24px; }
  .body { white-space: pre-wrap; font-size: 15px; line-height: 1.6; min-height: 300px; }
  .sign { margin-top: 64px; text-align: center; font-size: 14px; }
  .sign span { display: inline-block; border-top: 1px solid #132628; padding-top: 6px; min-width: 280px; }
</style>
</head>
<body>
  <header><h1>${escapeHtml(doc.clinicName)}</h1></header>
  <div class="meta">
    <div><strong>Paciente:</strong> ${escapeHtml(doc.patient)}<br><strong>Tutor:</strong> ${escapeHtml(doc.owner)}</div>
    <div>${escapeHtml(doc.date)}</div>
  </div>
  <h2>${escapeHtml(doc.title)}</h2>
  <div class="body">${escapeHtml(doc.body)}</div>
  <div class="sign"><span>${escapeHtml(doc.signature || 'Médico(a)-veterinário(a) responsável')}</span></div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
  win.document.close();
}
