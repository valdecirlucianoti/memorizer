function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }

    if (req.path.startsWith('/api') || req.xhr) {
        return res.status(401).json({ erro: 'Sessão expirada ou usuário não autenticado.' });
    }

    return res.redirect('/login');
}

// Exige um ou mais perfis específicos (ex: requirePerfil('vip2'))
function requirePerfil(...perfisPermitidos) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect('/login');
        }

        const { perfil } = req.session.user;

        // Master Admin sempre tem passagem livre
        if (perfil === 'admin' || perfisPermitidos.includes(perfil)) {
            return next();
        }

        if (req.path.startsWith('/api')) {
            return res.status(403).json({ erro: 'Seu perfil não tem acesso a este recurso.' });
        }

        return res.status(403).send('Acesso não autorizado para o seu perfil.');
    };
}

function guestOnly(req, res, next) {
    if (req.session && req.session.user) {
        return res.redirect('/');
    }
    next();
}

// utils/middleware.js

// ... (seu guestOnly e requireAuth existentes)

const db = require('../config/database');

/**
 * Middleware Global: Busca os dados atualizados do usuário logado
 * e injeta na resposta (res.locals) para todas as views EJS.
 */
async function carregarUsuario(req, res, next) {
    // Se não tem usuário na sessão, não faz nada e deixa passar
    if (!req.session.user) {
        res.locals.usuario = null;
        return next();
    }

    try {
        // Busca dados fresquinhos no banco (ex: saldo de pontos, nome atualizado)
        // Aqui eu recomendo buscar o que muda com frequência. 
        // Nome e email já estão na sessão, mas pontos e ranking precisam ser dinâmicos.
        //(SELECT COUNT(*) FROM decks WHERE user_id = users.id) as total_decks
        const result = await db.query(`
            SELECT id, name, email, avatar_color, pontos
                    
            FROM users 
            WHERE id = $1
        `, [req.session.user.id]);

        const userDb = result.rows ? result.rows[0] : result[0];

        // Atualiza a sessão (opcional, mas bom pra manter sincronizado)
        req.session.user.pontos = userDb.pontos; 
        
        // A MÁGICA ACONTECE AQUI:
        // Tudo que vai em res.locals fica disponível globalmente no EJS
        res.locals.usuario = userDb;

    } catch (erro) {
        console.error('Erro ao carregar usuário global:', erro);
        res.locals.usuario = req.session.user; // Fallback para o que tem na sessão
    }

    next();
}

module.exports = {
    guestOnly,
    requireAuth,
    requirePerfil,
    carregarUsuario
};