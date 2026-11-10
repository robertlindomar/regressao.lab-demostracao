/* Motor didático: o código editado é executado de verdade, e os testes verificam valores. */
(function (root) {
  'use strict';
  const FONTE_COMPRA = `function calcularCompra(preco, quantidade) {
  let subtotal = calcularSubtotal(preco, quantidade);
  let desconto = calcularDesconto(subtotal);
  let frete = calcularFrete(subtotal);
  let total = subtotal - desconto + frete;

  return {
    subtotal: subtotal,
    desconto: desconto,
    frete: frete,
    total: total
  };
}`;
  const FONTE_DEFEITO = `function calcularSubtotal(preco, quantidade) {
  return preco * quantidade;
}

function calcularDesconto(subtotal) {
  return subtotal * 0.05; // ERRO: deveria ser 10%
}

function calcularFrete(subtotal) {
  if (subtotal >= 200) {
    return 0;
  }
  return 20;
}

${FONTE_COMPRA}`;
  const FONTE_PATCH = `function calcularSubtotal(preco, quantidade) {
  return preco * quantidade;
}

function calcularDesconto(subtotal) {
  return subtotal * 0.10; // CORRIGIDO: 10%
}

function calcularFrete(subtotal) {
  if (subtotal >= 150) { // REGRESSÃO: limite errado!
    return 0;
  }
  return 20;
}

${FONTE_COMPRA}`;
  const FONTE_FINAL = `function calcularSubtotal(preco, quantidade) {
  return preco * quantidade;
}

function calcularDesconto(subtotal) {
  return subtotal * 0.10;
}

function calcularFrete(subtotal) {
  if (subtotal >= 200) { // CORRIGIDO: R$ 200
    return 0;
  }
  return 20;
}

${FONTE_COMPRA}`;

  const CENARIOS = Object.freeze([
    Object.freeze({ id: 'CT-01', tipo: 'reteste', titulo: 'Desconto de 10%', detalhe: 'Compra de R$ 100 deve conceder R$ 10 de desconto.', preco: 100, quantidade: 1, campo: 'desconto', esperado: 10, risco: 'Alto', requisito: 'RN-01' }),
    Object.freeze({ id: 'CT-02', tipo: 'regressao', titulo: 'Frete abaixo do limite', detalhe: 'Compra de R$ 150 ainda paga R$ 20 de frete.', preco: 150, quantidade: 1, campo: 'frete', esperado: 20, risco: 'Alto', requisito: 'RN-02' }),
    Object.freeze({ id: 'CT-03', tipo: 'regressao', titulo: 'Valor próximo do limite', detalhe: 'Compra de R$ 199 ainda paga R$ 20 de frete.', preco: 199, quantidade: 1, campo: 'frete', esperado: 20, risco: 'Alto', requisito: 'RN-02' }),
    Object.freeze({ id: 'CT-04', tipo: 'regressao', titulo: 'Frete grátis no limite', detalhe: 'Compra de R$ 200 tem frete grátis.', preco: 200, quantidade: 1, campo: 'frete', esperado: 0, risco: 'Médio', requisito: 'RN-02' }),
    Object.freeze({ id: 'CT-05', tipo: 'regressao', titulo: 'Quantidade preservada', detalhe: 'Três itens de R$ 50 produzem subtotal de R$ 150.', preco: 50, quantidade: 3, campo: 'subtotal', esperado: 150, risco: 'Médio', requisito: 'RN-03' }),
    Object.freeze({ id: 'CT-06', tipo: 'regressao', titulo: 'Frete usa subtotal antes do desconto', detalhe: 'Compra de R$ 210 (R$ 189 após desconto) mantém frete grátis.', preco: 210, quantidade: 1, campo: 'frete', esperado: 0, risco: 'Alto', requisito: 'RN-02' })
  ]);

  // Executa somente código local que o usuário escreve/seleciona. Não cole scripts desconhecidos.
  function compilar(codigo) {
    const implementacao = new Function('"use strict";\n' + codigo + '\nreturn typeof calcularCompra === "function" ? calcularCompra : undefined;')();
    if (typeof implementacao !== 'function') throw new TypeError('O código deve definir function calcularCompra(preco, quantidade).');
    const verificacao = implementacao(100, 1);
    if (!verificacao || !['subtotal', 'desconto', 'frete', 'total'].every(k => Number.isFinite(verificacao[k]))) {
      throw new TypeError('A função precisa retornar os campos numéricos subtotal, desconto, frete e total.');
    }
    return implementacao;
  }

  function testar(implementacao, tipo) {
    const selecionados = CENARIOS.filter(c => tipo === 'todos' || c.tipo === tipo);
    return selecionados.map(c => {
      try {
        const calculo = implementacao(c.preco, c.quantidade);
        const obtido = calculo?.[c.campo];
        const aprovado = Number.isFinite(obtido) && Math.abs(obtido - c.esperado) < 0.001;
        return { ...c, obtido, aprovado, calculo, erro: '' };
      } catch (e) {
        return { ...c, obtido: null, aprovado: false, calculo: null, erro: String(e.message || e) };
      }
    });
  }
  function assinatura(codigo) {
    let h = 5381;
    for (let i = 0; i < codigo.length; i++) h = ((h << 5) + h) ^ codigo.charCodeAt(i);
    return (h >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }
  const api = Object.freeze({ FONTE_DEFEITO, FONTE_PATCH, FONTE_FINAL, CENARIOS, compilar, testar, assinatura });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Regressao = api;
})(typeof window !== 'undefined' ? window : undefined);
