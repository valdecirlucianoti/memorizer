const express = require('express');
const db = require('../config/database');
const { requireAuth, requirePerfil } = require('../utils/middleware');

const router = express.Router();

/*
    Todas as rotas abaixo exigem que o usuário esteja autenticado na sessão.
    Se não estiver logado, o middleware devolve HTTP 401 em JSON.
*/
router.use(requireAuth);

router.post('/eventos', async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { tipo, delta, modo, motivo, payload } = req.body;

        if (!tipo) {
            return res.status(400).json({ erro: 'Informe o tipo do evento.' });
        }

        await db.query(`
            INSERT INTO events (user_id, event_type, points_delta, metadata)
            VALUES ($1, $2, $3, $4)
        `, [
            userId, 
            tipo, 
            delta || 0, 
            JSON.stringify({ modo, motivo, ...(payload || {}) })
        ]);

        // Se o evento é de sessão, cria uma study_session
        if (modo === 'flashcards' || modo === 'words') {
            await db.query(`
                INSERT INTO study_sessions (user_id, method_id, score, metadata)
                SELECT $1, lm.id, $2, $3
                FROM learning_methods lm
                WHERE lm.slug = $4
            `, [userId, delta || 0, JSON.stringify({ motivo }), modo]);
        }

        return res.sendStatus(204);
    } catch (erro) {
        console.error('Erro em POST /api/eventos:', erro);
        return res.status(500).json({ erro: 'Erro ao registrar evento.' });
    }
});

// Criar um novo deck
router.post('/decks', async (req, res) => {
    try {
        const { id: userId } = req.session.user;
        const title = req.body.name ? String(req.body.name).trim() : '';
        const content = req.body.description ? String(req.body.description).trim() : '';
        const color = req.body.color || '#5b6cff'; // Cor padrão se não vier

        if (!title) {
            return res.status(400).json({ erro: 'Informe o título do deck.' });
        }

        // Insere um novo deck na tabela study_items (type='deck')
        const novoDeck = await db.query(`
            INSERT INTO study_items (user_id, type, title, content, metadata)
            VALUES ($1, 'deck', $2, $3, $4)
            RETURNING id, title, content, metadata
        `, [userId, title, content, JSON.stringify({ color })]);

        const deck = novoDeck.rows[0];
        return res.status(201).json({
            id: deck.id,
            name: deck.title,
            description: deck.content,
            color: deck.metadata && deck.metadata.color ? deck.metadata.color : '#5b6cff',
            cards: []
        });
    } catch (erro) {
        console.error('Erro em POST /api/decks:', erro);
        return res.status(500).json({ erro: 'Erro ao criar deck.' });
    }
});

// salvarCartao() em views/flashcards.ejs
router.post('/decks/:deckId/cartoes', async (req, res) => {
    try {
        const { id: userId, perfil } = req.session.user;
        const { deckId } = req.params;
        const front = req.body.front ? String(req.body.front).trim() : '';
        const back = req.body.back ? String(req.body.back).trim() : '';

        if (!front || !back) {
            return res.status(400).json({ erro: 'Informe a frente e o verso do cartão.' });
        }

        // 1. Verifica se o deck existe e pertence ao usuário
        const resDeck = await db.query(
            "SELECT id, user_id FROM study_items WHERE id = $1 AND type = 'deck'",
            [deckId]
        );
        const deck = resDeck.rows[0];
        if (!deck) {
            return res.status(404).json({ erro: 'Deck não encontrado.' });
        }
        if (deck.user_id !== userId && perfil !== 'admin') {
            return res.status(403).json({ erro: 'Sem permissão para alterar este deck.' });
        }

        // 2. Insere o cartão na tabela study_items (type='flashcard')
        const novoCartao = await db.query(`
            INSERT INTO study_items (user_id, parent_id, type, title, content)
            VALUES ($1, $2, 'flashcard', $3, $4)
            RETURNING id, title AS front, content AS back
        `, [userId, deckId, front, back]);

        return res.status(201).json(novoCartao.rows[0]);
    } catch (erro) {
        console.error('Erro em POST /api/decks/:deckId/cartoes:', erro);
        return res.status(500).json({ erro: 'Erro ao salvar cartão.' });
    }
});

// validarPalavra() em views/palavras.ejs
// Resposta esperada: { ok: true, palavra } ou { ok: false, motivo }
router.get('/palavras/validar', async (req, res) => {
    try {
        const letra = req.query.letra ? String(req.query.letra).trim().toLowerCase() : '';
        const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';

        if (!letra || !q) {
            return res.status(400).json({ ok: false, motivo: 'Informe a letra e a palavra.' });
        }

        // TODO: consultar o dicionário no banco ou serviço
        return res.json({ ok: true, palavra: q });
    } catch (erro) {
        console.error('Erro em GET /api/palavras/validar:', erro);
        return res.status(500).json({ ok: false, motivo: 'Erro ao validar palavra.' });
    }
});

// salvarPartida() em views/palavras.ejs
router.post('/palavras/partidas', async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { pontuacao, acertos, duracaoMs } = req.body;

        // TODO: gravar a rodada e atualizar o recorde do usuário `userId` no banco
        // await db.query(
        //     'INSERT INTO partidas_palavras (user_id, pontuacao, acertos, duracao_ms) VALUES ($1, $2, $3, $4)',
        //     [userId, pontuacao || 0, acertos || 0, duracaoMs || 0]
        // );

        return res.sendStatus(204);
    } catch (erro) {
        console.error('Erro em POST /api/palavras/partidas:', erro);
        return res.status(500).json({ erro: 'Erro ao salvar partida.' });
    }
});

/*
    Exemplo de rota futura exclusiva para perfis com acesso a módulos extras
    (ex.: VIP 2, promocionais liberados ou Master Admin).
*/
router.get('/treinos-avancados', requirePerfil('vip2'), (req, res) => {
    return res.json({
        ok: true,
        perfil: req.session.user.perfil,
        modulos: ['simulacao-rapida', 'revisao-espacada-intensiva']
    });
});

module.exports = router;