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

function sectionLine(agent, heading, fallback) {
  const lines = orderedDeliverable(agent && agent.deliverable || '').split(/\n+/).map(line => line.trim()).filter(Boolean);
  const index = lines.findIndex(line => line.replace(/[:\-]\s*$/, '').toUpperCase() === heading);
  const value = index >= 0 ? lines[index + 1] : fallback;
  return clean(String(value || 'Confirm this during the next business review.').replace(/^(-|\d+[.)])\s+/, ''), 190);
}

function selectPlanAgent(agents, names, fallbackIndex) {
  return agents.find(agent => names.some(name => String(agent.name || '').toLowerCase().includes(name)))
    || agents[Math.min(fallbackIndex, Math.max(0, agents.length - 1))]
    || {name:'Business Planning', outputs:[], deliverable:''};
}

function onePageSection(doc, y, number, title, agent) {
  const width = doc.page.width - 96;
  const finding = sectionLine(agent, 'KEY FINDINGS', agent.outputs && agent.outputs[0]);
  const action = sectionLine(agent, 'RECOMMENDED ACTIONS', agent.outputs && agent.outputs[1]);
  doc.roundedRect(48, y, width, 116, 10).fill('#F7F8FC');
  doc.circle(70, y + 24, 13).fill(COLORS.purple);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white).text(String(number), 62, y + 18, {width:16, align:'center'});
  doc.font('Helvetica-Bold').fontSize(15).fillColor(COLORS.ink).text(title, 94, y + 14, {width:width - 62});
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.purple).text('MOST IMPORTANT INSIGHT', 66, y + 48, {width:140});
  doc.font('Helvetica').fontSize(9.2).fillColor(COLORS.body).text(finding, 210, y + 46, {width:width - 178, lineGap:2});
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.green).text('NEXT ACTION', 66, y + 80, {width:140});
  doc.font('Helvetica').fontSize(9.2).fillColor(COLORS.body).text(action, 210, y + 78, {width:width - 178, lineGap:2});
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

  const agents = data.agents || [];
  const discovery = selectPlanAgent(agents, ['discovery','research'], 0);
  const strategy = selectPlanAgent(agents, ['strategy','financial'], 1);
  const operations = selectPlanAgent(agents, ['operations','implementation','handoff','ops'], 2);
  const generatedDate = new Date(data.generatedAt || Date.now()).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});

  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.purple).text('PRODUCT IMAGINATION', 48, 42, {width:doc.page.width - 96, characterSpacing:1.2});
  doc.font('Helvetica-Bold').fontSize(25).fillColor(COLORS.ink).text('Business Growth Plan', 48, 62, {width:doc.page.width - 96});
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text(`${company}  |  ${generatedDate}`, 48, 96, {width:doc.page.width - 96});

  doc.roundedRect(48, 120, doc.page.width - 96, 84, 10).fill('#EEF0FF');
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.purple).text('BUSINESS GOAL', 64, 136, {width:110});
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.ink).text(field(brief.goal), 178, 133, {width:doc.page.width - 242, lineGap:2});
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.purple).text('SUCCESS WINDOW', 64, 171, {width:110});
  doc.font('Helvetica').fontSize(9.2).fillColor(COLORS.body).text(`${field(brief.deadline)} | Audience: ${field(brief.audience)}`, 178, 169, {width:doc.page.width - 242});

  onePageSection(doc, 220, 1, 'Discovery', discovery);
  onePageSection(doc, 350, 2, 'Strategy', strategy);
  onePageSection(doc, 480, 3, 'Operations', operations);

  doc.roundedRect(48, 612, doc.page.width - 96, 74, 10).fill('#ECFDF5');
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.green).text('FOCUS FOR BUSINESS SUCCESS', 64, 626, {width:doc.page.width - 128});
  doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.body)
    .text('Confirm the customer need, choose one clear strategy, and complete the first operations action before adding more work.', 64, 646, {width:doc.page.width - 128, lineGap:3});
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
    .text('Need help? Schedule a free consultation with Erika from your workflow summary.', 64, 671, {width:doc.page.width - 128});

  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.purple).text('BUSINESS BUILDER SUPPORT', 48, 42, {width:doc.page.width - 96, characterSpacing:1.2});
  doc.font('Helvetica-Bold').fontSize(23).fillColor(COLORS.ink).text('Prompts to Help You Get Started', 48, 62, {width:doc.page.width - 96});
  doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.muted)
    .text('Copy one prompt into ChatGPT or another trusted assistant. Replace any missing detail, then answer one question at a time.', 48, 94, {width:doc.page.width - 96, lineGap:2});
  doc.y = 126;

  promptCard(doc, 1, 'Create a simple starting plan',
    `I am building ${company}. My main goal is ${field(brief.goal)}. My customer is ${field(brief.audience)}. Create a simple one-page plan covering my offer, customer, price, and first three actions. Ask me one easy question at a time when information is missing.`);
  promptCard(doc, 2, 'Learn what customers truly need',
    `My business is ${company}. I want to help ${field(brief.audience)}. Give me five short questions to ask potential customers. Explain what each answer will help me understand. Do not assume facts about my customers.`);
  promptCard(doc, 3, 'Build a practical 30-day action plan',
    `Create a realistic 30-day plan for ${company} to work toward this goal: ${field(brief.goal)}. Consider my budget of ${field(brief.budget)} and timeline of ${field(brief.deadline)}. Give me three priorities for each week and one clear result to check.`);
  promptCard(doc, 4, 'Prepare for your consultation',
    `Help me prepare for a business consultation about ${company}. My goal is ${field(brief.goal)}. Summarize my current situation, the decisions I need to make, my biggest questions, my budget, and my timeline. Keep it to one page and identify any information I should bring to the meeting.`);

  const prepY = doc.y;
  doc.roundedRect(48, prepY, doc.page.width - 96, 91, 10).fill('#ECFDF5');
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.green).text('BRING THESE FIVE THINGS TO YOUR CONSULTATION', 64, prepY + 13, {width:doc.page.width - 128});
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.body)
    .text('1. Your main goal   2. Who you want to help   3. Your offer or idea   4. Your budget and timeline   5. Your top three questions', 64, prepY + 33, {width:doc.page.width - 128, lineGap:3});
  doc.font('Helvetica-Bold').fontSize(8.7).fillColor(COLORS.green)
    .text('You do not need perfect answers. Bring what you know, and our team will help you find the next step.', 64, prepY + 66, {width:doc.page.width - 128, lineGap:2});

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) { doc.switchToPage(i); pageDecor(doc, meta, i + 1); }
  doc.end();
  await finished;
  const pdf = Buffer.concat(chunks);
  return {statusCode:200,isBase64Encoded:true,headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${project.replace(/[^A-Za-z0-9]+/g,'-')}-Business-Report.pdf"`,'Cache-Control':'no-store'},body:pdf.toString('base64')};
};

