'use strict';

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': process.env.SITE_URL || '*',
  },
  body: JSON.stringify(body),
});

const parseBody = (event) => {
  try { return JSON.parse(event.body || '{}'); }
  catch (_) { return null; }
};

const preflight = (event) => event.httpMethod === 'OPTIONS' ? {
  statusCode: 204,
  headers: {
    'Access-Control-Allow-Origin': process.env.SITE_URL || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: '',
} : null;

module.exports = { json, parseBody, preflight };
