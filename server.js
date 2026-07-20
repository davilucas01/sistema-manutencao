// =================================================================
// 1. CONFIGURAÇÃO DAS URLS (PIPEDREAM MANTIDO)
// =================================================================
function obterUrlServidor() {
    // Sua URL original do Pipedream mantida exatamente como você enviou
    return "https://eopthfj60z574hn.m.pipedream.net";
}

// Variável global para gerenciar o gráfico (Evita erro de Canvas em uso)
window.meuGrafico = null;
// Variável global para armazenar o cache em memória
window.dadosTratadosDashboard = [];
// Armazena o ID do intervalo de atualização para poder limpá-lo
let temporizadorSincronizacao = null;

// =================================================================
// 2. CONTROLE DE TELAS E FLUXO DO DASHBOARD
// =================================================================
function mudarTela(idTela) {
    document.querySelectorAll('.tela').forEach(tela => tela.classList.remove('ativa'));
    
    const telaAlvo = document.getElementById(idTela);
    if (telaAlvo) telaAlvo.classList.add('ativa');

    // Se entrou na tela do Dashboard/Supervisor, liga a atualização em tempo real
    if (idTela === 'telaDashboard') {
        // AJUSTE DO SISTEMA: Puxa o que já estava salvo no computador antes de ir na rede
        const dadosSalvos = localStorage.getItem("cache_dados_supervisor");
        if (dadosSalvos) {
            window.dadosTratadosDashboard = JSON.parse(dadosSalvos);
            atualizarGrafico(window.dadosTratadosDashboard);
        }

        carregarDadosDashboard(); // Puxa dados novos do Pipedream
        
        if (temporizadorSincronizacao) clearInterval(temporizadorSincronizacao);
        
        // Mantém a sincronização de fundo a cada 15 segundos
        temporizadorSincronizacao = setInterval(carregarDadosDashboard, 15000);
    } else {
        if (temporizadorSincronizacao) {
            clearInterval(temporizadorSincronizacao);
            temporizadorSincronizacao = null;
        }
    }
}

// Busca os dados consolidados do servidor (Pipedream/Excel)
function carregarDadosDashboard() {
    const url = obterUrlServidor();
    if (!url || url.includes("SUA_URL_DO_PIPEDREAM_AQUI")) return;

    fetch(url)
    .then(res => {
        if (!res.ok) throw new Error('Falha na resposta do servidor');
        return res.json();
    })
    .then(dados => {
        if (Array.isArray(dados) && dados.length > 0) {
            window.dadosTratadosDashboard = dados; 
            
            // CORREÇÃO INTERNA: Salva permanentemente no navegador do supervisor para não sumir ao desligar
            localStorage.setItem("cache_dados_supervisor", JSON.stringify(dados));
            
            atualizarGrafico(dados);               
            
            const inputBusca = document.getElementById("inputBuscaTag");
            if (inputBusca && inputBusca.value.trim() !== "") {
                buscarSolucoesPorTag(inputBusca.value);
            }
        }
    })
    .catch(err => {
        console.error("Erro na rede ao puxar dados do Pipedream. Usando cache local:", err);
        // Se a rede falhar ou o computador for ligado offline, mantém os dados salvos na tela
        const dadosSalvos = localStorage.getItem("cache_dados_supervisor");
        if (dadosSalvos) {
            window.dadosTratadosDashboard = JSON.parse(dadosSalvos);
            atualizarGrafico(window.dadosTratadosDashboard);
        }
    });
}

// =================================================================
// 3. RENDERIZAÇÃO DO GRÁFICO (CHART.JS)
// =================================================================
function atualizarGrafico(dados) {
    const ctx = document.getElementById("canvasGrafico")?.getContext("2d");
    if (!ctx) return;

    if (window.meuGrafico instanceof Chart) {
        window.meuGrafico.destroy();
    }

    const contagem = { preventiva: 0, programacao_semanal: 0, livro_ocorrencia: 0 };
    dados.forEach(item => {
        if (contagem[item.tipoTabela] !== undefined) {
            contagem[item.tipoTabela]++;
        }
    });

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

    const tagTratada = tagBusca.trim().toUpperCase();
    if (!tagTratada) return;

    let dados = window.dadosTratadosDashboard || [];
    if (dados.length === 0) {
        const dadosSalvos = localStorage.getItem("cache_dados_supervisor");
        if (dadosSalvos) dados = JSON.parse(dadosSalvos);
    }

    // Filtra apenas o livro de ocorrência da TAG pesquisada
    const resultados = dados.filter(item => 
        item.tipoTabela === 'livro_ocorrencia' && 
        item.tag && 
        item.tag.trim().toUpperCase() === tagTratada
    );

    corpoTabela.innerHTML = "";

    if (resultados.length === 0) {
        corpoTabela.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #6b7280;">Nenhuma ocorrência registrada para esta TAG.</td></tr>`;
        return;
    }

    // Injeta as linhas mantendo o histórico salvo com Falha, Causa, Solução e o Executante solicitado
    resultados.forEach(item => {
        const linhaHTML = `
            <tr>
                <td>${item.data ? formatarData(item.data) : '-'}</td>
                <td style="font-weight: 600; color: #dc2626;">${item.falha || 'Não informada'}</td>
                <td>${item.causa || 'Não informada'}</td>
                <td style="font-weight: 600; color: #16a34a;">${item.solucao || 'Em andamento'}</td>
                <td><strong>${item.executante || item.nome || 'Não informado'}</strong></td>
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
    
    if (!url || url.includes("SUA_URL_DO_PIPEDREAM_AQUI")) {
        console.warn("URL do Pipedream não configurada. Salvando localmente.");
        salvarDadosLocais(dados, tipoTabela);
        return;
    }

    const payload = { ...dados, tipoTabela: tipoTabela };

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(res => {
        if (!res.ok) throw new Error("Erro na gravação do servidor.");
        console.log(`Dados enviados com sucesso para o Pipedream: ${tipoTabela}`);
        limparFormularioAtual(tipoTabela);
        // Atualiza imediatamente o painel do supervisor após o envio do operador
        carregarDadosDashboard();
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

function sincronizarDadosPendentes() {
    let fila = JSON.parse(localStorage.getItem("fila_sincronizacao")) || [];
    if (fila.length === 0) return;

    const url = obterUrlServidor();
    if (!url || url.includes("SUA_URL_DO_PIPEDREAM_AQUI")) return;

    const item = fila[0];
    const payload = { ...item.dados, tipoTabela: item.tipoTabela };

    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(res => {
        if (!res.ok) throw new Error("Ainda indisponível.");
        fila.shift();
        localStorage.setItem("fila_sincronizacao", JSON.stringify(fila));
        console.log("Item sincronizado e removido da fila.");
    })
    .catch(err => console.error("Servidor ainda offline. Mantendo na fila.", err));
}

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