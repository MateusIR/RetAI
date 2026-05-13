
import { DiagnosticoDetalhe } from '../api';

export function gerarHTMLdoLaudo(data: DiagnosticoDetalhe, parecer: string): string {
  const formatarCPF = (cpf?: string) => {
    if (!cpf) return '';
    const digits = cpf.replace(/\D/g, '');
    if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return cpf;
  };

  const imagensHTML = (data.imagens || [])
    .map((img) => {
      const src = `http://localhost:8000/imagens_salvas/${img.caminho.split(/[/\\]/).pop()}`;
      const label = `Olho ${img.tipo === 'OD' ? 'Direito (OD)' : 'Esquerdo (OE)'}`;
      return `
        <div style="break-inside: avoid; margin-bottom: 16px; text-align: center;">
          <img src="${src}" style="max-width: 100%; max-height: 300px; display: block; margin: 0 auto; border: 1px solid #ccc;" />
          <p style="font-size: 12px; color: #555;">${label}</p>
        </div>`;
    })
    .join('');

  const resultadosHTML = data.resultados
    ? Object.entries(
        data.resultados.reduce<Record<string, typeof data.resultados>>((acc, r) => {
          if (!acc[r.olho]) acc[r.olho] = [];
          acc[r.olho].push(r);
          return acc;
        }, {})
      )
        .map(([olho, res]) => {
          const nomeOlho = olho === 'OD' ? 'Olho Direito (OD)' : 'Olho Esquerdo (OE)';
          const linhas = res
            .map(
              (r) => `
                <tr>
                  <td style="padding: 6px 12px; border: 1px solid #ddd;">${r.doenca}</td>
                  <td style="padding: 6px 12px; border: 1px solid #ddd; text-align: right;">${r.confianca}%</td>
                </tr>`
            )
            .join('');
          return `
            <h3 style="margin: 16px 0 8px;">${nomeOlho}</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              <thead><tr><th style="text-align: left; padding: 6px 12px; border: 1px solid #ddd;">Patologia</th><th style="text-align: right; padding: 6px 12px; border: 1px solid #ddd;">Confiança</th></tr></thead>
              <tbody>${linhas}</tbody>
            </table>`;
        })
        .join('')
    : '<p>Sem resultados</p>';

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Laudo #${data.id}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; color: #000; }
      h1, h2, h3 { margin: 0 0 8px; }
      .header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 24px; }
      .field { margin-bottom: 12px; }
      .label { font-size: 11px; color: #666; text-transform: uppercase; }
      .value { font-size: 14px; font-weight: bold; }
      .parecer { margin-top: 24px; border-top: 1px solid #000; padding-top: 16px; }
      @media print { body { margin: 20px; } }
    </style></head>
    <body onload="window.print();">
      <div class="header">
        <h1>Laudo de Diagnóstico #${data.id}</h1>
        <p>Emitido em: ${new Date().toLocaleString('pt-BR')}</p>
      </div>
      <div class="field"><span class="label">Paciente</span><br><span class="value">${data.paciente}</span></div>
      <div class="field"><span class="label">Idade / Sexo</span><br><span class="value">${data.idade} anos · ${data.sexo === 'M' ? 'Masculino' : 'Feminino'}</span></div>
      ${data.cpf ? `<div class="field"><span class="label">CPF</span><br><span class="value">${formatarCPF(data.cpf)}</span></div>` : ''}
      <div class="field"><span class="label">Modelo</span><br><span class="value">${data.modelo_versao}</span></div>

      <h2>Imagens</h2>
      ${imagensHTML || '<p>Nenhuma imagem disponível</p>'}

      <h2>Resultados</h2>
      ${resultadosHTML}

      <div class="parecer">
        <h2>Parecer do Médico Responsável</h2>
        <p style="white-space: pre-wrap; min-height: 80px; border: 1px solid #ccc; padding: 12px;">${parecer || '—'}</p>
        <p style="margin-top: 40px; text-align: right;">____________________________________<br>Assinatura e carimbo</p>
      </div>
    </body>
    </html>`;
}