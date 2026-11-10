# regressao.lab-demostracao

Demonstração prática de **teste de regressão após correção de defeito** (Tema 2 · Grupo Bianca).

Uma aplicação web que executa código JavaScript real de uma loja virtual e mostra, em três passos, a diferença entre **reteste** e **teste de regressão**:

1. **Reproduzir o defeito**: o desconto é de 5% em vez de 10% (CT-01 falha).
2. **Corrigir e testar**: o patch corrige o desconto, mas muda o limite do frete grátis. O reteste passa e a regressão falha (CT-02 e CT-03).
3. **Corrigir a regressão**: a suíte completa (6 casos) passa.

## Como usar

Abra `index.html` no navegador. Não precisa de instalação nem de internet.

Os testes do motor podem ser executados com Node.js:

```bash
node --test testes.cjs
```

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Página da aplicação |
| `styles.css` | Identidade visual regressão.lab |
| `app.js` | Interface: editor, guia de próxima ação, resultados e evidências |
| `engine.js` | Motor: código de exemplo, casos de teste e execução |
| `testes.cjs` | Testes automatizados do motor |
