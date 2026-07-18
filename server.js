// O front-end agora conversa com o seu servidor Node.js (server.js) de forma limpa e segura
const API_DADOS_URL = "/api/dados";
const API_ENVIAR_URL = "/api/ocorrencia";

let usuarioMatricula = "";
let chartInstance = null;

// Função chamada quando o usuário clica em "Entrar"
function verificarAcesso() {
    const inputMatricula = document.getElementById("input-matricula");
    if (!inputMatricula) return;

    const mat = inputMatricula.value.trim();
    if (!mat) return alert("Por favor, digite uma matrícula válida.");
    
    usuarioMatricula = mat;
    document.getElementById("login-section").classList.add("hidden");

    // Define se é supervisor (ex: matrícula 0000 ou admin) ou operador padrão
    if (mat === "0000" || mat.toLowerCase() === "admin") {
        document.getElementById("supervisor-section").classList.remove("hidden");
        inicializarDashboard();
        
        // Executa a função de carregar dados a cada 10 segundos automaticamente
        setInterval(carregarDadosDashboard, 10000);
    } else {
        document.getElementById("operador-section").classList.remove("hidden");
    }
}

async function inicializarDashboard() {
    await carregarDadosDashboard();
}

// Busca os dados atualizados do Google Sheets passando pelo server.js
async function carregarDadosDashboard() {
    try {
        const response = await fetch(API_DADOS_URL);
        const res = await response.json();
        
        if (res.success) {
            atualizarInterfaceSupervisor(res.data);
        }
    } catch (err) {
        console.error("Erro ao sincronizar com o Sheets através do servidor: ", err);
    }
}

// Renderiza os dados recebidos na tela do Supervisor
function atualizarInterfaceSupervisor(data) {
    // 1. Atualiza os cards de contagem
    document.getElementById("card-enviados").innerText = data.metricas.totalEnviados;
    document.getElementById("card-pendentes").innerText = data.metricas.totalNaoEnviados;
    document.getElementById("card-operadores").innerText = data.metricas.quantidadeOperadores;

    // 2. Atualiza a lista de quem enviou
    const listaUl = document.getElementById("lista-quem-enviou");
    if (listaUl) {
        listaUl.innerHTML = "";
        if (data.quemEnviou.length === 0) {
            listaUl.innerHTML = `<li class="py-2 text-gray-500 text-sm text-center">Nenhum envio hoje.</li>`;
        } else {
            data.quemEnviou.forEach(op => {
                listaUl.innerHTML += `<li class="py-2 flex justify-between items-center text-sm">
                    <span class="font-medium text-gray-800">${op.nome}</span>
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${op.matricula}</span>
                </li>`;
            });
        }
    }

    // 3. Atualiza a tabela de Solução de Problemas dinamicamente
    const tbody = document.getElementById("table-solucoes-body");
    if (tbody) {
        tbody.innerHTML = "";
        if (data.solucaoProblemas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">Nenhum problema resolvido até o momento.</td></tr>`;
        } else {
            data.solucaoProblemas.forEach(sol => {
                tbody.innerHTML += `<tr class="hover:bg-gray-50">
                    <td class="p-3 font-semibold text-blue-900">${sol.tag}</td>
                    <td class="p-3">${sol.falha}</td>
                    <td class="p-3">${sol.causa}</td>
                    <td class="p-3 text-green-700 font-medium">${sol.solucao}</td>
                    <td class="p-3 text-gray-600">${sol.operador} (${sol.matricula})</td>
                </tr>`;
            });
        }
    }

    // 4. Renderiza ou Atualiza o Gráfico do Chart.js
    const canvasChart = document.getElementById('chartStatus');
    if (!canvasChart) return;
    
    const ctx = canvasChart.getContext('2d');
    if (chartInstance) {
        chartInstance.data.datasets[0].data = [data.metricas.totalEnviados, data.metricas.totalNaoEnviados];
        chartInstance.update();
    } else {
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Concluídos (OK)', 'Não Enviados / Pendentes'],
                datasets: [{
                    label: 'Volume de Atividades',
                    data: [data.metricas.totalEnviados, data.metricas.totalNaoEnviados],
                    backgroundColor: ['#22c55e', '#eab308'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
            }
        });
    }
}

// Envia os dados do operador para o servidor (que repassa com segurança ao Sheets)
async function enviarOcorrencia(event) {
    event.preventDefault();
    
    const payload = {
        tipo: "ocorrencia",
        matricula: usuarioMatricula,
        nomeOperador: document.getElementById("op-nome").value,
        tag: document.getElementById("op-tag").value,
        falha: document.getElementById("op-falha").value,
        causa: document.getElementById("op-causa").value,
        solucao: document.getElementById("op-solucao").value
    };

    try {
        const response = await fetch(API_ENVIAR_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        const resultado = await response.json();
        
        if (resultado.success) {
            alert("Dados gravados com sucesso no Livro de Ocorrência e Solução de Problemas!");
            document.getElementById("form-ocorrencia").reset();
        } else {
            alert("O servidor respondeu com um erro ao tentar salvar.");
        }
    } catch (err) {
        alert("Erro ao enviar dados para o servidor.");
        console.error(err);
    }
}