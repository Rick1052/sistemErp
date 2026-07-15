import { AppError } from '../../utils/AppError.js';
import logger from '../../utils/logger.js';

export const BASE_URLS = {
  SANDBOX: 'https://api-sandbox.asaas.com/v3',
  PRODUCTION: 'https://api.asaas.com/v3',
};

async function request(environment, apiKey, method, path, body) {
  const baseUrl = BASE_URLS[environment];
  if (!baseUrl) throw new AppError(`Ambiente Asaas inválido: ${environment}`, 500);
  if (!apiKey) throw new AppError('API key do Asaas não configurada', 400);

  const url = `${baseUrl}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // O Asaas autentica pelo header access_token (não é Bearer)
        access_token: apiKey,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    logger.error({ msg: '[asaasClient] Falha de rede', url, error: error.message });
    throw new AppError('Não foi possível conectar ao Asaas. Tente novamente.', 502);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    logger.warn({ msg: '[asaasClient] Resposta de erro', url, status: response.status, data });
  }

  return { status: response.status, data };
}

export const asaasClient = {
  async createCustomer(environment, apiKey, payload) {
    return request(environment, apiKey, 'POST', '/customers', payload);
  },

  async getCustomer(environment, apiKey, customerId) {
    return request(environment, apiKey, 'GET', `/customers/${encodeURIComponent(customerId)}`);
  },

  async createSubscription(environment, apiKey, payload) {
    return request(environment, apiKey, 'POST', '/subscriptions', payload);
  },

  async getSubscription(environment, apiKey, subscriptionId) {
    return request(environment, apiKey, 'GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  },

  async cancelSubscription(environment, apiKey, subscriptionId) {
    return request(environment, apiKey, 'DELETE', `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  },

  async listSubscriptionPayments(environment, apiKey, subscriptionId) {
    return request(environment, apiKey, 'GET', `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`);
  },

  async getPayment(environment, apiKey, paymentId) {
    return request(environment, apiKey, 'GET', `/payments/${encodeURIComponent(paymentId)}`);
  },
};
