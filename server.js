 const express = require('express');
const cors = require('cors');
const ExcelJS = require('exceljs');
const path = require('path');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());

// PORTA DINÂMICA: Usa a porta que a Vercel definir ou 3000 localmente
const PORT = process.env.PORT || 3000;

// IMPORTANTE: Ajuste do FILE_PATH para funcionar dentro da Vercel.
// Como o arquivo .xlsx está na mesma pasta que você vai arrastar, 
// usamos o path.join para achar o arquivo de forma segura na nuvem.
const FILE_PATH = path.join(__dirname, 'Manutencao_Katoen_Natie.xlsx');

// Rota amigável para teste rápido no navegador
app.get('/', (req, res) => {
    const hostname = os.hostname();
    res.send(`
        <div style="font-family: 'Segoe UI', sans-serif; text-align: center; margin-top: 10%; color: #333;">
            <h1 style="color: #2b7a78;">🚀 Servidor Katoen Natie Conectado!</h1>
            <p style="font-size: 1.2em;">A conexão com a nuvem Vercel foi realizada com sucesso.</p>
            <div style="display: inline-block; background: #e0f2f1; padding: 15px 25px; border-radius: 8px; margin-top: 20px;">
                <strong>Status do Servidor:</strong> <span style="color: #00796b;">Ativo & Operando na nuvem</span>
            </div>
        </div>
    `);
});

// ROTA PARA SALVAR OS DADOS DOS FORMULÁRIOS
app.post('/salvar', async (req, res) => {
    const dados = req.body;
    const workbook = new ExcelJS.Workbook();

    try {
        await workbook.xlsx.readFile(FILE_PATH);
    } catch (error) {
        console.error("Erro ao ler o arquivo no salvamento:", error);
        return res.status(500).json({ erro: 'Arquivo Excel não encontrado ou inacessível.' });
    }

    let buscaAba = '';
    let novosDados = [];

    if (dados.tipoTabela === 'preventiva') {
        buscaAba = 'preventiva';
        novosDados = [
            dados.ordem, dados.data, dados.tag, dados.executantes,
            dados.especialidade, dados.componente, dados.status, dados.observacoes
        ];
    } else if (dados.tipoTabela === 'programacao_semanal') {
        buscaAba = 'programação semanal';
        novosDados = [
            dados.tag, dados.ordem, dados.tarefa, dados.dataInicio,
            dados.dataTermino, dados.status, dados.observacoes
        ];
    } else if (dados.tipoTabela === 'livro_ocorrencia') {
        buscaAba = 'livro de ocorrência';
        novosDados = [
            dados.tag, dados.data, dados.falha, dados.causa,
            dados.solucao, dados.tecnicos, dados.observacoes
        ];
    }

    const worksheet = workbook.worksheets.find(ws => 
        ws.name.toLowerCase().trim() === buscaAba
    );

    if (!worksheet) {
        return res.status(400).json({ erro: `Aba para "${buscaAba}" não encontrada.` });
    }

    let linhaDestino = 5; 
    while (true) {
        const celula = worksheet.getCell(`A${linhaDestino}`);
        if (!celula.value || celula.text.trim() === '') {
            break;
        }
        linhaDestino++;
    }

    const novaLinha = worksheet.getRow(linhaDestino);
    novaLinha.values = novosDados;
    
    novaLinha.eachCell((cell) => {
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
        cell.font = { name: 'Segoe UI', size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    try {
        await workbook.xlsx.writeFile(FILE_PATH);
        console.log(`[SUCESSO] Gravado em "${worksheet.name}" -> LINHA: ${linhaDestino}`);
        res.json({ sucesso: true });
    } catch (error) {
        console.error("Erro ao gravar o arquivo:", error);
        res.status(500).json({ erro: 'Erro ao gravar arquivo no servidor local.' });
    }
});

// ROTA DO DASHBOARD: CONTA APENAS AS LINHAS QUE TÊM TEXTO REAL ESCRITO
app.get('/dados-dashboard', async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(FILE_PATH);
        
        const contarLinhasReais = (nomeAba) => {
            const sheet = workbook.worksheets.find(ws => 
                ws.name.toLowerCase().trim() === nomeAba.toLowerCase().trim()
            );
            if (!sheet) return 0;

            let contagem = 0;
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber >= 5) {
                    const celulaIdentificadora = row.getCell(1);
                    if (celulaIdentificadora.value && celulaIdentificadora.text.trim() !== '') {
                        contagem++;
                    }
                }
            });
            return contagem;
        };

        const dadosDash = {
            preventivas: contarLinhasReais('preventiva'),
            programacoes: contarLinhasReais('programação semanal'),
            ocorrencias: contarLinhasReais('livro de ocorrência')
        };

        res.json(dadosDash);
    } catch (erro) {
        console.error("Erro ao ler dados para o Dashboard:", erro);
        res.json({ preventivas: 0, programacoes: 0, ocorrencias: 0 });
    }
});

// MÉTODOS DE INICIALIZAÇÃO:
// 1. Só escuta na porta local se NÃO estiver rodando no ambiente de produção da Vercel.
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        const hostname = os.hostname();
        console.log(`===================================================================`);
        console.log(` 🚀 SERVIDOR KATOEN NATIE INICIADO COM SUCESSO!`);
        console.log(` Computador Local:  http://localhost:${PORT}`);
        console.log(` Celulares/Tablets: http://${hostname}.local:${PORT}`);
        console.log(`===================================================================`);
    });
}

// 2. EXPORTAÇÃO EXCLUSIVA PARA A VERCEL (Obrigatório para funcionar na Nuvem)
module.exports = app;