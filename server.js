 const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ==================================================================
// COLE A URL DO SEU GOOGLE APPS SCRIPT AQUI DENTRO DAS ASPAS:
const GOOGLE_SCRIPT_URL = 'SUA_URL_DO_APPS_SCRIPT_AQUI';
// ==================================================================

// Rota amigável para teste rápido no navegador
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: 'Segoe UI', sans-serif; text-align: center; margin-top: 10%; color: #333;">
            <h1 style="color: #2b7a78;">🚀 Servidor Cloud Katoen Natie Conectado!</h1>
            <p style="font-size: 1.2em;">A conexão com a nuvem Vercel foi realizada com sucesso.</p>
            <div style="display: inline-block; background: #e0f2f1; padding: 15px 25px; border-radius: 8px; margin-top: 20px;">
                <strong>Status do Banco:</strong> <span style="color: #00796b;">Ativo & Redirecionando para o Google Sheets</span>
            </div>
        </div>
    `);
});

// ROTA PARA SALVAR OS DADOS DOS FORMULÁRIOS NO GOOGLE SHEETS via Apps Script
app.post('/salvar', async (req, res) => {
    const dados = req.body;

    try {
        // Envia os dados recebidos do celular diretamente para o seu Google Apps Script
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });

        const resultado = await response.json();

        if (resultado.sucesso || resultado.status === 'success') {
            console.log(`[SUCESSO] Dados enviados e salvos no Google Sheets via Apps Script!`);
            return res.json({ sucesso: true });
        } else {
            throw new Error(resultado.mensagem || 'Erro retornado pelo script do Google');
        }

    } catch (error) {
        console.error("Erro ao enviar dados para o Google Sheets:", error);
        res.status(500).json({ erro: 'Erro ao conectar ou gravar dados na planilha do Google.' });
    }
});

// ROTA DO DASHBOARD: BUSCA AS QUANTIDADES DE LINHAS DIRETAMENTE DO SCRIPT
app.get('/dados-dashboard', async (req, res) => {
    try {
        // Faz uma requisição GET para o seu Apps Script obter as contagens das abas
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=dashboard`);
        const dadosDash = await response.json();

        res.json({
            preventivas: dadosDash.preventivas || 0,
            programacoes: dadosDash.programacoes || 0,
            ocorrencias: dadosDash.ocorrencias || 0
        });
    } catch (erro) {
        console.error("Erro ao ler dados do Dashboard no Google Sheets:", erro);
        res.json({ preventivas: 0, programacoes: 0, ocorrencias: 0 });
    }
});

// Inicialização local (para testes se necessário)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        const hostname = os.hostname();
        console.log(`===================================================================`);
        console.log(` 🚀 SERVIDOR CLOUD INICIADO LOCALMENTE!`);
        console.log(` http://localhost:${PORT}`);
        console.log(`===================================================================`);
    });
}

module.exports = app;