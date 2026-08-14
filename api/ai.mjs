import { FOODS, KNOWN_KEYS, nutritionFor } from '../data/foods.mjs';
const MODEL='gpt-5-mini';
const NUMBER_WORDS={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10};
const FILLER=new Set(['i','ate','had','have','for','breakfast','lunch','dinner','and','with','plus','a','an','the','de','y','con','comi','comí','desayuno','comida','cena']);
function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));}
function norm(s=''){return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
function parseQty(t){if(!t)return 1;if(/^\d+(?:\.\d+)?$/.test(t))return Number(t);return NUMBER_WORDS[t]||1;}
function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function deterministicFoodParse(text){
 const input=norm(text),candidates=[],qtyWords=Object.keys(NUMBER_WORDS).join('|');
 for(const key of KNOWN_KEYS)for(const rawAlias of FOODS[key].aliases){const alias=norm(rawAlias);const re=new RegExp(`(?:\\b(\\d+(?:\\.\\d+)?|${qtyWords})\\s+)?\\b${esc(alias)}\\b`,'g');let m;while((m=re.exec(input)))candidates.push({key,alias,quantity:parseQty(m[1]),hasQty:!!m[1],start:m.index,end:re.lastIndex});}
 candidates.sort((a,b)=>(Number(b.hasQty)-Number(a.hasQty))||a.start-b.start||(b.end-b.start)-(a.end-a.start));
 const matches=[],occupied=[];for(const c of candidates){if(occupied.some(([a,b])=>c.start<b&&c.end>a))continue;matches.push(c);occupied.push([c.start,c.end]);}
 if(!matches.length)return null;matches.sort((a,b)=>a.start-b.start);
 let leftover=input;for(const m of [...matches].sort((a,b)=>b.start-a.start))leftover=leftover.slice(0,m.start)+' '+leftover.slice(m.end);
 const unknown=norm(leftover).split(' ').filter(Boolean).filter(w=>!FILLER.has(w)&&!NUMBER_WORDS[w]&&!/^\d+(?:\.\d+)?$/.test(w));if(unknown.length)return null;
 const items=matches.map(m=>({key:m.key,quantity:m.quantity,...nutritionFor(m.key,m.quantity,null,null)}));
 const totals=items.reduce((a,i)=>({calories:a.calories+i.calories,protein_g:a.protein_g+i.protein_g,carbs_g:a.carbs_g+i.carbs_g,fat_g:a.fat_g+i.fat_g}),{calories:0,protein_g:0,carbs_g:0,fat_g:0});
 return{type:'food',name:items.map(i=>`${i.quantity} ${i.label}${i.quantity===1?'':'s'}`).join(' + '),items,calories:Math.round(totals.calories),protein_g:+totals.protein_g.toFixed(1),carbs_g:+totals.carbs_g.toFixed(1),fat_g:+totals.fat_g.toFixed(1),note:'Calculated from local reference foods; no AI estimate used.',answer:'',source:'local-reference',model:'deterministic-local'};
}
function workoutCalories(met,minutes,weightKg){
 const m=Number(met)||0,min=Number(minutes)||0,kg=Number(weightKg)||0;
 if(!m||!min||!kg)return 0;
 return Math.max(0,Math.round(m*3.5*kg/200*min));
}
export default async function handler(req,res){if(req.method!=='POST')return json(res,405,{error:'POST only'});try{
 const body=typeof req.body==='string'?JSON.parse(req.body):(req.body||{}),text=String(body.text||'').trim().slice(0,1200),user=String(body.user||'User').slice(0,40),context=body.context&&typeof body.context==='object'?body.context:{};if(!text)return json(res,400,{error:'Missing text'});
 const direct=deterministicFoodParse(text);if(direct)return json(res,200,direct);
 const apiKey=(process.env.OPENAI_API_KEY||process.env.OPEN_API_KEY||process.env.open_api_key||process.env.openai_api_key||'').trim();if(!apiKey)return json(res,500,{error:'OpenAI API key is not configured for this deployment'});
 const catalog=KNOWN_KEYS.map(k=>`${k}: ${FOODS[k].label} (${FOODS[k].per})`).join('; ');
 const system=`You are a precise fallback parser for a private nutrition and workout logging app. ONLY parse the CURRENT user message. Never import foods, workouts, or quantities from previous messages. User: ${user}. Known local food keys: ${catalog}.
For food/drink, split only the current message into ingredients. Preserve every stated food and quantity. Match a known key when appropriate. Generic tortilla means corn_tortilla_6in unless flour/harina is explicit. Unknown prepared foods use key 'unknown' and estimate only that item conservatively.
For workouts, identify the activity, duration in minutes if stated, and choose a conservative MET value representing the overall session intensity. Examples: light resistance training around 3.5 MET, moderate resistance/calisthenics around 5 MET, vigorous circuit/calisthenics around 7-8 MET, brisk walking around 4 MET, jogging around 7 MET. If duration is not stated, set duration_min=0 and note that calorie burn cannot be estimated until duration is provided. Do not fabricate duration. The server will calculate calories from MET, duration, and the user's saved weight.
For general questions, answer concisely. Current profile context: ${JSON.stringify(context)}.`;
 const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages:[{role:'system',content:system},{role:'user',content:text}],response_format:{type:'json_schema',json_schema:{name:'fitness_parse',strict:true,schema:{type:'object',additionalProperties:false,properties:{type:{type:'string',enum:['food','workout','question']},name:{type:'string'},items:{type:'array',items:{type:'object',additionalProperties:false,properties:{key:{type:'string',enum:[...KNOWN_KEYS,'unknown']},label:{type:'string'},quantity:{type:'number',minimum:0},grams:{type:'number',minimum:0},ml:{type:'number',minimum:0},estimated_calories:{type:'number',minimum:0},estimated_protein_g:{type:'number',minimum:0},estimated_carbs_g:{type:'number',minimum:0},estimated_fat_g:{type:'number',minimum:0}},required:['key','label','quantity','grams','ml','estimated_calories','estimated_protein_g','estimated_carbs_g','estimated_fat_g']}},duration_min:{type:'number',minimum:0},met:{type:'number',minimum:0,maximum:20},note:{type:'string'},answer:{type:'string'}},required:['type','name','items','duration_min','met','note','answer']}}}})});
 const data=await response.json();if(!response.ok)return json(res,response.status,{error:data?.error?.message||'AI request failed'});const raw=data?.choices?.[0]?.message?.content;if(!raw)return json(res,502,{error:'AI returned no content'});const parsed=JSON.parse(raw);
 if(parsed.type==='workout'){
  const weightKg=Number(context.weight_kg)||0;const burn=workoutCalories(parsed.met,parsed.duration_min,weightKg);
  const noteParts=[];if(parsed.note)noteParts.push(parsed.note);if(!weightKg)noteParts.push('Add body weight in Profile to estimate calories burned.');else if(!parsed.duration_min)noteParts.push('Add workout duration to estimate calories burned.');else noteParts.push(`Estimated using ${parsed.met} MET and ${weightKg} kg body weight.`);
  return json(res,200,{type:'workout',name:parsed.name||text,duration_min:+parsed.duration_min||0,met:+parsed.met||0,calories_burned:burn,note:noteParts.join(' '),answer:'',source:'met-estimate',model:MODEL});
 }
 if(parsed.type!=='food')return json(res,200,{...parsed,calories:0,protein_g:0,carbs_g:0,fat_g:0,source:'ai-parser',model:MODEL});
 const resolved=parsed.items.map(item=>item.key!=='unknown'?{...item,...nutritionFor(item.key,item.quantity,item.grams,item.ml)}:{...item,calories:Math.round(item.estimated_calories||0),protein_g:+(item.estimated_protein_g||0).toFixed(1),carbs_g:+(item.estimated_carbs_g||0).toFixed(1),fat_g:+(item.estimated_fat_g||0).toFixed(1),source:'ai-estimate'});
 const totals=resolved.reduce((a,i)=>({calories:a.calories+(i.calories||0),protein_g:a.protein_g+(i.protein_g||0),carbs_g:a.carbs_g+(i.carbs_g||0),fat_g:a.fat_g+(i.fat_g||0)}),{calories:0,protein_g:0,carbs_g:0,fat_g:0}),sources=[...new Set(resolved.map(i=>i.source))];return json(res,200,{type:'food',name:parsed.name||text,items:resolved,calories:Math.round(totals.calories),protein_g:+totals.protein_g.toFixed(1),carbs_g:+totals.carbs_g.toFixed(1),fat_g:+totals.fat_g.toFixed(1),note:parsed.note,answer:parsed.answer,source:sources.length===1?sources[0]:'mixed',model:MODEL});
}catch(error){console.error(error);return json(res,500,{error:'Unable to process entry'});}}
