const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { guestOnly } = require('../utils/middleware');
const router = express.Router();
const CORES_AVATAR = ['#ff6a3d', '#5b6cff', '#12b886', '#f59f00', '#e64980'];

// Tela de Login
router.get('/login', guestOnly, (req, res) => {
    res.render('login', { erro: null, error: null, email: '' });
});

// Processa Login
router.post('/login', guestOnly, async (req, res) => {
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
    const password = req.body.password ? String(req.body.password) : '';

    if (!email || !password) {
        return res.status(400).render('login', {
            erro: 'Preencha e-mail e senha.',
            error: 'Preencha e-mail e senha.',
            email
        });
    }

    try {
        const result = await db.query(`
            SELECT u.id, u.name, u.email, u.password_hash, u.avatar_color, u.expires_at,
                   p.slug AS perfil, p.nome AS perfil_nome,
                   p.ver_todos_decks, p.acesso_telas_extras
            FROM users u
            JOIN perfis p ON p.id = u.perfil_id
            WHERE LOWER(u.email) = $1 AND p.ativo = TRUE
        `, [email]);

        const user = result.rows ? result.rows[0] : result[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).render('login', {
                erro: 'E-mail ou senha inválidos.',
                error: 'E-mail ou senha inválidos.',
                email
            });
        }

        if (user.expires_at && new Date(user.expires_at) < new Date()) {
            return res.status(403).render('login', {
                erro: 'Seu acesso temporário expirou.',
                error: 'Seu acesso temporário expirou.',
                email
            });
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            avatarColor: user.avatar_color,
            perfil: user.perfil,
            perfilNome: user.perfil_nome,
            verTodosDecks: Boolean(user.ver_todos_decks),
            acessoTelasExtras: Boolean(user.acesso_telas_extras)
        };

        return res.redirect('/');
    } catch (erro) {
        console.error('Erro no login:', erro);
        return res.status(500).render('login', {
            erro: 'Erro interno ao entrar. Tente novamente.',
            error: 'Erro interno ao entrar. Tente novamente.',
            email
        });
    }
});

// Tela de register
router.get('/register', guestOnly, (req, res) => {
    res.render('register', { erro: null, error: null, valores: { name: '', email: '' } });
});

// Processa register (todo novo usuário entra como perfil 'free')
router.post('/register', guestOnly, async (req, res) => {
    const name = req.body.name ? String(req.body.name).trim() : '';
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
    const password = req.body.password ? String(req.body.password) : '';
    const passwordConfirm = req.body.password_confirm ? String(req.body.password_confirm) : '';

    const valores = { name, email };

    if (!name || !email || !password) {
        return res.status(400).render('register', {
            erro: 'Preencha todos os campos obrigatórios.',
            error: 'Preencha todos os campos obrigatórios.',
            valores
        });
    }
    if (password.length < 6) {
        return res.status(400).render('register', {
            erro: 'A senha deve ter pelo menos 6 caracteres.',
            error: 'A senha deve ter pelo menos 6 caracteres.',
            valores
        });
    }
    if (passwordConfirm && password !== passwordConfirm) {
        return res.status(400).render('register', {
            erro: 'As senhas não conferem.',
            error: 'As senhas não conferem.',
            valores
        });
    }

    try {
        const existe = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
        const jaCadastrado = existe.rows ? existe.rows.length > 0 : existe.length > 0;

        if (jaCadastrado) {
            return res.status(409).render('register', {
                erro: 'Este e-mail já está cadastrado.',
                error: 'Este e-mail já está cadastrado.',
                valores
            });
        }

        const resPerfil = await db.query(
            "SELECT id, slug, nome, ver_todos_decks, acesso_telas_extras FROM perfis WHERE slug = 'free' LIMIT 1"
        );
        const perfilFree = resPerfil.rows ? resPerfil.rows[0] : resPerfil[0];

        if (!perfilFree) {
            return res.status(500).render('register', {
                erro: 'Perfil padrão não configurado no banco.',
                error: 'Perfil padrão não configurado no banco.',
                valores
            });
        }

        const hash = await bcrypt.hash(password, 10);
        const cor = CORES_AVATAR[Math.floor(Math.random() * CORES_AVATAR.length)];

        const inserido = await db.query(`
            INSERT INTO users (name, email, password_hash, perfil_id, avatar_color)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, email, avatar_color
        `, [name, email, hash, perfilFree.id, cor]);

        const novoUsuario = inserido.rows ? inserido.rows[0] : inserido[0];

        req.session.user = {
            id: novoUsuario.id,
            name: novoUsuario.name,
            email: novoUsuario.email,
            avatarColor: novoUsuario.avatar_color,
            perfil: perfilFree.slug,
            perfilNome: perfilFree.nome,
            verTodosDecks: Boolean(perfilFree.ver_todos_decks),
            acessoTelasExtras: Boolean(perfilFree.acesso_telas_extras)
        };

        return res.redirect('/');
    } catch (erro) {
        console.error('Erro no register:', erro);
        return res.status(500).render('register', {
            erro: 'Erro interno ao criar conta. Tente novamente.',
            error: 'Erro interno ao criar conta. Tente novamente.',
            valores
        });
    }
});

// Encerra sessão
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

module.exports = router;