// Função para gerar PDF a partir do conteúdo HTML
export const generatePdfFromHtml = async (htmlContent) => {
  try {
    // Abrir uma nova janela para impressão
    const printWindow = window.open('', '_blank');
    
    // Escrever o conteúdo HTML na nova janela com estilos melhorados para markdown
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>CredAnalyzer - Relatório</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            margin: 20px; 
          }
          h1, h2, h3, h4, h5, h6 { 
            color: #2c3e50; 
            margin-top: 1.5em;
            margin-bottom: 0.5em;
          }
          h1 { font-size: 2em; }
          h2 { font-size: 1.75em; }
          h3 { font-size: 1.5em; }
          h4 { font-size: 1.25em; }
          blockquote {
            border-left: 4px solid #ddd;
            margin-left: 0;
            padding-left: 1em;
            color: #666;
          }
          pre {
            background-color: #f5f5f5;
            padding: 1em;
            border-radius: 4px;
            overflow-x: auto;
          }
          code {
            background-color: #f5f5f5;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: monospace;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 1em 0;
          }
          table, th, td {
            border: 1px solid #ddd;
          }
          th, td {
            padding: 0.5em;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
          }
          ul, ol {
            padding-left: 2em;
          }
          img {
            max-width: 100%;
            height: auto;
          }
          .report-header { 
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
          }
          .timestamp {
            font-size: 0.8rem;
            color: #666;
            margin-bottom: 20px;
          }
          @media print {
            @page { 
              size: A4; 
              margin: 2cm; 
            }
            body { 
              font-size: 12pt; 
            }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>Relatório de Análise Financeira</h1>
          <p>CredAnalyzer</p>
          <div class="timestamp">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
        </div>
        <div class="report-content">
          ${htmlContent}
        </div>
      </body>
      </html>
    `);
    
    // Finalizar o documento
    printWindow.document.close();
    
    // Esperar um momento para que o conteúdo seja renderizado completamente
    setTimeout(() => {
      // Acionar a impressão quando o conteúdo tiver sido carregado
      printWindow.focus();
      printWindow.print();
      
      // Não feche a janela após a impressão para permitir que o usuário faça download do PDF
    }, 500);
    
    return null;
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return null;
  }
}; 