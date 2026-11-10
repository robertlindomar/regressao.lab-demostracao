'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const e = require('./engine.js');
function run(src,kind){return e.testar(e.compilar(src),kind)}
test('cenário inicial: o desconto falha, mas todos os testes antigos passam',()=>{
 const resultados=run(e.FONTE_DEFEITO,'todos');
 assert.deepEqual(resultados.map(r=>r.aprovado),[false,true,true,true,true,true]);
 assert.equal(resultados[0].obtido,5);
});
test('reteste passa após patch',()=>{
 const r=run(e.FONTE_PATCH,'reteste');
 assert.equal(r.length,1);assert.equal(r[0].aprovado,true);assert.equal(r[0].obtido,10);
});
test('regressão detecta erro novo do frete',()=>{
 const r=run(e.FONTE_PATCH,'regressao');
 assert.deepEqual(r.map(t=>t.aprovado),[false,false,true,true,true]);
 assert.equal(r[0].esperado,20);assert.equal(r[0].obtido,0);
});
test('correção definitiva passa na suíte toda',()=>{
 assert.equal(run(e.FONTE_FINAL,'todos').every(r=>r.aprovado),true);
});
test('o executor roda código editado, e não um resultado estático',()=>{
 const custom=e.FONTE_FINAL.replace('>= 200', '>= 300');
 const result=run(custom,'regressao');
 assert.equal(result.find(r=>r.id==='CT-04').aprovado,false);
});
test('regressão detecta frete calculado sobre o valor com desconto',()=>{
 const custom=e.FONTE_FINAL.replace('calcularFrete(subtotal);', 'calcularFrete(subtotal - desconto);');
 const ct06=run(custom,'regressao').find(r=>r.id==='CT-06');
 assert.equal(ct06.aprovado,false);assert.equal(ct06.obtido,20);
});
test('compilar rejeita código sem calcularCompra',()=>{
 assert.throws(()=>e.compilar('function calcularFrete(subtotal) { return 20; }'),/calcularCompra/);
});
test('registra falha caso função do usuário lance exceção',()=>{
 const r=e.testar(()=>{throw Error('erro em execução')},'reteste');
 assert.equal(r[0].aprovado,false);assert.match(r[0].erro,/erro em execução/);
});
