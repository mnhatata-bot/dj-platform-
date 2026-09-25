'use client';
import { useState } from 'react';
export function Visual({src,alt,className=''}:{src?:string|null;alt:string;className?:string}) {
 const [failed,setFailed]=useState<string|null>(null);
 return <div className={`visual ${className}`}>
 {src && failed!==src ? <img src={src} alt={alt} loading="lazy" onError={()=>setFailed(src)}/> : <div className="visual-fallback" aria-hidden="true"><span>C / L</span><i/><b>CUELANCE</b></div>}
 </div>;
}
