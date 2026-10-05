'use strict';
/* Kinetic op-art backgrounds for the color panels.
   One pattern per screen, one animation loop, only the visible panel is drawn.
   Distortion, speed and double vision follow window.buzzIntensity (0..1, set by app.js). */
(()=>{
  const INK='rgba(255,247,236,.22)',GHOST='rgba(20,18,14,.10)'; // fine cream hairlines, dark offset copy
  const bubbles=(c,w,h,t,top,n,color,speedK=1)=>{
    for(let i=0;i<n;i++){
      const sx=(i*0.618034)%1,sy=(i*0.414214)%1,speed=(18+(i%7)*7)*speedK,r=1.2+(i%5)*.7;
      const y=h-((t*speed*2.4+sy*h)%h),x=sx*w+Math.sin(t*1.6+i)*3;
      if(y<top+6)continue;
      c.fillStyle=color(i);c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
    }
  };
  const gloss=(c,w,h,t,top,alpha)=>{ // slow diagonal light band
    const x=((t*40)%(w*2))-w*.5;
    const g=c.createLinearGradient(x,top,x+w*.35,h);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,`rgba(255,255,255,${alpha})`);g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g;c.fillRect(0,top-20,w,h);
  };
  const DRINKS={
    biere:{surface:58,wave:3,foam:true,empty:'#fff8ea',grad:['#f9cf3f','#eda216'],meniscus:'rgba(190,110,0,.22)',
      inside:(c,w,h,t,b,top)=>bubbles(c,w,h,t,top,46,i=>`rgba(255,248,225,${.18+(i%3)*.08})`)},
    vin:{surface:60,wave:1.6,slosh:.7,empty:'#f3e6df',grad:['#a3213f','#5a0b22','#3a0615'],meniscus:'rgba(255,190,205,.45)',
      inside:(c,w,h,t,b,top)=>{gloss(c,w,h,t,top,.10);}},
    cocktail:{surface:60,wave:2.4,empty:'#fff3ec',grad:['#ff8fab','#ff7b72','#ffa94d'],meniscus:'rgba(255,255,255,.55)',
      inside:(c,w,h,t,b,top,edge)=>{bubbles(c,w,h,t,top,60,()=>'rgba(255,255,255,.35)',1.6);
        }},
    shot:{surface:60,wave:1.2,slosh:1.3,empty:'#f5ebde',grad:['#d98b26','#8a4310','#4f2406'],meniscus:'rgba(255,220,160,.5)',
      inside:(c,w,h,t,b,top)=>{gloss(c,w,h,t,top,.14);
        // Warm caustics drifting through the spirit.
        for(let i=0;i<6;i++){const x=w*((i*.37+t*.02)%1),y=top+((i*.53)%1)*(h-top),r=40+i*9;
          const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,200,120,.16)');g.addColorStop(1,'rgba(255,200,120,0)');
          c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}}}
  };
  const patterns={
    // Home: the drink itself, generated from its type (beer, wine, cocktail, shot).
    // The liquid pours in when the type changes and sloshes more with the Buzz.
    'home-panel'(c,w,h,t,b,ghost,layer){
      const type=layer.panel.dataset.drink||'biere',spec=DRINKS[type]||DRINKS.biere;
      if(layer.type!==type){layer.type=type;layer.pourStart=performance.now();}
      const p=Math.min(1,(performance.now()-(layer.pourStart||0))/900),pour=1-Math.pow(1-p,3);
      const base=spec.surface,top=h-(h-base)*pour;                     // liquid level while pouring
      const tilt=Math.sin(t*.6)*(3+b*16)*(spec.slosh||1);
      const edge=x=>top+(x/w-.5)*tilt+Math.sin(x*.032+t*1.4)*(spec.wave+b*5)+Math.sin(x*.011-t*.8)*(spec.wave*.8+b*3);
      const surfacePath=()=>{c.beginPath();c.moveTo(0,h);c.lineTo(0,edge(0));for(let x=0;x<=w;x+=6)c.lineTo(x,edge(x));c.lineTo(w,h);c.closePath();};
      if(ghost){ // double vision: only the surface line
        c.strokeStyle='rgba(255,250,240,.35)';c.lineWidth=4;c.beginPath();
        for(let x=0;x<=w;x+=6){const y=edge(x);x?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();return;
      }
      c.fillStyle=spec.empty;c.fillRect(0,0,w,h);                        // panel above the liquid
      const g=c.createLinearGradient(0,top,0,h);spec.grad.forEach((col,i)=>g.addColorStop(i/(spec.grad.length-1),col));
      surfacePath();c.fillStyle=g;c.fill();
      c.save();surfacePath();c.clip();
      spec.inside(c,w,h,t,b,top,edge);
      c.restore();
      if(spec.foam){ // beer head
        c.fillStyle='#fff8ea';c.beginPath();c.moveTo(0,0);c.lineTo(w,0);
        for(let x=w;x>=0;x-=6)c.lineTo(x,edge(x));c.closePath();c.fill();
        for(let i=0;i<Math.round(w/9);i++){
          const x=i*9+((i*37)%7),y=edge(x)-2-((i*13)%9),r=2+((i*7)%4);
          c.fillStyle='rgba(236,214,170,.55)';c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
          c.fillStyle='#fff8ea';c.beginPath();c.arc(x-.6,y-.8,r*.7,0,Math.PI*2);c.fill();
        }
      }
      c.strokeStyle=spec.meniscus;c.lineWidth=3;c.beginPath();
      for(let x=0;x<=w;x+=6){const y=edge(x)+(spec.foam?3:0);x?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
    },
    // Ce soir: fine concentric rings, slowly breathing, wobbling more with every glass.
    'result-panel'(c,w,h,t,b){
      const chaos=window.resultChaos||0;
      const cx=w*(.7+Math.sin(t*.37)*.12*chaos/(1+chaos)),cy=h*(.25+Math.cos(t*.29)*.12*chaos/(1+chaos)),max=Math.hypot(w,h),gap=9;c.lineWidth=.8;
      for(let r=gap;r<max;r+=gap){
        c.beginPath();
        for(let a=0;a<=Math.PI*2+.01;a+=.06){
          const rr=r+Math.sin(t*.6+r*.015)*2+Math.sin(a*4+t*1.1+r*.02)*(.4+b*10)*(r/max*2);
          const twist=a+Math.sin(r/max*5+t*.43)*chaos*.3;
          const ripple=Math.sin(a*3-t*.71+r*.025)*chaos*12;
          const x=cx+Math.cos(twist)*(rr+ripple),y=cy+Math.sin(twist)*(rr-ripple);
          a?c.lineTo(x,y):c.moveTo(x,y);
        }
        c.stroke();
      }
    },
    // Simulation: hairline rays that twist around the target, over faint rings.
    'sim-panel'(c,w,h,t,b){
      const cx=w/2,cy=h*.42,max=Math.hypot(w,h)*.75,rays=72,twist=Math.sin(t*.5)*(.35+b*1.4);
      c.lineWidth=.7;
      for(let k=0;k<rays;k++){
        const a0=k/rays*Math.PI*2;c.beginPath();
        for(let r=24;r<=max;r+=10){const a=a0+twist*Math.pow(r/max,1.4);const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;r===24?c.moveTo(x,y):c.lineTo(x,y);}
        c.stroke();
      }
      c.globalAlpha=.5;
      for(let r=30;r<max;r+=22){c.beginPath();c.arc(cx,cy,r+Math.sin(t+r*.03)*2,0,Math.PI*2);c.stroke();}
      c.globalAlpha=1;
    }
  };
  patterns['dose-panel']=patterns['home-panel']; // Doser shows the same generated drink
  const layers=[];
  document.querySelectorAll('.color-panel').forEach(panel=>{
    const key=Object.keys(patterns).find(k=>panel.classList.contains(k));if(!key)return;
    const canvas=document.createElement('canvas');canvas.className='op-canvas';canvas.setAttribute('aria-hidden','true');
    panel.prepend(canvas);
    const layer={panel,canvas,ctx:canvas.getContext('2d'),draw:patterns[key],w:0,h:0,always:key==='home-panel'||key==='dose-panel'};
    new ResizeObserver(()=>{const r=panel.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);layer.w=r.width;layer.h=r.height;canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);layer.ctx.setTransform(d,0,0,d,0,0);paint(layer,performance.now());}).observe(panel);
    layers.push(layer);
  });
  const still=()=>document.body.classList.contains('reduced-motion');
  let phase=0,previousTime=null;
  function paint(layer,now){
    const {ctx:c,w,h}=layer;if(!w||!h||(!layer.always&&!document.body.classList.contains('has-session')))return;
    const b=(window.buzzIntensity||0)+(window.resultChaos||0)*.65,t=still()?0:phase;
    c.clearRect(0,0,w,h);
    c.fillStyle=c.strokeStyle=INK;layer.draw(c,w,h,t,b,false,layer);
    if(b>.25){ // double vision: an offset, lighter copy
      const off=b*5;c.save();c.translate(off,off*.4);c.fillStyle=c.strokeStyle=GHOST;layer.draw(c,w,h,t+.15*b,b,true,layer);c.restore();
    }
  }
  let last=0;
  function loop(now){
    requestAnimationFrame(loop);
    const dt=previousTime===null?0:Math.min(.1,(now-previousTime)/1000);previousTime=now;
    if(!document.hidden&&!still())phase+=dt*(.25+(window.buzzIntensity||0)*.9);
    if(document.hidden||now-last<33)return; // ~30 fps is plenty
    last=now;
    if(still()&&layers.every(l=>l.drawnStill===`${window.buzzIntensity||0}:${window.resultChaos||0}`))return;
    const session=document.body.classList.contains('has-session');
    layers.forEach(l=>{if(l.panel.offsetParent===null||(!l.always&&!session))return;paint(l,now);l.drawnStill=still()?`${window.buzzIntensity||0}:${window.resultChaos||0}`:undefined;});
  }
  requestAnimationFrame(loop);
})();
