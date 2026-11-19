import { useEffect, useState } from 'react';
export function useRouteValue(key: string, fallback: string, allowed: readonly string[]) {
 const read=()=>{const value=typeof window==='undefined'?null:new URLSearchParams(window.location.hash.slice(1)).get(key);return value!==null&&allowed.includes(value)?value:fallback;};
 const [value,setValue]=useState(read);
 useEffect(()=>{const update=()=>setValue(read());window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[key,fallback,allowed.join('|')]);
 function navigate(next:string){if(!allowed.includes(next))return;const params=new URLSearchParams(window.location.hash.slice(1));params.set(key,next);window.location.hash=params.toString();setValue(next);}
 return [value,navigate] as const;
}
