import assert from 'node:assert/strict';
import test from 'node:test';
import {
  API_RATE_LIMIT_WINDOW_MS,
  resolveApiRateLimitMax,
} from '../src/config/apiRateLimit.js';

test('limite da API comporta o uso normal do ERP em desenvolvimento', () => {
  assert.equal(resolveApiRateLimitMax({ NODE_ENV: 'development' }), 5000);
  assert.equal(API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
});

test('produção usa limite conservador maior que o antigo gargalo de 100 chamadas', () => {
  assert.equal(resolveApiRateLimitMax({ NODE_ENV: 'production' }), 1000);
});

test('limite pode ser configurado e ignora valores inválidos', () => {
  assert.equal(resolveApiRateLimitMax({ API_RATE_LIMIT_MAX: '2500' }), 2500);
  assert.equal(resolveApiRateLimitMax({ NODE_ENV: 'development', API_RATE_LIMIT_MAX: '0' }), 5000);
  assert.equal(resolveApiRateLimitMax({ NODE_ENV: 'production', API_RATE_LIMIT_MAX: 'abc' }), 1000);
});
