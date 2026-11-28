"use strict";
class SunPrint {
  constructor(canvas) {
    this.ctx = canvas.getContext("2d");
    this.papers = [];
    for(let i=0;i<5;i++) this.papers.push(this.landscape(i));
  }
  polygon(g,points,fill,stroke) {
    g.beginPath(); g.moveTo(points[0],points[1]);
    for(let i=2;i<points.length;i+=2) g.lineTo(points[i],points[i+1]);
    g.closePath(); g.fillStyle=fill; g.fill();
    if(stroke){g.strokeStyle=stroke;g.lineWidth=1.5;g.stroke();}
  }
  disc(g,x,y,r,color) {
    g.fillStyle=color; g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
  }
  landscape(stage) {
    const sheet=document.createElement("canvas"); sheet.width=WIDTH; sheet.height=HEIGHT;
    const g=sheet.getContext("2d");
    let seed=1532;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const sky=g.createLinearGradient(0,0,0,HEIGHT);
    sky.addColorStop(0,["#263f7f","#304879","#2c486e","#364376","#273e68"][stage]);
    sky.addColorStop(.7,"#628caa");sky.addColorStop(1,"#ced1ab");
    g.fillStyle=sky;g.fillRect(0,0,WIDTH,HEIGHT);
    const sx=555-stage*30,sy=185-stage*6,r=101;
    for(let i=0;i<74;i++){
      const angle=i*Math.PI/37;
      g.beginPath();g.moveTo(sx+Math.cos(angle)*111,sy+Math.sin(angle)*111);
      g.lineTo(sx+Math.cos(angle)*1100,sy+Math.sin(angle)*1100);
      g.strokeStyle=i%2 ? "#eddeb712" : "#e4dfbf09";g.stroke();
    }
    for(const radius of [112,119,156]){
      g.beginPath();g.arc(sx,sy,radius,0,Math.PI*2);g.strokeStyle="#ecdfb04a";g.stroke();
    }
    this.disc(g,sx,sy,r,"#f6c66e");
    g.save();g.clip();
    for(let y=sy-r;y<sy+r;y+=5){
      g.fillStyle=y<sy ? "#fceaa75c" : "#c4845b8a";g.fillRect(sx-r,y,r*2,1+(y-sy+r)/100);
    }g.restore();
    // Each mountain is a two-ink printing plate, with etched lines following its face.
    const ridge=(x,y,w,h,light,dark,ink)=>{
      const base=y+h;
      this.polygon(g,[x-w,base,x,y,x+w,base],light);
      this.polygon(g,[x,y,x+w*.15,y+h*.33,x+w*.1,y+h*.38,x+w*.42,y+h*.68,x+w*.35,y+h*.7,x+w*.67,base,x+w,base],dark);
      g.save();g.beginPath();g.moveTo(x-w,base);g.lineTo(x,y);g.lineTo(x+w,base);g.clip();
      g.strokeStyle=ink;g.lineWidth=1;
      for(let i=0;i<39;i++){const offset=i*w/41;
        g.beginPath();g.moveTo(x-offset,y+offset*.29+8);g.lineTo(x-offset-w*.24,y+h*.4+offset*.34);g.lineTo(x-offset-w*.27,y+h*.43+offset*.34);g.lineTo(x-offset-w*.83,base);g.stroke();}
      g.restore();
    };
    ridge(-2,363,260,215,"#91aaa9","#718faa","#668fa5");
    ridge(290,395,214,162,"#b6bca6","#8ea2a6","#91a7a9");
    ridge(716,294,276,250,"#d1c7a1","#899da2","#9aaba5");
    ridge(528,403,193,130,"#a7b7ac","#7f9bab","#8aa4a7");
    const sea=g.createLinearGradient(0,510,0,640);sea.addColorStop(0,"#73929c");sea.addColorStop(1,"#355978");
    g.fillStyle=sea;g.fillRect(0,525,WIDTH,115);
    for(let i=0;i<250;i++){const y=528+random()*110;g.fillStyle="#dbd4a841";g.fillRect(random()*WIDTH,y,4+random()*54,.7);}
    ridge(-76,399,280,174,"#587592","#334f73","#476787");
    ridge(790,431,225,133,"#638096","#3d5d78","#55768c");
    this.polygon(g,[0,604,84,584,121,589,183,578,231,597,318,606,377,626,456,626,519,612,584,615,652,593,760,572,760,640,0,640],"#2b4764");
    this.polygon(g,[0,615,112,602,247,618,309,615,388,632,495,627,611,615,760,603,760,640,0,640],"#223c56");
    for(let i=0;i<17000;i++){
      g.fillStyle=i%2 ? "#fff5c70e" : "#13294612";
      g.fillRect(random()*WIDTH, random()*HEIGHT,random()*1.8+.35,1);
    }
    return sheet;
  }
  bird(g,b,t,scale=1) {
    g.save();g.translate(b.x,b.y);g.scale(scale,scale);
    const dark="#213659",cream="#fff1ba";
    if(b.type === "egg"){
      g.rotate(Math.sin(t*3+b.phase)*.17);
      this.polygon(g,[0,-19,8,-14,14,-2,12,12,4,17,-7,16,-13,8,-12,-3,-6,-15],"#f5c668",dark);
      this.polygon(g,[0,-17,4,-3,-3,4,2,15,10,10,12,-2,7,-12],"#ca674c");
      this.polygon(g,[-10,-4,-4,-13,-1,-10,-5,-1],cream);
      if(b.hatch-t<1.25){g.strokeStyle=dark;g.lineWidth=2;g.beginPath();g.moveTo(-11,1);g.lineTo(-2,-3);g.lineTo(1,3);g.lineTo(10,-1);g.stroke();}
    } else {
      const large=b.type==="kite";
      const w=large?46:23, h=large?28:16;
      const flap=Math.sin(t*(large?4:7)+b.phase);
      const upper=[["#ffe19b","#d68a45"],["#ffb19a","#c55f50"],["#d7f0e5","#75acb4"]][b.color%3];
      for(const s of [-1,1]) {
        const lost=s<0 ? b.left : b.right;
        if(large && lost>0)continue;
        g.save();g.scale(s,1);
        const tip=-h*(.65+flap*.32);
        this.polygon(g,[1,1,w*.43,-h*.34,w,tip,w*.76,h*.28,w*.57,h*.18,w*.42,h*.49,w*.22,h*.27,1,h*.39],upper[0],dark);
        this.polygon(g,[2,3,w*.43,-h*.30,w*.96,tip+1,w*.5,h*.09,w*.23,h*.25],upper[1]);
        if(large){this.polygon(g,[w*.46,-3,w*.84,tip+4,w*.55,0],cream);}
        g.restore();
      }
      this.polygon(g,[-5,-h*.59,0,-h*.38,5,-h*.6,large?9:5,h*.13,0,h*.82,large?-9:-5,h*.13],upper[1],dark);
      this.polygon(g,[0,-h*.29,large?5:3,h*.14,0,h*.6,-2,h*.16],cream);
      this.polygon(g,[-3,h*.45,3,h*.45,0,h], "#ffca51");
    }
    g.restore();
  }
  ship(g,x,guard,time,grace) {
    if(grace>0 && Math.floor(grace*10)%2===1)return;
    g.save();g.translate(x,DECK);
    this.polygon(g,[-5,12,0,23+Math.sin(time*25)*4,5,12],"#ffac66");
    this.polygon(g,[0,-23,6,-4,20,11,19,16,5,12,0,15,-6,12,-20,16,-19,10,-6,-4],"#fff1c5","#192e4b");
    this.polygon(g,[-18,12,-3,1,-1,-15,-1,8,-5,10],"#d66645");
    this.polygon(g,[1,-15,6,0,16,11,5,7,1,11],"#7894a4");
    this.polygon(g,[-3,1,0,-10,3,1,0,5],"#254978");
    if(guard>0){this.disc(g,0,0,31,"#ffea9233");g.strokeStyle="#ffea92";g.lineWidth=3;g.stroke();}
    g.restore();
  }
  press(g,b,t) {
    g.save();g.translate(b.x,b.y);
    const hull="#1c3553", brass="#de9852";
    this.polygon(g,[-470,-78,-310,-76,-273,-58,-124,-58,-90,-83,90,-83,124,-58,273,-58,310,-76,470,-78,470,3,307,3,260,22,184,22,160,10,-160,10,-184,22,-260,22,-307,3,-470,3],hull,"#152843");
    for(const s of [-1,1]){
      g.save();g.scale(s,1);
      this.polygon(g,[32,-56,95,-69,128,-48,295,-48,323,-64,447,-64,447,-42,312,-36,277,-19,111,-20,75,-31,32,-24],"#628299");
      this.polygon(g,[95,-15,258,-15,305,-32,424,-32,424,-24,310,-22,263,-4,95,-4],brass);
      for(let x=124;x<288;x+=17){g.fillStyle="#273e57";g.fillRect(x,-42,8,13);}
      for(let x=40;x<420;x+=32)this.disc(g,x,-10,2.3,"#f2c378");
      this.polygon(g,[206,4,247,4,242,19,232,26,216,24],"#a96949",hull);
      g.restore();
    }
    g.fillStyle="#49657a";g.fillRect(-164,-5,328,10);g.fillStyle="#96aab0";g.fillRect(-164,-3,328,2);
    g.save();g.translate(b.spindle,0);
    this.disc(g,0,0,31,"#e6b65f");this.disc(g,0,0,24,"#334458");
    g.save();g.rotate(t*.8);
    for(let i=0;i<8;i++){g.rotate(Math.PI/4);this.polygon(g,[8,-2,20,-5,16,2,9,4],"#e29856");}g.restore();
    this.disc(g,0,0,12,b.latched?"#ffde75":"#996947");this.disc(g,0,0,5,b.latched?"#fff6cf":"#5d4b46");g.restore();
    for(let row=0;row<3;row++)for(let col=0;col<15;col++)if(b.plates[row][col]){
      const x=-180+col*24, y=17+row*15;
      this.polygon(g,[x,y,x+23,y,x+22,y+11,x+16,y+14,x+2,y+13],["#edc16c","#e5a85d","#c9834f"][row],hull);
      g.fillStyle="#fff0a6";g.fillRect(x+3,y+2,15,1);
    }
    g.restore();
  }
  draw(game,mode,t) {
    const g=this.ctx;
    g.drawImage(this.papers[game.stage],0,0);
    if(mode==="title"){
      this.bird(g,{x:364,y:121,phase:1,color:0,type:"kite"},t,2.85);
      this.bird(g,{x:221,y:154,phase:2,color:1,type:"swift"},t,1.45);
      this.bird(g,{x:506,y:151,phase:3,color:2,type:"swift"},t,1.45);
      this.ship(g,380,0,t,0);return;
    }
    if(game.boss)this.press(g,game.boss,t);
    for(const b of game.birds)this.bird(g,b,t);
    for(const p of game.bolts){g.fillStyle="#263f61";g.fillRect(p.x-3,p.y-4,6,16);g.fillStyle="#fff2af";g.fillRect(p.x-2,p.y-4,4,12);}
    for(const p of game.hostile)this.polygon(g,[p.x,p.y-8,p.x+5,p.y,p.x,p.y+8,p.x-5,p.y],"#ff8065","#4c3043");
    for(const p of game.sparks){g.fillStyle=p.color;g.fillRect(p.x,p.y,3,3);}
    if(!game.over)this.ship(g,game.x,game.guard,t,game.grace);
    if(game.clearTime>0 || game.age<1.35 || game.boss){
      const caption=game.clearTime>0?"Stage clear":game.age<1.35?stages[game.stage]:("Spindle  "+game.boss.hp+" / "+game.boss.max);
      g.font="bold 16px 'Courier New',monospace";g.textAlign="center";
      const w=g.measureText(caption).width+24;
      g.fillStyle="#203653";g.fillRect(380-w/2,12,w,28);g.fillStyle="#ffe6ae";g.fillText(caption,380,31);
    }
  }
}
