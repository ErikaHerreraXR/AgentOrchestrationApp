'use strict';
const Stripe = require('stripe');
const {json,parseBody,preflight} = require('./_shared');
const {PACKAGES,TYPES} = require('./_packages');

function checkoutOrigin(event) {
  const headers=event.headers||{};
  const host=headers['x-forwarded-host']||headers.host||'';
  const protocol=headers['x-forwarded-proto']||'https';
  const candidates=[
    process.env.SITE_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    headers.origin,
    event.rawUrl,
    host?`${protocol}://${host}`:''
  ];
  for(const candidate of candidates){
    if(!candidate)continue;
    try{
      const parsed=new URL(candidate);
      if(parsed.protocol==='https:'||parsed.protocol==='http:')return parsed.origin;
    }catch(_){}
  }
  return '';
}

exports.handler = async event => {
  const options=preflight(event); if(options)return options;
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  if(!process.env.STRIPE_SECRET_KEY)return json(503,{error:'Stripe is not configured yet.'});
  const body=parseBody(event)||{};
  const pack=PACKAGES[body.packageId];
  const businessType=TYPES[body.businessType]?body.businessType:'service';
  if(!pack)return json(400,{error:'Unknown package.'});
  const origin=checkoutOrigin(event);
  if(!origin)return json(500,{error:'The secure checkout return address could not be detected.'});
  try{
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
    const session=await stripe.checkout.sessions.create({
      // Do not attach a Customer ID: Checkout treats the buyer as a guest and
      // never requires a Stripe login. Stripe dynamically presents enabled,
      // eligible methods (including cards, Apple Pay and PayPal).
      mode:'payment',billing_address_collection:'auto',
      customer_creation:'if_required',
      line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:pack.amount,product_data:{name:pack.name,description:`${TYPES[businessType]} digital business-builder toolkit`}}}],
      metadata:{packageId:body.packageId,businessType,consultation:String(pack.consultation)},
      success_url:`${origin}/purchase-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${origin}/#pricing-section`,allow_promotion_codes:true
    });
    return json(200,{url:session.url});
  }catch(error){console.error('[Stripe checkout]',error.message);return json(502,{error:'Checkout could not be created.'});}
};
