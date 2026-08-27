'use strict';
const Stripe=require('stripe');
const archiver=require('archiver');
const {PACKAGES,TYPES,fileContent}=require('./_packages');
const {json}=require('./_shared');

function buildZip(pack,businessType){
  return new Promise((resolve,reject)=>{
    const chunks=[];const archive=archiver('zip',{zlib:{level:9}});
    archive.on('data',chunk=>chunks.push(chunk));archive.on('end',()=>resolve(Buffer.concat(chunks)));archive.on('error',reject);
    const readme=`# ${pack.name}\n\nBusiness type: ${TYPES[businessType]}\n\nYour purchase includes ${pack.files.length} ready-to-use business tools. Open each Markdown file in any text editor, Word, Google Docs, ChatGPT, Claude, or your preferred AI tool. Replace the bracketed business information with your own details.\n\nWork through the files in numerical order. Keep your answers in one business folder so every later prompt can build on earlier decisions.\n`;
    archive.append(readme,{name:'00-START-HERE.md'});
    pack.files.forEach((title,index)=>archive.append(fileContent(title,businessType,pack.name),{name:`${String(index+1).padStart(2,'0')}-${title.replace(/[^A-Za-z0-9]+/g,'-')}.md`}));
    archive.finalize();
  });
}
exports.buildZip=buildZip;

exports.handler=async event=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed.'});
  if(!process.env.STRIPE_SECRET_KEY)return json(503,{error:'Stripe is not configured.'});
  const sessionId=event.queryStringParameters&&event.queryStringParameters.session_id;
  if(!sessionId)return json(400,{error:'Checkout session is required.'});
  try{
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
    const session=await stripe.checkout.sessions.retrieve(sessionId);
    if(session.payment_status==='unpaid')return json(402,{error:'Payment is not complete.'});
    const pack=PACKAGES[session.metadata.packageId];
    const businessType=TYPES[session.metadata.businessType]?session.metadata.businessType:'service';
    if(!pack)return json(404,{error:'Package was not found.'});
    if(event.queryStringParameters.info==='1')return json(200,{ok:true,name:pack.name,businessType:TYPES[businessType],consultation:pack.consultation,calendlyUrl:pack.consultation?(process.env.CALENDLY_URL||'https://calendly.com/metakittyz/30min'):''});
    const zip=await buildZip(pack,businessType);
    return{statusCode:200,isBase64Encoded:true,headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${pack.name.replace(/[^A-Za-z0-9]+/g,'-')}.zip"`,'Cache-Control':'no-store'},body:zip.toString('base64')};
  }catch(error){console.error('[Package download]',error.message);return json(403,{error:'This purchase could not be verified.'});}
};
