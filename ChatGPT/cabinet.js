"use strict";
const el=id=>document.getElementById(id);
const speaker=new Carillon();
const print=new SunPrint(el("field"));
let mode="title", best=0, titleTime=0, last=0, bank=0;
const held=new Set(), fingers=new Map();
const game=new Flight(name=>{
  if(name==="stage")return;
  speaker.effect(name);
  if(name==="life")el("status").textContent="Extra ship";
});
try {best=Math.max(0,Number(localStorage.getItem("sunspindle.best"))||0);}catch{}
function clearInput(){held.clear();fingers.clear();}
function changeMode(next){
  mode=next; clearInput();bank=0;
  const playing=mode==="play", paused=mode==="pause", over=mode==="over";
  el("cover").hidden=playing;
  el("pause").disabled=!(playing||paused);el("pause").textContent=paused?"Resume":"Pause";
  el("heading").textContent=paused?"Paused":over?"Flight over":"Sunspindle";
  el("copy").textContent=paused?"The flock can wait.":over?"Final score  "+String(game.score).padStart(6,"0"):"Break the flock. Pierce the sun.";
  el("edition").textContent=over?"END OF FLIGHT":paused?"FLIGHT ON HOLD":"ARCADE SHOOTER  /  V1.0.0";
  el("launch").innerHTML=(paused?"Resume flight":over?"Fly again":"Launch ship")+' <span aria-hidden="true">↗</span>';
  el("shortcut").textContent=paused?"or press P":"or press Enter";
  if(playing)document.activeElement?.blur();
  el("status").textContent=playing?stages[game.stage]:el("heading").textContent;
  hud();
}
function launch(){
  speaker.wake();
  if(mode!=="pause"){game.reset();speaker.beat=0;}
  changeMode("play");
}
function pause(){if(mode==="play")changeMode("pause");else if(mode==="pause")launch();}
function mute(){speaker.toggle();el("mute").textContent=speaker.muted?"Sound off":"Sound on";el("mute").setAttribute("aria-pressed",String(speaker.muted));}
const hints=["Pick off the formation. A diving swift is worth double.","Track the low birds as they peel away.","Break eggs early, or let them hatch for a higher score.","Aim between the wings. A missing wing grows back.","Cut through the brass plates. Follow the spindle and fire when its centre turns gold."];
function hud(){
  if(el("hint").textContent!==hints[game.stage])el("hint").textContent=hints[game.stage];
  if(game.score>best){
    best=game.score;
    try{localStorage.setItem("sunspindle.best",String(best));}catch{}
  }
  el("score").textContent=String(game.score).padStart(6,"0");el("best").textContent=String(best).padStart(6,"0");
  el("cycle").textContent="Cycle "+String(game.cycle).padStart(2,"0");
  Array.from(el("route").children).forEach((li,i)=>li.classList.toggle("current",i===game.stage));
  el("ships").textContent=game.lives<=5?"▲ ".repeat(game.lives).trim():"▲ × "+game.lives;
  el("ships").setAttribute("aria-label",game.lives+" ships");
  el("shield").textContent=game.guard>0?"Active":game.recharge>0?Math.ceil(game.recharge)+" s":"Ready";
  el("charge").value=game.guard>0?game.guard/1.45:1-Math.min(1,game.recharge/5);
}
el("launch").onclick=launch;el("pause").onclick=pause;el("mute").onclick=mute;
const bindings={ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right",Space:"fire",ArrowUp:"fire",KeyW:"fire",
  ShiftLeft:"shield",ShiftRight:"shield",ArrowDown:"shield",KeyS:"shield"};
window.addEventListener("keydown",e=>{
  if(e.altKey||e.metaKey||e.ctrlKey)return;
  if((e.code==="Enter"||e.code==="Space") && e.target instanceof HTMLButtonElement && !e.target.disabled)return;
  const action=bindings[e.code];
  if(!action && !["KeyP","Escape","KeyM","Enter"].includes(e.code))return;
  e.preventDefault();if(e.repeat)return;
  if(e.code==="KeyM"){mute();return;}
  if(e.code==="KeyP"||e.code==="Escape"){pause();return;}
  if(mode!=="play"){
    if(e.code==="Enter" || (e.code==="Space" && mode!=="pause"))launch();
    return;
  }
  if(action==="shield")game.activateShield();
  if(action)held.add(e.code);
});
window.addEventListener("keyup",e=>held.delete(e.code));
for(const btn of document.querySelectorAll("[data-key]")){
  btn.addEventListener("pointerdown",e=>{
    e.preventDefault();if(mode!=="play")return;
    btn.setPointerCapture(e.pointerId);
    fingers.set(e.pointerId,btn.dataset.key);
    if(btn.dataset.key==="shield")game.activateShield();
  });
  for(const event of ["pointerup","pointercancel","lostpointercapture"])btn.addEventListener(event,e=>fingers.delete(e.pointerId));
}
window.addEventListener("blur",()=>{if(mode==="play")changeMode("pause");else clearInput();});
document.addEventListener("visibilitychange",()=>{if(document.hidden && mode==="play")changeMode("pause");});
function frame(now){
  const dt=Math.min(.12,Math.max(0,(now-last)/1000));last=now;
  if(mode==="play"){
    const actions=new Set([...Array.from(held,code=>bindings[code]),...fingers.values()]);
    const input={left:actions.has("left"),right:actions.has("right"),fire:actions.has("fire")};
    bank+=dt;
    const previousStage=game.stage;
    while(bank>=1/120 && !game.over){game.tick(1/120,input);bank-=1/120;}
    if(game.over)changeMode("over");
    else {speaker.music(game.stage);if(game.stage!==previousStage)el("status").textContent=stages[game.stage];}
    hud();
  }else if(mode==="title" && !matchMedia("(prefers-reduced-motion: reduce)").matches)titleTime+=dt;
  print.draw(game,mode,mode==="title"?titleTime:game.age);
  requestAnimationFrame(frame);
}
changeMode("title");requestAnimationFrame(frame);
