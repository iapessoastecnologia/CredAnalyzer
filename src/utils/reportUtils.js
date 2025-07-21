// Função para gerar PDF a partir do conteúdo HTML
export const generatePdfFromHtml = async (htmlContent) => {
  try {
    // Definir a variável global que será acessada pelo template
    window.reportContent = htmlContent;
    
    // Abrir o template timbrado em uma nova janela
    const printWindow = window.open('/assets/print-template.html', '_blank');
    
    // Garantir que a janela tenha acesso ao conteúdo do relatório
    if (!printWindow) {
      console.error('Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está ativado.');
      return null;
    }
    
    // Não é necessário chamar window.print() aqui pois o template tem seu próprio botão de impressão
    return null;
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return null;
  }
}; 