import i18n from '../i18n';
import { DiagnosticoDetalhe } from '../api';

// Mapeamento tag → chave de tradução (conforme os arquivos de locales)
const doencaTagToTranslationKey: Record<string, string> = {
  diabetic_retinopathy: 'list.disease.diabetic_retinopathy',
  macular_edema:        'list.disease.macular_edema',
  scar:                 'list.disease.scar',
  amd:                  'list.disease.amd',
  drusens:              'list.disease.drusens',
  myopic_fundus:        'list.disease.myopic_fundus',
  increased_cup_disc:   'list.disease.increased_cup_disc',
  vascular_occlusion:   'list.disease.vascular_occlusion',
  retinal_detachment:   'list.disease.retinal_detachment',
};

// Para doenças que eventualmente venham com nome em português (legado)
const nomeDoencaParaTraducao = (nome: string): string => {
  // Se já for uma chave conhecida, retorna a tradução; senão retorna o próprio nome
  const tag = Object.keys(doencaTagToTranslationKey).find(k => 
    i18n.t(doencaTagToTranslationKey[k]) === nome || k === nome
  );
  if (tag) return i18n.t(doencaTagToTranslationKey[tag]);
  // Se não mapeou, tenta traduzir pelo nome (caso o backend envie o nome em português)
  return i18n.t(nome, nome); // fallback para o próprio nome
};

export function gerarHTMLdoLaudo(data: DiagnosticoDetalhe, parecer: string): string {
  const t = (key: string, options?: any) => i18n.t(key, options);

  const formatarCPF = (cpf?: string) => {
    if (!cpf) return '';
    const digits = cpf.replace(/\D/g, '');
    if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return cpf;
  };

  const imagensHTML = (data.imagens || [])
    .map((img) => {
      const src = `http://localhost:8000/imagens_salvas/${img.caminho.split(/[/\\]/).pop()}`;
      const label = img.tipo === 'OD' ? t('app.od') : t('app.oe');
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
          const nomeOlho = olho === 'OD' ? t('app.od') : t('app.oe');
          const linhas = res
            .map(
              (r) => `
                <tr>
                  <td style="padding: 6px 12px; border: 1px solid #ddd;">${nomeDoencaParaTraducao(r.doenca)}</td>
                  <td style="padding: 6px 12px; border: 1px solid #ddd; text-align: right;">${r.confianca}%</td>
                </tr>`
            )
            .join('');
          return `
            <h3 style="margin: 16px 0 8px;">${nomeOlho}</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              <thead><tr><th style="text-align: left; padding: 6px 12px; border: 1px solid #ddd;">${t('list.disease')}</th><th style="text-align: right; padding: 6px 12px; border: 1px solid #ddd;">${t('app.confidence')}</th></tr></thead>
              <tbody>${linhas}</tbody>
            </table>`;
        })
        .join('')
    : `<p>${t('diagnosis.noResults')}</p>`;

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>${t('app.pdf.reportTitle')} #${data.id}</title>
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
        <h1>${t('app.pdf.reportTitle')} #${data.id}</h1>
        <p>${t('app.pdf.issuedAt', { date: new Date().toLocaleString(i18n.language === 'en' ? 'en-US' : 'pt-BR') })}</p>
      </div>
      <div class="field"><span class="label">${t('app.patient')}</span><br><span class="value">${data.paciente}</span></div>
      <div class="field"><span class="label">${t('app.ageSex')}</span><br><span class="value">${data.idade} ${t('anos')} · ${data.sexo === 'M' ? t('app.male') : t('app.female')}</span></div>
      ${data.cpf ? `<div class="field"><span class="label">${t('app.cpf')}</span><br><span class="value">${formatarCPF(data.cpf)}</span></div>` : ''}
      <div class="field"><span class="label">${t('app.model')}</span><br><span class="value">${data.modelo_versao}</span></div>

      <h2>${t('app.images')}</h2>
      ${imagensHTML || `<p>${t('app.diagnosis.noImages')}</p>`}

      <h2>${t('app.analysisResults')}</h2>
      ${resultadosHTML}

      <div class="parecer">
        <h2>${t('app.report')}</h2>
        <p style="white-space: pre-wrap; min-height: 80px; border: 1px solid #ccc; padding: 12px;">${parecer || t('—')}</p>
        <p style="margin-top: 40px; text-align: right;">____________________________________<br>${t('app.pdf.signature')}</p>
      </div>
    </body>
    </html>`;
}