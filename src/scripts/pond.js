/* Mosaic Pond — dependency-free, original procedural artwork.
 * 遊泳（位置と方向）と描画（体をモザイク化）を分けています。
 * 魚群の3つの力を弱く使った装飾用モデルで、生物学的再現ではありません。
 */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  function mountPond(root, options = {}) {
    if (root.pondController) return root.pondController;
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

    // クリック波紋と航跡を共通のプールで管理する。クリックを優先。
    const SETTINGS = {
      foodPerClick: 5, maxFood: 60, foodDrag: 2.8,
      rippleLifetime: 3.2, maxRipples: 12, rippleOpacity: .32,
      maxWakeRipples: 8, wakeSpacing: .16,
    };
    // 鯉は段階1と同じ係数。テトラだけ別の体形・群れ・運動を使う。
    const koi = {
      count: 7, speed: 28, turnSpeed: .85,
      fishSizes: [100, 95, 95, 100, 105, 100, 108],
      palette: ['#d5d0bd', '#c76c35', '#a44626', '#6a6d60'],
      spineNodes: 21, bodyLength: 1.58, nose: .59,
      jointHead: .16, jointBody: .20,
      speedMin: .8, speedMax: 1.2,
      momentum: 1.5, wanderMax: .65, wanderWeight: .65, wanderRate: .7,
      decisionMin: 1.7, decisionMax: 4.3,
      neighborRange: 2.3, rearVision: -.55,
      cohesion: .0008, alignment: .2, separation: 4.8,
      prediction: .65, safeDistance: .4,
      wallMargin: 1.15, wallLookSize: .6, wallLookTime: 1.25,
      pointerRange: 170, pointerForce: 5,
      turnRadius: .7, turnGain: 1.8, turnResponse: 2.6,
      tailBase: 2.1, tailDrive: 5.5, waveBase: .018, waveDrive: .047,
      feedingRange: 650, feedingSpeedMultiplier: 3.2,
      feedingAttack: .35, feedingHold: .5, feedingDecay: 2.4,
      accelerationTime: .18, decelerationTime: 1.6,
      wakeDelayMin: .7, wakeDelayMax: 2.4, wakeLifetime: 2.2, wakeSpeed: 19,
      wakeRadius: 4, wakeOpacity: .36, wakeDistance: .22,
    };
    const FISH_PROFILES = {
      koi,
      'koi-blue': {
        ...koi,
        // 以前のライトテーマの青系パレット。泳ぎ・輪郭は赤い鯉と共通。
        palette: ['#667c70', '#83bda4', '#9fa4ce', '#7cabc4'],
      },
      tetra: {
        ...koi,
        count: 45, speed: 38, turnSpeed: 2.7,
        fishSizes: [36, 38, 40, 42, 39, 37, 41, 38],
        palette: ['#a8c8d4', '#4ab8d8', '#377daf', '#708d9c'],
        spineNodes: 13, bodyLength: 1.2, nose: .55,
        jointHead: .23, jointBody: .28,
        speedMin: .9, speedMax: 1.1,
        momentum: 1.2, wanderMax: .5, wanderWeight: .3, wanderRate: 1.2,
        decisionMin: 1, decisionMax: 2.8,
        neighborRange: 6.3, rearVision: -.8,
        cohesion: .006, alignment: 1.1, separation: 5,
        prediction: .35, safeDistance: .55,
        wallMargin: 1.4, wallLookSize: .5, wallLookTime: .65,
        pointerRange: 110, pointerForce: 4.2,
        turnRadius: .4, turnGain: 2.4, turnResponse: 5,
        tailBase: 3.8, tailDrive: 8, waveBase: .008, waveDrive: .025,
        feedingRange: 450, feedingSpeedMultiplier: 2.4,
        feedingAttack: .18, feedingHold: .35, feedingDecay: 1.6,
        accelerationTime: .12, decelerationTime: .8,
        wakeDelayMin: 5, wakeDelayMax: 16, wakeLifetime: 1.8, wakeSpeed: 14,
        maxWakeRipples: 3,
        wakeRadius: 3, wakeOpacity: .28, wakeDistance: .5,
      },
    };
    let species = Object.hasOwn(FISH_PROFILES, options.species) ? options.species : 'koi';
    let profile = FISH_PROFILES[species];
    let width = 1, height = 1, cell = clamp(options.cell || 8, 4, 13);
    let fps = options.fps === 60 ? 60 : 30;
    let theme = options.theme === 'light' ? 'light' : 'dark';
    let fish = [], food = [], ripples = [], frame = 0, lastTime = 0, time = 0;
    // 手動停止・OS設定・非表示をそれぞれ保持する。
    let manualPause = Boolean(options.paused), motionOverride = false;
    let visible = true, destroyed = false, pageSuspended = false;
    let lastPaint = null;
    let nextWakeAt = 0, nextWakeFish = 0;
    const pointer = { x: -10000, y: -10000, active: false };
    const random = (min, max) => min + Math.random() * (max - min);

    function createFish() {
      const scale = clamp(width / 1100, .65, 1.1);
      // テトラは15匹ずつ、3つの緩いまとまりから開始。以後の群れは固定しない。
      // 鯉側は以前と同じ乱数の消費順を維持する。
      const schools = species === 'tetra' ? [
        { x: width * .22, y: height * .25, angle: random(-Math.PI, Math.PI) },
        { x: width * .78, y: height * .5, angle: random(-Math.PI, Math.PI) },
        { x: width * .24, y: height * .78, angle: random(-Math.PI, Math.PI) },
      ] : [
        { x: width * .22, y: height * .3, angle: random(-Math.PI, Math.PI) },
        { x: width * .78, y: height * .7, angle: random(-Math.PI, Math.PI) },
      ];
      fish = Array.from({ length: profile.count }, (_, i) => {
        const school = schools[Math.min(schools.length - 1, Math.floor(i * schools.length / profile.count))];
        const small = species === 'tetra';
        return {
          species,
          x: small ? clamp(school.x + random(-90, 90), width * .08, width * .92)
            : random(width * .12, width * .88),
          y: small ? clamp(school.y + random(-75, 75), height * .1, height * .9)
            : i < 4 ? random(height * .13, height * .43) : random(height * .45, height * .9),
          angle: small ? school.angle + random(-.35, .35) : random(-Math.PI, Math.PI),
          size: profile.fishSizes[i % profile.fishSizes.length] * scale,
          phase: random(0, TAU), speed: random(profile.speedMin, profile.speedMax), pattern: i,
          velocity: 0, angularVelocity: 0,
          wander: 0, wanderTarget: 0, nextDecision: random(0, 2),
          tailPhase: random(0, TAU), effort: .35, alarm: 0,
          feedAt: null, feedFrom: 0, feedBoost: 0,
          targetFood: null, spine: [],
        };
      });
      fish.forEach(f => {
        f.velocity = profile.speed * f.speed;
        // x,yは鼻先。魚種ごとに背骨の長さと区間数を変える。
        const spacing = f.size * profile.bodyLength / (profile.spineNodes - 1);
        f.spine = Array.from({ length: profile.spineNodes }, (_, j) => ({
          x: f.x - Math.cos(f.angle) * spacing * j,
          y: f.y - Math.sin(f.angle) * spacing * j,
        }));
        // 航跡専用の乱数列。泳ぎ側のMath.randomを消費しない。
        f.wakeSeed = ((f.phase / TAU * 4294967296) ^ Math.imul(f.pattern + 1, 0x9e3779b9)) >>> 0 || 1;
        f.nextWake = time + wakeDelay(f);
        f.wakeDistance = 0;
        const tail = wakePoint(f);
        f.wakeLastX = tail.x; f.wakeLastY = tail.y;
      });
      nextWakeAt = time;
      nextWakeFish = 0;
      root.dataset.species = species;
      options.onSpeciesChange?.(species, profile.count);
    }

    function feedingBoost(f) {
      if (f.feedAt === null) return 0;
      const age = Math.max(0, time - f.feedAt);
      if (age < profile.feedingAttack) {
        const t = age / profile.feedingAttack;
        const smooth = t * t * (3 - 2 * t);
        return f.feedFrom + (1 - f.feedFrom) * smooth;
      }
      const decayAge = age - profile.feedingAttack - profile.feedingHold;
      const boost = decayAge <= 0 ? 1 : Math.exp(-decayAge / profile.feedingDecay);
      return boost < .001 ? 0 : boost;
    }

    function followSpine(f) {
      const spacing = f.size * profile.bodyLength / (f.spine.length - 1);
      f.spine[0].x = f.x;
      f.spine[0].y = f.y;
      let previousHeading = f.angle;
      for (let j = 1; j < f.spine.length; j++) {
        const parent = f.spine[j - 1], node = f.spine[j];
        // 直前の節の新しい位置と、この節の古い位置を結ぶ。
        // 魚全体を回転させず、前の節に引かれる分だけ後ろの節が進む。
        const heading = Math.atan2(parent.y - node.y, parent.x - node.x);
        const jointLimit = j === 1 ? profile.jointHead : profile.jointBody;
        const constrainedHeading = previousHeading + clamp(angleDiff(heading, previousHeading), -jointLimit, jointLimit);
        node.x = parent.x - Math.cos(constrainedHeading) * spacing;
        node.y = parent.y - Math.sin(constrainedHeading) * spacing;
        previousHeading = constrainedHeading;
      }
    }

    function resize() {
      const oldW = width, oldH = height;
      width = Math.max(8, root.clientWidth); height = Math.max(8, root.clientHeight);
      if (oldW === width && oldH === height && fish.length) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!fish.length) createFish();
      else fish.forEach(f => {
        f.x *= width / oldW; f.y *= height / oldH;
        f.spine.forEach(p => { p.x *= width / oldW; p.y *= height / oldH; });
        followSpine(f);
        // リサイズを「移動」として数えず、不自然な航跡を防ぐ。
        const tail = wakePoint(f);
        f.wakeLastX = tail.x; f.wakeLastY = tail.y;
        f.wakeDistance = 0;
      });
      [...food, ...ripples].forEach(p => { p.x *= width / oldW; p.y *= height / oldH; });
      draw();
    }

    function update(dt) {
      time += dt;
      food = food.filter(p => time - p.born < 14);
      ripples = ripples.filter(p => time - p.born < p.lifetime);
      // 投げた直後は放射状に広がり、水の抵抗で素早く落ち着く。
      // 指数減衰の積分を使い、フレームレートによる広がりの差を抑える。
      const drag = Math.exp(-SETTINGS.foodDrag * dt);
      food.forEach(p => {
        const driftX = Math.sin(time * .8 + p.phase) * .65;
        const driftY = Math.cos(time * .65 + p.phase) * .45;
        p.x = clamp(p.x + p.vx * (1 - drag) / SETTINGS.foodDrag + driftX * dt, 3, width - 3);
        p.y = clamp(p.y + p.vy * (1 - drag) / SETTINGS.foodDrag + driftY * dt, 3, height - 3);
        p.vx *= drag; p.vy *= drag;
      });
      // 前のフレームを共有。更新順によって群れの動きが変わらないようにする。
      const previous = fish.map(f => ({ x: f.x, y: f.y, angle: f.angle, size: f.size, velocity: f.velocity }));
      fish.forEach((f, i) => {
        const forwardX = Math.cos(f.angle), forwardY = Math.sin(f.angle);
        let ax = forwardX * profile.momentum, ay = forwardY * profile.momentum;
        // 毎フレーム乱数で曲がらず、数秒おきの意図をゆっくり追いかける。
        if (time >= f.nextDecision) {
          f.wanderTarget = random(-profile.wanderMax, profile.wanderMax);
          f.nextDecision = time + random(profile.decisionMin, profile.decisionMax);
        }
        f.wander += (f.wanderTarget - f.wander) * (1 - Math.exp(-dt * profile.wanderRate));
        ax += Math.cos(f.angle + f.wander) * profile.wanderWeight;
        ay += Math.sin(f.angle + f.wander) * profile.wanderWeight;

        let cx = 0, cy = 0, hx = 0, hy = 0, weight = 0, crowd = 0;
        previous.forEach((g, j) => {
          if (i === j) return;
          const dx = g.x - f.x, dy = g.y - f.y, d = Math.hypot(dx, dy);
          if (d < .01) return;
          const front = (dx * forwardX + dy * forwardY) / d;
          const range = f.size * profile.neighborRange;
          // 遠くの真後ろの魚は追わず、視野内の魚を弱く参照する。
          if (d < range && front > profile.rearVision) {
            const w = (1 - d / range) ** 2;
            cx += g.x*w; cy += g.y*w;
            hx += Math.cos(g.angle)*w; hy += Math.sin(g.angle)*w; weight += w;
          }
          // 少し先の位置も見て、接近中の個体を早めに避ける。
          const look = profile.prediction;
          const px = dx + (Math.cos(g.angle)*g.velocity-forwardX*f.velocity)*look;
          const py = dy + (Math.sin(g.angle)*g.velocity-forwardY*f.velocity)*look;
          const predicted = Math.hypot(px, py);
          const safe = (f.size + g.size) * profile.safeDistance;
          if (predicted < safe || d < safe) {
            const q = Math.max(0, 1 - Math.min(d, predicted)/safe);
            ax -= dx/d*q*profile.separation; ay -= dy/d*q*profile.separation;
            if (front > .35) crowd = Math.max(crowd, q);
          }
        });
        if (weight > .001) {
          ax += (cx/weight-f.x)*profile.cohesion + hx/weight*profile.alignment;
          ay += (cy/weight-f.y)*profile.cohesion + hy/weight*profile.alignment;
        }

        // 頭の位置と進行方向を先読み。壁際で急反転せず、内側へ弧を描く。
        const margin = Math.min(f.size*profile.wallMargin, width*.32, height*.32);
        const lookAhead = f.size*profile.wallLookSize + f.velocity*profile.wallLookTime;
        const px = f.x + forwardX*lookAhead, py = f.y + forwardY*lookAhead;
        const wall = (distance) => clamp((margin-distance)/margin, 0, 2);
        const wl=wall(px), wr=wall(width-px), wt=wall(py), wb=wall(height-py);
        ax += (wl-wr)*4.3; ay += (wt-wb)*4.3;
        const wallPressure = Math.max(wl,wr,wt,wb);

        // 記事の裏も泳ぐため、以前の説明文付近を避ける処理は使わない。

        // 一度狙った餌を維持。頭（口）が餌に近づいて初めて食べる。
        if (!food.includes(f.targetFood)) f.targetFood = null;
        if (!f.targetFood && food.length) {
          const nearest = food.reduce((best,p) => Math.hypot(p.x-f.x,p.y-f.y)<Math.hypot(best.x-f.x,best.y-f.y)?p:best);
          if (Math.hypot(nearest.x-f.x,nearest.y-f.y)<profile.feedingRange) f.targetFood=nearest;
        }
        let eating=false, foodDistance=Infinity;
        if (f.targetFood) {
          const target=f.targetFood;
          const mouthX=f.x, mouthY=f.y;
          const dx=target.x-mouthX, dy=target.y-mouthY;
          foodDistance=Math.hypot(dx,dy);
          if (foodDistance<Math.max(9,f.size*.09)) {
            food=food.filter(p=>p!==target); f.targetFood=null;
          } else {
            ax+=dx/foodDistance*2.5; ay+=dy/foodDistance*2.5; eating=true;
          }
        }

        // マウスは進路の回避にだけ使い、速度の上昇は餌クリックに限定。
        const dx=f.x-pointer.x, dy=f.y-pointer.y, d=Math.hypot(dx,dy);
        f.alarm *= Math.exp(-dt*1.1);
        if (pointer.active && d<profile.pointerRange && d>.1) {
          const threat=(1-d/profile.pointerRange)*(eating ? .35 : 1);
          ax+=dx/d*threat*profile.pointerForce; ay+=dy/d*threat*profile.pointerForce;
          f.alarm=Math.max(f.alarm,threat);
        }

        const desiredTurn=angleDiff(Math.atan2(ay,ax),f.angle);
        // 体長に対して小さすぎる半径で旋回しない。
        const maxTurn=Math.min(profile.turnSpeed*(1+f.alarm*.75),
          Math.max(.2,f.velocity/(f.size*profile.turnRadius)) + clamp(wallPressure,0,1)*.6);
        const desiredAngular=clamp(desiredTurn*profile.turnGain,-maxTurn,maxTurn);
        // 角速度にも慣性を持たせ、左右への切り返しをなだらかに。
        f.angularVelocity+=(desiredAngular-f.angularVelocity)*(1-Math.exp(-dt*profile.turnResponse));
        f.angle+=f.angularVelocity*dt;

        // 平常時の周期的な加速は廃止。クリック時だけ短い推進を加える。
        // 餌を食べたあとも減速が続くよう、餌の有無と速度を独立させる。
        f.feedBoost = feedingBoost(f);
        const baseSpeed = profile.speed * f.speed;
        let targetSpeed = baseSpeed * (1 + (profile.feedingSpeedMultiplier - 1) * f.feedBoost);
        // 壁や混雑での減速は残す。自発的に通常速度を超えることはない。
        targetSpeed *= 1 - crowd * .35;
        if (wallPressure > .2) targetSpeed *= 1 - clamp(wallPressure * .22, 0, .45);
        const responseTime = targetSpeed > f.velocity ? profile.accelerationTime : profile.decelerationTime;
        f.velocity += (targetSpeed - f.velocity) * (1 - Math.exp(-dt / responseTime));
        // 速度が高い間は尾を速く・大きく振り、減速とともに弱める。
        const drive = .3 + clamp((f.velocity / baseSpeed - 1) / (profile.feedingSpeedMultiplier - 1), 0, 1) * .95;
        f.effort += (drive - f.effort) * (1 - Math.exp(-dt * 5));
        f.x=clamp(f.x+Math.cos(f.angle)*f.velocity*dt,4,width-4);
        f.y=clamp(f.y+Math.sin(f.angle)*f.velocity*dt,4,height-4);
        f.tailPhase+=dt*(profile.tailBase+f.effort*profile.tailDrive);
        followSpine(f);
        const tail = wakePoint(f);
        f.wakeDistance += Math.hypot(tail.x - f.wakeLastX, tail.y - f.wakeLastY);
        f.wakeLastX = tail.x; f.wakeLastY = tail.y;
      });
      emitWakes();
    }

    // 尾端の少し手前。発生した波紋はこの地点に残し、魚には追従させない。
    function wakePoint(f) {
      return f.spine[Math.floor((f.spine.length - 1) * .9)];
    }

    function addRipple(ripple) {
      if (ripple.kind === 'wake') {
        const wakes = ripples.filter(p => p.kind === 'wake').length;
        const wakeLimit = Math.min(SETTINGS.maxWakeRipples, profile.maxWakeRipples ?? SETTINGS.maxWakeRipples);
        if (wakes >= wakeLimit || ripples.length >= SETTINGS.maxRipples) return false;
      } else if (ripples.length >= SETTINGS.maxRipples) {
        // クリックで満杯になったときは、航跡から先に取り除く。
        const wakeIndex = ripples.findIndex(p => p.kind === 'wake');
        ripples.splice(wakeIndex < 0 ? 0 : wakeIndex, 1);
      }
      ripples.push(ripple);
      return true;
    }

    // 個体ごとに独立したxorshift32。待ち時間は発生のたびに抽選する。
    function wakeRandom(f) {
      let x = f.wakeSeed;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      f.wakeSeed = x >>> 0;
      return f.wakeSeed / 4294967296;
    }
    function wakeDelay(f) {
      return profile.wakeDelayMin + wakeRandom(f) * (profile.wakeDelayMax - profile.wakeDelayMin);
    }

    function emitWakes() {
      if (time < nextWakeAt) return;
      // 毎回同じ個体が枠を使わないよう、参照開始位置を順番に回す。
      for (let n = 0; n < fish.length; n++) {
        const index = (nextWakeFish + n) % fish.length;
        const f = fish[index], tail = wakePoint(f);
        if (time < f.nextWake || f.wakeDistance < f.size * profile.wakeDistance) continue;
        if (tail.x < 0 || tail.y < 0 || tail.x > width || tail.y > height) continue;
        // 枠が空くまで抽選を繰り返さない。描画fpsにも依存させない。
        const wakeLimit = Math.min(SETTINGS.maxWakeRipples, profile.maxWakeRipples ?? SETTINGS.maxWakeRipples);
        if (ripples.length >= SETTINGS.maxRipples || ripples.filter(p => p.kind === 'wake').length >= wakeLimit) return;
        const parent = f.spine[Math.floor((f.spine.length - 1) * .9) - 1];
        const dx = parent.x - tail.x, dy = parent.y - tail.y;
        const length = Math.max(.001, Math.hypot(dx, dy));
        const phase = wakeRandom(f) * TAU;
        addRipple({
          kind: 'wake', x: tail.x, y: tail.y, born: time,
          lifetime: profile.wakeLifetime * (.9 + .2 * wakeRandom(f)), speed: profile.wakeSpeed,
          radius: profile.wakeRadius, opacity: profile.wakeOpacity * (.85 + .15 * wakeRandom(f)),
          forwardX: dx / length, forwardY: dy / length,
          phaseSin: Math.sin(phase), phaseCos: Math.cos(phase),
          small: f.species === 'tetra',
        });
        f.wakeDistance = 0;
        f.nextWake = time + wakeDelay(f);
        nextWakeAt = time + SETTINGS.wakeSpacing * (1 + wakeRandom(f));
        nextWakeFish = (index + 1) % fish.length;
        // 群れ全体でも1回の更新で1件、毎秒およそ6件まで。
        return;
      }
    }

    // 位置の追従に使う背骨に、遊泳の小さな横波だけを重ねる。
    // この段階でも全身を頭の角度で回転させる処理はありません。
    function makeRenderSegments(f) {
      const points = f.spine.map((p, j, spine) => {
        const before = spine[Math.max(0,j-1)], after = spine[Math.min(spine.length-1,j+1)];
        const heading = Math.atan2(before.y-after.y,before.x-after.x);
        const t = j/(spine.length-1);
        const wave = Math.sin(f.tailPhase-t*7.2)*f.size*(profile.waveBase+f.effort*profile.waveDrive)*t*t;
        return { x:p.x-Math.sin(heading)*wave, y:p.y+Math.cos(heading)*wave };
      });
      return points.slice(0,-1).map((a,j) => {
        const b=points[j+1], dx=b.x-a.x, dy=b.y-a.y;
        const lengthSquared=dx*dx+dy*dy, length=Math.sqrt(lengthSquared);
        return { a, dx, dy, lengthSquared, nx:dy/length, ny:-dx/length, j };
      });
    }

    // 最寄りの背骨の区間に投影し、体に沿うuと幅方向のvへ変換。
    // 目・色模様もこの座標で描くため、曲がった体に追従します。
    function sampleFish(x,y,f,segments) {
      let nearest=null, best=Infinity;
      for (const segment of segments) {
        const dx=x-segment.a.x, dy=y-segment.a.y;
        const raw=(dx*segment.dx+dy*segment.dy)/segment.lengthSquared;
        const t=clamp(raw,0,1);
        const ex=dx-segment.dx*t, ey=dy-segment.dy*t;
        const distanceSquared=ex*ex+ey*ey;
        if (distanceSquared<best) { best=distanceSquared; nearest={segment,t,raw,ex,ey}; }
      }
      const {segment,t,raw,ex,ey}=nearest;
      if ((segment.j===0 && raw<0) || (segment.j===segments.length-1 && raw>1)) return null;
      const u=profile.nose-(segment.j+t)/segments.length*profile.bodyLength;
      const v=(ex*segment.nx+ey*segment.ny)/f.size;
      if (f.species === 'tetra') {
        // 細い体、短い二叉の尾、小さな胸びれ。鯉の斑模様とは分ける。
        if (u > -.38 && u < .55) {
          const bodyT = (u + .38) / .93;
          const radius = .14 * Math.pow(Math.sin(bodyT * Math.PI), .9) * (.9 + bodyT * .1);
          if (Math.abs(v) < radius) return { part: 'body', edge: Math.abs(v) / radius, u, v };
        }
        if (u >= -.65 && u <= -.35) {
          const spread = .025 + (-u - .35) * .36;
          if (Math.abs(v) < spread && !(u < -.58 && Math.abs(v) < (-u - .58) * .8)) {
            return { part: 'tail', edge: Math.abs(v) / spread, u, v };
          }
        }
        if (u > -.03 && u < .18) {
          const finWidth = .12 + Math.sin((u + .03) / .21 * Math.PI) * .065;
          if (Math.abs(v) < finWidth) return { part: 'fin', edge: .9, u, v };
        }
        return null;
      }
      if (u>-.62 && u<.59) {
        const bodyT=(u+.62)/1.21;
        const radius=.21*Math.pow(Math.sin(bodyT*Math.PI),.72)*(.75+bodyT*.3);
        if (Math.abs(v)<radius) return {part:'body',edge:Math.abs(v)/radius,u,v};
      }
      if (u>=-.99 && u<=-.58) {
        const spread=.035+(-u-.58)*.53;
        if (Math.abs(v)<spread && !(u<-.9 && Math.abs(v)<(-u-.9)*.65)) return {part:'tail',edge:Math.abs(v)/spread,u,v};
      }
      if (u>-.12 && u<.2) {
        const finWidth=.19+Math.sin((u+.12)/.32*Math.PI)*.15;
        if (Math.abs(v)<finWidth) return {part:'fin',edge:.9,u,v};
      }
      return null;
    }

    function drawFish(f) {
      const palette=profile.palette;
      const small = f.species === 'tetra';
      // 小魚だけ細かいマスにして、体が数マスに潰れることを防ぐ。
      const fishCell = small ? clamp(cell * .5, 2.5, 4) : cell;
      const segments=makeRenderSegments(f);
      // 曲がった魚の全節から描画範囲を計算。鼻先中心の範囲で尾を切らない。
      const padding=f.size*.38;
      const xs=segments.map(s=>s.a.x), ys=segments.map(s=>s.a.y);
      xs.push(f.spine.at(-1).x); ys.push(f.spine.at(-1).y);
      const left=Math.max(0,Math.floor((Math.min(...xs)-padding)/fishCell)*fishCell);
      const top=Math.max(0,Math.floor((Math.min(...ys)-padding)/fishCell)*fishCell);
      const right=Math.min(width,Math.max(...xs)+padding);
      const bottom=Math.min(height,Math.max(...ys)+padding);
      for (let y=top;y<bottom;y+=fishCell) {
        for (let x=left;x<right;x+=fishCell) {
          const hit=sampleFish(x+fishCell/2,y+fishCell/2,f,segments);
          if (!hit) continue;
          const {u,v}=hit;
          const markings=Math.sin(u*12+f.pattern*2)+Math.cos(v*18+f.pattern)+Math.sin(u*21-v*13);
          let color=markings>.6?palette[1]:markings< -1.05?palette[3]:palette[0];
          if (markings>1.65) color=palette[2];
          if (small) {
            // 水色の帯と青い背側。明暗テーマに依存せず、青系を維持する。
            color = Math.abs(v) < .06 ? palette[1] : v > 0 ? palette[0] : palette[2];
            if (u < -.2) color = palette[2];
          }
          if (hit.part!=='body') color=palette[3];
          ctx.globalAlpha=(hit.part==='fin'?.22:hit.part==='tail'?.38:(small ? .9 : .83))*(1-hit.edge*.27);
          ctx.fillStyle=color;
          ctx.fillRect(x,y,Math.max(1,fishCell-(small ? .45 : .8)),Math.max(1,fishCell-(small ? .45 : .8)));
          if (small ? (u>.28 && u<.43 && Math.abs(v)>.025 && Math.abs(v)<.09) : (u>.36 && u<.46 && Math.abs(v)>.055 && Math.abs(v)<.125)) {
            ctx.globalAlpha=.9; ctx.fillStyle='#222720';
            ctx.fillRect(x+fishCell*.25,y+fishCell*.25,fishCell*.5,fishCell*.5);
          }
        }
      }
    }

    function drawWake(p, age) {
      const progress = clamp(age / .28, 0, 1);
      const fadeIn = progress * progress * (3 - 2 * progress);
      const fade = Math.pow(Math.max(0, 1 - age / p.lifetime), 1.15) * fadeIn;
      const radius = p.radius + age * p.speed;
      // 航跡もクリック波紋・鯉と同じ基準マスに揃える。
      const grid = cell;
      // 濃淡の帯幅は従来どおりに保ち、ドットの粗さだけを変更する。
      const softness = clamp(cell * (p.small ? .45 : .65), p.small ? 2 : 3, p.small ? 3.5 : 5) * .7;
      const sigma = softness + radius * .03;
      const extent = radius + sigma * 2.5;
      const left = Math.max(0, Math.floor((p.x - extent) / grid) * grid);
      const top = Math.max(0, Math.floor((p.y - extent) / grid) * grid);
      const right = Math.min(width, p.x + extent), bottom = Math.min(height, p.y + extent);
      for (let y = top; y < bottom; y += grid) {
        for (let x = left; x < right; x += grid) {
          const dx = x + grid / 2 - p.x, dy = y + grid / 2 - p.y;
          // 発生時の尾の向きで座標を変換。曲がったあとも過去の波は回転しない。
          const along = dx * p.forwardX + dy * p.forwardY;
          const across = -dx * p.forwardY + dy * p.forwardX;
          const distance = Math.max(.001, Math.hypot(dx, dy));
          const error = Math.abs(distance - radius) / sigma;
          if (error >= 2.5) continue;
          const c = along / distance, t = across / distance;
          const backward = clamp((1 - c) * .5, 0, 1);
          // 一周つながる円。前方にも30％の濃さを残し、後方へ滑らかに強める。
          const direction = .3 + .7 * backward * backward * (3 - 2 * backward);
          // ピザ状の境界を作らず、角度に沿って連続的に濃淡を変える。
          const variation = .82 + .18 * ((c * c - t * t) * p.phaseCos + 2 * c * t * p.phaseSin);
          const sideWeight = .8 + .2 * Math.abs(t);
          const edge = clamp((2.5 - error) / .5, 0, 1);
          const radial = Math.exp(-.5 * error * error) * edge * edge * (3 - 2 * edge);
          const alpha = p.opacity * fade * radial * direction * sideWeight * variation;
          if (alpha < .003) continue;
          ctx.globalAlpha = alpha;
          ctx.fillRect(x, y, Math.max(1, grid - .8), Math.max(1, grid - .8));
        }
      }
    }

    function drawRipples() {
      ctx.fillStyle = theme === 'dark' ? '#92b8a1' : '#648a78';
      ripples.forEach(p => {
        const age = time - p.born;
        if (p.kind === 'wake') { drawWake(p, age); return; }
        // クリック波紋は従来の2本の円と濃淡を維持する。
        for (let ring = 0; ring < 2; ring++) {
          const waveAge = age - ring * .28;
          const duration = p.lifetime - ring * .28;
          if (waveAge < 0) continue;
          const radius = p.radius + waveAge * p.speed;
          const fade = Math.pow(Math.max(0, 1 - waveAge / duration), 1.6);
          const thickness = cell * .8;
          const left = Math.max(0, Math.floor((p.x - radius - thickness) / cell) * cell);
          const top = Math.max(0, Math.floor((p.y - radius - thickness) / cell) * cell);
          const right = Math.min(width, p.x + radius + thickness);
          const bottom = Math.min(height, p.y + radius + thickness);
          for (let y = top; y < bottom; y += cell) {
            for (let x = left; x < right; x += cell) {
              const error = Math.abs(Math.hypot(x + cell / 2 - p.x, y + cell / 2 - p.y) - radius);
              if (error >= thickness) continue;
              ctx.globalAlpha = p.opacity * fade * (ring === 0 ? .5 : .27) * (1 - error / thickness);
              ctx.fillRect(x, y, Math.max(1, cell - .8), Math.max(1, cell - .8));
            }
          }
        }
      });
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      drawRipples();
      fish.forEach(drawFish);
      // 餌は誘導先の計算にだけ使い、画面には描かない。
      ctx.globalAlpha = 1;
    }

    function isPaused() {
      return manualPause || (reducedMotion.matches && !motionOverride);
    }
    function canAnimate() {
      return !destroyed && !isPaused() && visible && !pageSuspended && !document.hidden;
    }
    function tick(now) {
      frame = 0;
      if (!canAnimate()) return;
      // 描画だけを30/60fpsへ制限。経過時間で動きを更新する。
      const interval = 1000 / fps;
      if (lastPaint === null || now - lastPaint >= interval - .5) {
        const elapsed = lastTime === 0 ? 1 / fps : Math.min((now - lastTime) / 1000, .12);
        lastTime = now;
        lastPaint = now - ((lastPaint === null ? 0 : now - lastPaint) % interval);
        // 通常の更新間隔は現行と同程度に保ち、遅いフレームは小分けにする。
        const steps = Math.max(1, Math.ceil(elapsed / .034));
        for (let i = 0; i < steps; i++) update(elapsed / steps);
        draw();
      }
      frame = requestAnimationFrame(tick);
    }
    function syncAnimation() {
      cancelAnimationFrame(frame); frame = 0; lastTime = 0; lastPaint = null;
      if (canAnimate()) frame = requestAnimationFrame(tick);
      else draw();
      options.onPauseChange?.(isPaused());
    }
    function setPaused(value) {
      if (destroyed) return;
      manualPause = Boolean(value);
      // 動きを減らす設定でも「再生」を明示した場合は再生できる。
      motionOverride = !manualPause;
      syncAnimation();
    }
    function setTheme(value) {
      if (destroyed || !['dark', 'light'].includes(value)) return;
      theme = value;
      draw();
    }
    function setSpecies(value) {
      if (destroyed || !Object.hasOwn(FISH_PROFILES, value) || value === species) return;
      species = value;
      profile = FISH_PROFILES[species];
      food = []; ripples = [];
      createFish();
      // テーマ・停止・記事の位置・描画ループには触らない。
      draw();
    }
    function setPointer(x, y, active) {
      if (destroyed) return;
      Object.assign(pointer, { x, y, active: Boolean(active) });
    }
    function feedAt(x, y) {
      if (destroyed) return;
      const p = { x: clamp(x, 3, width - 3), y: clamp(y, 3, height - 3) };
      const rotation = random(0, TAU);
      const pellets = Array.from({ length: SETTINGS.foodPerClick }, (_, j) => {
        const angle = rotation + TAU * j / SETTINGS.foodPerClick + random(-.12, .12);
        const offset = random(5, 9), speed = random(45, 78);
        return {
          x: clamp(p.x + Math.cos(angle) * offset, 3, width - 3),
          y: clamp(p.y + Math.sin(angle) * offset, 3, height - 3),
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          phase: random(0, TAU), born: time,
        };
      });
      food.push(...pellets);
      if (food.length > SETTINGS.maxFood) food.splice(0, food.length - SETTINGS.maxFood);
      // 波紋は餌から独立。餌を食べても、輪は自然に消えるまで残す。
      addRipple({
        ...p, kind: 'click', born: time, lifetime: SETTINGS.rippleLifetime,
        radius: 7, speed: 39, opacity: SETTINGS.rippleOpacity,
      });
      fish.forEach(f => {
        if (Math.hypot(f.x - p.x, f.y - p.y) > profile.feedingRange) return;
        f.feedFrom = feedingBoost(f);
        f.feedAt = time;
        f.targetFood = pellets.reduce((best, pellet) =>
          Math.hypot(pellet.x - f.x, pellet.y - f.y) < Math.hypot(best.x - f.x, best.y - f.y) ? pellet : best);
      });
      if (!canAnimate()) draw();
    }
    function onMotion() { motionOverride = false; syncAnimation(); }
    document.addEventListener('visibilitychange', syncAnimation);
    reducedMotion.addEventListener('change', onMotion);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    const intersectionObserver = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      syncAnimation();
    });
    intersectionObserver.observe(root);

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect(); intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', syncAnimation);
      reducedMotion.removeEventListener('change', onMotion);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      delete root.pondController;
    }
    function onPageHide(event) {
      if (event.persisted) { pageSuspended = true; syncAnimation(); }
      else destroy();
    }
    function onPageShow(event) {
      if (event.persisted) { pageSuspended = false; syncAnimation(); }
    }
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    const controller = {
      setTheme, setSpecies, setPaused, setPointer, feedAt, destroy,
      setCell(value) {
        if (destroyed || !Number.isFinite(Number(value))) return;
        cell = clamp(Number(value), 4, 13); draw();
      },
      setFps(value) {
        if (destroyed) return;
        fps = Number(value) === 60 ? 60 : 30; syncAnimation();
      },
    };
    root.pondController = controller;
    resize(); syncAnimation();
    return controller;
  }

  // 背景本体の公開API。外側のボタンがなくても単独で初期化できる。
  window.MosaicPond = { mountPond };

})();
