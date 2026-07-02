import { AppError } from '../../utils/AppError.js';
import logger from '../../utils/logger.js';

export const BASE_URLS = {
  homologacao: 'https://homologacao.focusnfe.com.br',
  producao: 'https://api.focusnfe.com.br',
};

function basicAuthHeader(token) {
  return 'Basic ' + Buffer.from(`${token}:`).toString('base64');
}

async function request(ambiente, token, method, path, body) {
  const baseUrl = BASE_URLS[ambiente];
  if (!baseUrl) throw new AppError(`Ambiente Focus NFe inválido: ${ambiente}`, 500);

  const url = `${baseUrl}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuthHeader(token),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    logger.error({ msg: '[focusNfeClient] Falha de rede', url, error: error.message });
    throw new AppError('Não foi possível conectar à Focus NFe. Tente novamente.', 502);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok && response.status !== 202) {
    logger.warn({ msg: '[focusNfeClient] Resposta de erro', url, status: response.status, data });
  }

  return { status: response.status, data };
}

export const focusNfeClient = {
  async criarEmpresa(ambiente, token, payload) {
    return request(ambiente, token, 'POST', '/v2/empresas', payload);
  },

  async atualizarEmpresa(ambiente, token, focusEmpresaId, payload) {
    return request(ambiente, token, 'PUT', `/v2/empresas/${focusEmpresaId}`, payload);
  },

  async emitirNfe(ambiente, token, ref, payload) {
    return request(ambiente, token, 'POST', `/v2/nfe?ref=${encodeURIComponent(ref)}`, payload);
  },

  async consultarNfe(ambiente, token, ref) {
    return request(ambiente, token, 'GET', `/v2/nfe/${encodeURIComponent(ref)}`);
  },

  async cancelarNfe(ambiente, token, ref, justificativa) {
    return request(ambiente, token, 'DELETE', `/v2/nfe/${encodeURIComponent(ref)}`, { justificativa });
  },

  async criarWebhook(ambiente, token, payload) {
    return request(ambiente, token, 'POST', '/v2/hooks', payload);
  },
};
