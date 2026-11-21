const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../utils/middleware');
const { montarStudio } = require('../utils/studioHelper');
const router = express.Router();

/*
    Todas as telas abaixo exigem sessão autenticada.
    Se não houver usuário logado, `requireAuth` redireciona para /login.
*/
router.use(requireAuth);

router.get('/', async (req, res) => {
    try {
        const studio = await montarStudio(req.session.user.id);
        res.render('index', { studio });
    } catch (erro) {
        console.error('Erro ao montar studio:', erro);
        res.status(500).send('Erro ao carregar dados do usuário.');
    }
});

router.get('/flashcards', async (req, res) => {
    try {
        const userId = req.session.user.id;
        const studio = await montarStudio(userId);

        // 1. Busca todos os decks do usuário
        const decksRes = await db.query(
            "SELECT id, title, content, metadata FROM study_items WHERE user_id = $1 AND type = 'deck' ORDER BY id",
            [userId]
        );

        // 2. Busca todos os flashcards desses decks
        const cardsRes = await db.query(
            "SELECT id, parent_id, title AS front, content AS back FROM study_items WHERE user_id = $1 AND type = 'flashcard'",
            [userId]
        );

        // 3. Monta a estrutura que o flashcards.ejs espera: { decks: [{ id, name, description, color, cards: [] }] }
        const decks = decksRes.rows.map((deck) => ({
            id: deck.id,
            name: deck.title,
            description: deck.content,
            color: (deck.metadata && deck.metadata.color) || '#5b6cff',
            cards: cardsRes.rows
                .filter((c) => c.parent_id === deck.id)
                .map((c) => ({ id: c.id, front: c.front, back: c.back }))
        }));

        // Se quiser testar, descomente o console.log abaixo e veja no terminal:
        // console.log(JSON.stringify(decks, null, 2));

        res.render('flashcards', {
            studio,
            pageData: {
                decks,
                deckAtual: decks[0] ? decks[0].id : null
            }
        });
    } catch (erro) {
        console.error('Erro ao carregar flashcards:', erro);
        res.status(500).send('Erro ao carregar flashcards.');
    }
});

/*router.get('/flashcards', (req, res) => {
    res.render('flashcards', {
        pageData: {
            deckAtual: 'teste',
            decks: [
                {
                    id: 'teste',
                    name: 'Meu deck de teste',
                    description: 'Cartas que eu mesmo cadastrei.',
                    color: '#5b6cff',
                    cards: [
                        { id: 1, front: 'Capital da França?', back: 'Paris' },
                        { id: 2, front: '2 + 2', back: '4' },
                        { id: 3, front: 'Quem pintou a Mona Lisa?', back: 'Leonardo da Vinci' }
                    ]
                }
            ]
        }
    });
});
*/

router.get('/palavras', (req, res) => {
    res.render('palavras');
});

router.get('/ranking', (req, res) => {
    res.render('ranking');
});

router.get('/perfil', (req, res) => {
    res.redirect('/'); // TODO: tela de perfil
});

module.exports = router;