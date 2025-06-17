// Função para gerar PDF a partir do conteúdo HTML
export const generatePdfFromHtml = async (htmlContent) => {
  try {
    // Abrir uma nova janela para impressão
    const printWindow = window.open('', '_blank');
    
    // Escrever o conteúdo HTML na nova janela
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
          h1, h2 { color: #2c3e50; }
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
            .no-print {
              display: none;
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
        <div class="no-print">
          <p style="text-align: center; margin-top: 30px;">
            <button onclick="window.print();" style="padding: 10px 20px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Imprimir / Salvar PDF
            </button>
            <button onclick="window.close();" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">
              Fechar
            </button>
          </p>
        </div>
      </body>
      </html>
    `);
    
    // Criar um Blob com o conteúdo HTML para download direto
    const htmlBlob = new Blob([`
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
        h1, h2 { color: #2c3e50; }
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
  `], { type: 'text/html' });
    
    // Finalizar o documento
    printWindow.document.close();
    
    // Retornar o Blob HTML para ser usado no Firebase (não é um PDF real, mas será tratado como um)
    return htmlBlob;
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return null;
  }
}; 