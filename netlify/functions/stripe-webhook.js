'use strict';
const Stripe=require('stripe');
const {getStore}=require('@netlify/blobs');

exports.handler=async event=>{
  if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET)return{statusCode:503,body:'Stripe webhook is not configured.'};
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
  let stripeEvent;
  try{
    const payload=event.isBase64Encoded?Buffer.from(event.body||'','base64'):event.body||'';
    stripeEvent=stripe.webhooks.constructEvent(payload,event.headers['stripe-signature']||event.headers['Stripe-Signature'],process.env.STRIPE_WEBHOOK_SECRET);
  }catch(error){return{statusCode:400,body:`Webhook Error: ${error.message}`};}
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(stripeEvent.type)){
    const session=stripeEvent.data.object;
    if(session.payment_status!=='unpaid'){
      const store=getStore('package-orders');
      const existing=await store.get(`stripe_${session.id}`,{type:'json'}).catch(()=>null);
      if(!existing)await store.setJSON(`stripe_${session.id}`,{sessionId:session.id,email:session.customer_details&&session.customer_details.email,packageId:session.metadata.packageId,businessType:session.metadata.businessType,paidAt:new Date().toISOString(),amountTotal:session.amount_total,currency:session.currency});
    }
  }
  return{statusCode:200,body:'received'};
};
