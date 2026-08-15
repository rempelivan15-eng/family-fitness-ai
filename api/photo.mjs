const MODEL='gpt-5-mini';
function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));}
export default async function handler(req,res){
 if(req.method!=='POST')return json(res,405,{error:'POST only'});
 try{
  const body=typeof req.body==='string'?JSON.parse(req.body):(req.body||{});
  const image=String(body.image||'');
  const note=String(body.note||'').trim().slice(0,400);
  if(!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image))return json(res,400,{error:'Missing or unsupported image'});
  if(image.length>6_500_000)return json(res,413,{error:'Photo is too large. Please retake it.'});
  const apiKey=(process.env.OPENAI_API_KEY||process.env.OPEN_API_KEY||process.env.open_api_key||process.env.openai_api_key||'').trim();
  if(!apiKey)return json(res,500,{error:'OpenAI API key is not configured for this deployment'});
  const instructions=`Analyze ONE food photo for a private nutrition tracker. Estimate only what is visibly present, using the user's optional note only to clarify ingredients or portion. Do not invent foods that are not visible or stated. Portion size from a single image is uncertain, so use conservative central estimates and explicitly state uncertainty. Return a useful meal name, estimated calories and protein, and list the visible food components with estimated portions. If the image is not food, say so. Do not give medical advice.`;
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
   method:'POST',
   headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
   body:JSON.stringify({
    model:MODEL,
    messages:[
     {role:'system',content:instructions},
     {role:'user',content:[
      {type:'text',text:note?`Optional user note: ${note}`:'Estimate this food from the photo.'},
      {type:'image_url',image_url:{url:image,detail:'low'}}
     ]}
    ],
    response_format:{type:'json_schema',json_schema:{name:'food_photo_estimate',strict:true,schema:{
     type:'object',additionalProperties:false,
     properties:{
      is_food:{type:'boolean'},name:{type:'string'},calories:{type:'integer',minimum:0},protein_g:{type:'number',minimum:0},
      confidence:{type:'string',enum:['low','medium','high']},note:{type:'string'},
      items:{type:'array',items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},portion:{type:'string'},calories:{type:'integer',minimum:0},protein_g:{type:'number',minimum:0}},required:['name','portion','calories','protein_g']}}
     },required:['is_food','name','calories','protein_g','confidence','note','items']
    }}}
   })
  });
  const data=await response.json();
  if(!response.ok)return json(res,response.status,{error:data?.error?.message||'Photo analysis failed'});
  const raw=data?.choices?.[0]?.message?.content;if(!raw)return json(res,502,{error:'AI returned no photo estimate'});
  const parsed=JSON.parse(raw);
  return json(res,200,{...parsed,source:'ai-photo-estimate',model:MODEL});
 }catch(error){console.error(error);return json(res,500,{error:'Unable to analyze photo'});}
}
