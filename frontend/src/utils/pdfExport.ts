import i18n from '../i18n';
import { DiagnosticoDetalhe } from '../api';

const currentLang = (): string => localStorage.getItem('lang') || 'pt-BR';

const tr = (key: string, options?: any): string =>
  i18n.t(key, { lng: currentLang(), ...options }) as string;
const nomeDoenca = (tag: string): string =>
  i18n.t(`app.list.disease.${tag}`, { lng: currentLang(), defaultValue: tag }) as string;
const formatarCPF = (cpf?: string): string => {
  if (!cpf) return '';
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : cpf;
};

export function gerarHTMLdoLaudo(data: DiagnosticoDetalhe, parecer: string): string {
  const lang = currentLang();
  const locale = lang === 'en' ? 'en-US' : 'pt-BR';

  const imagensHTML = (data.imagens || [])
    .map((img) => {
      const src = `http://localhost:8000/imagens_salvas/${img.caminho.split(/[/\\]/).pop()}`;
      const label = img.tipo === 'OD' ? tr('app.od') : tr('app.oe');
      return `
        <div style="break-inside:avoid;margin-bottom:16px;text-align:center;">
          <img src="${src}" style="max-width:100%;max-height:300px;display:block;margin:0 auto;border:1px solid #ccc;" />
          <p style="font-size:12px;color:#555;">${label}</p>
        </div>`;
    })
    .join('');

  const resultadosHTML = (() => {
    if (!data.resultados?.length) return `<p>${tr('app.noDiagnostics')}</p>`;

    const porOlho = data.resultados.reduce<Record<string, typeof data.resultados>>(
      (acc, r) => { (acc[r.olho] ??= []).push(r); return acc; },
      {}
    );

    return Object.entries(porOlho)
      .map(([olho, res]) => {
        const nomeOlho = olho === 'OD' ? tr('app.od') : tr('app.oe');
        const linhas = res
          .map((r) => `
            <tr>
              <td style="padding:6px 12px;border:1px solid #ddd;">${nomeDoenca(r.doenca)}</td>
              <td style="padding:6px 12px;border:1px solid #ddd;text-align:right;">${r.confianca}%</td>
            </tr>`)
          .join('');
        return `
          <h3 style="margin:16px 0 8px;">${nomeOlho}</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:6px 12px;border:1px solid #ddd;">${tr('app.detectedDiseases')}</th>
                <th style="text-align:right;padding:6px 12px;border:1px solid #ddd;">${tr('app.confidence')}</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>`;
      })
      .join('');
  })();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${tr('app.pdf.reportTitle')} #${data.id}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #000; }
    h1, h2, h3 { margin: 0 0 8px; }
    .header { border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 24px; }
    .field { margin-bottom: 12px; }
    .label { font-size: 11px; color: #666; text-transform: uppercase; }
    .value { font-size: 14px; font-weight: bold; }
    .parecer { margin-top: 24px; border-top: 1px solid #000; padding-top: 16px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body onload="window.print();">
  <div class="header">
    <h1>${tr('app.pdf.reportTitle')} #${data.id}</h1>
    <p>${tr('app.pdf.issuedAt', { date: new Date().toLocaleString(locale) })}</p>
  </div>

  <div class="field">
    <span class="label">${tr('app.patient')}</span><br>
    <span class="value">${data.paciente}</span>
  </div>
  <div class="field">
    <span class="label">${tr('app.ageSex')}</span><br>
    <span class="value">${data.idade} ${tr('app.years')} · ${data.sexo === 'M' ? tr('app.male') : tr('app.female')}</span>
  </div>
  ${data.cpf ? `
  <div class="field">
    <span class="label">${tr('app.cpf')}</span><br>
    <span class="value">${formatarCPF(data.cpf)}</span>
  </div>` : ''}
  <div class="field">
    <span class="label">${tr('app.model')}</span><br>
    <span class="value">${data.modelo_versao}</span>
  </div>

  <h2>${tr('app.images')}</h2>
  ${imagensHTML || `<p>${tr('app.noImages')}</p>`}

  <h2>${tr('app.analysisResults')}</h2>
  ${resultadosHTML}

  <div class="parecer">
    <h2>${tr('app.report')}</h2>
    <p style="white-space:pre-wrap;min-height:80px;border:1px solid #ccc;padding:12px;">${parecer || '—'}</p>
    <p style="margin-top:40px;text-align:right;">____________________________________<br>${tr('app.pdf.signature')}</p>
  </div>
</body>
</html>`;
}