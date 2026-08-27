'use strict';

const PDFDocument = require('pdfkit');
const { json, parseBody, preflight } = require('./_shared');

const COLORS = { navy:'#0B0D1E', card:'#F4F5FA', ink:'#17182D', body:'#47495D', muted:'#74768A', purple:'#6366F1', blue:'#0EA5E9', green:'#169B62', line:'#DDDFF0', white:'#FFFFFF' };
const clean = (value, max = 6000) => String(value == null ? '' : value)
  .replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/[\u2010-\u2015]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  .replace(/[•●▪]/g, '-').trim().slice(0, max);
const field = (value) => clean(value || 'Not provided', 500);
const roleName = (value) => clean(value, 100).replace(/\s+Agent\b/gi, '').trim() || 'Business Planning';
const polished = (value) => clean(value, 12000)
  .replace(/\s*\|\s*Prepared by:\s*[^|\n]+/gi, '')
  .replace(/[*_`#]+/g, '')
  .replace(/[★☆✓✗→]/g, '')
  .replace(/×/g, ' times ')
  .replace(/^[-=━─]{3,}$/gm, '')
  .replace(/\[[^\]]+\]\s*%/g, 'unconfirmed')
  .replace(/\[([^\]]+)\]/g, 'confirm this detail')
  .replace(/\b(\d+(?:\.\d+)?)\s*%/g, '$1 percent')
  .replace(/%/g, ' percent')
  .replace(/\bAI[- ]generated\b/gi, 'prepared')
  .replace(/\bas an AI\b/gi, '')
  .replace(/\bAI agent\b/gi, 'business specialist')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - 58) doc.addPage();
}

function pageDecor(doc, meta, pageNumber) {
  const w = doc.page.width;
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.save().rect(0, 0, w, 7).fill(COLORS.purple);
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
    .text('PRODUCT IMAGINATION - BUSINESS GROWTH PLAN', 48, doc.page.height - 35, {width:w - 96, lineBreak:false})
    .text(`${meta.company}  |  ${pageNumber}`, 48, doc.page.height - 35, {width:w - 96, align:'right', lineBreak:false});
  doc.restore();
  doc.page.margins.bottom = originalBottomMargin;
}

function sectionTitle(doc, title, subtitle) {
  ensureSpace(doc, 70);
  const left = 48;
  const width = doc.page.width - 96;
  doc.moveDown(.4);
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.ink).text(title, left, doc.y, {width});
  if (subtitle) {
    doc.moveDown(.2);
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.muted).text(subtitle, left, doc.y, {width, lineGap:2});
  }
  doc.moveDown(.55).strokeColor(COLORS.line).lineWidth(1).moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).stroke().moveDown(.7);
}

function pathStep(doc, number, title, detail) {
  ensureSpace(doc, 54);
  const y = doc.y;
  doc.circle(66, y + 13, 13).fill(COLORS.purple);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white).text(String(number), 58, y + 7, {width:16, align:'center'});
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLORS.ink).text(title, 92, y + 2, {width:doc.page.width - 146});
  doc.font('Helvetica').fontSize(9.2).fillColor(COLORS.body).text(detail, 92, y + 19, {width:doc.page.width - 146, lineGap:2});
  doc.y = y + 50;
}

function actionGuide(doc) {
  ensureSpace(doc, 78);
  const y = doc.y;
  doc.roundedRect(48, y, doc.page.width - 96, 62, 9).fill('#F5F6FF');
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.purple).text('FOLLOW THIS ORDER', 64, y + 12, {width:doc.page.width - 128});
  doc.font('Helvetica').fontSize(9.2).fillColor(COLORS.body)
    .text('1. Read the finding.   2. Choose the next action.   3. Assign an owner and date.   4. Review progress.', 64, y + 30, {width:doc.page.width - 128, lineGap:3});
  doc.y = y + 76;
}

function keyValue(doc, label, value) {
  ensureSpace(doc, 34);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.purple).text(label.toUpperCase(), 54, y, {width:118});
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.body).text(field(value), 172, y, {width:doc.page.width - 226, lineGap:2});
  doc.y = Math.max(doc.y, y + 24);
}

function orderedDeliverable(text) {
  const raw = polished(text);
  const order = ['EXECUTIVE SUMMARY','KEY FINDINGS','RECOMMENDED ACTIONS','OWNERS AND TIMING','DECISIONS NEEDED','NEXT STEPS'];
  const sections = {};
  const opening = [];
  let current = null;
  raw.split(/\n+/).map(line => line.trim()).filter(Boolean).forEach(line => {
    const normalized = line.replace(/[:\-]\s*$/, '').toUpperCase();
    if (order.includes(normalized)) {
      current = normalized;
      if (!sections[current]) sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    } else {
      opening.push(line);
    }
  });
  if (Object.keys(sections).length < 2) return raw;
  if (opening.length) sections['EXECUTIVE SUMMARY'] = opening.concat(sections['EXECUTIVE SUMMARY'] || []);
  return order.filter(title => sections[title] && sections[title].length)
    .map(title => title + '\n' + sections[title].join('\n')).join('\n');
}

function writeDeliverable(doc, text) {
  const paragraphs = orderedDeliverable(text).split(/\n+/).map(s => s.trim()).filter(Boolean).slice(0, 100);
  paragraphs.forEach(paragraph => {
    const bullet = /^-\s+/.test(paragraph);
    const numbered = /^\d+[.)]\s+/.test(paragraph);
    const heading = !bullet && !numbered && paragraph.length < 90 && (/[:\-]$/.test(paragraph) || /^[A-Z][A-Z\s&/]+$/.test(paragraph));
    if (heading) {
      ensureSpace(doc, 44);
      doc.moveDown(.45).font('Helvetica-Bold').fontSize(12).fillColor(COLORS.ink)
        .text(paragraph.replace(/[:\-]$/, ''), 54, doc.y, {width:doc.page.width - 108, lineGap:2});
    } else if (bullet || numbered) {
      ensureSpace(doc, 38);
      const marker = numbered ? (paragraph.match(/^\d+[.)]/) || ['1.'])[0] : '-';
      const body = paragraph.replace(/^(-|\d+[.)])\s+/, '');
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.purple).text(marker, 56, y, {width:24});
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.body).text(body, 84, y, {width:doc.page.width - 138, lineGap:3});
      doc.y += 3;
    } else {
      ensureSpace(doc, 42);
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.body)
        .text(paragraph, 54, doc.y, {width:doc.page.width - 108, lineGap:3});
    }
    doc.moveDown(.5);
  });
}

function recommendedAction(agent) {
  const lines = orderedDeliverable(agent.deliverable || '').split(/\n+/).map(line => line.trim()).filter(Boolean);
  const start = lines.findIndex(line => line.replace(/[:\-]\s*$/, '').toUpperCase() === 'RECOMMENDED ACTIONS');
  if (start >= 0 && lines[start + 1]) return clean(lines[start + 1].replace(/^(-|\d+[.)])\s+/, ''), 180);
  if (Array.isArray(agent.outputs) && agent.outputs[0]) return `Review and complete ${clean(agent.outputs[0], 150).toLowerCase()}.`;
  return `Review the ${roleName(agent.name).toLowerCase()} findings and choose the first action.`;
}

function promptCard(doc, number, title, prompt) {
  ensureSpace(doc, 126);
  const y = doc.y;
  doc.roundedRect(48, y, doc.page.width - 96, 108, 10).fill('#F5F6FF');
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.purple).text(`PROMPT ${number}`, 64, y + 14);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.ink).text(title, 64, y + 30, {width:doc.page.width - 128});
  doc.font('Helvetica').fontSize(9.2).fillColor(COLORS.body).text(prompt, 64, y + 51, {width:doc.page.width - 128, lineGap:3});
  doc.y = y + 120;
}

exports.handler = async (event) => {
  const options = preflight(event); if (options) return options;
  if (event.httpMethod !== 'POST') return json(405, {error:'Method not allowed.'});
  const data = parseBody(event);
  if (!data || !data.brief || !Array.isArray(data.agents)) return json(400, {error:'Report data is required.'});

  const brief = data.brief;
  const company = field(brief.client || brief.company || 'Your Business');
  const project = field(brief.project || 'Business Growth Plan');
  const meta = {company};
  const doc = new PDFDocument({size:'LETTER', margins:{top:48,bottom:54,left:48,right:48}, bufferPages:true, info:{Title:`${project} - Business Growth Plan`, Author:'Product Imagination', Subject:'Stakeholder-ready business growth plan'}});
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); });

  // Cover
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.navy);
  doc.rect(0, 0, doc.page.width, 9).fill(COLORS.purple);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#A5B4FC').text('PRODUCT IMAGINATION', 54, 64, {characterSpacing:1.4});
  doc.font('Helvetica-Bold').fontSize(31).fillColor(COLORS.white).text(project, 54, 160, {width:doc.page.width - 108, lineGap:4});
  doc.moveDown(.45).font('Helvetica').fontSize(15).fillColor('#C7C9DB').text('Business Workflow Report', {width:doc.page.width - 108});
  doc.moveDown(2.2).roundedRect(54, doc.y, doc.page.width - 108, 116, 12).fill('#171A35');
  const boxY = doc.y + 20;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#A5B4FC').text('PREPARED FOR', 74, boxY);
  doc.font('Helvetica-Bold').fontSize(17).fillColor(COLORS.white).text(company, 74, boxY + 18, {width:doc.page.width - 148});
  doc.font('Helvetica').fontSize(9.5).fillColor('#AEB1C7').text(`${field(data.template)}  |  ${new Date(data.generatedAt || Date.now()).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}`, 74, boxY + 53);
  doc.font('Helvetica').fontSize(9).fillColor('#8F93AA').text('Prepared from the company brief, supporting analysis, and approved recommendations.', 74, boxY + 77);
  doc.font('Helvetica').fontSize(8).fillColor('#777B95').text('Confidential - prepared for your business use', 54, doc.page.height - 78);

  // Executive overview
  doc.addPage();
  sectionTitle(doc, 'Executive Overview', 'A simple summary of what this workflow produced and what matters next.');
  doc.roundedRect(48, doc.y, doc.page.width - 96, 82, 10).fill(COLORS.card);
  const overviewY = doc.y + 17;
  doc.font('Helvetica-Bold').fontSize(25).fillColor(COLORS.purple).text(String(data.averageScore || 0), 66, overviewY, {width:70});
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink).text(`${clean(data.overallRating,60)} overall quality`, 138, overviewY + 2);
  doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.body).text(`${data.agents.length} business workstreams were completed for ${company}. This report turns the findings into practical decisions and actions.`, 138, overviewY + 22, {width:doc.page.width - 210, lineGap:3});
  doc.y = overviewY + 90;
  sectionTitle(doc, 'Business Snapshot');
  keyValue(doc, 'Business', company);
  keyValue(doc, 'Primary goal', brief.goal);
  keyValue(doc, 'Requested work', brief.deliverable);
  keyValue(doc, 'Audience', brief.audience);
  keyValue(doc, 'Timeline', brief.deadline);
  keyValue(doc, 'Budget', brief.budget);
  keyValue(doc, 'Voice', brief.tone);
  sectionTitle(doc, 'How This Report Is Organized', 'The sections always appear in this order.');
  pathStep(doc, 1, 'Business Snapshot', 'Confirm the business goal, requested work, audience, timeline, and budget.');
  pathStep(doc, 2, 'Findings and Action Plan', 'Review the detailed findings, actions, owners, timing, and decisions for each workstream.');
  pathStep(doc, 3, 'Recommended Next Moves', 'Use the final priority list only after reviewing the supporting findings.');

  // Scorecard
  doc.addPage();
  sectionTitle(doc, 'Plan Quality Review', 'Review scores for each completed part of the business plan.');
  data.agents.forEach(agent => {
    ensureSpace(doc, 38);
    const y = doc.y;
    const score = Math.max(0, Math.min(100, Number(agent.score || 0)));
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.ink).text(roleName(agent.name), 54, y, {width:190});
    doc.roundedRect(250, y + 2, 190, 7, 3.5).fill('#E7E8F1');
    doc.roundedRect(250, y + 2, 190 * score / 100, 7, 3.5).fill(score >= 85 ? COLORS.green : COLORS.purple);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink).text(String(score), 450, y, {width:28,align:'right'});
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(clean(agent.rating,40), 484, y, {width:64,align:'right'});
    doc.y = y + 27;
  });

  // Real deliverables
  data.agents.forEach((agent, index) => {
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.purple).text(`WORKSTREAM ${String(index + 1).padStart(2,'0')}`, 48, doc.y, {width:doc.page.width - 96});
    doc.moveDown(.35).font('Helvetica-Bold').fontSize(22).fillColor(COLORS.ink).text(roleName(agent.name), 48, doc.y, {width:doc.page.width - 96});
    doc.moveDown(.3).font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(`Review score: ${Number(agent.score || 0)}/100 - ${clean(agent.rating,50)}`, 48, doc.y, {width:doc.page.width - 96});
    doc.moveDown(.9);
    sectionTitle(doc, 'Findings and Action Plan', 'Follow the sections below in order: summary, findings, actions, ownership, and decisions.');
    actionGuide(doc);
    if (Array.isArray(agent.outputs) && agent.outputs.length) {
      ensureSpace(doc, 38);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.ink).text('PLAN OVERVIEW', 54, doc.y, {width:doc.page.width - 108});
      doc.moveDown(.5);
      agent.outputs.slice(0,8).forEach(output => {
        ensureSpace(doc, 32);
        const y = doc.y;
        doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.green).text('-', 56, y, {width:18});
        doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.body).text(polished(output), 80, y, {width:doc.page.width - 134, lineGap:3});
        doc.moveDown(.55);
      });
    }
    writeDeliverable(doc, agent.deliverable || 'No deliverable text was available for this workstream.');
  });

  // Recommendations come after the supporting findings so the document reads in decision order.
  doc.addPage();
  sectionTitle(doc, 'Recommended Next Moves', 'Complete these priorities after reviewing the Findings and Action Plan workstreams.');
  const topAgents = data.agents.slice().sort((a,b) => Number(b.score||0) - Number(a.score||0)).slice(0,5);
  topAgents.forEach((agent, index) => {
    ensureSpace(doc, 58);
    const y = doc.y;
    doc.circle(68, y + 12, 12).fill(COLORS.purple);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLORS.white).text(String(index + 1), 60, y + 6, {width:16, align:'center'});
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink).text(roleName(agent.name), 94, y, {width:doc.page.width - 148});
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.body).text(recommendedAction(agent), 94, y + 18, {width:doc.page.width - 148, lineGap:3});
    doc.y = y + 54;
  });

  // Beginner-ready prompts
  doc.addPage();
  sectionTitle(doc, 'Simple Prompts to Prepare Your Business', 'Use these before your consultation or whenever you want a clearer business overview.');
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.body)
    .text('How to use them: replace the words in parentheses with your information. Copy one prompt at a time into ChatGPT or another AI chat. Read the answer, correct anything that is wrong, and save the useful parts in your business folder.', 54, doc.y, {width:doc.page.width - 108, lineGap:4});
  doc.moveDown(1);
  promptCard(doc, 1, 'Create a simple business overview', `Help me create a one-page overview for ${company}. We help (type of customer) with (main problem) by offering (product or service). Our main goal is ${field(brief.goal)}. Ask me one simple question at a time, then organize my answers into a clear overview.`);
  promptCard(doc, 2, 'Check the health of the business', 'Help me review my business in five areas: customers, sales, marketing, daily operations, and money. Ask one basic question at a time. After I answer, show what is working, what needs attention, and the three best next steps. Do not guess numbers or facts.');
  promptCard(doc, 3, 'Build a fill-in customer and offer template', 'Create a simple worksheet I can fill out for my ideal customer, their main need, my offer, my price, why they should trust me, and the next action I want them to take. Include one short example under each question.');
  promptCard(doc, 4, 'Prepare for a business consultation', `Help me prepare for a business consultation about ${company}. Ask about my current stage, biggest challenge, main goal, customers, offer, sales, marketing, operations, and budget. Then create a short consultation brief with my priorities, open questions, and decisions I need help making.`);

  // Closing page
  doc.addPage();
  sectionTitle(doc, 'Use This Report');
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.body).text('Use this document as your working business guide. Confirm the goal, review each workstream in order, assign every action to one person, add a due date, and review progress regularly.', 48, doc.y, {width:doc.page.width - 96, lineGap:5});
  doc.moveDown(1.2).roundedRect(48, doc.y, doc.page.width - 96, 96, 12).fill('#EEF0FF');
  const nextY = doc.y + 18;
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.ink).text('Need help putting the plan into action?', 66, nextY);
  doc.moveDown(.45).font('Helvetica').fontSize(10).fillColor(COLORS.body).text('Schedule a free consultation with Erika through the completed workflow screen or contact hello@productimagination.com.', 66, doc.y, {width:doc.page.width - 132,lineGap:3});

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) { doc.switchToPage(i); pageDecor(doc, meta, i + 1); }
  doc.end();
  await finished;
  const pdf = Buffer.concat(chunks);
  return {statusCode:200,isBase64Encoded:true,headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${project.replace(/[^A-Za-z0-9]+/g,'-')}-Business-Report.pdf"`,'Cache-Control':'no-store'},body:pdf.toString('base64')};
};
