/* Interaktivne vizualizacije za skripto Mehanika in toplota.
   Vsak <div class="viz" data-viz="ime"> dobi platno (canvas), drsnike in izpis vrednosti.
   Brez zunanjih knjižnic; barve se berejo iz CSS spremenljivk, zato delujeta svetla in temna tema. */
(function(){
'use strict';

var G0=9.81, root=document.documentElement;
var reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- pomožne funkcije ---------- */
function fmt(v,d){
  if(!isFinite(v)) return '∞';
  if(d===undefined) d=2;
  var s=(Math.abs(v)<5e-13?0:v).toFixed(d);
  if(s.indexOf('-')===0 && +s===0) s=s.slice(1);
  return s.replace('.',',');
}
function fmtE(v){ // znanstveni zapis za velike/majhne vrednosti
  if(v===0) return '0';
  var a=Math.abs(v);
  if(a>=1e4||a<1e-2){var e=Math.floor(Math.log10(a)), m=v/Math.pow(10,e); return fmt(m,2)+'·10'+sup(e);}
  return String(+v.toPrecision(3)).replace('.',',');
}
function sup(n){var map={'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};return String(n).split('').map(function(c){return map[c];}).join('');}
function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
function el(tag,cls,txt){var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=txt; return e;}
function niceStep(range,n){var raw=range/n, p=Math.pow(10,Math.floor(Math.log10(raw))), f=raw/p; return (f<1.5?1:f<3.5?2:f<7.5?5:10)*p;}

function colors(){
  var cs=getComputedStyle(root);
  function v(n){return cs.getPropertyValue(n).trim();}
  return {text:v('--text'),muted:v('--muted'),border:v('--border'),accent:v('--accent'),accentSoft:v('--accent-soft'),
    ok:v('--ok'),okSoft:v('--ok-soft'),bad:v('--bad'),badSoft:v('--bad-soft'),warn:v('--warn'),warnSoft:v('--warn-soft'),
    surface:v('--surface'),surface2:v('--surface2'),bg:v('--bg'),
    font:getComputedStyle(document.body).fontFamily||'system-ui,sans-serif'};
}

/* Risalni pripomočki nad 2D kontekstom */
function Gfx(ctx,w,h,c){this.ctx=ctx;this.w=w;this.h=h;this.c=c;}
Gfx.prototype={
  clear:function(){this.ctx.clearRect(0,0,this.w,this.h);},
  line:function(x1,y1,x2,y2,col,lw,dash){var x=this.ctx;x.save();x.strokeStyle=col||this.c.text;x.lineWidth=lw||1.5;if(dash)x.setLineDash(dash);x.beginPath();x.moveTo(x1,y1);x.lineTo(x2,y2);x.stroke();x.restore();},
  poly:function(pts,col,lw,dash,close,fill){var x=this.ctx;if(pts.length<2)return;x.save();x.beginPath();x.moveTo(pts[0][0],pts[0][1]);for(var i=1;i<pts.length;i++)x.lineTo(pts[i][0],pts[i][1]);if(close)x.closePath();if(fill){x.fillStyle=fill;x.fill();}if(col){x.strokeStyle=col;x.lineWidth=lw||1.5;if(dash)x.setLineDash(dash);x.lineJoin='round';x.stroke();}x.restore();},
  circle:function(cx,cy,r,fill,stroke,lw){var x=this.ctx;x.save();x.beginPath();x.arc(cx,cy,r,0,2*Math.PI);if(fill){x.fillStyle=fill;x.fill();}if(stroke){x.strokeStyle=stroke;x.lineWidth=lw||1.5;x.stroke();}x.restore();},
  rect:function(x0,y0,w,h,fill,stroke,lw){var x=this.ctx;x.save();if(fill){x.fillStyle=fill;x.fillRect(x0,y0,w,h);}if(stroke){x.strokeStyle=stroke;x.lineWidth=lw||1.5;x.strokeRect(x0,y0,w,h);}x.restore();},
  arrow:function(x1,y1,x2,y2,col,lw,label,lpos){
    var x=this.ctx,dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy);if(L<1)return;
    var hl=Math.min(9,L*0.45),ux=dx/L,uy=dy/L;x.save();x.strokeStyle=x.fillStyle=col;x.lineWidth=lw||2;x.lineCap='round';
    x.beginPath();x.moveTo(x1,y1);x.lineTo(x2-ux*hl*0.8,y2-uy*hl*0.8);x.stroke();
    x.beginPath();x.moveTo(x2,y2);x.lineTo(x2-ux*hl-uy*hl*0.45,y2-uy*hl+ux*hl*0.45);x.lineTo(x2-ux*hl+uy*hl*0.45,y2-uy*hl-ux*hl*0.45);x.closePath();x.fill();
    x.restore();
    if(label){var o=lpos||{};this.text(label,x2+('dx' in o?o.dx:ux*10),y2+('dy' in o?o.dy:uy*10),{color:col,align:o.align||'center',base:'middle',bold:true,halo:true});}
  },
  text:function(s,x0,y0,o){o=o||{};var x=this.ctx;x.save();x.fillStyle=o.color||this.c.text;x.font=(o.bold?'600 ':'')+(o.size||12.5)+'px '+this.c.font;x.textAlign=o.align||'left';x.textBaseline=o.base||'alphabetic';
    var tw=x.measureText(s).width,al=x.textAlign,lx=al==='center'?x0-tw/2:al==='right'?x0-tw:x0;x0+=clamp(lx,3,this.w-3-tw)-lx; // ostani na platnu
    if(o.halo){x.lineWidth=3;x.strokeStyle=this.c.surface;x.lineJoin='round';x.strokeText(s,x0,y0);}x.fillText(s,x0,y0);x.restore();}
};

/* Os z oznakami: map = {x0,x1,y0,y1 (svet), px0,px1,py0,py1 (piksli)} */
function axes(g,m,o){
  o=o||{};var c=g.c;
  var X=function(v){return m.px0+(v-m.x0)/(m.x1-m.x0)*(m.px1-m.px0);}, Y=function(v){return m.py0+(v-m.y0)/(m.y1-m.y0)*(m.py1-m.py0);};
  if(o.grid!==false){
    var sx=niceStep(m.x1-m.x0,o.nx||5), sy=niceStep(m.y1-m.y0,o.ny||4), v;
    for(v=Math.ceil(m.x0/sx)*sx;v<=m.x1+1e-9;v+=sx){g.line(X(v),m.py0,X(v),m.py1,c.border,1);g.text(fmtTick(v,sx),X(v),m.py0+14,{color:c.muted,align:'center',size:11});}
    for(v=Math.ceil(m.y0/sy)*sy;v<=m.y1+1e-9;v+=sy){g.line(m.px0,Y(v),m.px1,Y(v),c.border,1);g.text(fmtTick(v,sy),m.px0-5,Y(v),{color:c.muted,align:'right',base:'middle',size:11});}
  }
  g.line(m.px0,m.py0,m.px1,m.py0,c.muted,1.2);g.line(m.px0,m.py0,m.px0,m.py1,c.muted,1.2);
  if(o.xl) g.text(o.xl,m.px1,m.py0-6,{color:c.muted,align:'right',size:11.5,halo:true});
  if(o.yl) g.text(o.yl,m.px0+6,m.py1+11,{color:c.muted,size:11.5,halo:true});
  return {X:X,Y:Y};
}
function fmtTick(v,step){var d=step>=1?0:Math.min(3,Math.ceil(-Math.log10(step)));return fmt(v,d);}

/* ---------- ogrodje gradnika ---------- */
var widgets=[];

function mount(host,spec){
  var w={host:host,spec:spec,s:{p:{}},labels:[],playing:spec.anim&&!reduceMotion,visible:true};
  host.innerHTML='';
  var head=el('div','viz-head');
  head.appendChild(el('span','viz-tag','Interaktivno'));
  head.appendChild(el('h4',null,spec.title));
  host.appendChild(head);
  if(spec.note){var n=el('p','viz-note');n.textContent=spec.note;host.appendChild(n);}
  var box=el('div','viz-canvas');var cv=el('canvas');cv.setAttribute('role','img');cv.setAttribute('aria-label',spec.title);box.appendChild(cv);host.appendChild(box);
  var ctr=el('div','viz-ctrl');host.appendChild(ctr);
  var out=el('div','viz-out');out.setAttribute('aria-live','polite');host.appendChild(out);
  w.cv=cv;w.box=box;w.out=out;

  spec.controls.forEach(function(k){
    w.s.p[k.k]=k.value;
    var row=el('label','viz-row'+(k.type==='select'?' sel':k.type==='check'?' chk':''));
    if(k.type==='select'){
      row.appendChild(el('span','viz-lbl',k.label));
      var sel=el('select');
      k.options.forEach(function(o){var op=el('option',null,o[1]);op.value=o[0];sel.appendChild(op);});
      sel.value=k.value;
      sel.addEventListener('change',function(){w.s.p[k.k]=sel.value;changed(w);});
      row.appendChild(sel);
    }else if(k.type==='check'){
      var cb=el('input');cb.type='checkbox';cb.checked=!!k.value;
      cb.addEventListener('change',function(){w.s.p[k.k]=cb.checked;changed(w);});
      row.appendChild(cb);row.appendChild(el('span','viz-lbl',k.label));
    }else{
      var ls=el('span','viz-lbl',k.label);row.appendChild(ls);
      if(k.labelFn)w.labels.push([ls,k.labelFn]);
      var r=el('input');r.type='range';r.min=k.min;r.max=k.max;r.step=k.step;r.value=k.value;
      var val=el('output','viz-val');
      var show=function(){val.textContent=(k.show?k.show(+r.value):fmt(+r.value,k.d!==undefined?k.d:decimals(k.step)))+(k.unit?' '+k.unit:'');};
      r.addEventListener('input',function(){w.s.p[k.k]=+r.value;show();changed(w);});
      show();row.appendChild(r);row.appendChild(val);
    }
    ctr.appendChild(row);
  });

  if(spec.anim){
    var bar=el('div','viz-btns');
    var bp=el('button',null,'');var br=el('button',null,'↺ Znova');
    var lab=function(){bp.textContent=w.playing?'❚❚ Ustavi':'▶ Predvajaj';};
    bp.addEventListener('click',function(){w.playing=!w.playing;lab();kick();});
    br.addEventListener('click',function(){spec.reset(w.s);w.draw();kick();});
    lab();bar.appendChild(bp);bar.appendChild(br);ctr.appendChild(bar);
  }

  w.resize=function(){
    var W=Math.max(260,box.clientWidth), H=Math.round(clamp(W*(spec.aspect||0.5),spec.minH||220,spec.maxH||420));
    if(W<520&&spec.mobileH) H=Math.max(H,spec.mobileH);
    var dpr=window.devicePixelRatio||1;
    cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.height=H+'px';
    w.g=new Gfx(cv.getContext('2d'),W,H,w.g?w.g.c:colors());
    w.g.ctx.setTransform(dpr,0,0,dpr,0,0);
    w.draw();
  };
  w.draw=function(){if(!w.g)return;w.g.clear();spec.draw(w.g,w.s);};
  w.recolor=function(){if(w.g){w.g.c=colors();w.draw();}};
  spec.update(w.s);spec.reset&&spec.reset(w.s);
  out.innerHTML=spec.readout(w.s);
  widgets.push(w);
  w.resize();
  return w;
}
function decimals(step){var s=String(step);return s.indexOf('.')<0?0:s.length-s.indexOf('.')-1;}
function changed(w){w.labels.forEach(function(l){l[0].textContent=l[1](w.s.p);});w.spec.update(w.s);if(w.spec.reset&&!w.spec.keepOnChange)w.spec.reset(w.s);w.out.innerHTML=w.spec.readout(w.s);w.draw();kick();}

/* skupna animacijska zanka: teče le, ko je kak gradnik viden in predvaja */
var rafId=0,last=0;
function kick(){if(!rafId){last=0;rafId=requestAnimationFrame(frame);}}
function frame(ts){
  rafId=0;var dt=last?Math.min(0.05,(ts-last)/1000):0;last=ts;var any=false;
  widgets.forEach(function(w){
    if(w.spec.anim&&w.playing&&w.visible&&!document.hidden){any=true;if(dt>0)w.spec.step(w.s,dt);w.draw();}
  });
  if(any){rafId=requestAnimationFrame(frame);}
}

function row(label,value){return '<div><span>'+label+'</span><b>'+value+'</b></div>';}
function wide(label,value){return '<div class="wide"><span>'+label+'</span><b>'+value+'</b></div>';}

/* ======================================================================
   1. Poševni met
   ====================================================================== */
var MET={
  title:'Poševni met',
  note:'Spreminjaj začetno hitrost, kot in višino izstrelišča. Merilo je izbrano glede na v₀ in h, zato se ob spreminjanju kota vidi, pri katerem kotu je domet največji. Pri h = 0 črtkana krivulja pokaže komplementarni kot 90° − φ, ki da enak domet.',
  aspect:0.5,minH:240,maxH:400,anim:true,
  controls:[
    {k:'v0',label:'v₀',min:2,max:30,step:0.5,value:15,unit:'m/s',d:1},
    {k:'phi',label:'φ',min:0,max:90,step:1,value:40,unit:'°'},
    {k:'h',label:'h',min:0,max:20,step:0.5,value:0,unit:'m',d:1},
    {k:'vec',type:'check',label:'pokaži komponente hitrosti',value:true}
  ],
  update:function(s){
    var p=s.p,f=p.phi*Math.PI/180;
    s.vx=p.v0*Math.cos(f);s.vy=p.v0*Math.sin(f);
    s.T=(s.vy+Math.sqrt(s.vy*s.vy+2*G0*p.h))/G0;
    s.D=s.vx*s.T;
    s.hmax=p.h+(s.vy>0?s.vy*s.vy/(2*G0):0);
    s.tv=s.vy>0?s.vy/G0:0;
    s.vend=Math.sqrt(s.vx*s.vx+Math.pow(s.vy-G0*s.T,2));
    s.beta=Math.atan2(G0*s.T-s.vy,s.vx)*180/Math.PI;
    // merilo neodvisno od kota
    s.Xmax=p.v0/G0*Math.sqrt(p.v0*p.v0+2*G0*p.h);
    s.Ymax=p.h+p.v0*p.v0/(2*G0);
    // optimalni kot pri višini h: tan φ = v0 / sqrt(v0² + 2gh)
    s.phiOpt=Math.atan(p.v0/Math.sqrt(p.v0*p.v0+2*G0*p.h))*180/Math.PI;
  },
  reset:function(s){s.t=0;s.hold=0;},
  step:function(s,dt){
    if(s.t>=s.T){s.hold+=dt;if(s.hold>1.0){s.t=0;s.hold=0;}return;}
    s.t=Math.min(s.T,s.t+dt);
  },
  draw:function(g,s){
    var c=g.c,p=s.p,padL=34,padR=18,padT=22,padB=30;
    var sc=Math.min((g.w-padL-padR)/Math.max(s.Xmax,1),(g.h-padT-padB)/Math.max(s.Ymax,1));
    var X=function(x){return padL+x*sc;}, Y=function(y){return g.h-padB-y*sc;};
    // tla in izstrelišče
    g.line(0,Y(0),g.w,Y(0),c.muted,1.5);
    if(p.h>0){g.rect(X(0)-padL+6,Y(p.h),padL-6,p.h*sc,c.surface2,c.muted,1);g.text('h',X(0)-padL+10,Y(p.h/2),{color:c.muted,base:'middle'});}
    function path(phiDeg,col,dash,lw){
      var f=phiDeg*Math.PI/180,vx=p.v0*Math.cos(f),vy=p.v0*Math.sin(f),T=(vy+Math.sqrt(vy*vy+2*G0*p.h))/G0,pts=[];
      for(var i=0;i<=80;i++){var t=T*i/80;pts.push([X(vx*t),Y(p.h+vy*t-G0*t*t/2)]);}
      g.poly(pts,col,lw||2,dash);
    }
    if(p.h===0&&p.phi!==45&&p.phi>0&&p.phi<90) path(90-p.phi,c.muted,[5,5],1.4);
    path(p.phi,c.accent,null,2.2);
    // vrh in pristanek
    if(s.vy>0.01){
      var xa=s.vx*s.tv;g.line(X(xa),Y(s.hmax),X(xa),Y(0),c.muted,1,[3,4]);
      g.circle(X(xa),Y(s.hmax),3,c.muted);
      g.text('hₘₐₓ = '+fmt(s.hmax,1)+' m',X(xa),Y(s.hmax)-8,{color:c.muted,align:'center',size:11.5,halo:true});
    }
    g.circle(X(s.D),Y(0),3.5,c.bad);
    if(s.D>0.05){var yd=Y(0)+17;g.arrow((X(0)+X(s.D))/2,yd,X(0),yd,c.bad,1.2);g.arrow((X(0)+X(s.D))/2,yd,X(s.D),yd,c.bad,1.2);
      g.text('D = '+fmt(s.D,1)+' m',(X(0)+X(s.D))/2,yd-1,{color:c.bad,align:'center',base:'middle',bold:true,size:12,halo:true});}
    // telo
    var t=s.t,x=s.vx*t,y=p.h+s.vy*t-G0*t*t/2,vyt=s.vy-G0*t;
    g.circle(X(x),Y(y),6,c.warn,c.text,1);
    if(p.vec){
      var k=2.2;
      g.arrow(X(x),Y(y),X(x)+s.vx*k,Y(y),c.ok,2,'vₓ',{dx:10,dy:0,align:'left'});
      g.arrow(X(x),Y(y),X(x),Y(y)-vyt*k,c.bad,2,'vᵧ',{dx:-10,dy:0,align:'right'});
      g.arrow(X(x),Y(y),X(x)+s.vx*k,Y(y)-vyt*k,c.text,1.6);
    }
    g.text('t = '+fmt(t,2)+' s',g.w-padR,16,{color:c.muted,align:'right'});
  },
  readout:function(s){
    return row('čas leta t',fmt(s.T,2)+' s')+row('domet D',fmt(s.D,2)+' m')+row('najvišja točka hₘₐₓ',fmt(s.hmax,2)+' m')+
      row('hitrost ob udarcu',fmt(s.vend,2)+' m/s')+row('kot ob udarcu β',fmt(s.beta,1)+'°')+row('kot za največji domet',fmt(s.phiOpt,1)+'°');
  }
};

/* ======================================================================
   2. Klada na klancu s trenjem
   ====================================================================== */
var KLANEC={
  title:'Klada na klancu s trenjem',
  note:'Teža mg se razstavi na dinamično komponento mg sin φ (vzdolž klanca) in statično mg cos φ (pravokotno na klanec). Klada miruje, dokler je mg sin φ ≤ kₗN, torej dokler je tan φ ≤ kₗ. Ko drsi, deluje trenje Fₜᵣ = kₜᵣN.',
  aspect:0.52,minH:240,maxH:380,anim:true,
  controls:[
    {k:'phi',label:'nagib φ',min:0,max:60,step:1,value:20,unit:'°'},
    {k:'kl',label:'kₗ (lepenje)',min:0,max:1,step:0.01,value:0.5},
    {k:'kt',label:'kₜᵣ (trenje)',min:0,max:1,step:0.01,value:0.3}
  ],
  update:function(s){
    var p=s.p,f=p.phi*Math.PI/180;s.f=f;
    s.Fd=Math.sin(f);s.N=Math.cos(f); // v enotah mg
    s.slides=Math.tan(f)>p.kl+1e-9;
    s.Ft=s.slides?p.kt*s.N:s.Fd;
    s.a=s.slides?Math.max(0,G0*(Math.sin(f)-p.kt*Math.cos(f))):0;
    s.phic=Math.atan(p.kl)*180/Math.PI;
  },
  reset:function(s){s.x=0;s.v=0;s.hold=0;},
  step:function(s,dt){
    if(!s.slides||s.a<=0)return;
    if(s.x>=1){s.hold+=dt;if(s.hold>0.8){s.x=0;s.v=0;s.hold=0;}return;}
    s.v+=s.a*dt;s.x+=s.v*dt/3.0; // klanec dolg 3 m
    if(s.x>1)s.x=1;
  },
  draw:function(g,s){
    var c=g.c,p=s.p,f=s.f,W=g.w,H=g.h;
    var K=Math.min(90,H*0.32),x0=24,y0=H-Math.max(26,K*0.55),Lmax=Math.min((W-150)/Math.max(Math.cos(f),0.5),(H-60)/Math.max(Math.sin(f),0.01));
    var L=Math.min(Lmax,W*0.8);
    var ex=Math.cos(f),ey=-Math.sin(f); // smer navzgor po klancu (zaslon)
    var top=[x0+L*ex,y0+L*ey];
    g.poly([[x0,y0],[x0+L*ex,y0],top],c.muted,1.5,null,true,c.surface2);
    g.line(0,y0,W,y0,c.muted,1.2);
    if(p.phi>0){var ctx=g.ctx;ctx.save();ctx.strokeStyle=c.muted;ctx.beginPath();ctx.arc(x0,y0,34,-f,0);ctx.stroke();ctx.restore();
      g.text('φ',x0+40,y0-6,{color:c.muted});}
    // klada: pozicija vzdolž klanca (s=1 vrh .. 0 dno)
    var bw=46,bh=28,sPos=0.8-(s.x||0)*0.5;
    var bx=x0+L*sPos*ex,by=y0+L*sPos*ey; // središče spodnje ploskve
    var nx=-Math.sin(f),ny=-Math.cos(f); // normala ven iz klanca (zaslon: navzgor-levo)
    var cx=bx+nx*bh/2,cy=by+ny*bh/2;
    var ctx2=g.ctx;ctx2.save();ctx2.translate(cx,cy);ctx2.rotate(-f);
    ctx2.fillStyle=c.accentSoft;ctx2.strokeStyle=c.accent;ctx2.lineWidth=2;ctx2.fillRect(-bw/2,-bh/2,bw,bh);ctx2.strokeRect(-bw/2,-bh/2,bw,bh);
    ctx2.fillStyle=c.text;ctx2.font='600 12px '+c.font;ctx2.textAlign='center';ctx2.textBaseline='middle';ctx2.fillText('m',0,0);ctx2.restore();
    // sile (merilo: mg = K px)
    g.arrow(cx,cy,cx,cy+K,c.text,2.2,'mg',{dx:8,dy:-6,align:'left'});
    if(p.phi>0&&p.phi<90){
      g.arrow(cx,cy,cx-ex*K*s.Fd,cy-ey*K*s.Fd,c.warn,1.6,'mg sin φ',{dx:-6,dy:12,align:'right'});
      g.arrow(cx,cy,cx-nx*K*s.N,cy-ny*K*s.N,c.muted,1.4);
    }
    g.arrow(cx,cy,cx+nx*K*s.N,cy+ny*K*s.N,c.ok,2.2,'N');
    if(s.Ft>1e-3){var fx=bx+ex*bw*0.5,fy=by+ey*bw*0.5;g.arrow(fx,fy,fx+ex*K*s.Ft,fy+ey*K*s.Ft,c.bad,2.2,s.slides?'Fₜᵣ':'Fₗ',{dx:6,dy:-10,align:'left'});}
    var st=s.slides?(s.a>0?'klada drsi: a = '+fmt(s.a,2)+' m/s²':'klada drsi, a = 0'):'klada miruje (lepenje)';
    g.text(st,W-12,20,{align:'right',bold:true,color:s.slides?c.bad:c.ok});
  },
  readout:function(s){
    var p=s.p;
    return row('kritični kot φc = arctan kₗ',fmt(s.phic,1)+'°')+
      row('sila vzdolž klanca',fmt(s.Fd,3)+' mg')+row('normalna sila N',fmt(s.N,3)+' mg')+
      row(s.slides?'trenje Fₜᵣ = kₜᵣN':'lepenje Fₗ (≤ kₗN = '+fmt(p.kl*s.N,3)+' mg)',fmt(s.Ft,3)+' mg')+
      row('pospešek a',fmt(s.a,2)+' m/s²')+
      (p.kt>p.kl?'<div class="warn">Običajno je kₜᵣ < kₗ.</div>':'');
  }
};

/* ======================================================================
   3. Satelit — krožna, eliptična in ubežna tirnica
   ====================================================================== */
var GM=3.986e14,RZ=6.371e6,TU=Math.sqrt(RZ*RZ*RZ/GM); // časovna enota ≈ 806 s
var SAT={
  title:'Satelit okoli Zemlje',
  note:'Pri v = v_kr (faktor 1) satelit kroži; pri manjši hitrosti tirnica postane elipsa (ali pa satelit pade na Zemljo), pri v ≥ √2·v_kr pa satelit uide. Čas je pospešen, a razmerje med obhodnim časom in vrtenjem Zemlje je pravo — poskusi r ≈ 1,07 R (ISS) in r ≈ 6,6 R (geostacionarna tirnica).',
  aspect:0.62,minH:260,maxH:440,anim:true,mobileH:300,
  controls:[
    {k:'r',label:'polmer r',min:1.05,max:8,step:0.01,value:2,show:function(v){return fmt(v,2)+' R';}},
    {k:'f',label:'v / v_kr',min:0.5,max:1.5,step:0.01,value:1}
  ],
  update:function(s){
    var p=s.p,r=p.r*RZ;
    s.vk=Math.sqrt(GM/r);s.t0=2*Math.PI*Math.sqrt(r*r*r/GM);s.vu=Math.SQRT2*s.vk;s.h=(p.r-1)*RZ;
    // energija in velika polos v brezdimenzijskih enotah (GM=1, R=1)
    var v=p.f/Math.sqrt(p.r),E=v*v/2-1/p.r;
    s.E=E;s.esc=E>=-1e-9;
    if(!s.esc){s.a=-1/(2*E);var hh=p.r*v;s.ecc=Math.sqrt(Math.max(0,1+2*E*hh*hh));s.rp=s.a*(1-s.ecc);s.ra=s.a*(1+s.ecc);s.T=2*Math.PI*Math.pow(s.a,1.5);}
    s.crash=!s.esc&&Math.min(s.rp,s.ra)<1;
    s.view=s.esc?Math.max(2.2,p.r*2.2):Math.max(1.5,Math.min(Math.max(p.r,s.ra)*1.12,p.r*4));
    // časovno merilo: krožna tirnica pri 1,07 R traja ~3 s
    s.speed=2*Math.PI*Math.pow(1.07,1.5)/3;
    // vnaprej izračunana tirnica za risanje
    var st={x:p.r,y:0,vx:0,vy:v},pts=[[st.x,st.y]],tt=0,Tmax=s.esc?60:s.T*1.02;
    for(var i=0;i<6000&&tt<Tmax;i++){var rr=Math.hypot(st.x,st.y);if(rr<1||rr>s.view*1.6)break;var dt=0.01*Math.pow(rr,1.5);rk4(st,dt);tt+=dt;pts.push([st.x,st.y]);}
    s.path=pts;
  },
  reset:function(s){var p=s.p;s.st={x:p.r,y:0,vx:0,vy:p.f/Math.sqrt(p.r)};s.tt=0;s.hold=0;s.trail=[];s.hit=false;},
  step:function(s,dt){
    if(s.hit||s.out){s.hold+=dt;if(s.hold>1.2){s.out=false;this.reset(s);}return;}
    var left=dt*s.speed;
    while(left>0){var rr=Math.hypot(s.st.x,s.st.y),h=Math.min(left,0.01*Math.pow(rr,1.5));rk4(s.st,h);left-=h;s.tt+=h;
      rr=Math.hypot(s.st.x,s.st.y);
      if(rr<=1){var k=1/rr;s.st.x*=k;s.st.y*=k;s.hit=true;s.hold=0;break;}
      if(rr>s.view*1.5){s.out=true;s.hold=0;break;}}
  },
  draw:function(g,s){
    var c=g.c,cx=g.w/2,cy=g.h/2,sc=Math.min(g.w,g.h)/2/s.view;
    // geostacionarna tirnica za orientacijo
    var rg=Math.cbrt(GM*86164*86164/(4*Math.PI*Math.PI))/RZ;
    if(rg<s.view*1.4){g.circle(cx,cy,rg*sc,null,c.border,1);g.text('geostacionarna',cx,cy-rg*sc-5,{color:c.muted,align:'center',size:10.5,halo:true});}
    // Zemlja z vrtečim se poldnevnikom
    g.circle(cx,cy,sc,c.accentSoft,c.accent,1.5);
    var rot=(s.tt||0)*TU/86164*2*Math.PI;
    g.line(cx,cy,cx+Math.cos(rot)*sc,cy-Math.sin(rot)*sc,c.accent,1.5);
    g.circle(cx+Math.cos(rot)*sc,cy-Math.sin(rot)*sc,3,c.accent);
    g.poly(s.path.map(function(q){return [cx+q[0]*sc,cy-q[1]*sc];}),s.crash?c.bad:s.esc?c.warn:c.muted,1.4,[5,4]);
    var x=cx+s.st.x*sc,y=cy-s.st.y*sc;
    var vx=s.st.vx,vy=s.st.vy,vl=Math.hypot(vx,vy)||1;
    g.arrow(x,y,x+vx/vl*28,y-vy/vl*28,c.ok,2,'v');
    g.arrow(x,y,x-s.st.x/Math.hypot(s.st.x,s.st.y)*22,y+s.st.y/Math.hypot(s.st.x,s.st.y)*22,c.bad,2);
    g.circle(x,y,5,c.warn,c.text,1);
    var tReal=(s.tt||0)*TU;
    g.text('pretečeni čas: '+(tReal<7200?fmt(tReal/60,0)+' min':fmt(tReal/3600,1)+' h'),10,18,{color:c.muted});
    if(s.hit) g.text('satelit je padel na Zemljo',g.w/2,g.h-12,{align:'center',bold:true,color:c.bad,halo:true});
    else if(s.esc) g.text('ubežna hitrost — satelit uide',g.w/2,g.h-12,{align:'center',bold:true,color:c.warn,halo:true});
  },
  readout:function(s){
    var p=s.p,out=row('višina nad površjem',fmt(s.h/1000,0)+' km')+row('krožna hitrost v_kr = √(GM/r)',fmt(s.vk/1000,2)+' km/s')+
      row('obhodni čas krožne tirnice',s.t0<7200?fmt(s.t0/60,1)+' min':fmt(s.t0/3600,2)+' h')+row('ubežna hitrost √2·v_kr',fmt(s.vu/1000,2)+' km/s')+
      row('začetna hitrost',fmt(p.f*s.vk/1000,2)+' km/s');
    if(s.esc) out+=row('tirnica','ubežna — satelit zapusti Zemljo');
    else if(Math.abs(p.f-1)>0.005) out+=row('tirnica','elipsa, e = '+fmt(s.ecc,2)+(s.crash?' (seka Zemljo)':''));
    return out;
  }
};
function rk4(st,h){
  function acc(x,y){var r=Math.hypot(x,y),r3=r*r*r;return [-x/r3,-y/r3];}
  var x=st.x,y=st.y,vx=st.vx,vy=st.vy;
  var a1=acc(x,y),k1=[vx,vy,a1[0],a1[1]];
  var a2=acc(x+h/2*k1[0],y+h/2*k1[1]),k2=[vx+h/2*k1[2],vy+h/2*k1[3],a2[0],a2[1]];
  var a3=acc(x+h/2*k2[0],y+h/2*k2[1]),k3=[vx+h/2*k2[2],vy+h/2*k2[3],a3[0],a3[1]];
  var a4=acc(x+h*k3[0],y+h*k3[1]),k4=[vx+h*k3[2],vy+h*k3[3],a4[0],a4[1]];
  st.x+=h/6*(k1[0]+2*k2[0]+2*k3[0]+k4[0]);st.y+=h/6*(k1[1]+2*k2[1]+2*k3[1]+k4[1]);
  st.vx+=h/6*(k1[2]+2*k2[2]+2*k3[2]+k4[2]);st.vy+=h/6*(k1[3]+2*k2[3]+2*k3[3]+k4[3]);
}

/* ======================================================================
   4. Centralni trk dveh vozičkov
   ====================================================================== */
var TRK={
  title:'Centralni trk dveh vozičkov',
  note:'Koeficient e pove, kolikšen del relativne hitrosti ostane po trku: e = 1 je prožni trk (kinetična energija se ohrani), e = 0 popolnoma neprožni (vozička se sprimeta). Gibalna količina se ohrani vedno, težišče (◆) se giblje enakomerno.',
  aspect:0.34,minH:200,maxH:280,anim:true,
  controls:[
    {k:'m1',label:'m₁',min:0.5,max:5,step:0.1,value:2,unit:'kg',d:1},
    {k:'v1',label:'v₁',min:-4,max:4,step:0.1,value:3,unit:'m/s',d:1},
    {k:'m2',label:'m₂',min:0.5,max:5,step:0.1,value:1,unit:'kg',d:1},
    {k:'v2',label:'v₂',min:-4,max:4,step:0.1,value:-1,unit:'m/s',d:1},
    {k:'e',label:'e (prožnost)',min:0,max:1,step:0.05,value:1}
  ],
  update:function(s){
    var p=s.p,M=p.m1+p.m2,P=p.m1*p.v1+p.m2*p.v2;
    s.meet=p.v1>p.v2+1e-9;
    if(s.meet){s.u1=(P+p.m2*p.e*(p.v2-p.v1))/M;s.u2=(P+p.m1*p.e*(p.v1-p.v2))/M;}else{s.u1=p.v1;s.u2=p.v2;}
    s.P=P;s.vT=P/M;
    s.W0=0.5*p.m1*p.v1*p.v1+0.5*p.m2*p.v2*p.v2;s.W1=0.5*p.m1*s.u1*s.u1+0.5*p.m2*s.u2*s.u2;
    s.w1=0.35+0.12*Math.sqrt(p.m1);s.w2=0.35+0.12*Math.sqrt(p.m2); // širini [m]
  },
  reset:function(s){s.t=0;},
  step:function(s,dt){s.t+=dt;if(s.t>4.2)s.t=0;},
  draw:function(g,s){
    var c=g.c,p=s.p,tc=1.6,t=s.t;
    var L=g.w<520?5.5:8,sc=(g.w-20)/L,X=function(x){return g.w/2+x*sc;},yb=g.h-34;
    // položaj: robova se dotakneta v x=0 ob t=tc
    var r1,l2;
    if(!s.meet){r1=-0.3+p.v1*t;l2=0.3+p.v2*t;}
    else if(t<tc){r1=p.v1*(t-tc);l2=p.v2*(t-tc);}
    else{r1=s.u1*(t-tc);l2=s.u2*(t-tc);}
    var x1c=r1-s.w1/2,x2c=l2+s.w2/2;
    g.line(0,yb+14,g.w,yb+14,c.muted,1.5);
    function cart(xc,w,m,col,soft,lab,v){
      var hgt=26+8*Math.sqrt(m),px=X(xc-w/2),pw=w*sc;
      g.rect(px,yb-hgt+6,pw,hgt,soft,col,2);
      g.circle(px+pw*0.25,yb+8,6,c.surface,col,2);g.circle(px+pw*0.75,yb+8,6,c.surface,col,2);
      g.text(lab,px+pw/2,yb-hgt/2+8,{align:'center',base:'middle',bold:true,color:col});
      if(Math.abs(v)>0.05) g.arrow(X(xc),yb-hgt-4,X(xc)+v*22,yb-hgt-4,col,2,fmt(v,1)+' m/s',{dx:-v*11,dy:-11});
    }
    var after=s.meet&&t>=tc;
    cart(x1c,s.w1,p.m1,c.accent,c.accentSoft,'m₁',after?s.u1:p.v1);
    cart(x2c,s.w2,p.m2,c.bad,c.badSoft,'m₂',after?s.u2:p.v2);
    // težišče
    var xT=(p.m1*x1c+p.m2*x2c)/(p.m1+p.m2),ty=yb+14;
    g.ctx.save();g.ctx.fillStyle=c.text;g.ctx.beginPath();g.ctx.moveTo(X(xT),ty-6);g.ctx.lineTo(X(xT)+5,ty);g.ctx.lineTo(X(xT),ty+6);g.ctx.lineTo(X(xT)-5,ty);g.ctx.closePath();g.ctx.fill();g.ctx.restore();
    g.text(after?'po trku':'pred trkom',10,18,{color:c.muted,bold:true});
    if(!s.meet) g.text('v₁ ≤ v₂ — vozička se ne srečata',g.w-10,18,{align:'right',color:c.warn,bold:true});
  },
  readout:function(s){
    var lost=s.W0-s.W1;
    return row('po trku u₁',fmt(s.u1,2)+' m/s')+row('po trku u₂',fmt(s.u2,2)+' m/s')+
      row('gibalna količina G (pred = po)',fmt(s.P,2)+' kg m/s')+row('hitrost težišča',fmt(s.vT,2)+' m/s')+
      row('Wₖ pred → po',fmt(s.W0,2)+' J → '+fmt(s.W1,2)+' J')+row('izguba Wₖ',fmt(lost,2)+' J ('+fmt(s.W0>0?100*lost/s.W0:0,0)+' %)');
  }
};

/* ======================================================================
   5. Kotaljenje po klancu — dirka teles
   ====================================================================== */
var BODIES=[
  {n:'drsenje brez trenja',k:0,col:'warn'},
  {n:'polna krogla',k:0.4,col:'ok'},
  {n:'poln valj',k:0.5,col:'accent'},
  {n:'obroč',k:1,col:'bad'}
];
var KOT={
  title:'Kotaljenje po klancu',
  note:'Vsa telesa spustimo hkrati z vrha 2 m dolgega klanca. Pri kotaljenju brez podrsavanja je a = g sin φ / (1 + J/mR²) — neodvisno od mase in polmera. Telo z večjim J/mR² več energije porabi za vrtenje in je počasnejše.',
  aspect:0.55,minH:250,maxH:400,anim:true,
  controls:[{k:'phi',label:'nagib φ',min:5,max:60,step:1,value:20,unit:'°'}],
  update:function(s){
    var f=s.p.phi*Math.PI/180;s.f=f;
    s.b=BODIES.map(function(b){var a=G0*Math.sin(f)/(1+b.k);return {a:a,t:Math.sqrt(2*2/a),v:Math.sqrt(2*a*2),rot:b.k/(1+b.k)};});
  },
  reset:function(s){s.t=0;s.hold=0;},
  step:function(s,dt){var tmax=s.b[3].t;if(s.t>=tmax){s.hold+=dt;if(s.hold>1.2){s.t=0;s.hold=0;}return;}s.t=Math.min(tmax,s.t+dt);},
  draw:function(g,s){
    var c=g.c,f=s.f,cf=Math.cos(f),sf=Math.sin(f),lane=Math.min(30,g.h/9),R=lane*0.36;
    var left=g.w<480?14:130,avW=g.w-left-58-4*lane*sf,avH=g.h-30-4*lane;
    var L=Math.min(avW/cf,avH/sf);
    var x0=left,y0=g.h-14-L*sf; // vrh spodnje (površinske) črte
    var ex=cf,ey=sf,nx=sf,ny=-cf; // smer navzdol po klancu, normala ven
    g.poly([[x0,y0],[x0+L*ex,y0+L*ey],[x0,y0+L*ey]],null,0,null,true,c.surface2);
    g.line(x0,y0,x0+L*ex,y0+L*ey,c.muted,1.5);
    var finish=[x0+L*ex,y0+L*ey];
    g.line(finish[0]+nx*4,finish[1]+ny*4,finish[0]+nx*(4*lane+6),finish[1]+ny*(4*lane+6),c.text,2,[4,3]);
    s.b.forEach(function(b,i){
      var B=BODIES[i],col=c[B.col],off=(i+0.5)*lane;
      var ax=x0+nx*(off-lane/2),ay=y0+ny*(off-lane/2);
      if(i>0)g.line(ax,ay,ax+L*ex,ay+L*ey,c.border,1);
      var d=Math.min(2,0.5*b.a*s.t*s.t),u=d/2*(L-2*R)+R,px=x0+nx*(off-lane/2+R)+ex*u,py=y0+ny*(off-lane/2+R)+ey*u;
      if(B.k===0){var ctx=g.ctx;ctx.save();ctx.translate(px,py);ctx.rotate(f);ctx.fillStyle=col;ctx.fillRect(-R,-R,2*R,2*R);ctx.restore();}
      else{
        var ang=d/2*(L-2*R)/R;
        g.circle(px,py,R,B.k===1?null:col,col,B.k===1?3:1.5);
        g.line(px,py,px+Math.cos(ang+f)*R,py+Math.sin(ang+f)*R,B.k===1?col:c.surface,2);
      }
      if(left>100) g.text(B.n,left-8,y0+ny*(off-lane/2+R)+4,{align:'right',color:col,size:11.5,bold:true});
      if(d>=2) g.text(fmt(b.t,2)+' s',finish[0]+nx*(off-lane/2+R)+8,finish[1]+ny*(off-lane/2+R)+4,{color:col,bold:true,size:11.5});
    });
    g.text('t = '+fmt(s.t,2)+' s',g.w-10,16,{align:'right',color:c.muted});
  },
  readout:function(s){
    return '<div class="tablewrap"><table class="viz-tab"><tr><th>telo</th><th>J/mR²</th><th>a [m/s²]</th><th>t [s]</th><th>v na dnu [m/s]</th><th>delež W v vrtenju</th></tr>'+
      s.b.map(function(b,i){var B=BODIES[i];return '<tr><td><i class="dot '+B.col+'"></i>'+B.n+'</td><td>'+fmt(B.k,1)+'</td><td>'+fmt(b.a,2)+'</td><td>'+fmt(b.t,2)+'</td><td>'+fmt(b.v,2)+'</td><td>'+fmt(100*b.rot,0)+' %</td></tr>';}).join('')+'</table></div>';
  }
};

/* ======================================================================
   6. Dušeno in vsiljeno nihanje
   ====================================================================== */
var NIH={
  title:'Dušeno in vsiljeno nihanje',
  note:'Utež na vzmeti začne z odmikom 5 cm. Z β > 0 amplituda pojema (črtkana ovojnica x₀e^(−βt)). Ko vključiš vsiljevanje, se po prehodnem pojavu ustali nihanje s frekvenco vsiljevanja; amplituda je največja blizu ω ≈ ω₀ (spodnji graf: resonančna krivulja).',
  aspect:0.66,minH:320,maxH:480,anim:true,mobileH:360,
  controls:[
    {k:'w0',label:'ω₀ = √(k/m)',min:2,max:10,step:0.1,value:6,unit:'s⁻¹',d:1},
    {k:'b',label:'β (dušenje)',min:0,max:3,step:0.05,value:0.3,unit:'s⁻¹'},
    {k:'F',label:'F₀/m',min:0,max:1.5,step:0.05,value:0,unit:'m/s²'},
    {k:'w',label:'ω vsiljevanja',min:0.5,max:15,step:0.1,value:6,unit:'s⁻¹',d:1}
  ],
  update:function(s){
    var p=s.p;s.wd=p.b<p.w0?Math.sqrt(p.w0*p.w0-p.b*p.b):0;
    s.A=p.F/Math.sqrt(Math.pow(p.w0*p.w0-p.w*p.w,2)+4*p.b*p.b*p.w*p.w);
    s.phase=(p.b===0&&p.w===p.w0)?90:Math.atan2(2*p.b*p.w,p.w0*p.w0-p.w*p.w)*180/Math.PI;
    s.ymax=Math.max(0.05,isFinite(s.A)?s.A:0.05)*1.25;
  },
  reset:function(s){s.x=0.05;s.v=0;s.t=0;s.hist=[[0,0.05]];},
  step:function(s,dt){
    var p=s.p,h=0.001,n=Math.round(dt/h);
    function a(t,x,v){return -p.w0*p.w0*x-2*p.b*v+p.F*Math.cos(p.w*t);}
    for(var i=0;i<n;i++){
      var t=s.t,x=s.x,v=s.v;
      var k1x=v,k1v=a(t,x,v),k2x=v+h/2*k1v,k2v=a(t+h/2,x+h/2*k1x,v+h/2*k1v),k3x=v+h/2*k2v,k3v=a(t+h/2,x+h/2*k2x,v+h/2*k2v),k4x=v+h*k3v,k4v=a(t+h,x+h*k3x,v+h*k3v);
      s.x+=h/6*(k1x+2*k2x+2*k3x+k4x);s.v+=h/6*(k1v+2*k2v+2*k3v+k4v);s.t+=h;
    }
    s.hist.push([s.t,s.x]);
    while(s.hist.length>2&&s.hist[0][0]<s.t-12)s.hist.shift();
    s.ymax=Math.max(s.ymax,Math.abs(s.x)*1.1);
  },
  draw:function(g,s){
    var c=g.c,p=s.p,W=g.w,H=g.h,topH=Math.round(H*0.58);
    // vzmet in utež
    var sx=W<480?34:56,y0=14,ymid=y0+(topH-y0)/2,amp=(topH-y0)/2-24;
    var yy=ymid-clamp(s.x/s.ymax,-1.15,1.15)*amp;
    g.line(sx-18,y0,sx+18,y0,c.text,2);
    var pts=[[sx,y0]],n=12;for(var i=1;i<n;i++)pts.push([sx+(i%2?-9:9),y0+(yy-14-y0)*i/n]);pts.push([sx,yy-14]);
    g.poly(pts,c.muted,1.5);
    g.rect(sx-14,yy-14,28,28,c.accentSoft,c.accent,2);
    g.line(sx-22,ymid,sx+22,ymid,c.border,1,[3,3]);
    // graf x(t)
    var gx0=sx+(W<480?28:44),t1=Math.max(8,s.t),t0=t1-8;
    var m={x0:t0,x1:t1,y0:-s.ymax,y1:s.ymax,px0:gx0,px1:W-10,py0:topH-6,py1:y0};
    var ax=axes(g,m,{grid:false});
    g.line(gx0,ax.Y(0),W-10,ax.Y(0),c.border,1);
    for(var tk=Math.ceil(t0);tk<=t1;tk++)g.text(String(tk),ax.X(tk),ax.Y(0)+13,{color:c.muted,align:'center',size:10.5});
    g.text('x(t)',gx0+6,y0+12,{color:c.muted,size:11.5});g.text('t [s]',W-12,ax.Y(0)-5,{color:c.muted,align:'right',size:11});
    if(p.F===0&&p.b>0){var e1=[],e2=[];for(var j=0;j<=60;j++){var tt=t0+8*j/60;if(tt<0)continue;var e=0.05*Math.exp(-p.b*tt);e1.push([ax.X(tt),ax.Y(e)]);e2.push([ax.X(tt),ax.Y(-e)]);}g.poly(e1,c.warn,1.2,[4,4]);g.poly(e2,c.warn,1.2,[4,4]);}
    var ctx=g.ctx;ctx.save();ctx.beginPath();ctx.rect(gx0,y0,W-10-gx0,topH-6-y0);ctx.clip();
    g.poly(s.hist.filter(function(q){return q[0]>=t0;}).map(function(q){return [ax.X(q[0]),ax.Y(q[1])];}),c.accent,2);ctx.restore();
    g.text('x = '+fmt(s.x*100,1)+' cm',W-12,y0+12,{align:'right',color:c.accent,bold:true,size:12});
    // resonančna krivulja A(ω)/A(0)
    var ry0=topH+16,ry1=H-22,wmax=15,rmax=0;
    function rel(w){return p.w0*p.w0/Math.sqrt(Math.pow(p.w0*p.w0-w*w,2)+4*p.b*p.b*w*w);}
    for(var q=0;q<=300;q++){var r=rel(wmax*q/300);if(isFinite(r))rmax=Math.max(rmax,r);}
    rmax=Math.min(Math.max(rmax*1.1,1.5),25);
    var m2={x0:0,x1:wmax,y0:0,y1:rmax,px0:gx0,px1:W-10,py0:ry1,py1:ry0};
    var a2=axes(g,m2,{nx:5,ny:3,xl:'ω [s⁻¹]',yl:'A/A(0)'});
    var cp=[];for(q=0;q<=300;q++){var ww=wmax*q/300,rv=rel(ww);cp.push([a2.X(ww),a2.Y(Math.min(rv,rmax*1.05))]);}
    ctx.save();ctx.beginPath();ctx.rect(gx0,ry0-2,W-10-gx0,ry1-ry0+2);ctx.clip();g.poly(cp,c.ok,2);ctx.restore();
    g.line(a2.X(p.w0),ry0,a2.X(p.w0),ry1,c.muted,1,[3,3]);g.text('ω₀',a2.X(p.w0)+3,ry0+10,{color:c.muted,size:11});
    var rc=Math.min(rel(p.w),rmax);g.circle(a2.X(p.w),a2.Y(rc),5,p.F>0?c.bad:c.surface,c.bad,2);
  },
  readout:function(s){
    var p=s.p;
    return row('lastni nihajni čas t₀ = 2π/ω₀',fmt(2*Math.PI/p.w0,3)+' s')+
      row('dušena frekvenca ω = √(ω₀² − β²)',s.wd>0?fmt(s.wd,2)+' s⁻¹':'aperiodično (β ≥ ω₀)')+
      row('razpolovni čas amplitude ln2/β',p.b>0?fmt(Math.LN2/p.b,2)+' s':'∞')+
      (p.F>0?row('ustaljena amplituda',isFinite(s.A)?fmt(s.A*100,2)+' cm':'raste brez meje (β = 0, ω = ω₀)')+row('fazni zamik za silo',fmt(s.phase,0)+'°'):'');
  }
};

/* ======================================================================
   7. Venturijeva cev — kontinuitetna in Bernoullijeva enačba
   ====================================================================== */
var VEN={
  title:'Venturijeva cev',
  note:'Voda (ρ = 1000 kg/m³) teče skozi vodoravno cev z zožitvijo. Iz S₁v₁ = S₂v₂ sledi v₂ > v₁, iz Bernoullijeve enačbe pa p₂ < p₁. Razliko tlakov pokažeta stolpca v navpičnih cevkah: Δh = Δp/ρg. Tlak v širokem delu ustreza 2 m vodnega stolpca.',
  aspect:0.5,minH:240,maxH:380,anim:true,
  controls:[
    {k:'v1',label:'v₁',min:0.2,max:2,step:0.05,value:1,unit:'m/s'},
    {k:'r',label:'S₁ / S₂',min:1,max:3,step:0.05,value:2}
  ],
  update:function(s){
    var p=s.p;s.v2=p.v1*p.r;s.dp=500*(s.v2*s.v2-p.v1*p.v1);s.dh=s.dp/(1000*G0);s.h1=2;s.h2=s.h1-s.dh;
  },
  reset:function(s){if(!s.parts){s.parts=[];for(var i=0;i<70;i++)s.parts.push([Math.random(),Math.random()*1.8-0.9]);}},
  keepOnChange:true,
  step:function(s,dt){var self=this;s.parts.forEach(function(q){q[0]+=dt*0.12*s.p.v1/self.prof(q[0],s.p.r);if(q[0]>1){q[0]-=1;q[1]=Math.random()*1.8-0.9;}});},
  prof:function(u,r){ // relativna višina cevi (1 v širokem delu, 1/r v zožitvi)
    var a=0.36,b=0.48,c=0.52,d=0.64,k;
    if(u<a||u>d+0.0)k=0;else if(u<b)k=(1-Math.cos(Math.PI*(u-a)/(b-a)))/2;else if(u<=c)k=1;else k=(1+Math.cos(Math.PI*(u-c)/(d-c)))/2;
    if(u>d)k=0;
    return 1-k*(1-1/r);
  },
  draw:function(g,s){
    var c=g.c,p=s.p,W=g.w,H=g.h,self=this;
    var x0=10,x1=W-10,yc=H-Math.min(70,H*0.25),hw=Math.min(36,H*0.13);
    var colTop=18,colBase=yc-hw,pxPerM=(colBase-colTop)/2.2;
    function X(u){return x0+u*(x1-x0);}
    var top=[],bot=[];for(var i=0;i<=120;i++){var u=i/120,hh=hw*self.prof(u,p.r);top.push([X(u),yc-hh]);bot.push([X(u),yc+hh]);}
    g.poly(top.concat(bot.slice().reverse()),null,0,null,true,c.accentSoft);
    g.poly(top,c.text,2);g.poly(bot,c.text,2);
    // delci
    s.parts.forEach(function(q){var hh=hw*self.prof(q[0],p.r)*0.85;g.circle(X(q[0]),yc+q[1]*hh,1.8,c.accent);});
    // manometrski cevki
    function column(u,hgt,lab,col){
      var xm=X(u),yb=yc-hw*self.prof(u,p.r),yt=colBase-hgt*pxPerM;
      g.rect(xm-7,colTop,14,yb-colTop,null,c.muted,1.2);
      g.rect(xm-6,Math.max(colTop,yt),12,yb-Math.max(colTop,yt),c.accentSoft);
      g.line(xm-6,Math.max(colTop,yt),xm+6,Math.max(colTop,yt),c.accent,2);
      g.text(lab,xm+12,Math.max(colTop+10,yt+4),{color:col,bold:true,size:12});
    }
    column(0.18,s.h1,'p₁',c.text);column(0.5,s.h2,'p₂',c.text);
    // Δh
    var ya=colBase-s.h1*pxPerM,yb2=colBase-s.h2*pxPerM,xa=X(0.34);
    g.line(X(0.18)+8,ya,X(0.5)-8,ya,c.muted,1,[3,3]);
    if(s.dh>0.005){g.arrow(xa,ya,xa,yb2,c.bad,1.8);g.arrow(xa,yb2,xa,ya,c.bad,1.8);g.text('Δh = '+fmt(s.dh*100,0)+' cm',xa+6,(ya+yb2)/2+4,{color:c.bad,bold:true,size:12,halo:true});}
    g.text('v₁ = '+fmt(p.v1,2)+' m/s',X(0.08),yc+hw+18,{align:'center',color:c.accent,bold:true,size:12});
    g.text('v₂ = '+fmt(s.v2,2)+' m/s',X(0.5),yc+hw+18,{align:'center',color:c.accent,bold:true,size:12});
  },
  readout:function(s){
    var p=s.p;
    return row('hitrost v zožitvi v₂ = v₁·S₁/S₂',fmt(s.v2,2)+' m/s')+row('razlika tlakov Δp = ρ(v₂² − v₁²)/2',fmtE(s.dp)+' Pa')+
      row('razlika višin stolpcev Δh',fmt(s.dh*100,1)+' cm')+row('pretok pri S₁ = 20 cm²',fmt(20e-4*p.v1*1000,2)+' L/s');
  }
};

/* ======================================================================
   8. Stoječe valovanje na struni
   ====================================================================== */
var VAL={
  title:'Stoječe valovanje na struni',
  note:'Stoječe valovanje je vsota dveh enakih valovanj, ki potujeta v nasprotnih smereh: A sin(kx − ωt) + A sin(kx + ωt) = 2A sin(kx) cos(ωt). Na struni, vpeti na obeh koncih, so možni le valovi z λₙ = 2L/n. Struna: L = 0,5 m, μ = 0,01 kg/m. Animacija je upočasnjena.',
  aspect:0.42,minH:220,maxH:340,anim:true,
  controls:[
    {k:'n',label:'n (harmonik)',min:1,max:6,step:1,value:2},
    {k:'F',label:'sila F',min:10,max:200,step:1,value:100,unit:'N'},
    {k:'comp',type:'check',label:'pokaži potujoči komponenti',value:true}
  ],
  update:function(s){var p=s.p;s.c=Math.sqrt(p.F/0.01);s.lam=2*0.5/p.n;s.nu=p.n*s.c/(2*0.5);},
  reset:function(s){s.ph=s.ph||0;},keepOnChange:true,
  step:function(s,dt){s.ph+=2*Math.PI*0.3*s.p.n*Math.sqrt(s.p.F/100)*dt;},
  draw:function(g,s){
    var c=g.c,p=s.p,x0=20,x1=g.w-20,yc=g.h/2+4,A=Math.min(g.h*0.2,60),N=220;
    var wt=s.ph||0; // upočasnjena faza (frekvenca ∝ n√F)
    var k=p.n*Math.PI; // na enoto dolžine [0,1]
    function X(u){return x0+u*(x1-x0);}
    g.line(x0,yc,x1,yc,c.border,1,[3,4]);
    if(p.comp){
      var a=[],b=[];for(var i=0;i<=N;i++){var u=i/N;a.push([X(u),yc-A*0.5*Math.sin(k*u-wt)]);b.push([X(u),yc-A*0.5*Math.sin(k*u+wt)]);}
      g.poly(a,c.ok,1.4,[6,4]);g.poly(b,c.warn,1.4,[6,4]);
    }
    var env1=[],env2=[],sum=[];
    for(var j=0;j<=N;j++){var uu=j/N,sn=Math.sin(k*uu);env1.push([X(uu),yc-A*sn]);env2.push([X(uu),yc+A*sn]);sum.push([X(uu),yc-A*sn*Math.cos(wt)]);}
    g.poly(env1,c.border,1);g.poly(env2,c.border,1);
    g.poly(sum,c.accent,2.6);
    for(var q=0;q<=p.n;q++){g.circle(X(q/p.n),yc,4,c.bad);}
    for(q=0;q<p.n;q++){g.text('hrbet',X((q+0.5)/p.n),yc-A-8,{align:'center',color:c.muted,size:10.5});}
    g.rect(x0-8,yc-30,8,60,c.surface2,c.muted,1);g.rect(x1,yc-30,8,60,c.surface2,c.muted,1);
    g.text('● vozli',x0,g.h-10,{color:c.bad,size:11.5,bold:true});
    if(p.comp){g.text('→ val v desno',x0+70,g.h-10,{color:c.ok,size:11.5});g.text('← val v levo',x0+170,g.h-10,{color:c.warn,size:11.5});}
  },
  readout:function(s){
    var p=s.p;
    return row('hitrost valovanja c = √(F/μ)',fmt(s.c,1)+' m/s')+row('valovna dolžina λₙ = 2L/n',fmt(s.lam,3)+' m')+
      row('frekvenca νₙ = nc/2L',fmt(s.nu,1)+' Hz')+row('število vozlov / hrbtov',(p.n+1)+' / '+p.n);
  }
};

/* ======================================================================
   9. Procesi idealnega plina v p(V) diagramu
   ====================================================================== */
var PV={
  title:'Procesi idealnega plina v diagramu p(V)',
  note:'Začetno stanje: p₁ = 100 kPa, V₁ = 10 L, T₁ = 300 K (n = 0,401 mol). Senčena ploskev pod krivuljo je |A|. Po konvenciji predmeta je A delo, ki ga plin prejme (pri razpenjanju A < 0), in velja ΔWₙ = A + Q. Tanki krivulji sta izotermi pri T₁ in T₂.',
  aspect:0.55,minH:280,maxH:420,anim:true,mobileH:320,
  controls:[
    {k:'proc',type:'select',label:'proces',value:'izoterma',options:[['izoterma','izotermni (T = konst.)'],['izobara','izobarni (p = konst.)'],['izohora','izohorni (V = konst.)'],['adiabata','adiabatni (Q = 0)']]},
    {k:'gas',type:'select',label:'plin',value:'2',options:[['1','enoatomni (κ = 5/3)'],['2','dvoatomni (κ = 7/5)']]},
    {k:'x',label:'V₂ / V₁',labelFn:function(p){return p.proc==='izohora'?'p₂ / p₁':'V₂ / V₁';},min:0.3,max:3,step:0.05,value:2,show:function(v){return fmt(v,2)+'×';}}
  ],
  update:function(s){
    var p=s.p,R=8.314,p1=1e5,V1=0.01,T1=300,n=p1*V1/(R*T1),cv=p.gas==='1'?1.5*R:2.5*R,ka=(cv+R)/cv,x=p.x;
    var V2=V1,p2=p1,T2=T1,A=0,curve;
    if(p.proc==='izoterma'){V2=V1*x;p2=p1/x;A=-p1*V1*Math.log(x);curve=function(V){return p1*V1/V;};}
    else if(p.proc==='izobara'){V2=V1*x;T2=T1*x;A=-p1*(V2-V1);curve=function(){return p1;};}
    else if(p.proc==='izohora'){p2=p1*x;T2=T1*x;A=0;curve=null;}
    else{V2=V1*x;p2=p1*Math.pow(1/x,ka);T2=T1*Math.pow(1/x,ka-1);A=n*cv*(T2-T1);curve=function(V){return p1*Math.pow(V1/V,ka);};}
    var dW=n*cv*(T2-T1);
    Object.assign(s,{n:n,ka:ka,p1:p1,V1:V1,T1:T1,p2:p2,V2:V2,T2:T2,A:A,dW:dW,Q:dW-A,curve:curve});
    s.Vmax=Math.max(V1,V2)*1.25*1000;s.pmax=Math.max(p1,p2)*1.3/1000;
  },
  reset:function(s){s.u=0;s.dir=1;s.hold=0;},
  step:function(s,dt){
    if(s.hold>0){s.hold-=dt;return;}
    s.u+=s.dir*dt/2.2;if(s.u>=1){s.u=1;s.dir=-1;s.hold=0.8;}else if(s.u<=0){s.u=0;s.dir=1;s.hold=0.8;}
  },
  draw:function(g,s){
    var c=g.c,p=s.p,W=g.w,H=g.h,cylW=W<480?0:Math.min(130,W*0.22);
    var m={x0:0,x1:s.Vmax,y0:0,y1:s.pmax,px0:44,px1:W-16-cylW,py0:H-26,py1:14};
    var ax=axes(g,m,{xl:'V [L]',yl:'p [kPa]',nx:5,ny:4});
    var ctx=g.ctx;ctx.save();ctx.beginPath();ctx.rect(m.px0,m.py1,m.px1-m.px0,m.py0-m.py1);ctx.clip();
    // izotermi T1 in T2
    var nR=s.n*8.314;
    [s.T1,s.T2].forEach(function(T,i){if(i===1&&Math.abs(s.T2-s.T1)<0.5)return;var pts=[];for(var j=1;j<=120;j++){var V=s.Vmax*j/120/1000;pts.push([ax.X(V*1000),ax.Y(nR*T/V/1000)]);}g.poly(pts,c.border,1.2);
      var Vl=s.Vmax*0.93/1000;g.text(fmt(T,0)+' K',ax.X(Vl*1000),ax.Y(nR*T/Vl/1000)-5,{color:c.muted,size:10.5,align:'right'});});
    // pot procesa
    var path=[];
    function P(V){return s.curve(V);}
    if(s.curve){for(var k=0;k<=80;k++){var V=s.V1+(s.V2-s.V1)*k/80;path.push([V,P(V)]);}}
    else path=[[s.V1,s.p1],[s.V2,s.p2]];
    if(s.curve){var area=path.map(function(q){return [ax.X(q[0]*1000),ax.Y(q[1]/1000)];});area.push([ax.X(s.V2*1000),ax.Y(0)]);area.push([ax.X(s.V1*1000),ax.Y(0)]);
      g.poly(area,null,0,null,true,s.V2>s.V1?c.okSoft:c.badSoft);}
    g.poly(path.map(function(q){return [ax.X(q[0]*1000),ax.Y(q[1]/1000)];}),c.accent,2.6);
    ctx.restore();
    g.circle(ax.X(s.V1*1000),ax.Y(s.p1/1000),4.5,c.text);g.text('1',ax.X(s.V1*1000)+7,ax.Y(s.p1/1000)-7,{bold:true});
    g.circle(ax.X(s.V2*1000),ax.Y(s.p2/1000),4.5,c.text);g.text('2',ax.X(s.V2*1000)+7,ax.Y(s.p2/1000)-7,{bold:true});
    // trenutno stanje
    var u=s.u,Vc,pc;
    if(s.curve){Vc=s.V1+(s.V2-s.V1)*u;pc=P(Vc);}else{Vc=s.V1;pc=s.p1+(s.p2-s.p1)*u;}
    var Tc=pc*Vc/nR;
    g.circle(ax.X(Vc*1000),ax.Y(pc/1000),6,c.warn,c.text,1.2);
    if(cylW){
      var cx0=W-cylW+6,cyTop=24,cyBot=H-30,cw=cylW-30,maxV=Math.max(s.V1,s.V2)*1.15,hpx=(cyBot-cyTop)*Vc/maxV;
      var tr=clamp((Tc-150)/600,0,1),gasCol='rgba('+Math.round(70+185*tr)+','+Math.round(120-40*tr)+','+Math.round(230-180*tr)+',0.35)';
      g.rect(cx0,cyBot-hpx,cw,hpx,gasCol);
      g.line(cx0,cyTop,cx0,cyBot,c.text,2);g.line(cx0+cw,cyTop,cx0+cw,cyBot,c.text,2);g.line(cx0,cyBot,cx0+cw,cyBot,c.text,2);
      g.rect(cx0+2,cyBot-hpx-8,cw-4,8,c.muted);g.line(cx0+cw/2,cyBot-hpx-8,cx0+cw/2,cyTop-10,c.muted,3);
      g.text(fmt(Tc,0)+' K',cx0+cw/2,cyBot-hpx/2+4,{align:'center',bold:true,size:12});
      g.text(fmt(Vc*1000,1)+' L',cx0+cw/2,cyBot+16,{align:'center',color:c.muted,size:11});
    }
  },
  readout:function(s){
    function J(v){return (Math.abs(v)>=1000?fmt(v/1000,2)+' kJ':fmt(v,0)+' J');}
    return wide('končno stanje','p₂ = '+fmt(s.p2/1000,1)+' kPa, V₂ = '+fmt(s.V2*1000,1)+' L, T₂ = '+fmt(s.T2,0)+' K')+
      row('prejeto delo A = −∫p dV',J(s.A))+row('prejeta toplota Q',J(s.Q))+row('sprememba notranje energije ΔWₙ',J(s.dW))+
      row('A + Q (= ΔWₙ)',J(s.A+s.Q));
  }
};

/* ---------- zagon ---------- */
var REG={met:MET,klanec:KLANEC,satelit:SAT,trk:TRK,kotaljenje:KOT,nihanje:NIH,venturi:VEN,struna:VAL,pv:PV};

function init(){
  [].slice.call(document.querySelectorAll('.viz[data-viz]')).forEach(function(h){var sp=REG[h.getAttribute('data-viz')];if(sp)mount(h,sp);});
  if(window.ResizeObserver){var ro=new ResizeObserver(function(es){es.forEach(function(e){widgets.forEach(function(w){if(w.box===e.target)w.resize();});});});widgets.forEach(function(w){ro.observe(w.box);});}
  else window.addEventListener('resize',function(){widgets.forEach(function(w){w.resize();});});
  if(window.IntersectionObserver){var io=new IntersectionObserver(function(es){es.forEach(function(e){widgets.forEach(function(w){if(w.host===e.target)w.visible=e.isIntersecting;});});kick();},{rootMargin:'100px'});widgets.forEach(function(w){io.observe(w.host);});}
  new MutationObserver(function(){widgets.forEach(function(w){w.recolor();});}).observe(root,{attributes:true,attributeFilter:['data-theme']});
  if(window.matchMedia){var mq=window.matchMedia('(prefers-color-scheme: dark)');var fn=function(){widgets.forEach(function(w){w.recolor();});};if(mq.addEventListener)mq.addEventListener('change',fn);else if(mq.addListener)mq.addListener(fn);}
  document.addEventListener('visibilitychange',kick);
  kick();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
