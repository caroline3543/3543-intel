#!/usr/bin/env node
// PreToolUse guard for Bash. Backs up the permission rules in .claude/settings.json, which can be
// sidestepped by rephrasing (e.g. `git -C . push origin main`). Exit 2 = block, stderr goes to Claude.
let raw='';process.stdin.on('data',d=>raw+=d).on('end',()=>{
 let cmd='';try{cmd=JSON.parse(raw).tool_input?.command||''}catch{process.exit(0)}
 const c=cmd.replace(/\s+/g,' ');
 const rules=[
  [/\bgit\b[^|;&]*\bpush\b[^|;&]*(\s|:|\/)main\b/,'Pushing to main is production. Push a feature branch and open a PR; Caroline merges after staging.'],
  [/\bgit\b[^|;&]*\bpush\b[^|;&]*(\s--force\b|\s-f\b|\s--force-with-lease\b)/,'Force-push rewrites shared history. Not allowed from Claude.'],
  [/\bvercel\b[^|;&]*(--prod\b|\bpromote\b|\brollback\b)/,'Production deploy/promote/rollback needs Caroline\'s explicit approval in chat. Use a preview deploy.'],
  [/\bsupabase\b[^|;&]*\b(db\s+(push|reset)|functions\s+deploy|secrets\b|migration\s+repair)/,'Supabase changes touch live alliance data. Write the migration file and ask Caroline to apply it.'],
  [/\b(cat|less|more|head|tail|grep|sed|awk|cp|base64)\b[^|;&]*(^|\s|\/)\.env(\.local|\.[\w-]+\.local)?(\s|$)/,'Reading local .env files is blocked — they hold secrets. Use .env.production (public VITE_ values) only.'],
  [/\b(sb_secret_|service_role)\b/,'That looks like a Supabase secret/service key. Never use or print it.'],
 ];
 for(const [re,msg] of rules)if(re.test(c)){console.error('Blocked by .claude/hooks/guard-bash.mjs: '+msg);process.exit(2)}
 process.exit(0);
});
