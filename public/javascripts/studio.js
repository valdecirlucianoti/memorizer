/* =========================================================
   memorizer — núcleo compartilhado (todas as telas carregam este arquivo)

   DADOS INJETADOS PELA ROTA (res.render('pagina', { studio: {...} })):
   {
     user:    { name, initials, color },
     points:  { total, level?, levelFloor?, levelCeil? },
     streak:  { days, week: [7 booleanos, segunda a domingo], today: 0-6 },
     goal:    { target, done },                      // meta diária em pontos
     badges:  { flashcards: 12 },                    // número ao lado do item do menu
     ranking: { week: [...], month: [...], all: [...] }
              // cada item: { id, name, initials, color, me?, points: { total, flashcards, words } }
   }
   Sem `studio`, o arquivo usa dados de demonstração (e guarda os pontos ganhos
   na sessão do navegador só para a demo parecer viva entre as telas).

   O QUE AS TELAS USAM:
     Studio.addPoints(delta, 'flashcards' | 'words', motivo)   -> soma pontos e atualiza tudo
     Studio.ranking(periodo, modo)                             -> lista ordenada com posição
     Studio.registrar(evento)                                  -> PONTO ÚNICO para salvar no servidor
     Studio.on(fn)                                             -> avisa quando algo muda
     Studio.toast(texto)
========================================================= */

