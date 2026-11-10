(function () {
  'use strict';
  const E = window.Regressao;
  const $ = id => document.getElementById(id);
  const fases = [
    { titulo: 'Prove que existe um defeito', descricao: 'O sistema dá apenas 5% de desconto, mas o requisito exige 10%. Antes de corrigir, registre o erro e confirme o que já funciona.', codigo: E.FONTE_DEFEITO, execucoes: ['todos'], marcas: [{ trecho: '* 0.05', tipo: 'erro', rotulo: 'defeito: 5%' }], tipo: 'DEFEITO ORIGINAL', explicacao: 'Cada regra tem sua própria função. Em calcularDesconto, a taxa 0.05 = 5%: para R$ 100 o esperado é R$ 10, mas o sistema calcula R$ 5. calcularFrete e calcularSubtotal funcionam.', insight: 'Execute TODOS os testes: CT-01 deve falhar e CT-02 a CT-06 devem passar. Isso cria a referência inicial.' },
    { titulo: 'Corrija o desconto e faça o reteste', descricao: 'O desenvolvedor corrigiu calcularDesconto para 10%, mas aproveitou o mesmo patch para “ajustar” calcularFrete e mudou o limite para R$ 150. Vamos descobrir o efeito colateral.', codigo: E.FONTE_PATCH, execucoes: ['reteste', 'regressao'], marcas: [{ trecho: '* 0.10', tipo: 'ok', rotulo: 'corrigido' }, { trecho: '>= 150', tipo: 'erro', rotulo: 'efeito colateral' }], tipo: 'CORREÇÃO COM REGRESSÃO', explicacao: 'Duas funções mudaram: calcularDesconto passou de 0.05 → 0.10 (correção) e calcularFrete teve o limite trocado de 200 → 150 (defeito introduzido).', insight: 'Primeiro execute RETESTE: CT-01 passa. Depois execute REGRESSÃO: CT-02 e CT-03 falham, provando que outra regra foi quebrada.' },
    { titulo: 'Corrija a regressão e valide o sistema', descricao: 'Ajuste o limite em calcularFrete de volta para R$ 200. Agora o desconto e o frete devem obedecer aos requisitos ao mesmo tempo.', codigo: E.FONTE_FINAL, execucoes: ['todos'], marcas: [{ trecho: '* 0.10', tipo: 'ok', rotulo: 'mantido' }, { trecho: '>= 200', tipo: 'ok', rotulo: 'corrigido' }], tipo: 'CORREÇÃO DEFINITIVA', explicacao: 'calcularDesconto continua com 10% e calcularFrete voltou a dar frete grátis a partir de R$ 200. O código é testado novamente.', insight: 'Execute TODOS os testes. A suíte deve terminar com 6 aprovados e 0 falhas; o histórico comprova as três etapas.' }
  ];
  const ACOES = {
    todos: { botao: 'run-all', texto: 'Clique em “Executar TODOS” para rodar a suíte completa.' },
    reteste: { botao: 'run-retest', texto: 'Clique em “Executar RETESTE” para verificar se o desconto foi corrigido.' },
    regressao: { botao: 'run-regression', texto: 'Agora clique em “Executar REGRESSÃO” para checar se algo que funcionava quebrou.' }
  };
  let fase = 0, faseAplicada = -1, funcaoAtiva = null, codigoAtivo = '', historico = [], ultimo = null;
  const dinheiro = n => Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Erro';
  const escapar = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

  function etapa(n) {
    fase = n;
    document.querySelectorAll('.stage').forEach((el, i) => {el.classList.toggle('active',i===n);el.setAttribute('aria-pressed',String(i===n));});
    $('step-pill').textContent = 'PASSO ' + (n+1) + ' DE 3';
    $('stage-type').textContent = fases[n].tipo;
    $('stage-title').textContent = fases[n].titulo;
    $('stage-description').textContent = fases[n].descricao;
    $('stage-insight').textContent = fases[n].insight;
    $('edit-hint').innerHTML = '<b>O que mudou?</b> ' + fases[n].explicacao;
    $('editor').value = fases[n].codigo;
    marcouEdicao();
    $('app-message').textContent = '';
    // Resultados da etapa anterior continuam no histórico, mas não aparentam ser da nova etapa.
    ultimaExecucao(null);
  }
  function marcouEdicao() {
    const mesmo = funcaoAtiva && faseAplicada === fase && $('editor').value === codigoAtivo;
    const tag = $('code-status');
    tag.textContent = mesmo ? 'Código ativo' : 'Alterações não aplicadas';
    tag.className = 'status-tag ' + (mesmo ? 'status-applied' : 'status-unapplied');
    desenharEditor();
    atualizarGuia();
  }

  const PALAVRAS_DECLARACAO = new Set(['function', 'let', 'const', 'var', 'true', 'false', 'null', 'undefined', 'new', 'typeof', 'this']);
  const PALAVRAS_CONTROLE = new Set(['return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'throw', 'try', 'catch', 'finally']);
  const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:\\.|[^'\\\n])*'?|"(?:\\.|[^"\\\n])*"?|`(?:\\.|[^`\\])*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([{}()[\]])|([\s\S])/g;

  /**
   * Gera HTML com as cores do tema Dark+ do VS Code, incluindo cores de pares de parênteses por nível.
   * @param {string} codigo
   * @returns {string}
   */
  function destacarSintaxe(codigo) {
    let html = '', nivel = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(codigo))) {
      const [texto, comentario, str, numero, ident, chave] = m;
      let classe = '';
      if (comentario) classe = 'tk-com';
      else if (str) classe = 'tk-str';
      else if (numero) classe = 'tk-num';
      else if (ident) {
        if (PALAVRAS_CONTROLE.has(ident)) classe = 'tk-ctl';
        else if (PALAVRAS_DECLARACAO.has(ident)) classe = 'tk-kw';
        else classe = /^\s*\(/.test(codigo.slice(TOKEN.lastIndex)) ? 'tk-fn' : 'tk-var';
      } else if (chave) {
        const abre = '({['.includes(chave);
        if (!abre) nivel = Math.max(0, nivel - 1);
        classe = 'tk-b' + (nivel % 3);
        if (abre) nivel++;
      }
      html += classe ? `<span class="${classe}">${escapar(texto)}</span>` : escapar(texto);
    }
    return html + '\n';
  }

  /** Numera as linhas e destaca as que contêm a mudança da etapa ou foram editadas pelo usuário. */
  function desenharEditor() {
    const linhas = $('editor').value.split('\n');
    const exemplo = fases[fase].codigo.split('\n');
    $('gutter').textContent = linhas.map((_, i) => i + 1).join('\n');
    $('editor').style.setProperty('--linhas', String(linhas.length));
    $('editor-highlight').innerHTML = destacarSintaxe($('editor').value);
    $('editor-marks').innerHTML = linhas.map((linha, i) => {
      const marca = fases[fase].marcas.find(m => linha.includes(m.trecho))
        || (linha !== exemplo[i] ? { tipo: 'edit', rotulo: 'editado' } : null);
      return marca ? `<div class="mark-line mark-${marca.tipo}" data-label="${escapar(marca.rotulo)}"></div>` : '<div class="mark-line"></div>';
    }).join('');
    sincronizarRolagem();
  }
  function sincronizarRolagem() {
    $('gutter').scrollTop = $('editor').scrollTop;
    $('editor-marks').scrollTop = $('editor').scrollTop;
    $('editor-highlight').scrollTop = $('editor').scrollTop;
    $('editor-highlight').scrollLeft = $('editor').scrollLeft;
  }

  const executouNaVersao = (n, tipo, assinatura) => historico.some(h => h.fase === n + 1 && h.tipo === tipo && h.assinatura === assinatura);
  const etapaConcluida = n => historico.some(h => h.fase === n + 1 && fases[n].execucoes.every(t => executouNaVersao(n, t, h.assinatura)));

  /** Indica a próxima ação esperada no roteiro e destaca o botão correspondente. */
  function atualizarGuia() {
    document.querySelectorAll('.stage').forEach((el, i) => {
      const concluida = etapaConcluida(i);
      el.classList.toggle('done', concluida);
      el.querySelector('.stage-number').textContent = concluida ? '✓' : String(i + 1);
    });
    let alvo = null, texto, proximaEtapa = false;
    const aplicado = funcaoAtiva && faseAplicada === fase && $('editor').value === codigoAtivo;
    const pendente = aplicado && fases[fase].execucoes.find(t => !executouNaVersao(fase, t, E.assinatura(codigoAtivo)));
    if (!aplicado) { alvo = 'apply'; texto = 'Clique em “Aplicar código à aplicação” para ativar esta versão.'; }
    else if (pendente) { alvo = ACOES[pendente].botao; texto = ACOES[pendente].texto; }
    else if (fase < fases.length - 1) { proximaEtapa = true; texto = 'Etapa concluída! Avance para o passo ' + (fase + 2) + '.'; }
    else { alvo = 'download'; texto = 'Demonstração concluída. Baixe o relatório CSV com as evidências.'; }
    document.querySelectorAll('.is-next').forEach(el => el.classList.remove('is-next'));
    if (alvo) $(alvo).classList.add('is-next');
    $('next-action-text').textContent = texto;
    $('next-action').classList.toggle('complete', !pendente && !!aplicado);
    const botao = $('next-stage');
    botao.hidden = !proximaEtapa;
    botao.textContent = 'Ir para o passo ' + (fase + 2) + ' →';
    botao.classList.toggle('is-next', proximaEtapa);
  }
  function mensagem(texto, erro) { const el = $('app-message');el.textContent = texto;el.className = erro ? 'error-msg' : 'ok-msg'; }
  function aplicar() {
    try {
      const codigo = $('editor').value;
      const nova = E.compilar(codigo);
      codigoAtivo = codigo;funcaoAtiva = nova;faseAplicada = fase;
      $('active-version').textContent = 'Implementação ativa: ' + E.assinatura(codigo);
      mensagem('Código aplicado. Agora execute os testes: eles usam exatamente esta implementação.', false);
      marcouEdicao();ultimaExecucao(null);
    } catch (error) { mensagem('Código não aplicado: ' + error.message, true); }
  }
  function executar(tipo) {
    if (!funcaoAtiva) { mensagem('Primeiro clique em “Aplicar código à aplicação”.', true); return; }
    if ($('editor').value !== codigoAtivo || faseAplicada !== fase) { mensagem('Há mudanças no editor ainda não aplicadas. Clique em “Aplicar código” antes dos testes.', true);return; }
    const resultados=E.testar(funcaoAtiva,tipo);
    const registro={fase:fase+1,titulo:fases[fase].tipo,tipo,data:new Date().toLocaleString('pt-BR'),assinatura:E.assinatura(codigoAtivo),resultados};
    historico.push(registro);ultimaExecucao(registro);renderHistorico();$('download').disabled=false;
    mensagem('Testes executados sobre a versão ' + registro.assinatura + '.',false);
    atualizarGuia();
  }
  const CAMPOS = { subtotal: 'Subtotal', desconto: 'Desconto', frete: 'Frete', total: 'Total' };

  /** Mostra todos os valores calculados pela implementação, realçando o campo verificado pelo caso. */
  function resumoCalculo(r) {
    if (!r.calculo) return `<span class="calc-line">Erro na execução: ${escapar(r.erro)}</span>`;
    const partes = Object.keys(CAMPOS).map(k => {
      const texto = `${CAMPOS[k]} ${dinheiro(r.calculo[k])}`;
      return k === r.campo ? `<b>${texto}</b>` : texto;
    });
    return `<span class="calc-line">${partes.join(' · ')}</span>`;
  }

  function explicarFalha(f) {
    if (!f.calculo) return `A execução lançou um erro: ${f.erro}`;
    let texto = `Entrada ${dinheiro(f.preco)} × ${f.quantidade}. A regra ${f.requisito} exige ${CAMPOS[f.campo].toLowerCase()} de ${dinheiro(f.esperado)}, mas o código retornou ${dinheiro(f.obtido)}.`;
    if (f.campo === 'desconto') texto += f.obtido < f.esperado ? ' A taxa aplicada é menor que os 10% exigidos.' : ' A taxa aplicada é maior que os 10% exigidos.';
    if (f.campo === 'frete') texto += f.obtido === 0 ? ' O código concedeu frete grátis abaixo do limite de R$ 200.' : ' O código cobrou frete de uma compra que deveria ter frete grátis (subtotal a partir de R$ 200, antes do desconto).';
    return texto;
  }

  function ultimaExecucao(registro) {
    ultimo=registro;
    const body=$('results');
    if (!registro) {
      $('execution-label').textContent = 'Nenhum teste executado nesta etapa';
      $('execution-meta').textContent = '';
      $('execution-count').textContent = '0 resultados';
      body.innerHTML='<tr><td colspan="7" class="empty">Aplique o código e execute um teste. Os resultados não são simulados.</td></tr>';
      $('detail').hidden=true;
      mostrarVeredito('neutral','Ainda sem evidência','Execute os testes para verificar o comportamento real.');
      return;
    }
    const {resultados,tipo}=registro;
    const aprovados=resultados.filter(r=>r.aprovado).length;
    $('execution-label').textContent=({reteste:'RETESTE · defeito corrigido',regressao:'REGRESSÃO · funções anteriores',todos:'SUÍTE COMPLETA · todos os requisitos'})[tipo];
    $('execution-meta').textContent=` · versão ${registro.assinatura} · ${registro.data}`;
    $('execution-count').textContent=`${aprovados}/${resultados.length} aprovados`;
    body.innerHTML=resultados.map(r=>`<tr class="${r.aprovado?'':'row-fail'}">
      <td>${r.id}<br><span class="tipo-badge tipo-${r.tipo}">${r.tipo==='reteste'?'Reteste':'Regressão'}</span></td>
      <td><strong>${escapar(r.titulo)}</strong><br><span class="req-meta">${escapar(r.requisito)} · risco ${escapar(r.risco)}</span><br>${resumoCalculo(r)}</td>
      <td class="nowrap">${dinheiro(r.preco)} × ${r.quantidade}</td>
      <td>${CAMPOS[r.campo]}</td>
      <td class="nowrap">${dinheiro(r.esperado)}</td>
      <td class="nowrap">${dinheiro(r.obtido)}</td>
      <td><span class="${r.aprovado?'status-pass':'status-fail'}">${r.aprovado?'PASSOU':'FALHOU'}</span></td></tr>`).join('');
    const falhas=resultados.filter(r=>!r.aprovado);
    const detalhe=$('detail');
    if(falhas.length){
      const titulo=falhas.length===1?`Por que ${falhas[0].id} falhou?`:`Por que ${falhas.length} casos falharam?`;
      detalhe.innerHTML=`<strong>${titulo}</strong><ul class="detail-list">${falhas.map(f=>`<li><b>${f.id}</b> · ${escapar(explicarFalha(f))}</li>`).join('')}</ul><strong>Critério de aprovação:</strong> esperado = obtido.`;
      detalhe.hidden=false;
    } else { detalhe.hidden=true; }
    if(tipo==='reteste') {
      mostrarVeredito(aprovados===1?'success':'danger',aprovados===1?'O reteste PASSOU':'O reteste FALHOU',aprovados===1?'O erro do desconto foi corrigido. Isso NÃO prova que as outras funcionalidades continuam corretas. Execute a regressão.':'O defeito original ainda está presente; a correção não foi validada.');
    } else if(tipo==='regressao') {
      mostrarVeredito(aprovados===resultados.length?'success':'danger',aprovados===resultados.length?'A regressão PASSOU':'REGRESSÃO DETECTADA!',aprovados===resultados.length?'As regras antigas selecionadas continuam corretas na implementação testada.':'Algumas funcionalidades que passavam antes agora falham. É a prova do efeito colateral da alteração.');
    } else {
      mostrarVeredito(aprovados===resultados.length?'success':'danger',aprovados===resultados.length?'Suíte completa APROVADA':'Suíte completa REPROVADA',aprovados===resultados.length?'Todos os seis casos de teste passaram na implementação ativa.':'Há divergência entre comportamento esperado e obtido. Consulte a tabela e corrija o código.');
    }
    if (fase===1) {
      const igual=historico.filter(h=>h.assinatura===registro.assinatura);
      const rp=igual.find(h=>h.tipo==='reteste'&&h.resultados.every(r=>r.aprovado));
      const rg=igual.find(h=>h.tipo==='regressao'&&h.resultados.some(r=>!r.aprovado));
      if(rp&&rg) mostrarVeredito('danger','PROVA CONCLUÍDA: reteste passou e regressão falhou','Na MESMA versão de código ('+registro.assinatura+'), o defeito do desconto foi corrigido, mas CT-02 e CT-03 mostraram que a regra do frete deixou de funcionar.');
    }
  }
  function mostrarVeredito(classe,titulo,desc){const el=$('verdict');el.className='verdict '+classe;el.querySelector('.verdict-icon').textContent=classe==='success'?'✓':classe==='danger'?'!':'i';el.querySelector('strong').textContent=titulo;el.querySelector('p').textContent=desc;}
  function renderHistorico(){
    const list=historico.slice(-6).reverse();
    $('history').className='';
    $('history').innerHTML='<ul class="history-items">'+list.map(e=>{const ap=e.resultados.filter(r=>r.aprovado).length;const grupo=({reteste:'Reteste',regressao:'Regressão',todos:'Suíte completa'})[e.tipo];return `<li><div><strong>Passo ${e.fase}: ${grupo}</strong><br>Código ${e.assinatura} · ${escapar(e.data)}</div><span>${ap}/${e.resultados.length} passaram<br>${ap===e.resultados.length?'Aprovado':'Falha detectada'}</span></li>`;}).join('')+'</ul>';
  }
  function exportar(){
    const rows=[['Data','Passo','Alteração','Assinatura do código','Execução','Caso','Requisito','Risco','Entrada (preço)','Quantidade','Campo validado','Esperado','Obtido','Status']];
    for(const h of historico) for(const t of h.resultados) rows.push([h.data,h.fase,h.titulo,h.assinatura,h.tipo,t.id,t.requisito,t.risco,t.preco,t.quantidade,t.campo,t.esperado,t.obtido,t.aprovado?'PASSOU':'FALHOU']);
    const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Evidencias_Teste_de_Regressao.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.querySelectorAll('.stage').forEach(el=>el.addEventListener('click',()=>etapa(Number(el.dataset.stage))));
  $('reset-code').addEventListener('click',()=>{ $('editor').value=fases[fase].codigo;marcouEdicao(); });
  $('editor').addEventListener('input',marcouEdicao);
  $('editor').addEventListener('scroll',sincronizarRolagem);
  $('next-stage').addEventListener('click',()=>{ etapa(fase+1); document.querySelector('.instructions').scrollIntoView({behavior:'smooth',block:'start'}); });
  $('apply').addEventListener('click',aplicar);
  $('run-retest').addEventListener('click',()=>executar('reteste'));
  $('run-regression').addEventListener('click',()=>executar('regressao'));
  $('run-all').addEventListener('click',()=>executar('todos'));
  $('download').addEventListener('click',exportar);
  etapa(0);
})();
