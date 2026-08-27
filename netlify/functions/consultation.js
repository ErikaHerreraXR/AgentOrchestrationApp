'use strict';

const { randomUUID } = require('crypto');
const { getStore } = require('@netlify/blobs');
const nodemailer = require('nodemailer');
const { json, parseBody, preflight } = require('./_shared');

const DEFAULT_BUSINESS_EMAIL = 'productimaginationhere@gmail.com';

async function emailConsultationLead(lead) {
  const to = process.env.EMAIL_TO || DEFAULT_BUSINESS_EMAIL;
  const user = process.env.EMAIL_USER || DEFAULT_BUSINESS_EMAIL;
  const pass = process.env.EMAIL_PASS;
  if (!pass) return { sent:false, reason:'EMAIL_PASS is not configured.' };

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: String(process.env.EMAIL_PORT || '587') === '465',
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: `"Product Imagination" <${user}>`,
    to,
    replyTo: lead.email,
    subject: `Free consultation request from ${lead.company || lead.email}`,
    text: [
      'New free consultation request',
      '',
      `Customer email: ${lead.email}`,
      `Company: ${lead.company || 'Not provided'}`,
      `Goal: ${lead.goal || 'Not provided'}`,
      `Project: ${lead.project || 'Not provided'}`,
      `Template: ${lead.template || 'Not provided'}`,
      `Selected package: ${lead.selectedPackage || 'Not provided'}`,
      `Source: ${lead.source}`,
      `Submitted: ${lead.submittedAt}`,
    ].join('\n'),
  });
  return { sent:true, to };
}

exports.handler = async (event) => {
  const options = preflight(event); if (options) return options;
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  const body = parseBody(event);
  const email = body && String(body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    return json(400, { error: 'A valid email address is required.' });
  }
  if (body.consent !== true) return json(400, { error: 'Consultation consent is required.' });

  const lead = {
    id: randomUUID(),
    email,
    source: String(body.source || 'website').slice(0, 40),
    company: String(body.company || '').slice(0, 120),
    goal: String(body.goal || '').slice(0, 500),
    project: String(body.project || '').slice(0, 160),
    template: String(body.template || '').slice(0, 100),
    selectedPackage: String(body.selectedPackage || '').slice(0, 300),
    submittedAt: new Date().toISOString(),
  };

  try {
    const store = getStore('consultation-leads');
    await store.setJSON(`${lead.submittedAt}_${lead.id}`, lead);

    if (process.env.CONSULTATION_WEBHOOK_URL) {
      fetch(process.env.CONSULTATION_WEBHOOK_URL, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(lead),
      }).catch(error => console.warn('[Consultation webhook]', error.message));
    }
    let emailResult;
    try {
      emailResult = await emailConsultationLead(lead);
    } catch (emailError) {
      console.error('[Consultation email]', emailError.message);
      emailResult = { sent:false, reason:'Email delivery failed. The lead remains saved.' };
    }
    return json(200, { ok: true, id: lead.id, emailSent:emailResult.sent });
  } catch (error) {
    console.error('[Consultation]', error.message);
    return json(500, { error: 'The consultation request could not be saved.' });
  }
};

