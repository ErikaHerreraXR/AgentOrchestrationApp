'use strict';

const PACKAGES = {
  new_basic:{name:'Start Smart Prompt Pack',amount:10000,consultation:false,files:['Business Plan','Ideal Customer Worksheet','Offer and Pricing Calculator','30-Day Launch Checklist','AI Prompt Pack']},
  new_launch:{name:'Launch Ready Prompt Pack',amount:25000,consultation:false,files:['Business Plan','Ideal Customer Worksheet','Offer and Pricing Calculator','30-Day Launch Checklist','Brand Voice Guide','Website Copy Kit','Social Launch Calendar','Sales and Outreach Scripts','AI Prompt Pack','Business Builder Workbook']},
  new_complete:{name:'Full Business Builder',amount:50000,consultation:true,files:['Business Plan','Ideal Customer Worksheet','Offer and Pricing Calculator','90-Day Launch Roadmap','Brand Voice Guide','Website Copy Kit','Marketing Campaign Planner','Social Content Calendar','Sales Pipeline and Scripts','Client Onboarding Kit','Operations Playbook','Budget and Cash-Flow Tracker','Finance Prompt Pack','Sales Prompt Pack','Marketing Prompt Pack','Operations Prompt Pack','Consultation Booking Guide']},
  existing_basic:{name:'Business Essentials',amount:15000,consultation:false,files:['Business Health Audit','Customer Experience Review','Offer and Pricing Audit','Marketing Planner','Operations Checklist','Sales Follow-Up Pack','Weekly Business Dashboard']},
  existing_growth:{name:'Business Growth',amount:35000,consultation:false,files:['Business Health Audit','Growth Strategy','Lead Generation System','Sales Pipeline and Scripts','Referral Program','90-Day Marketing Campaign','Operations Playbook','Customer Retention Plan','KPI Dashboard','Team Planning Prompts']},
  elite_builder:{name:'Elite Business Builder',amount:200000,consultation:true,files:['Elite Business Setup Roadmap','Business Plan','Offer and Pricing System','Ideal Customer Profile','Brand Direction','Website Same-Day Intake Checklist','Website Content and Page Plan','Website Launch Checklist','Hosting Setup Guide','Website Maintenance Plan','On-Demand Team Support Guide','Business Support Request Template','App Design Brief','App User Journey','App Screen Plan','App Feature Priorities','App Design Handoff','Marketing Launch Campaign','Sales Pipeline and Scripts','Client Onboarding System','Operations Playbook','Budget and Cash-Flow Tracker','90-Day Growth Roadmap','Private Consultation Guide','Final Launch Handoff Checklist']}
};

const TYPES = {
  service:'Service or Consulting', ecommerce:'Products or Ecommerce', property:'Property or Short-Term Rental', creator:'Creator or Personal Brand', local:'Local Business'
};

function fileContent(title, businessType, packageName) {
  const type = TYPES[businessType] || TYPES.service;
  return `# ${title}\n\nPackage: ${packageName}\nBusiness type: ${type}\n\n## Purpose\nUse this tool to make one clear decision and turn it into action. Keep answers short, specific, and based on real customer information.\n\n## Business Context\n- Business name:\n- Main offer or product:\n- Ideal customer:\n- Current stage:\n- Most important 90-day goal:\n\n## Guided Questions\n1. What result does the customer need most?\n2. What problem prevents that result today?\n3. Why should they choose this business?\n4. What proof supports the offer?\n5. What is the simplest next action?\n\n## AI Builder Prompt\nYou are a practical business coach for a ${type.toLowerCase()} business. Using my answers below, create a clear ${title.toLowerCase()}. Use everyday language, explain every recommendation, and end with three prioritized next steps. Do not invent facts. Ask one direct question when essential information is missing.\n\n[PASTE YOUR BUSINESS ANSWERS HERE]\n\n## Action Plan\n- This week:\n- This month:\n- Owner:\n- Success measure:\n\n## Review Checklist\n- Is this specific to the customer?\n- Can the owner take action today?\n- Are numbers and assumptions clearly labeled?\n- Is the next step obvious?\n`;
}

module.exports = {PACKAGES,TYPES,fileContent};
