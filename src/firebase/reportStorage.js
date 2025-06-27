import { doc, setDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';

// Função para salvar relatório no Firestore
export const saveReport = async (userId, userName, planningData, analysisFiles, reportContent, reportIdentifier = null) => {
  try {
    console.log(`Tentando salvar relatório com identificador: ${reportIdentifier}`);
    console.log(`Dados do usuário: ${userId}, ${userName}`);
    console.log(`Tamanho do conteúdo: ${reportContent?.length || 0} caracteres`);
    
    let isDuplicado = false;
    
    try {
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
            isDuplicado = true;
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
          where('usuarioId', '==', userId)
        );
        
        const querySnapshot = await getDocs(q);
        let relatorioDuplicado = false;
        
        querySnapshot.forEach(doc => {
          const dados = doc.data();
          // Verificar só os relatórios recentes com conteúdo idêntico
          if (dados.conteudoRelatorio === reportContent) {
            // Verificar se tem timestamp e se é recente
            let isRecente = false;
            
            if (dados.timestamp && typeof dados.timestamp.toMillis === 'function') {
              // Usar o método toMillis do Timestamp do Firestore
              isRecente = dados.timestamp.toMillis() > cincoMinutosAtras.getTime();
            } else if (dados.dataCriacao) {
              // Usar a data de criação como fallback
              const dataCriacaoMs = new Date(dados.dataCriacao).getTime();
              isRecente = dataCriacaoMs > cincoMinutosAtras.getTime();
            } else {
              // Se não tem nenhuma data, assumir que é recente
              isRecente = true;
            }
            
            if (isRecente) {
              relatorioDuplicado = true;
              console.log("Relatório com conteúdo idêntico encontrado (últimos 5 min), não será salvo novamente");
            }
          }
        });
        
        if (relatorioDuplicado) {
          isDuplicado = true;
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
    } catch (err) {
      console.error("Erro nas verificações iniciais, continuando com o salvamento:", err);
      // Se houver erro nas verificações, continuar com o salvamento
    }
    
    // Se identificador contém "force", ignorar verificações de duplicidade
    if (reportIdentifier && reportIdentifier.includes("force")) {
      console.log("Identificador contém 'force', ignorando verificações de duplicidade");
      isDuplicado = false;
    }
    
    // Se foi identificado como duplicado pelas verificações, retornar sucesso
    if (isDuplicado) {
      return { 
        success: true, 
        reportId: "existente", 
        alreadyExists: true 
      };
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
    
    console.log("Tentando salvar no Firestore com ID gerado automaticamente");
    
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