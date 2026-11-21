const db = require('../config/database');

/**
 * Monta o objeto `studio` que o front (studio.js) espera.
 * Busca tudo do banco de uma vez (com JOINs) para evitar N+1.
 */
async function montarStudio(userId) {
    // 1. Dados do usuário + pontos
    const userRes = await db.query(`
        SELECT u.id, u.name, u.pontos, u.avatar_color
        FROM users u
        WHERE u.id = $1
    `, [userId]);

    const user = userRes.rows[0];
    if (!user) throw new Error('Usuário não encontrado');

    // 2. Sequência (streak) - vamos calcular com base em eventos recentes
    const streakRes = await db.query(`
        SELECT 
            COUNT(DISTINCT DATE(created_at)) AS dias_ativos,
            ARRAY(
                SELECT DISTINCT EXTRACT(DOW FROM created_at)::int 
                FROM events 
                WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
            ) AS dias_semana
        FROM events
        WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
    `, [userId]);

    const streakData = streakRes.rows[0];
    const diasSemanaAtivos = streakData.dias_semana || [];

    // 3. Ranking (semana, mês, geral) - top 10 + usuário
    const rankingRes = await db.query(`
        WITH ranking_semana AS (
            SELECT u.id, u.name, u.avatar_color,
                   COALESCE(SUM(e.points_delta), 0) AS pontos
            FROM users u
            LEFT JOIN events e ON e.user_id = u.id 
                AND e.created_at >= NOW() - INTERVAL '7 days'
            GROUP BY u.id, u.name, u.avatar_color
        ),
        ranking_mes AS (
            SELECT u.id, u.name, u.avatar_color,
                   COALESCE(SUM(e.points_delta), 0) AS pontos
            FROM users u
            LEFT JOIN events e ON e.user_id = u.id 
                AND e.created_at >= NOW() - INTERVAL '30 days'
            GROUP BY u.id, u.name, u.avatar_color
        ),
        ranking_geral AS (
            SELECT id, name, avatar_color, pontos
            FROM users
        )
        SELECT 'week' AS periodo, id, name, avatar_color, pontos FROM ranking_semana
        UNION ALL
        SELECT 'month', id, name, avatar_color, pontos FROM ranking_mes
        UNION ALL
        SELECT 'all', id, name, avatar_color, pontos FROM ranking_geral
    `);

    const ranking = { week: [], month: [], all: [] };
    rankingRes.rows.forEach((row) => {
        ranking[row.periodo].push({
            id: row.id,
            name: row.name,
            initials: iniciais(row.name),
            color: row.avatar_color,
            me: row.id === userId,
            points: {
                total: Number(row.pontos),
                flashcards: 0, // Pode detalhar depois com SUM FILTER
                words: 0
            }
        });
    });

    // 4. Badges (contagem de decks, cards, etc)
    const badgesRes = await db.query(`
        SELECT 
            COUNT(*) FILTER (WHERE type = 'flashcard') AS flashcards,
            COUNT(*) FILTER (WHERE type = 'deck') AS decks
        FROM study_items
        WHERE user_id = $1
    `, [userId]);

    const badges = badgesRes.rows[0];

    // 5. Meta diária (pode ser fixa ou da tabela users)
    const metaDiaria = 100;
    const pontosHojeRes = await db.query(`
        SELECT COALESCE(SUM(points_delta), 0) AS hoje
        FROM events
        WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE
    `, [userId]);
    const pontosHoje = Number(pontosHojeRes.rows[0].hoje);

    // Monta o objeto final
    const hoje = (new Date().getDay() + 6) % 7;

    return {
        user: {
            name: user.name,
            initials: (user.initials && user.initials.trim()) ? user.initials.trim() : iniciais(user.name),
            color: user.avatar_color
        },
        points: {
            total: user.pontos
        },
        streak: {
            days: streakData.dias_ativos,
            week: Array.from({ length: 7 }, (_, i) => diasSemanaAtivos.includes(i)),
            today: hoje
        },
        goal: {
            target: metaDiaria,
            done: pontosHoje
        },
        badges: {
            flashcards: Number(badges.flashcards) || 0
        },
        ranking
    };
}

function iniciais(nome) {
    const partes = String(nome).trim().split(/\s+/);
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

module.exports = { montarStudio };