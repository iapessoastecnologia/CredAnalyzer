import { doc, setDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';

// Função para salvar relatório no Firestore
export const saveReport = async (userId, userName, planningData, analysisFiles, reportContent, reportIdentifier = null) => {
  try {
    console.log(`Tentando salvar relatório com identificador: ${reportIdentifier}`);
    
    // Verificar se já existe um relatório com este identificador (se fornecido)
    if (reportIdentifier) {
      try {
        const relatoriosRef = collection(db, 'relatorios');
        const q = query(
          relatoriosRef, 
          where('identificadorRelatorio', '==', reportIdentifier)
        );
        
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          console.log("Relatório com este identificador já existe, não será salvo novamente");
          return { 
            success: true, 
            reportId: querySnapshot.docs[0].id, 
            alreadyExists: true 
          };
        }
      } catch (error) {
        console.error("Erro ao verificar existência do relatório:", error);
        // Continuar com o salvamento mesmo que a verificação falhe
      }
    }
    
    // Verificar também se há relatórios recentes para este usuário com conteúdo idêntico
    // para evitar duplicações mesmo sem identificador
    try {
      // Limitamos a busca aos últimos 5 minutos para evitar verificações demoradas
      const cincoMinutosAtras = new Date();
      cincoMinutosAtras.setMinutes(cincoMinutosAtras.getMinutes() - 5);
      
      const relatoriosRef = collection(db, 'relatorios');
      const q = query(
        relatoriosRef, 
        where('usuarioId', '==', userId),
        // Não podemos comparar com timestamp do Firestore, então verificamos após a busca
      );
      
      const querySnapshot = await getDocs(q);
      let relatorioDuplicado = false;
      
      querySnapshot.forEach(doc => {
        const dados = doc.data();
        // Verificar só os relatórios recentes
        if (
          dados.conteudoRelatorio === reportContent && 
          (!dados.timestamp || dados.timestamp.toMillis() > cincoMinutosAtras.getTime())
        ) {
          relatorioDuplicado = true;
          console.log("Relatório com conteúdo idêntico encontrado (últimos 5 min), não será salvo novamente");
          return;
        }
      });
      
      if (relatorioDuplicado) {
        return { 
          success: true, 
          reportId: "existente", 
          alreadyExists: true 
        };
      }
    } catch (error) {
      console.error("Erro ao verificar relatórios duplicados:", error);
      // Continuar mesmo que a verificação falhe
    }
    
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
      timestamp: serverTimestamp(),
      identificadorRelatorio: reportIdentifier || `${userId}-${Date.now()}`,
      dataCriacao: new Date().toISOString() // Adicionar data de criação explícita para facilitar consultas
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