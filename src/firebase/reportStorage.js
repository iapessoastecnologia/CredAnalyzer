import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

// Função para salvar relatório no Firestore
export const saveReport = async (userId, userName, planningData, analysisFiles, reportContent) => {
  try {
    // Preparar os dados de planejamento
    const planejamentoInicial = {
      segmentoEmpresa: planningData.segment,
      objetivoCredito: planningData.objective,
      valorCreditoBuscado: planningData.creditAmount,
      tempoEmpresa: planningData.timeInCompany
    };
    
    // Se houver campos personalizados, adicioná-los
    if (planningData.segment === 'Outro' && planningData.otherSegment) {
      planejamentoInicial.segmentoEmpresa = planningData.otherSegment;
    }
    
    if (planningData.objective === 'Outro' && planningData.otherObjective) {
      planejamentoInicial.objetivoCredito = planningData.otherObjective;
    }
    
    // Preparar informações sobre documentos enviados
    const documentosEnviados = {};
    
    if (analysisFiles && Object.keys(analysisFiles).length > 0) {
      Object.entries(analysisFiles).forEach(([key, file]) => {
        if (file) {
          // Usar os nomes corretos dos documentos
          const nomesDocumentos = {
            incomeTax: 'Imposto de Renda',
            registration: 'Registro',
            taxStatus: 'Situação Fiscal',
            taxBilling: 'Faturamento Fiscal',
            managementBilling: 'Faturamento Gerencial'
          };
          
          // Salvar apenas o nome do arquivo e tipo, já que não podemos usar o Storage
          documentosEnviados[nomesDocumentos[key] || key] = {
            nome: file.name,
            tipo: file.type,
            tamanho: file.size,
            dataEnvio: new Date().toISOString()
          };
        }
      });
    }
    
    // Criar o documento no Firestore
    const reportData = {
      usuarioId: userId,
      nomeUsuario: userName,
      planejamentoInicial,
      documentosEnviados,
      conteudoRelatorio: reportContent, // Salvar o conteúdo como texto
      timestamp: serverTimestamp()
    };
    
    // Salvar no Firestore com ID gerado automaticamente
    const reportsCollection = collection(db, 'relatorios');
    const newReportRef = doc(reportsCollection);
    await setDoc(newReportRef, reportData);
    
    console.log("Relatório salvo com sucesso no Firestore:", newReportRef.id);
    return { success: true, reportId: newReportRef.id };
  } catch (error) {
    console.error("Erro ao salvar relatório:", error);
    return { success: false, error: error.message };
  }
}; 