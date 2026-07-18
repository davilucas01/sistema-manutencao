// =================================================================
// 1. CONFIGURAÇÃO DA URL (INSIRA SEU LINK DO APPS SCRIPT AQUI)
// =================================================================
function obterUrlServidor() {
    // Substitua o texto abaixo pela URL gerada ao "Implantar" no Google Sheets (/exec)
    return "https://script.google.com/macros/s/AKfycbycXja40BJejgG5k6iuxVgwv4i0vbc7_IFdB4SXitq-QzwUWDog567_ZZI98ZTWJk58cA/exec";
}

// Variável global para gerenciar o gráfico (Evita erro de Canvas em uso)
window.meuGrafico = null;
// Variável global para armazenar o cache de dados vindos do Sheets
window.dadosTratadosDashboard = [];
// Armazena o ID do intervalo de atualização para poder limpá-lo
let temporizadorSincronizacao = null;

// =================================================================
// 2. CONTROLE DE TELAS E FLUXO DO DASHBOARD
// =================================================================
function mudarTela(idTela) {
    // Remove a classe ativa de todas as telas para ocultá-las
    document.querySelectorAll('.tela').forEach(tela => tela.classList.remove('ativa'));
    
    // Ativa a tela que o usuário clicou
    const telaAlvo = document.getElementById(idTela);
    if (telaAlvo) telaAlvo.classList.add('ativa');

    // Se entrou na tela do Dashboard/Supervisor, liga a atualização em tempo real
    if (idTela === 'telaDashboard') {
        carregarDadosDashboard(); // Roda imediatamente
        
        // Evita criar múltiplos loops duplicados se clicar no botão várias vezes
        if (temporizadorSincronizacao) clearInterval(temporizadorSincronizacao);
        
        // Configura o loop para atualizar a cada 15 segundos em background
        temporizadorSincronizacao = setInterval(carregarDadosDashboard, 15000);
    } else {
        // Se saiu do Dashboard, desliga o temporizador para economizar memória e internet
        if (temporizadorSincronizacao) {
            clearInterval(temporizadorSincronizacao);
            temporizadorSincronizacao = null;
        }
    }
}

// Busca os dados consolidados do servidor (Google Sheets)
function carregarDadosDashboard() {
    const url = obterUrlServidor();
    if (!url || url.includes("SUA_URL_DO_GOOGLE_APPS_SCRIPT_AQUI")) return;

    fetch(url)
    .then(res => res.json())
    .then(dados => {
        if (Array.isArray(dados)) {
            window.dadosTratadosDashboard = dados; // Atualiza o cache global
            atualizarGrafico(dados);               // Atualiza o gráfico na tela
            
            // Se o supervisor já estiver com uma TAG digitada na busca, atualiza a tabela na hora
            const tagBusca = document.getElementById("inputBuscaTag")?.value;
            if (tagBusca) {
                buscarSolucoesPorTag(tagBusca);
            }
        }
    })
    .catch(err => console.error("Erro ao puxar atualizações do Sheets:", err));
}