(function () {
    'use strict';

    const TAMANHO_NIVEL = 250; // só na demonstração; com dados reais o servidor manda levelFloor/levelCeil
    const ROTULOS_PERIODO = { week: 'na semana', month: 'no mês', all: 'no geral' };
    const INICIAIS_DIA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

    const $ = (seletor, contexto = document) => contexto.querySelector(seletor);
    const $$ = (seletor, contexto = document) => Array.from(contexto.querySelectorAll(seletor));
    const fmt = (n) => Number(n).toLocaleString('pt-BR');

    const esc = (texto) => String(texto).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    function lerJSON(id) {
        try {
            return JSON.parse(document.getElementById(id).textContent);
        } catch (e) {
            return null;
        }
    }

    function setTexto(seletor, valor) {
        $$(seletor).forEach((el) => { el.textContent = valor; });
    }

    /* ---------- Dados de demonstração ---------- */

    function dadosDemo() {
        const hoje = (new Date().getDay() + 6) % 7; // segunda = 0

        const base = [
            ['Lucas Prado',  'LP', '#5b6cff', 320], ['Marina Reis',   'MR', '#e64980', 298],
            ['João Silva',   'JS', '#12b886', 271], ['Carla Torres',  'CT', '#f59f00', 245],
            ['Pedro Lima',   'PL', '#7950f2', 230], ['Beatriz Nunes', 'BN', '#fa5252', 212],
            ['Rafael Costa', 'RC', '#15aabf', 198], ['Camila Dias',   'CD', '#82c91e', 171],
            ['Felipe Ramos', 'FR', '#fd7e14', 150], ['Júlia Mendes',  'JM', '#868e96', 122]
        ];
        const partilha = [.62, .5, .7, .45, .55, .6, .4, .52, .65, .48];

        const dividir = (total, i) => {
            const flash = Math.round(total * partilha[i]);
            return { total, flashcards: flash, words: total - flash };
        };

        const jogadores = (fator) => base.map(([name, initials, color, semana], i) => ({
            id: `u${i}`, name, initials, color,
            points: dividir(Math.round(semana * fator * (i % 2 ? 0.94 : 1.05)), i)
        }));

        const eu = (total) => {
            const flash = Math.round(total * 0.58);
            return {
                id: 'me', name: 'Alex Souza', initials: 'AS', color: '#ff6a3d', me: true,
                points: { total, flashcards: flash, words: total - flash }
            };
        };

        return {
            user: { name: 'Alex Souza', initials: 'AS', color: '#ff6a3d' },
            points: { total: 1190 },
            streak: { days: hoje + 2, week: Array.from({ length: 7 }, (_, i) => i < hoje), today: hoje },
            goal: { target: 100, done: 64 },
            badges: { flashcards: 12 },
            ranking: {
                week: [...jogadores(1), eu(206)],
                month: [...jogadores(3.6), eu(742)],
                all: [...jogadores(9.5), eu(1190)]
            }
        };
    }

    /* ---------- Estado ---------- */

    const injetado = lerJSON('studioData');
    const demo = !injetado;
    const state = JSON.parse(JSON.stringify(injetado || dadosDemo()));

    state.user = state.user || { name: 'Visitante', initials: 'V', color: '#8f9bb0' };
    state.points = state.points || { total: 0 };
    state.ranking = state.ranking || {};
    state.badges = state.badges || {};
    state.miniPeriodo = 'week';

    (function normalizarNivel() {
        const p = state.points;
        if (p.levelCeil == null || p.levelFloor == null) {
            p.level = Math.floor(p.total / TAMANHO_NIVEL) + 1;
            p.levelFloor = (p.level - 1) * TAMANHO_NIVEL;
            p.levelCeil = p.level * TAMANHO_NIVEL;
        }
        p.level = p.level || 1;
    })();

    function subirNivel() {
        const p = state.points;
        const intervalo = Math.max(1, p.levelCeil - p.levelFloor);
        let subidas = 0;

        while (p.total >= p.levelCeil) {
            p.level++;
            p.levelFloor = p.levelCeil;
            p.levelCeil += intervalo;
            subidas++;
        }
        return subidas;
    }

    function aplicarPontos(delta, modo) {
        state.points.total += delta;
        const subidas = subirNivel();

        Object.values(state.ranking).forEach((lista) => {
            const eu = lista.find((p) => p.me);
            if (!eu) return;
            eu.points.total += delta;
            eu.points[modo] = (eu.points[modo] || 0) + delta;
        });

        if (state.goal) state.goal.done += delta;

        const s = state.streak;
        if (s && !s.week[s.today]) {
            s.week[s.today] = true;
            s.days++;
        }
        return subidas;
    }

    /* Na demonstração, lembra os pontos ganhos para as telas seguintes */
    const CHAVE_DEMO = 'memorizer:demo:pontos';

    function lerDemo() {
        try { return JSON.parse(sessionStorage.getItem(CHAVE_DEMO)) || {}; } catch (e) { return {}; }
    }

    function guardarDemo(delta, modo) {
        try {
            const salvo = lerDemo();
            salvo[modo] = (salvo[modo] || 0) + delta;
            sessionStorage.setItem(CHAVE_DEMO, JSON.stringify(salvo));
        } catch (e) { /* sem armazenamento */ }
    }

    if (demo) {
        const salvo = lerDemo();
        ['flashcards', 'words'].forEach((modo) => { if (salvo[modo]) aplicarPontos(salvo[modo], modo); });
    }

    /* ---------- Ranking ---------- */

    function ranking(periodo = 'week', modo = 'total') {
        const lista = state.ranking[periodo] || [];
        return lista
            .map((p) => ({ ...p, pontos: (p.points && p.points[modo]) || 0 }))
            .sort((a, b) => b.pontos - a.pontos)
            .map((p, i) => ({ ...p, pos: i + 1 }));
    }

    const posicao = (periodo = 'week', modo = 'total') => ranking(periodo, modo).find((p) => p.me) || null;

    /* ---------- Renderização ---------- */

    function renderUsuario() {
        setTexto('[data-user-name]', state.user.name);
        setTexto('[data-user-first]', state.user.name.split(' ')[0]);
        $$('[data-user-avatar]').forEach((el) => {
            el.textContent = state.user.initials;
            el.style.setProperty('--c', state.user.color);
        });
    }

    function renderPontos() {
        const p = state.points;
        const pct = Math.round(((p.total - p.levelFloor) / (p.levelCeil - p.levelFloor)) * 100);

        setTexto('[data-stat="points"]', fmt(p.total));
        setTexto('[data-stat="level"]', p.level);
        setTexto('[data-stat="next"]', `${fmt(p.levelCeil - p.total)} p/ nível ${p.level + 1}`);
        $$('[data-level-ring]').forEach((el) => el.style.setProperty('--p', `${pct}%`));
    }

    function renderSequencia() {
        const s = state.streak;
        if (!s) return;

        setTexto('[data-stat="streak"]', s.days);
        setTexto('[data-streak-days]', s.days);
        setTexto('[data-streak-hint]', s.week[s.today]
            ? 'Você já treinou hoje!'
            : 'Treine hoje para manter a sequência');

        $$('[data-streak-week]').forEach((el) => {
            el.innerHTML = s.week.map((feito, i) => `
                <span class="streak-day ${feito ? 'is-done' : ''} ${i === s.today ? 'is-today' : ''}">
                    <i>${feito ? '<svg class="ic ic-sm"><use href="#i-check"/></svg>' : ''}</i>${INICIAIS_DIA[i]}
                </span>`).join('');
        });
    }

    function linhaRanking(p) {
        return `
            <li class="${p.me ? 'is-me' : ''}">
                <span class="pos">${p.pos}</span>
                <span class="avatar" style="--c:${esc(p.color)}">${esc(p.initials)}</span>
                <span class="name">${esc(p.name)}${p.me ? ' (você)' : ''}</span>
                <strong>${fmt(p.pontos)}</strong>
            </li>`;
    }

    function renderRanking() {
        const eu = posicao(state.miniPeriodo);
        setTexto('[data-stat="rank"]', eu ? `#${eu.pos}` : '#–');
        setTexto('[data-stat="rank-period"]', ROTULOS_PERIODO[state.miniPeriodo]);

        $$('[data-rank-period]').forEach((b) => {
            b.setAttribute('aria-pressed', String(b.dataset.rankPeriod === state.miniPeriodo));
        });

        const lista = ranking(state.miniPeriodo);
        let html = lista.slice(0, 5).map(linhaRanking).join('');
        if (eu && eu.pos > 5) html += `<li class="is-gap" aria-hidden="true">···</li>${linhaRanking(eu)}`;

        $$('[data-rank-mini]').forEach((ul) => { ul.innerHTML = html; });
    }

    function renderBadges() {
        $$('[data-badge]').forEach((el) => {
            const valor = state.badges[el.dataset.badge];
            el.textContent = valor || '';
            el.hidden = !valor;
        });
    }

    function renderTudo() {
        renderUsuario();
        renderPontos();
        renderSequencia();
        renderRanking();
        renderBadges();
    }

    document.addEventListener('click', (e) => {
        const botao = e.target.closest('[data-rank-period]');
        if (!botao) return;
        state.miniPeriodo = botao.dataset.rankPeriod;
        renderRanking();
    });

    /* ---------- Tema claro / escuro ---------- */

    document.addEventListener('click', (e) => {
        if (!e.target.closest('[data-theme-toggle]')) return;

        const html = document.documentElement;
        const novo = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-bs-theme', novo);
        try { localStorage.setItem('memorizer:theme', novo); } catch (err) { /* ignora */ }
    });

    /* ---------- Avisos ---------- */

    function toast(texto, opcoes = {}) {
        const area = document.getElementById('studioToasts');
        if (!area || !window.bootstrap) return;

        const el = document.createElement('div');
        el.className = 'toast align-items-center border-0';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.innerHTML = `
            <div class="d-flex">
                <div class="toast-body fw-bold">${esc(texto)}</div>
                <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
            </div>`;

        area.appendChild(el);
        el.addEventListener('hidden.bs.toast', () => el.remove());
        new window.bootstrap.Toast(el, { delay: opcoes.tempo || 3200 }).show();
    }

    function bolhaDePontos(delta) {
        $$('[data-points-pop]').forEach((el) => {
            el.textContent = `${delta > 0 ? '+' : ''}${delta}`;
            el.classList.remove('is-on');
            void el.offsetWidth; // reinicia a animação
            el.classList.add('is-on');
        });
    }

    /* ---------- Persistência (PONTO ÚNICO para produção) ---------- */

    // Toda ação importante passa por aqui: pontos, avaliações de cartas, partidas, etc.
    // Em produção, envie para o servidor. Exemplo:
    //   fetch('/api/eventos', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    //                           body: JSON.stringify(evento) });
    async function registrar(evento) {
    if (demo) {
        console.debug('[memorizer] evento (modo demo)', evento);
        return;
    }

    try {
        const resposta = await fetch('/api/eventos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evento)
        });

        if (!resposta.ok) {
            const erro = await resposta.json();
            console.error('Erro ao registrar evento:', erro);
            toast('Não foi possível salvar seu progresso.');
        }
    } catch (erro) {
        console.error('Erro de rede ao registrar evento:', erro);
    }
}

    /* ---------- API pública ---------- */

    function emitir() {
        document.dispatchEvent(new CustomEvent('studio:change', { detail: { state } }));
    }

    function addPoints(delta, modo = 'flashcards', motivo = '') {
        delta = Math.round(delta);
        if (!delta) return;

        const nivelAntes = state.points.level;
        aplicarPontos(delta, modo);
        if (demo) guardarDemo(delta, modo);

        renderTudo();
        bolhaDePontos(delta);
        if (state.points.level > nivelAntes) toast(`Nível ${state.points.level}! Você subiu de nível.`);

        emitir();
        registrar({ tipo: 'pontos', delta, modo, motivo });
    }

    window.Studio = {
        state, demo, fmt, esc,
        addPoints, ranking, posicao, toast, registrar,
        on(fn) { document.addEventListener('studio:change', () => fn(state)); }
    };

    renderTudo();
})();
