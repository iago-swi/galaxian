"use strict";
class Carillon {
  constructor(){ this.muted=false; this.beat=0; this.next=0; }
  wake(){
    try {
      if(!this.ctx){
        const Engine=window.AudioContext || window.webkitAudioContext;
        if(!Engine)return;
        this.ctx=new Engine();
        this.bus=this.ctx.createGain(); this.bus.gain.value=this.muted?0:.30;
        this.bus.connect(this.ctx.destination);
      }
      if(this.ctx.state==="suspended")this.ctx.resume().catch(()=>{});
    } catch { /* Browsers may disable audio output. */ }
  }
  toggle(){
    this.muted=!this.muted; this.wake();
    if(this.bus)this.bus.gain.setTargetAtTime(this.muted?0:.30,this.ctx.currentTime,.012);
  }
  note(hz,end,duration,type,level,when){
    if(!this.ctx || this.muted || this.ctx.state!=="running")return;
    const at=when??this.ctx.currentTime, osc=this.ctx.createOscillator(), amp=this.ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(hz,at);
    osc.frequency.exponentialRampToValueAtTime(end,at+duration);
    amp.gain.setValueAtTime(.0001,at);amp.gain.exponentialRampToValueAtTime(level,at+.008);
    amp.gain.exponentialRampToValueAtTime(.0001,at+duration);
    osc.connect(amp);amp.connect(this.bus);osc.start(at);osc.stop(at+duration+.02);
    osc.onended=()=>{osc.disconnect();amp.disconnect();};
  }
  effect(name){
    const sounds={shot:[780,360,.07,"triangle",.13],hit:[185,65,.16,"sawtooth",.12],
      plate:[900,240,.13,"square",.08],shield:[260,970,.44,"sine",.22],
      loss:[175,34,.7,"sawtooth",.22],hatch:[510,840,.2,"sine",.13],
      core:[220,115,.2,"triangle",.26],collapse:[135,30,1,"sawtooth",.22],life:[660,1320,.45,"sine",.25]};
    if(sounds[name])this.note(...sounds[name]);
  }
  music(stage){
    if(!this.ctx || this.muted || this.ctx.state!=="running")return;
    const now=this.ctx.currentTime;
    if(this.next<now-.1)this.next=now;
    const phrase=[0,7,12,null,10,7,null,3,5,null,12,7,3,null,2,null];
    while(this.next<now+.06){
      const step=this.beat%16;
      const root=[146.83,174.61,130.81,164.81][Math.floor(this.beat/16)%4];
      if(phrase[step]!==null){
        const pitch=root*2**(phrase[step]/12+1);
        this.note(pitch,pitch,.27,"sine",.13,this.next);
        this.note(pitch*2.98,pitch*2.97,.085,"sine",.045,this.next);
      }
      if(step%4===0)this.note(root,root*.99,.28,"triangle",.18,this.next);
      if(step%4===2)this.note(90,38,.09,"triangle",.14,this.next);
      this.next+=stage===4?.154:.178;this.beat++;
    }
  }
}
