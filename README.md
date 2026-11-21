# 🧠 MEMORIZADOR

<p align="center">
  <img src="./assets/imagem_animada.gif" alt="Demonstração do Memorizador" width="700">
</p>

<p align="center">
  Plataforma de estudos baseada em métodos de memorização ativa, com flashcards, jogos de palavras e ranking.
</p>

---

## Sobre o projeto

O **Memorizador** é uma aplicação web desenvolvida para facilitar e enriquecer a retenção de informações por meio de **ciclos de aprendizado**.

O projeto surgiu da aplicação de um método pessoal de ensino, com o objetivo de tornar o estudo mais **dinâmico, mensurável e eficiente**. A plataforma combina diferentes formatos de memorização ativa em um só lugar.

A aplicação está sendo desenvolvida com foco em autenticação de usuários, controle de acesso por perfis e persistência de dados em banco de dados relacional, com uma arquitetura flexível para acomodar novos métodos de estudo no futuro.

## Funcionalidades

- [x] Sistema de cadastro e login de usuários.
- [x] Criptografia de senhas com bcrypt.
- [x] Controle de acesso baseado em perfis (Free, VIP1, VIP2, Admin).
- [x] Sessões autenticadas com express-session.
- [x] Criação, edição e exclusão de decks (baralhos).
- [x] Criação de flashcards individualmente ou em lote (texto/CSV).
- [x] Sessão de estudo com flashcards (virar, avaliar e revisar).
- [x] Sistema de pontuação e níveis.
- [x] Ranking semanal, mensal e geral.
- [x] Sequência de dias estudados (streak).
- [x] Meta diária de pontos.
- [x] Integração com PostgreSQL.
- [ ] Jogo de palavras (em desenvolvimento).
- [ ] Expansão para novos métodos de estudo (em desenvolvimento).

## Tecnologias utilizadas

| Tecnologia | Aplicação |
|---|---|
| Node.js | Ambiente de execução |
| Express | Framework backend |
| EJS | Templates da aplicação |
| JavaScript | Lógica frontend e backend |
| HTML5 | Estrutura das páginas |
| CSS3 | Estilização |
| Bootstrap 5 | Componentes e layout |
| PostgreSQL | Banco de dados relacional |
| node-postgres (pg) | Conexão com PostgreSQL |
| bcryptjs | Criptografia de senhas |
| Express Session | Gerenciamento de sessões |
| Git e GitHub | Versionamento do código |

## Níveis de acesso

A aplicação possui diferentes níveis de permissão:

| Perfil | Descrição |
|---|---|
| Free | Acesso básico à plataforma. |
| VIP 1 | Acesso a métodos de estudo adicionais. |
| VIP 2 | Acesso a métodos avançados e recursos exclusivos. |
| Admin | Administração global da plataforma. |

## Estrutura do banco de dados

O projeto utiliza PostgreSQL para armazenar os dados da aplicação.

Entre as tabelas atualmente previstas na estrutura:

- `users` — usuários cadastrados, com pontuação e meta diária.
- `perfis` — perfis de acesso e permissões.
- `study_items` — tabela unificada que armazena decks e flashcards.
- `learning_methods` — catálogo de métodos de estudo disponíveis.
- `study_sessions` — sessões de estudo realizadas pelos usuários.
- `events` — registros de eventos e pontuação.

A tabela `study_items` foi projetada com o padrão de **tabela única + JSONB**, permitindo flexibilidade para adicionar novos tipos de itens de estudo (flashcards, quizzes, mapas mentais, etc.) sem alterar a estrutura do banco.

## Como executar localmente

### Pré-requisitos

- Node.js e NPM.
- PostgreSQL instalado e em execução.
- Git.
- Visual Studio Code (opcional).

### 1. Clonar o repositório

```bash
git clone https://github.com/valdecirlucianoti/memorizer.git