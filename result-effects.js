'use strict';
// Decorative layers only: totals, hit targets and the fixed controls stay intact.
(()=>{
  const panel=document.querySelector('#resultat .result-panel');
  const number=document.getElementById('total-wine');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('aria-hidden','true');svg.classList.add('liquid-defs');
  svg.innerHTML='<defs><filter id="result-liquid" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".009 .018" numOctaves="1" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
  document.body.append(svg);
  const displacement=svg.querySelector('feDisplacementMap');
  const noise=svg.querySelector('feTurbulence');
  const wave=document.createElement('div');wave.className='addition-wave';wave.setAttribute('aria-hidden','true');panel.append(wave);
  const echoes=[0,1].map(i=>{const el=document.createElement('span');el.className=`number-echo echo-${i}`;el.setAttribute('aria-hidden','true');number.parentElement.append(el);return el;});
  let last=0,phase=0,previous=null,wasActive=false;
  const history=[];
  function frame(now){
    requestAnimationFrame(frame);
    const dt=previous===null?0:Math.min(.05,(now-previous)/1000);previous=now;
    const reduced=document.body.classList.contains('reduced-motion');
    const active=document.body.dataset.page==='resultat'&&document.body.classList.contains('has-session')&&!reduced&&!document.hidden;
    if(!active){
      if(wasActive){panel.classList.remove('liquid-active');wave.style.opacity='0';echoes.forEach(el=>el.style.opacity='0');displacement.setAttribute('scale','0');history.length=0;number.style.translate='none';}
      wasActive=false;return;
    }
    wasActive=true;phase+=dt;
    if(now-last<33)return;last=now;
    const chaos=window.resultChaos||0;
    const liquid=Math.log1p(Math.max(0,(Number(number.textContent.replace(',','.'))||0)-8)/4);
    const elapsed=window.resultPulseAt==null?10:(now-window.resultPulseAt)/1000;
    const pulse=elapsed>=0&&elapsed<2.4?Math.sin(Math.PI*elapsed/2.4)*Math.exp(-elapsed*.6):0;
    const swell=Math.pow((1+Math.sin(phase*.85))/2,2);
    const strength=liquid*(3+20*swell)+pulse*(8+chaos*24);
    panel.classList.toggle('liquid-active',strength>.01);
    displacement.setAttribute('scale',strength.toFixed(2));
    noise.setAttribute('baseFrequency',`${(.009+Math.sin(phase*.21)*.002).toFixed(4)} ${(.018+Math.cos(phase*.17)*.004).toFixed(4)}`);
    wave.style.opacity=String(pulse*.55);
    wave.style.transform=`translate(-50%,-50%) scale(${.1+Math.min(1,elapsed/2.4)*3})`;
    // Keep a short trajectory history so echoes follow the number with a delay.
    const x=number.offsetLeft,y=number.offsetTop;
    const driftX=Math.sin(phase*.91)*chaos*9,driftY=Math.cos(phase*.67)*chaos*5;
    number.style.translate=`${driftX}px ${driftY}px`;
    history.push({time:now,x:driftX,y:driftY});
    while(history.length>1&&history[1].time<now-1000)history.shift();
    echoes.forEach((el,i)=>{
      const sample=history.find(v=>v.time>=now-(i+1)*330)||history[0];
      el.textContent=number.textContent;
      el.style.left=`${x}px`;el.style.top=`${y}px`;
      el.style.font=getComputedStyle(number).font;
      el.style.letterSpacing=getComputedStyle(number).letterSpacing;
      el.style.transform=`translate(${sample.x+(i?1:-1)*chaos*7}px,${sample.y}px)`;
      el.style.opacity=String(Math.min(.32,chaos*.16)*(i?.65:1));
    });
  }
  requestAnimationFrame(frame);
})();