// =================================================================
// 3. RENDERIZAÇÃO DO GRÁFICO (CHART.JS)
// =================================================================
function atualizarGrafico(dados) {
    const ctx = document.getElementById("canvasGrafico")?.getContext("2d");
    if (!ctx) return;

    // CORREÇÃO CRÍTICA: Se o gráfico já existir, destrói a instância antiga para não travar o canvas
    if (window.meuGrafico instanceof Chart) {
        window.meuGrafico.destroy();
    }

    // Consolida e conta quantos registros existem de cada tabela
    const contagem = { preventiva: 0, programacao_semanal: 0, livro_ocorrencia: 0 };
    dados.forEach(item => {
        if (contagem[item.tipoTabela] !== undefined) {
            contagem[item.tipoTabela]++;
        }
    });

    // Gera o novo gráfico atualizado
    window.meuGrafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Preventiva', 'Prog. Semanal', 'Livro de Ocorrência'],
            datasets: [{
                label: 'Registros Executados',
                data: [contagem.preventiva, contagem.programacao_semanal, contagem.livro_ocorrencia],
                backgroundColor: ['#2563eb', '#16a34a', '#dc2626']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// =================================================================
// 4. CONSULTA DE SOLUÇÃO DE PROBLEMAS (HISTÓRICO POR TAG)
// =================================================================
function buscarSolucoesPorTag(tagBusca) {
    const corpoTabela = document.getElementById("corpoTabelaSolucoes");
    if (!corpoTabela) return;

    // CORREÇÃO CRÍTICA: Limpa as linhas antigas antes de renderizar para não acumular/duplicar dados
    corpoTabela.innerHTML = "";

    const dados = window.dadosTratadosDashboard || [];
    const tagTratada = tagBusca.trim().toUpperCase();

    if (!tagTratada) return;

    // Filtra no banco apenas o que for 'livro_ocorrencia' e bater com a TAG pesquisada
    const resultados = dados.filter(item => 
        item.tipoTabela === 'livro_ocorrencia' && 
        item.tag && 
        item.tag.trim().toUpperCase() === tagTratada
    );

    // Se não achar nada, avisa o usuário de forma limpa na tabela
    if (resultados.length === 0) {
        corpoTabela.innerHTML = `<tr><td colspan="4" style="text-align:center; color: #6b7280;">Nenhuma ocorrência registrada para esta TAG.</td></tr>`;
        return;
    }

    // Injeta as linhas tratadas contra valores nulos/vazios
    resultados.forEach(item => {
        const linhaHTML = `
            <tr>
                <td>${item.data ? formatarData(item.data) : '-'}</td>
                <td style="font-weight: 600; color: #dc2626;">${item.falha || 'Não informada'}</td>
                <td>${item.causa || 'Não informada'}</td>
                <td style="font-weight: 600; color: #16a34a;">${item.solucao || 'Em andamento'}</td>
            </tr>
        `;
        corpoTabela.insertAdjacentHTML('beforeend', linhaHTML);
    });
}

// =================================================================
// 5. ENVIO DE FORMULÁRIOS & FILA OFFLINE (LOCALSTORAGE)
// =================================================================
function enviarAoServidor(dados, tipoTabela) {
    const url = obterUrlServidor();
    
    // Se não houver URL configurada, armazena direto no LocalStorage para não perder a informação
    if (!url || url.includes("SUA_URL_DO_GOOGLE_APPS_SCRIPT_AQUI")) {
        console.warn("URL do servidor não configurada. Salvando localmente.");
        salvarDadosLocais(dados, tipoTabela);
        return;
    }

    // Adiciona o tipo da tabela junto aos dados enviados
    const payload = { ...dados, tipoTabela: tipoTabela };

    fetch(url, {
        method: "POST",
        mode: "no-cors", // Evita problemas de CORS diretamente com o Google API
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(() => {
        console.log(`Dados enviados com sucesso: ${tipoTabela}`);
        limparFormularioAtual(tipoTabela);
    })
    .catch(erro => {
        console.error("Erro na rede. Armazenando dados no LocalStorage:", erro);
        salvarDadosLocais(dados, tipoTabela);
    });
}

function salvarDadosLocais(dados, tipoTabela) {
    let fila = JSON.parse(localStorage.getItem("fila_sincronizacao")) || [];
    fila.push({ dados: dados, tipoTabela: tipoTabela, timestamp: new Date().getTime() });
    localStorage.setItem("fila_sincronizacao", JSON.stringify(fila));
}

// Sincroniza o que ficou preso no LocalStorage quando a internet voltar
function sincronizarDadosPendentes() {
    let fila = JSON.parse(localStorage.getItem("fila_sincronizacao")) || [];
    if (fila.length === 0) return;

    const url = obterUrlServidor();
    if (!url || url.includes("SUA_URL_DO_GOOGLE_APPS_SCRIPT_AQUI")) return;

    console.log(`Sincronizando backlog offline (${fila.length} pendentes)...`);
    
    const item = fila[0];
    const payload = { ...item.dados, tipoTabela: item.tipoTabela };

    fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(() => {
        // CORREÇÃO: Remove o item com sucesso apenas APÓS a confirmação do envio para não duplicar
        fila.shift();
        localStorage.setItem("fila_sincronizacao", JSON.stringify(fila));
        console.log("Item sincronizado e removido da fila.");
    })
    .catch(err => console.error("Servidor ainda offline. Mantendo na fila.", err));
}

// Verifica e limpa o banco local offline a cada 30 segundos de forma silenciosa
setInterval(sincronizarDadosPendentes, 30000);

// =================================================================
// 6. FUNÇÕES AUXILIARES / INTERFACE
// =================================================================
function limparFormularioAtual(tipoTabela) {
    if (tipoTabela === 'preventiva') document.getElementById("formPreventiva")?.reset();
    if (tipoTabela === 'programacao_semanal') document.getElementById("formProgramacao")?.reset();
    if (tipoTabela === 'livro_ocorrencia') document.getElementById("formOcorrencia")?.reset();
}

function formatarData(stringData) {
    try {
        const d = new Date(stringData);
        if (isNaN(d.getTime())) return stringData;
        return d.toLocaleDateString('pt-BR');
    } catch {
        return stringData;
    }
}