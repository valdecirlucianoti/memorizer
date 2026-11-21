const express = require('express');
const path = require('path');
const session = require('express-session');

// Importando os arquivos de rotas
const authRouter = require('./routes/auth');   // Login/Register
const pagesRouter = require('./routes/pages'); // Telas (index, flashcards, etc)
const apiRouter = require('./routes/api');     // Dados JSON (eventos, decks)
const { carregarUsuario } = require('./utils/middleware'); // importe lá em cima

const app = express();

// Configuração da View Engine (EJS)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middlewares para receber dados de formulários
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Arquivos estáticos (CSS, JS, imagens)
app.use(express.static(path.join(__dirname, 'public')));

// Configuração da Sessão
app.use(session({
    secret: process.env.SESSION_SECRET || 'chave-secreta-memorizer',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 }
}));

app.use(carregarUsuario); 


// ==========================================
// ROTAS
// ==========================================

// 1. Rotas de Login/Register (na raiz)
app.use('/', authRouter);

// 2. Rotas de Telas (aqui está a index, flashcards, etc)
app.use('/', pagesRouter);

// 3. Rotas de API
app.use('/api', apiRouter);

module.exports = app;