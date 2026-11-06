// Locally shipped chess artwork. Keep this catalog aligned with licenses/PIECE-THEMES.md.
// Default Cburnett traces remain the original, unchanged appearance.
export const PIECE_THEMES = [
  {id:'classic',name:'Original',source:'Original Chess 360',license:'CC BY-SA 3.0'},
  {id:'staunton-ivory',name:'Classic Ivory',source:'Traditional',license:'GPLv2+',format:'png'},
  {id:'staunton-wood',name:'Classic Wood',source:'Traditional',license:'GPLv2+',format:'png'},
  {id:'art-fantasy',name:'Fantasy',source:'Chess Art',license:'MIT',custom:true},
  {id:'art-celtic',name:'Celtic',source:'Chess Art',license:'MIT',custom:true},
  {id:'art-spatial',name:'Spatial',source:'Chess Art',license:'MIT',custom:true},
  {id:'art-skulls',name:'Skulls',source:'Chess Art',license:'MIT'},
  {id:'art-eyes',name:'Eyes',source:'Chess Art',license:'MIT'},
  {id:'art-prmi',name:'Prmi',source:'Chess Art',license:'MIT'},
  {id:'art-freak',name:'Freak',source:'Chess Art',license:'MIT'},
  {id:'lila-chessnut',name:'Chessnut',source:'Lichess',license:'Apache 2.0'},
  {id:'lila-rhosgfx',name:'RhosGFX',source:'Lichess',license:'CC0'},
  {id:'lila-kiwen-suwi',name:'Kiwen Suwi',source:'Lichess',license:'CC BY 4.0'},
  {id:'lila-firi',name:'Firi',source:'Lichess',license:'CC BY 4.0'},
  {id:'lila-totoy',name:'Totoy',source:'Lichess',license:'CC BY 4.0'},
  {id:'lila-papercut',name:'Papercut',source:'Lichess',license:'CC BY 4.0'},
  {id:'lila-shapes',name:'Shapes',source:'Lichess',license:'CC BY-SA 4.0'},
  {id:'lila-cburnett',name:'Cburnett',source:'Lichess',license:'GPLv2+'},
  {id:'lila-merida',name:'Merida',source:'Lichess',license:'GPLv2+'},
  {id:'lila-mpchess',name:'MPChess',source:'Lichess',license:'GPLv3+'},
];
export const themeById = id => PIECE_THEMES.find(t=>t.id===id);
export const isCustomTheme = id => !!themeById(id)?.custom;
export const DEFAULT_PAINT = Object.freeze({
  w1:'#fff5df',w2:'#d7ad82',ws:'#352a25',
  b1:'#575d74',b2:'#151a2b',bs:'#e8e5df',
  whiteShadow:'#4b382b',blackShadow:'#11101b',shadow:true,
  stroke:18,boundary:26,blur:25,offset:24,slant:5,flatten:7,
});
export function cleanPaint(x={}) {
  const hex=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
  const number=(value,fallback,max)=>Number.isFinite(Number(value))&&value!==null&&value!==''?Math.min(max,Math.max(0,Number(value))):fallback;
  return {
    w1:hex(x.w1,DEFAULT_PAINT.w1),w2:hex(x.w2,DEFAULT_PAINT.w2),ws:hex(x.ws,DEFAULT_PAINT.ws),
    b1:hex(x.b1,DEFAULT_PAINT.b1),b2:hex(x.b2,DEFAULT_PAINT.b2),bs:hex(x.bs,DEFAULT_PAINT.bs),
    whiteShadow:hex(x.whiteShadow,DEFAULT_PAINT.whiteShadow),blackShadow:hex(x.blackShadow,DEFAULT_PAINT.blackShadow),
    shadow:x.shadow!==false,stroke:number(x.stroke,18,60),boundary:number(x.boundary,26,70),
    blur:number(x.blur,25,60),offset:number(x.offset,24,80),slant:number(x.slant,5,35),flatten:number(x.flatten,7,90),
  };
}
export function staticPieceUrl(theme,color,type) {
  const file=`${color}${type.toUpperCase()}.${themeById(theme)?.format||'svg'}`;
  return theme==='classic'?`assets/pieces/${file}`:`assets/piece-themes/${theme}/${file}`;
}
// Chess Art's original SVGs are actual editable vector templates, not recolored screenshots.
// Adapted from Maurizio Monge's MIT-licensed configure.html: gradient, stroke and shadow controls.
export function customizeChessArtSvg(xml,color,paint) {
  const doc=new DOMParser().parseFromString(xml,'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('Cannot parse Chess Art piece');
  const svg=doc.documentElement;
  const pick=selector=>svg.querySelector(selector);
  const col=color==='w'?'w':'b';
  const fill1=paint[col+'1'],fill2=paint[col+'2'],stroke=paint[col+'s'];
  for(const [selector,css] of [
    ['#fill-color',`.fill-color {fill:${fill1};}`],
    ['#stroke-color',`.stroke-color {stroke:${stroke};}`],
    ['#stroke-medium',`.stroke-medium {stroke-width:${paint.stroke};}`],
    ['#stroke-heavy',`.stroke-heavy {stroke-width:${Math.round(paint.stroke*1.15)};}`],
    ['#stroke-boundary',`.stroke-boundary {stroke-width:${paint.boundary};}`],
  ]) {const target=pick(selector);if(target)target.textContent=css;}
  for(const [selector,value] of [['#fillGradient #stop0',fill1],['#fillGradient #stop1',fill2]]) {
    const stop=pick(selector);
    if(stop) {stop.style.stopColor=value;stop.setAttribute('stop-color',value);}
  }
  const shadows=svg.querySelectorAll('#shadow');
  if (!paint.shadow) {
    shadows.forEach(s=>s.remove());
  } else {
    const slant=Math.tan(paint.slant*Math.PI/180);
    const heightScale=1-paint.flatten/100;
    const bottom=850;
    const dx=paint.offset+slant*bottom*0.5;
    const dy=paint.offset+(1-heightScale)*bottom;
    shadows.forEach(s=>{
      s.style.fill=col==='w'?paint.whiteShadow:paint.blackShadow;
      s.setAttribute('transform',`matrix(1 0 ${-slant} ${heightScale} ${dx.toFixed(2)} ${dy.toFixed(2)})`);
    });
    svg.querySelectorAll('#filterBlur feGaussianBlur').forEach(f=>f.setAttribute('stdDeviation',`${paint.blur} ${paint.blur}`));
  }
  svg.setAttribute('width','100%');svg.setAttribute('height','100%');
  return new XMLSerializer().serializeToString(svg);
}
