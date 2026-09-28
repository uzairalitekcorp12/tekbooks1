export type Activity = {id:number;label:string;slow:boolean;priority:number};
export type ActivitySnapshot = {current:Activity|null;count:number};
const idle:ActivitySnapshot={current:null,count:0};
let snapshot=idle;
let nextId=0;
const listeners=new Set<()=>void>();
const pending=new Map<number,Activity&{visible:boolean}>();

function publish(){
  const visible=[...pending.values()].filter(x=>x.visible);
  // Keep a file transfer or sign-in visible while related background requests run.
  visible.sort((a,b)=>b.priority-a.priority||a.id-b.id);
  const first=visible[0];
  snapshot=first?{current:{id:first.id,label:first.label,slow:first.slow,priority:first.priority},count:visible.length}:idle;
  listeners.forEach(listener=>listener());
}
export function subscribeToActivity(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
export function getActivitySnapshot(){return snapshot}

export function beginActivity(label:string,priority=0){
  const id=++nextId;
  const activity={id,label,priority,slow:false,visible:false};
  pending.set(id,activity);
  // Fast operations never flash a banner; longer ones get an honest waiting hint.
  const reveal=setTimeout(()=>{activity.visible=true;publish()},250);
  const slow=setTimeout(()=>{activity.slow=true;if(activity.visible)publish()},10000);
  return{
    update(label:string){if(pending.has(id)){activity.label=label;if(activity.visible)publish()}},
    end(){
      clearTimeout(reveal);clearTimeout(slow);
      if(pending.delete(id)&&activity.visible)publish();
    },
  };
}

export function requestActivityLabel(path:string,method:string){
  const route=path.split('?')[0];
  const auth:Record<string,string>={
    '/auth/login':'Signing in…','/auth/signup':'Creating your workspace…',
    '/auth/verify-email':'Verifying your email…','/auth/resend-verification':'Sending verification code…',
    '/auth/forgot-password':'Sending reset code…','/auth/reset-password':'Resetting your password…',
    '/auth/device/verify':'Verifying this device…','/auth/device/status':'Checking device approval…',
    '/auth/device/requests':'Fetching device requests…','/auth/device/approve':'Approving device…',
  };
  if(auth[route])return auth[route];
  if(route.startsWith('/uploads'))return method==='DELETE'?'Removing attachment…':'Preparing attachment…';
  if(route.endsWith('/pdf-check'))return 'Preparing invoice PDF…';
  if(route.includes('/devices'))return method==='GET'?'Fetching device requests…':'Updating device approval…';
  const resource=route.split('/')[1];
  const names:Record<string,string>={dashboard:'dashboard',profile:'profile',transactions:'transactions',invoices:'invoices',parties:'contacts',reports:'reports',admin:'device requests'};
  if(method==='GET')return `Fetching ${names[resource]||'data'}…`;
  if(method==='DELETE')return 'Deleting…';
  if(route.endsWith('/payments'))return 'Recording payment…';
  return `Saving ${names[resource]||'changes'}…`;
}
