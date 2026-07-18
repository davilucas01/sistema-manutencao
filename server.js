// Link direto da implantação do seu Google Apps Script atualizado
const API_URL = "https://script.google.com/macros/s/AKfycbyxnZn0iUjs1j7ppPvCn6V7EHsQC5O3lKzhT3WUucx9bhAdBX_xFEfaupvAr4bPXrYH-A/exec";

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

    // Mantém as seções visíveis e fixas dependendo do acesso
    if (mat === "0000" || mat.toLowerCase() === "admin") {
        document.getElementById("supervisor-section").classList.remove("hidden");
        inicializarDashboard();
        
        // Atualiza o painel a cada 10 segundos buscando o que está salvo no banco do Sheets
        setInterval(carregarDadosDashboard, 10000);
    } else {
        document.getElementById("operador-section").classList.remove("hidden");
    }
}

async function inicializarDashboard() {
    await carregarDadosDashboard();
}

// Busca o histórico fixo do Google Sheets para montar a tela do Supervisor
async function carregarDadosDashboard() {
    try {
        // Para ler os dados de forma limpa sem bloqueio de CORS na leitura
        const response = await fetch(API_URL);
        const res = await response.json();
        
        if (res.success) {
            atualizarInterfaceSupervisor(res.data);
        }
    } catch (err) {
        console.error("Erro ao puxar dados estáveis do Sheets: ", err);
    }
}

// Renderiza tudo na tela do Supervisor e deixa fixo na tabela
function atualizarInterfaceSupervisor(data) {
    document.getElementById("card-enviados").innerText = data.metricas.totalEnviados;
    document.getElementById("card-pendentes").innerText = data.metricas.totalNaoEnviados;
    document.getElementById("card-operadores").innerText = data.metricas.quantidadeOperadores;

    // Atualiza a lista de quem enviou
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

    // Alimenta a tabela de Solução de Problemas / Livro de Ocorrências com o banco de dados
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

    // Renderiza ou Atualiza o Gráfico
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

// Grava a atividade direto no Sheets (Livro de Ocorrência) e limpa o form sem deslogar
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
        // Envio direto via no-cors. Removemos os headers de Content-Type para evitar bloqueios do navegador.
        await fetch(API_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(payload)
        });
        
        alert("Dados gravados com sucesso no banco de dados do Google Sheets!");
        document.getElementById("form-ocorrencia").reset();
        
        // Se for uma conta admin/supervisor, atualiza a tabela local imediatamente
        if (usuarioMatricula === "0000" || usuarioMatricula.toLowerCase() === "admin") {
            carregarDadosDashboard();
        }
    } catch (err) {
        alert("Erro ao enviar dados para a nuvem.");
        console.error(err);
    }
}