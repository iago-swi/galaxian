"use strict";
const WIDTH = 760, HEIGHT = 640, DECK = 578;
const stages = ["First flight", "Crosswind", "Hatchery", "Double brood", "Solar press"];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const between = (a, b) => a + Math.random() * (b - a);

class Flight {
  constructor(signal = () => {}) {
    this.signal = signal;
    this.reset();
  }
  reset() {
    this.x = WIDTH / 2;
    this.score = 0;
    this.lives = 3;
    this.extra = 4000;
    this.cycle = 1;
    this.stage = 0;
    this.guard = this.recharge = this.reload = this.grace = 0;
    this.over = false;
    this.sparks = [];
    this.enter();
  }
  enter() {
    this.age = 0;
    this.clearTime = 0;
    this.bolts = [];
    this.hostile = [];
    this.birds = [];
    this.boss = null;
    this.diveClock = 2.0;
    this.fireClock = 2.1;
    this.escortClock = 1.7;
    this.speed = 1 + .13 * (this.cycle - 1);
    if (this.stage < 2) {
      const cols = 6 + this.stage;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < cols; col++) {
          const x = WIDTH / 2 + (col - (cols - 1) / 2) * 74;
          this.small(x, 90 + row * 52 + Math.abs(col - (cols - 1) / 2) * 8, row);
        }
      }
    } else if (this.stage < 4) {
      const count = 5 + (this.stage - 2) * 2;
      for (let i = 0; i < count; i++) {
        const phase = i * 2.4;
        this.birds.push({type:"egg", phase, x:380 + 291 * Math.sin(phase),
          y:110 + i % 3 * 85, lane:110 + i % 3 * 85, hatch:4.6 + i * 1.25,
          left:0, right:0, color:i % 3});
      }
    } else {
      this.boss = {y:-85, x:380, spindle:0, station:0, latched:false, hp:5 + this.cycle, max:5 + this.cycle,
        plates:Array.from({length:3}, () => Array(15).fill(true))};
      this.small(155, 160, 1);
      this.small(605, 160, 0);
    }
    this.signal("stage");
  }
  small(home, lane, color) {
    this.birds.push({type:"swift", x:home, y:lane, home, lane, color,
      phase:between(0,6.28), diving:false, age:0, dx:0, fired:false});
  }
  add(points) {
    this.score += points;
    if (this.score >= this.extra) {
      this.lives++;
      this.extra += 4000;
      this.signal("life");
    }
  }
  burst(x,y,color,count=12) {
    for (let i=0;i<count;i++) {
      this.sparks.push({x,y,color,vx:between(-120,120),vy:between(-125,50),ttl:between(.18,.6)});
    }
  }
  activateShield() {
    if (this.over || this.recharge > 0 || this.guard > 0) return;
    this.guard = 1.45;
    this.recharge = 6.45;
    this.signal("shield");
  }
  impact() {
    if (this.guard > 0 || this.grace > 0 || this.over) return;
    this.burst(this.x, DECK, "#fff1b8", 28);
    this.lives--;
    this.signal("loss");
    if (this.lives === 0) { this.over = true; return; }
    this.x = WIDTH / 2;
    this.grace = 2.4;
    this.hostile = [];
  }
  hostileShot(x,y) {
    const speed = Math.min(395,200 * this.speed + this.stage * 8);
    const dx = this.x - x, dy = Math.max(100, DECK - y);
    const offset = clamp(dx / Math.hypot(dx,dy), -.72,.72);
    this.hostile.push({x,y,vx:speed * offset, vy:speed * Math.sqrt(1 - offset*offset)});
  }
  moveBird(b,dt) {
    if (b.type === "swift") {
      if (b.diving) {
        b.age += dt;
        b.x += (b.dx + 55 * Math.cos(b.age * 4 + b.phase)) * dt;
        b.y += Math.min(360, 178 * this.speed + this.stage * 8) * dt;
        if (!b.fired && b.y > 260) { this.hostileShot(b.x,b.y); b.fired = true; }
        if (b.y > HEIGHT + 18) { b.diving = false; b.y = -18; }
      } else {
        const hx = b.home + Math.sin(this.age * .9) * 45;
        const hy = b.lane + Math.sin(this.age * 1.5 + b.phase) * 9;
        b.x += (hx - b.x) * Math.min(1,dt * 6);
        b.y += (hy - b.y) * Math.min(1,dt * 3);
      }
    } else {
      const rate = (.38 + (this.stage - 2) * .06) * Math.min(this.speed,2.2);
      b.x = 380 + 291 * Math.sin(this.age * rate + b.phase);
      b.y = b.lane + Math.sin(this.age * 1.4 + b.phase) * (b.type === "egg" ? 19 : 48);
      if (b.type === "egg" && this.age >= b.hatch) {
        b.type = "kite"; this.burst(b.x,b.y,"#ffdd86"); this.signal("hatch");
      }
      b.left = Math.max(0,b.left-dt);
      b.right = Math.max(0,b.right-dt);
    }
  }
  hitBird(b,shot,oldY) {
    const dx = shot.x - b.x;
    const large = b.type === "kite";
    const radius = large ? 15 : 13;
    if (shot.y > b.y + radius || oldY < b.y - radius) return false;
    if (Math.abs(dx) <= (large ? 10 : b.type === "egg" ? 12 : 19)) {
      this.add(b.type === "egg" ? 70 : large ? 250 : b.diving ? 100 : 50);
      this.burst(b.x,b.y,large ? "#ffa071" : "#ffdc86");
      this.signal("hit");
      this.birds.splice(this.birds.indexOf(b),1);
      return true;
    }
    const side = dx < 0 ? "left" : "right";
    if (large && Math.abs(dx) <= 44 && !b[side]) {
      b[side] = 3;
      this.burst(shot.x,b.y,"#ffab85",7); this.signal("plate");
      return true;
    }
    return false;
  }
  hitBoss(shot,oldY) {
    const boss = this.boss;
    if (!boss) return false;
    const dx = shot.x - boss.x;
    const col = Math.floor((dx + 180) / 24);
    if (col >= 0 && col < 15) {
      for (let row=2; row>=0; row--) {
        const y = boss.y + 24 + row * 15;
        if (boss.plates[row][col] && shot.y <= y + 7 && oldY >= y - 7) {
          boss.plates[row][col] = false;
          this.burst(shot.x,y,"#ffdb78",8); this.add(15); this.signal("plate");
          return true;
        }
      }
    }
    if (shot.y > boss.y + 12 || oldY < boss.y - 16) return false;
    if (boss.latched && Math.abs(dx - boss.spindle) < 17) {
      boss.hp--; boss.station++; boss.latched=false; this.burst(boss.x+boss.spindle,boss.y,"#fff4bc",15); this.signal("core");
      if (boss.hp === 0) {
        this.add(1800 * this.cycle); this.signal("collapse");
        for (let dx=-320;dx<=320;dx+=46) this.burst(boss.x+dx,boss.y,"#fbb56b");
        this.boss = null; this.birds = []; this.hostile = [];
      }
    } else { this.burst(shot.x,boss.y,"#849ec5",3); }
    return true;
  }
  tick(dt,input) {
    if (this.over) return;
    this.age += dt;
    this.guard = Math.max(0,this.guard-dt);
    this.recharge = Math.max(0,this.recharge-dt);
    this.grace = Math.max(0,this.grace-dt);
    this.reload -= dt;
    this.x = clamp(this.x + (Number(input.right)-Number(input.left)) * 390 * dt,19,WIDTH-19);
    if (input.fire && this.reload <= 0) {
      this.bolts.push({x:this.x,y:DECK-15}); this.reload = .145; this.signal("shot");
    }
    if (this.boss) {
      const boss = this.boss;
      boss.y = Math.min(248, -85 + Math.min(this.age,2.2)*78 + Math.max(0,this.age-2.2)*2.4);
      const rail = [0, -96, 72, -48, 120, 24, -120];
      const wanted = rail[boss.station % rail.length];
      boss.spindle += clamp(wanted - boss.spindle, -95*dt, 95*dt);
      boss.latched = boss.y >= 80 && Math.abs(wanted-boss.spindle) < 1;
      boss.x = 380 + Math.sin(this.age * .51) * 42;
      this.escortClock -= dt;
      if (this.escortClock < 0 && this.birds.length < 5) {
        this.small(Math.random()<.5 ? 140 : 620,boss.y+100,1);
        this.escortClock = 3.3 / this.speed;
      }
    }
    this.diveClock -= dt;
    if (this.diveClock <= 0) {
      const pool = this.birds.filter(b=>b.type === "swift" && !b.diving);
      if (pool.length) {
        const b = pool[Math.floor(Math.random()*pool.length)];
        b.diving = true; b.age = 0; b.fired = false;
        b.dx = clamp((this.x-b.x)*.49,-165,165);
      }
      this.diveClock = Math.max(.5,(this.stage === 1 ? 1.25 : 1.85)/this.speed);
    }
    for (const b of this.birds) {
      this.moveBird(b,dt);
      if (Math.abs(this.x-b.x)<20 && Math.abs(DECK-b.y)<17) this.impact();
    }
    this.fireClock -= dt;
    if (this.fireClock <= 0) {
      const pool = this.birds.filter(b=>b.type !== "egg" && b.y < DECK-95);
      if (pool.length) { const b=pool[Math.floor(Math.random()*pool.length)]; this.hostileShot(b.x,b.y); }
      if (this.boss) this.hostileShot(this.boss.x + (Math.random()<.5 ? -225 : 225),this.boss.y+10);
      this.fireClock = Math.max(.42,between(.98,1.6)/this.speed);
    }
    this.bolts = this.bolts.filter(shot => {
      const oldY = shot.y;
      shot.y -= 660 * dt;
      for(const b of this.birds) if(this.hitBird(b,shot,oldY)) return false;
      return !this.hitBoss(shot,oldY) && shot.y > -15;
    });
    for (const p of [...this.hostile]) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (Math.hypot(p.x-this.x,p.y-DECK) < (this.guard>0 ? 31 : 13)) {
        p.y = HEIGHT+30;
        this.impact();
      }
    }
    this.hostile = this.hostile.filter(p=>p.y<HEIGHT+12 && p.x>-12 && p.x<WIDTH+12);
    this.sparks = this.sparks.filter(p=>{
      p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 180*dt; p.ttl -= dt; return p.ttl>0;
    });
    if (!this.birds.length && !this.boss && !this.over) {
      this.clearTime += dt;
      if (this.clearTime >= 1.1) {
        this.stage++;
        if(this.stage === stages.length) {this.stage=0; this.cycle++;}
        this.enter();
      }
    }
  }
}
