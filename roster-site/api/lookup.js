import {authorized,respond} from '../server/access.js';
export default function handler(req,res){
 if(!authorized(req))return respond(res,401,{error:'Sign in to Caroline 3739.'});
 return respond(res,503,{error:'API refresh is disabled on this isolated testing clone. Your original Caroline 3573 website is unaffected.'});
}
