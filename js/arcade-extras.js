(() => {
  const SIZE = 480;
  const EXTRA_MODES = new Set(['flight', 'bomber', 'maze', 'tower']);

  function create(canvas, { onScore, onGameOver, beep }) {
    const ctx = canvas.getContext('2d');
    const flight = { frame: 0, playerY: 230, velocity: 0, gates: [], passed: 0, level: 1, difficulty: 'easy', nextGateAt: 105, started: false, ended: false };
    const bomber = { frame: 0, player: { x: 1, y: 1 }, blocks: new Set(), bombs: [], explosions: [], pickups: [], enemies: [], lives: 3, input: { x: 0, y: 0 }, moveAt: 0, level: 1, transition: 0, range: 2, bombCapacity: 1, ended: false };
    const maze = { frame: 0, player: { x: 1, y: 1 }, visual: { x: 48, y: 48 }, direction: { x: 0, y: 0 }, wanted: { x: 0, y: 0 }, ghosts: [], walls: new Set(), dots: new Set(), powerDots: new Set(), power: 0, lives: 3, invulnerable: 0, level: 1, ended: false };
    const tower = { frame: 0, player: { x: 54, y: 416, vy: 0, grounded: true, climbing: false }, barrels: [], fireballs: [], gems: [], hammers: [], impacts: [], hammerUses: 0, input: { x: 0, y: 0 }, lives: 3, level: 1, hammerFrames: 0, hammerCooldown: 0, transition: 0, invulnerable: 0, ended: false };
    const flightSettings = {
      easy: { speed: 2.35, speedStep: .16, gap: 96, gapStep: 4, interval: 132, intervalStep: 8 },
      medium: { speed: 2.8, speedStep: .23, gap: 84, gapStep: 4, interval: 112, intervalStep: 7 },
      hard: { speed: 3.35, speedStep: .24, gap: 74, gapStep: 3, interval: 92, intervalStep: 6 }
    };

    const cellId = (x, y) => `${x},${y}`;
    let score = 0;
    const setScore = value => { score = value; onScore(value); };
    const addScore = value => setScore(score + value);
    function playGameSound(mode, event) {
      const cues = {
        flight: { flap: [[520, .035, .018, 'square'], [760, .04, .013, 'square', 35]], score: [[880, .06, .022, 'square'], [1175, .08, .018, 'square', 55]], level: [[523, .07, .02, 'square'], [659, .07, .02, 'square', 70], [1047, .11, .025, 'square', 140]] },
        bomber: { bomb: [[190, .07, .035, 'square'], [260, .08, .025, 'triangle', 55]], blast: [[120, .15, .04, 'sawtooth'], [420, .09, .025, 'square', 60]], hit: [[660, .06, .025, 'square'], [990, .1, .025, 'square', 70]], level: [[392, .07, .025, 'square'], [523, .07, .025, 'square', 70], [784, .13, .03, 'square', 140]] },
        maze: { dot: [[700, .025, .012, 'square']], power: [[392, .07, .025, 'square'], [587, .07, .025, 'square', 65], [784, .1, .028, 'square', 130]], ghost: [[880, .055, .025, 'square'], [1175, .08, .025, 'square', 55]], hit: [[280, .12, .03, 'triangle']], level: [[440, .08, .025, 'square'], [660, .08, .025, 'square', 80], [880, .12, .03, 'square', 160]] },
        tower: { jump: [[280, .04, .018, 'square'], [390, .05, .016, 'square', 35]], hammer: [[170, .08, .03, 'sawtooth'], [620, .07, .024, 'square', 50]], collect: [[660, .06, .024, 'square'], [990, .08, .025, 'square', 60]], hit: [[150, .12, .03, 'triangle']], level: [[392, .08, .025, 'square'], [523, .08, .025, 'square', 80], [784, .12, .03, 'square', 160]] }
      };
      (cues[mode]?.[event] || []).forEach(([freq, duration, volume, type, delay = 0]) => {
        if (delay) setTimeout(() => beep(freq, duration, volume, type), delay);
        else beep(freq, duration, volume, type);
      });
    }
    const finish = message => {
      const state = activeState();
      if (state.ended) return;
      state.ended = true;
      onGameOver(message);
    };
    let activeMode = '';
    function activeState() { return ({ flight, bomber, maze, tower })[activeMode]; }

    function resetFlight() {
      Object.assign(flight, { frame: 0, playerY: 230, velocity: 0, gates: [{ x: 370, gap: 230 }], passed: 0, level: 1, nextGateAt: 105, started: false, ended: false });
    }
    function buildBomberArena() {
      bomber.player = { x: 1, y: 1 }; bomber.blocks = new Set(); bomber.bombs = []; bomber.explosions = []; bomber.pickups = []; bomber.enemies = [];
      const spawnPoints = [{ x: 13, y: 13 }, { x: 13, y: 1 }, { x: 1, y: 13 }, { x: 11, y: 13 }, { x: 13, y: 11 }, { x: 11, y: 1 }];
      const enemySpawns = new Set(spawnPoints.map(point => cellId(point.x, point.y)));
      for (let y = 1; y < 14; y++) for (let x = 1; x < 14; x++) {
        const protectedStart = (x <= 2 && y <= 2) || (x >= 12 && y >= 12) || (x >= 12 && y <= 2) || (x <= 2 && y >= 12);
        if (protectedStart || enemySpawns.has(cellId(x, y))) continue;
        if (x % 2 === 0 && y % 2 === 0) bomber.blocks.add(cellId(x, y));
        else if ((x * 17 + y * 31 + bomber.level * 13) % Math.max(5, 8 - Math.floor(bomber.level / 2)) < 3) bomber.blocks.add(cellId(x, y));
      }
      [[6, 7], [8, 7], [7, 6], [7, 8]].forEach(([x, y]) => bomber.blocks.add(cellId(x, y)));
      bomber.blocks.delete(cellId(7, 7));
      bomber.enemies = spawnPoints.slice(0, Math.min(1 + Math.floor((bomber.level - 1) / 2), spawnPoints.length)).map(point => ({ ...point }));
      bomber.range = Math.min(5, 2 + Math.floor((bomber.level - 1) / 2));
    }
    function resetBomber() {
      Object.assign(bomber, { frame: 0, player: { x: 1, y: 1 }, blocks: new Set(), bombs: [], explosions: [], pickups: [], enemies: [], lives: 3, input: { x: 0, y: 0 }, moveAt: 0, level: 1, range: 2, bombCapacity: 1, transition: 0, invulnerable: 0, ended: false });
      buildBomberArena();
    }
    function resetMaze(level = 1, lives = 3) {
      Object.assign(maze, { frame: 0, player: { x: 1, y: 1 }, visual: { x: 48, y: 48 }, direction: { x: 0, y: 0 }, wanted: { x: 0, y: 0 }, ghosts: [], walls: new Set(), dots: new Set(), powerDots: new Set(), power: 0, lives, invulnerable: level > 1 ? 45 : 0, level, ended: false });
      let layout = [
        '###############', '#.............#', '#.###.###.###.#', '#.#...#.#...#.#',
        '#.###.#.#.###.#', '#.....#.#.....#', '###.#.#.#.#.###', '...............',
        '###.#.#.#.#.###', '#.....#.#.....#', '#.###.#.#.###.#', '#.#...#.#...#.#',
        '#.###.###.###.#', '#.............#', '###############'
      ];
      if (Math.floor((level - 1) / 2) % 2) layout = layout.map(row => [...row].reverse().join(''));
      if (Math.floor((level - 1) / 4) % 2) layout = layout.slice().reverse();
      layout.forEach((row, y) => [...row].forEach((tile, x) => { if (tile === '#') maze.walls.add(cellId(x, y)); }));
      const distances = new Map([[cellId(1, 1), 0]]);
      const queue = [{ x: 1, y: 1 }];
      for (let i = 0; i < queue.length; i++) {
        const point = queue[i], distance = distances.get(cellId(point.x, point.y));
        for (const dir of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
          const x = point.x + dir.x, y = point.y + dir.y, key = cellId(x, y);
          if (x < 0 || y < 0 || x > 14 || y > 14 || maze.walls.has(key) || distances.has(key)) continue;
          distances.set(key, distance + 1);
          queue.push({ x, y });
        }
      }
      const reachable = queue.filter(p => !(p.x === 1 && p.y === 1));
      reachable.forEach(p => maze.dots.add(cellId(p.x, p.y)));
      [[1, 3], [13, 3], [1, 11], [13, 11]].forEach(([x, y]) => {
        const key = cellId(x, y);
        if (maze.dots.has(key)) { maze.dots.delete(key); maze.powerDots.add(key); }
      });
      const farthest = reachable.slice().sort((a, b) => distances.get(cellId(b.x, b.y)) - distances.get(cellId(a.x, a.y)));
      maze.ghosts = [farthest[0], farthest[Math.floor(farthest.length * .55)], farthest[Math.floor(farthest.length * .3)]]
        .filter(Boolean).map((p, i) => ({ ...p, homeX: p.x, homeY: p.y, visualX: p.x * 32 + 16, visualY: p.y * 32 + 16, color: ['#ff426d', '#28dcff', '#ff9b35'][i], brain: i, eaten: false, reviveAt: 0 }));
      maze.dots.delete(cellId(farthest[0]?.x, farthest[0]?.y));
    }
    function resetTower() {
      Object.assign(tower, { frame: 0, player: { x: 54, y: 416, vy: 0, grounded: true, climbing: false }, barrels: [], gems: [], hammers: [], impacts: [], hammerUses: 0, input: { x: 0, y: 0 }, lives: 3, level: 1, hammerFrames: 0, hammerCooldown: 0, transition: 0, invulnerable: 0, ended: false });
      buildTowerLevel();
    }
    function buildTowerLevel() {
      tower.player = { x: 54, y: 416, vy: 0, grounded: true, climbing: false };
      tower.barrels = [];
      tower.fireballs = [];
      tower.gems = [{ x: 108, y: 342 }, { x: 350, y: 262 }, { x: 108, y: 182 }, { x: 350, y: 102 }];
      const swap = tower.level % 2 === 0;
      tower.hammers = swap
        ? [{ x: 350, y: 340, floor: 1 }, { x: 108, y: 260, floor: 2 }]
        : [{ x: 350, y: 340, floor: 1 }, { x: 108, y: 180, floor: 3 }];
      tower.impacts = [];
      tower.hammerUses = 0;
      tower.hammerFrames = 0; tower.hammerCooldown = 0;
    }
    function start(mode) {
      if (!EXTRA_MODES.has(mode)) return;
      activeMode = mode;
      setScore(0);
      if (mode === 'flight') resetFlight();
      else if (mode === 'bomber') resetBomber();
      else if (mode === 'maze') resetMaze();
      else resetTower();
      render(mode);
    }
    function setFlightDifficulty(difficulty) {
      if (!['easy', 'medium', 'hard'].includes(difficulty)) return;
      flight.difficulty = difficulty;
    }

    function gridBackground(c, color = '#091426') {
      c.fillStyle = color; c.fillRect(0, 0, SIZE, SIZE);
      c.strokeStyle = '#8ecbe010'; c.lineWidth = 1;
      for (let p = 0; p <= SIZE; p += 32) {
        c.beginPath(); c.moveTo(p, 0); c.lineTo(p, SIZE); c.stroke();
        c.beginPath(); c.moveTo(0, p); c.lineTo(SIZE, p); c.stroke();
      }
    }
    function drawPixelSprite(c, x, y, rows, palette, scale = 3) {
      rows.forEach((row, rowIndex) => [...row].forEach((pixel, column) => {
        if (pixel !== '.') { c.fillStyle = palette[pixel]; c.fillRect(Math.round(x + column * scale), Math.round(y + rowIndex * scale), scale, scale); }
      }));
    }
    function drawBlueBird(c, x, y, frame) {
      const wing = ['..HHH...', '.HHHHH..', 'HHHH....', '.HHHHH..'][Math.floor(frame / 4) % 4];
      drawPixelSprite(c, x - 20, y - 16, [
        '....BBBB....', '...BBBBBB...', '..BBBBBBBB..', '.BBBWWWBBB..',
        'BBBBBWWBBBOO', 'BBBBBBBWWBOO', 'BBBBBBBBB...', '.BBBBBBBB..',
        '..BBBBBB....', '...BBBB.....'
      ], { B: '#1688ff', W: '#f6fbff', O: '#ffb43b' }, 3);
      drawPixelSprite(c, x - 5, y + 1, [wing], { H: '#68c9ff' }, 3);
      c.fillStyle = '#092958'; c.fillRect(x + 3, y - 7, 3, 3);
      c.fillStyle = '#fff'; c.fillRect(x + 3, y - 8, 2, 2);
      c.fillStyle = '#ff8e26'; c.fillRect(x + 15, y - 2, 8, 5);
      c.fillStyle = '#fff6c1'; c.fillRect(x - 13, y + 13, 5, 2);
    }
    function drawBomberHero(c, x, y, frame) {
      const stride = Math.floor(frame / 4) % 2;
      drawPixelSprite(c, x - 8, y - 14, [
        '..CCCC..', '.CCCCCC.', '.CFFFFC.', '.CFFFFC.',
        '..DDDD..', '.DDDDDD.', '.DWWDWD.', '.DDDDDD.',
        '..BBBB..', '.BBBBBB.', '.BB..BB.', '.BB..BB.',
        '.LL..LL.', '.LL..LL.'
      ], { C: '#ffd85c', F: '#f5c59a', D: '#18304b', W: '#fff', B: '#28b8ff', L: '#172d52' }, 2);
      c.fillStyle = '#16263f'; c.fillRect(x - 5 + stride * 2, y + 9, 4, 2);
      c.fillRect(x + 1 - stride * 2, y + 9, 4, 2);
    }
    function drawDonkeyHero(c, x, y, frame, facing = 1) {
      const stride = Math.floor(frame / 4) % 2;
      c.save(); if (facing < 0) { c.translate(x * 2, 0); c.scale(-1, 1); }
      drawPixelSprite(c, x - 13, y, [
        '...BBBBBBB...', '..BBBBBBBBB..', '.BBBBBBBBBBB.', 'BBBBBBBBBBBBB',
        'BBBBBDDDDBBBB', 'BBBBDFFWFFDBB', 'BBBBDFFWFFDBB', 'BBBBBFFFFBBBB',
        'BBBBFFFFFFBBB', 'BBBFFFFFFFFBB', 'BBBBFFFFFFBBB', 'BBBBBFFFFBBBB',
        '....BBRBB....', '.....BRB.....', '.....BRB.....'
      ], { B: '#a85f34', D: '#57352d', F: '#f0bd7c', W: '#fff3d6', R: '#ef4545' }, 2);
      c.fillStyle = '#34242a'; c.fillRect(x - 9, y + 5, 2, 3); c.fillRect(x + 7, y + 5, 2, 3);
      c.fillStyle = '#c47b46'; c.fillRect(x - 19, y + 13 + stride, 6, 8); c.fillRect(x + 13, y + 13 - stride, 6, 8);
      c.fillStyle = '#a85f34'; c.fillRect(x - 7 + stride, y + 26, 5, 4); c.fillRect(x + 2 - stride, y + 26, 5, 4);
      c.fillStyle = '#412a2c'; c.fillRect(x - 9 + stride, y + 29, 7, 2); c.fillRect(x + 2 - stride, y + 29, 7, 2);
      c.restore();
    }

    function tickFlight() {
      if (flight.ended) return;
      flight.frame++;
      if (!flight.started) { renderFlight(); return; }
      flight.velocity += .34; flight.playerY += flight.velocity;
      const difficulty = flightSettings[flight.difficulty];
      const speed = Math.min(5.15, difficulty.speed + (flight.level - 1) * difficulty.speedStep);
      if (flight.frame >= flight.nextGateAt) {
        const halfGap = Math.max(56, difficulty.gap - (flight.level - 1) * difficulty.gapStep);
        flight.gates.push({ x: 510, gap: halfGap + 24 + Math.random() * (SIZE - halfGap * 2 - 48), halfGap });
        flight.nextGateAt = flight.frame + Math.max(56, difficulty.interval - (flight.level - 1) * difficulty.intervalStep);
      }
      flight.gates.forEach(gate => { gate.x -= speed; });
      flight.gates = flight.gates.filter(gate => gate.x > -65);
      for (const gate of flight.gates) {
        if (!gate.passed && gate.x + 54 < 130) {
          gate.passed = true; flight.passed++; addScore(10); playGameSound('flight', 'score');
          if (flight.passed % 4 === 0) { flight.level++; playGameSound('flight', 'level'); }
        }
        const halfGap = gate.halfGap || 84;
        const overlapX = 130 + 20 > gate.x - 5 && 130 - 20 < gate.x + 59;
        if (overlapX && (flight.playerY - 15 < gate.gap - halfGap || flight.playerY + 15 > gate.gap + halfGap)) { finish('EL PÁJARO CHOCÓ CON UNA TUBERÍA'); return; }
      }
      if (flight.playerY < 10 || flight.playerY > 448) { finish('EL PÁJARO SALIÓ DE RUTA'); return; }
      renderFlight();
    }
    function renderFlight() {
      const c = ctx; c.clearRect(0, 0, SIZE, SIZE);
      const sky = c.createLinearGradient(0, 0, 0, SIZE); sky.addColorStop(0, '#102b50'); sky.addColorStop(1, '#101a30');
      c.fillStyle = sky; c.fillRect(0, 0, SIZE, SIZE);
      for (let i = 0; i < 18; i++) {
        const x = (i * 137 - flight.frame * 1.2 + 960) % 520, y = 48 + (i * 71) % 350;
        c.fillStyle = i % 3 ? '#a9dfff44' : '#ffe8a866'; c.fillRect(x, y, i % 3 ? 3 : 5, i % 3 ? 3 : 5);
      }
      c.fillStyle = '#7ce8e522'; c.beginPath(); c.arc(356, 94, 46, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffe69a'; c.fillRect(336, 74, 40, 40);
      c.fillStyle = '#fff4bf'; c.fillRect(344, 82, 24, 24);
      for (const gate of flight.gates) {
        const halfGap = gate.halfGap || 84, top = gate.gap - halfGap, bottom = gate.gap + halfGap;
        c.fillStyle = '#145b91'; c.fillRect(gate.x, 0, 54, top); c.fillRect(gate.x, bottom, 54, SIZE - bottom);
        c.fillStyle = '#1985c7'; c.fillRect(gate.x + 6, 0, 42, top); c.fillRect(gate.x + 6, bottom, 42, SIZE - bottom);
        c.fillStyle = '#5ee3ff'; c.fillRect(gate.x - 5, top - 12, 64, 12); c.fillRect(gate.x - 5, bottom, 64, 12);
        c.fillStyle = '#c2f7ff'; c.fillRect(gate.x + 3, top - 9, 5, 6); c.fillRect(gate.x + 3, bottom + 3, 5, 6);
        c.fillStyle = '#82a7d1'; for (let y = 28; y < top - 8; y += 38) c.fillRect(gate.x + 17, y, 7, 7);
        for (let y = bottom + 22; y < SIZE - 24; y += 38) c.fillRect(gate.x + 17, y, 7, 7);
      }
      c.fillStyle = '#174b47'; c.fillRect(0, 460, SIZE, 20);
      c.fillStyle = '#a2f2c2'; c.fillRect(0, 460, SIZE, 4);
      for (let x = -(flight.frame * 3 % 32); x < SIZE; x += 32) { c.fillStyle = '#63c996'; c.fillRect(x, 468, 16, 5); }
      c.fillStyle = '#f6d66d'; c.font = 'bold 16px monospace'; c.fillText('FLAPPY BIRD · JN EXPO', 16, 28);
      drawBlueBird(c, 130, flight.playerY, flight.frame);
      c.fillStyle = '#fff3b0'; c.font = 'bold 24px monospace'; c.fillText(String(score).padStart(2, '0'), 22, 66);
      c.fillStyle = '#e8f3ff'; c.font = 'bold 11px monospace'; c.fillText(`${flight.difficulty.toUpperCase()} · NIVEL ${flight.level}`, 333, 28);
      if (!flight.started) { c.fillStyle = '#071426cc'; c.fillRect(84, 292, 312, 48); c.fillStyle = '#fff1aa'; c.font = 'bold 16px monospace'; c.fillText('TOCA O PULSA ESPACIO', 104, 322); }
    }
    function jumpFlight() {
      if (activeMode !== 'flight' || flight.ended) return;
      flight.started = true;
      flight.velocity = -5.8; playGameSound('flight', 'flap');
    }

    function solidBomber(x, y) {
      return x < 0 || y < 0 || x > 14 || y > 14 || (x % 2 === 0 && y % 2 === 0) || bomber.blocks.has(cellId(x, y));
    }
    function moveBomber(dx, dy) {
      if (!dx && !dy) return;
      const x = bomber.player.x + dx, y = bomber.player.y + dy;
      if (!solidBomber(x, y) && !bomber.bombs.some(b => b.x === x && b.y === y)) bomber.player = { x, y };
    }
    function placeBomb() {
      if (activeMode !== 'bomber' || bomber.ended || bomber.bombs.length >= bomber.bombCapacity || bomber.bombs.some(b => b.x === bomber.player.x && b.y === bomber.player.y)) return;
      bomber.bombs.push({ x: bomber.player.x, y: bomber.player.y, fuse: 84 });
      playGameSound('bomber', 'bomb');
    }
    function detonateBomb(bomb) {
      const blast = [cellId(bomb.x, bomb.y)];
      for (const dir of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
        for (let step = 1; step <= bomber.range; step++) {
          const x = bomb.x + dir.x * step, y = bomb.y + dir.y * step, key = cellId(x, y);
          if (x < 0 || y < 0 || x > 14 || y > 14 || (x % 2 === 0 && y % 2 === 0)) break;
          blast.push(key);
          if (bomber.blocks.delete(key)) {
            if (Math.random() < .28) bomber.pickups.push({ x, y, type: Math.random() < .55 ? 'flame' : 'bomb', life: 480 });
            break;
          }
        }
      }
      const hitEnemy = bomber.enemies.filter(enemy => blast.includes(cellId(enemy.x, enemy.y)));
      bomber.enemies = bomber.enemies.filter(enemy => !hitEnemy.includes(enemy));
      blast.forEach(key => { const [x, y] = key.split(',').map(Number); bomber.explosions.push({ x, y, life: 14, center: x === bomb.x && y === bomb.y }); });
      bomber.bombs.forEach(other => { if (blast.includes(cellId(other.x, other.y))) other.fuse = Math.min(other.fuse, 1); });
      if (hitEnemy.length) { addScore(hitEnemy.length * 100); playGameSound('bomber', 'hit'); }
      if (blast.includes(cellId(bomber.player.x, bomber.player.y)) && !bomber.invulnerable) {
        bomber.lives--; bomber.player = { x: 1, y: 1 };
        bomber.invulnerable = 35;
        if (!bomber.lives) { finish('EL TÉCNICO QUEDÓ ATRAPADO'); return; }
      }
      if (!bomber.enemies.length && !bomber.transition) {
        bomber.level++; bomber.transition = 38; bomber.input = { x: 0, y: 0 };
        bomber.bombs = []; bomber.blocks.clear(); playGameSound('bomber', 'level');
      }
    }
    function tickBomber() {
      if (bomber.ended) return;
      bomber.frame++;
      if (bomber.transition > 0) {
        bomber.transition--;
        if (!bomber.transition) buildBomberArena();
        renderBomber(); return;
      }
      if (bomber.invulnerable > 0) bomber.invulnerable--;
      if (bomber.frame >= bomber.moveAt) { moveBomber(bomber.input.x, bomber.input.y); bomber.moveAt = bomber.frame + 5; }
      bomber.pickups.forEach(item => item.life--);
      bomber.pickups = bomber.pickups.filter(item => item.life > 0);
      bomber.pickups = bomber.pickups.filter(item => {
        if (item.x !== bomber.player.x || item.y !== bomber.player.y) return true;
        if (item.type === 'flame') bomber.range = Math.min(5, bomber.range + 1);
        else bomber.bombCapacity = Math.min(3, bomber.bombCapacity + 1);
        addScore(50); playGameSound('bomber', 'hit'); return false;
      });
      bomber.explosions.forEach(effect => effect.life--);
      bomber.explosions = bomber.explosions.filter(effect => effect.life > 0);
      bomber.bombs.forEach(b => b.fuse--);
      const exploding = bomber.bombs.filter(b => b.fuse <= 0);
      bomber.bombs = bomber.bombs.filter(b => b.fuse > 0);
      for (const bomb of exploding) { detonateBomb(bomb); if (bomber.ended) return; }
      if (bomber.frame % Math.max(12, 22 - bomber.level * 2) === 0) bomber.enemies.forEach(enemy => {
        const options = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
          .map(dir => ({ x: enemy.x + dir.x, y: enemy.y + dir.y }))
          .filter(point => !solidBomber(point.x, point.y) && !bomber.bombs.some(b => b.x === point.x && b.y === point.y));
        const danger = point => bomber.bombs.some(b => {
          if (point.x !== b.x && point.y !== b.y) return false;
          const distance = Math.abs(point.x - b.x) + Math.abs(point.y - b.y);
          if (distance > 2) return false;
          const dx = Math.sign(point.x - b.x), dy = Math.sign(point.y - b.y);
          for (let step = 1; step < distance; step++) {
            if (bomber.blocks.has(cellId(b.x + dx * step, b.y + dy * step))) return false;
          }
          return true;
        });
        const safe = options.filter(point => !danger(point));
        const choices = safe.length ? safe : options;
        choices.sort((a, b) => Math.abs(a.x - bomber.player.x) + Math.abs(a.y - bomber.player.y) - Math.abs(b.x - bomber.player.x) - Math.abs(b.y - bomber.player.y));
        const option = choices[Math.random() < .75 ? 0 : Math.floor(Math.random() * choices.length)];
        if (option) { enemy.x = option.x; enemy.y = option.y; }
      });
      const touched = !bomber.invulnerable && bomber.enemies.some(e => e.x === bomber.player.x && e.y === bomber.player.y);
      if (touched) {
        bomber.lives--; bomber.player = { x: 1, y: 1 };
        bomber.invulnerable = 35;
        if (!bomber.lives) { finish('LOS DRONES CERRARON EL PASO'); return; }
      }
      renderBomber();
    }
    function renderBomber() {
      const c = ctx, size = 32; gridBackground(c, '#121d2d');
      for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
        const px = x * size, py = y * size;
        c.fillStyle = (x + y) % 2 ? '#142337' : '#192a3d'; c.fillRect(px, py, size, size);
        if (x % 2 === 0 && y % 2 === 0) { c.fillStyle = '#273b52'; c.fillRect(px, py, size, size); c.fillStyle = '#3d536b'; c.fillRect(px + 2, py + 2, 28, 28); c.fillStyle = '#58718b'; c.fillRect(px + 5, py + 5, 5, 5); c.fillRect(px + 22, py + 22, 5, 5); }
        else if (bomber.blocks.has(cellId(x, y))) {
          c.fillStyle = '#493b3d'; c.fillRect(px + 1, py + 2, 30, 28);
          c.fillStyle = '#ae7957'; c.fillRect(px + 4, py + 4, 24, 8); c.fillRect(px + 4, py + 15, 24, 10);
          c.fillStyle = '#d5a16c'; c.fillRect(px + 6, py + 5, 8, 3); c.fillRect(px + 17, py + 16, 9, 3);
          c.fillStyle = '#60474a'; c.fillRect(px + 14, py + 4, 3, 8); c.fillRect(px + 8, py + 15, 3, 10);
          c.fillStyle = '#e1bd86'; c.fillRect(px + 4, py + 2, 4, 2); c.fillRect(px + 24, py + 26, 4, 2);
        }
      }
      bomber.pickups.forEach(item => {
        const cx = (item.x + .5) * size, cy = (item.y + .5) * size, pulse = Math.sin(bomber.frame * .15) * 2;
        c.fillStyle = item.type === 'flame' ? '#ff8b4d' : '#69dbff'; c.fillRect(cx - 10 - pulse, cy - 10 - pulse, 20 + pulse * 2, 20 + pulse * 2);
        c.fillStyle = '#0c1727'; c.fillRect(cx - 6, cy - 6, 12, 12);
        c.fillStyle = '#fff0a8'; c.font = 'bold 13px monospace'; c.fillText(item.type === 'flame' ? 'F' : 'B', cx - 4, cy + 5);
      });
      bomber.bombs.forEach(b => {
        const cx = (b.x + .5) * size, cy = (b.y + .5) * size, pulse = Math.floor(Math.sin(b.fuse * .45) * 2);
        c.fillStyle = '#ff9e3d'; c.fillRect(cx - 8 - pulse, cy - 8 - pulse, 16 + pulse * 2, 16 + pulse * 2);
        c.fillStyle = '#4b2739'; c.fillRect(cx - 6, cy - 5, 12, 12); c.fillStyle = '#bd6270'; c.fillRect(cx - 3, cy - 9, 6, 4);
        if (b.fuse < 30 && bomber.frame % 8 < 4) { c.fillStyle = '#fff2a3'; c.fillRect(cx + 4, cy - 13, 4, 4); c.fillStyle = '#ff983f'; c.fillRect(cx + 7, cy - 17, 3, 4); }
      });
      bomber.explosions.forEach(effect => {
        const inset = effect.center ? 2 : 8, alpha = Math.min(1, effect.life / 5);
        c.globalAlpha = alpha; c.fillStyle = effect.center ? '#fff5b0' : '#ffcf62'; c.fillRect(effect.x * size + inset, effect.y * size + inset, size - inset * 2, size - inset * 2);
        c.fillStyle = '#ff803f'; c.fillRect(effect.x * size + 12, effect.y * size + 2, 8, 28); c.fillRect(effect.x * size + 2, effect.y * size + 12, 28, 8);
        c.globalAlpha = 1;
      });
      bomber.enemies.forEach(e => {
        const ex = e.x * size + 4, ey = e.y * size + 4;
        c.fillStyle = '#48253a'; c.fillRect(ex + 2, ey + 4, 20, 21); c.fillStyle = '#ee718c'; c.fillRect(ex + 5, ey + 1, 14, 21);
        c.fillStyle = '#fff'; c.fillRect(ex + 7, ey + 8, 4, 5); c.fillRect(ex + 14, ey + 8, 4, 5); c.fillStyle = '#25304a'; c.fillRect(ex + 8, ey + 10, 2, 3); c.fillRect(ex + 15, ey + 10, 2, 3);
        c.fillStyle = '#f9a0ae'; c.fillRect(ex + 2, ey + 22 + (bomber.frame % 8 < 4 ? 0 : 2), 6, 4); c.fillRect(ex + 18, ey + 22 + (bomber.frame % 8 < 4 ? 2 : 0), 6, 4);
      });
      const blink = bomber.invulnerable > 0 && bomber.frame % 6 < 3;
      if (!blink) drawBomberHero(c, (bomber.player.x + .5) * size, (bomber.player.y + .5) * size, bomber.frame);
      c.fillStyle = '#e6f3ff'; c.font = 'bold 11px monospace'; c.fillText(`NIVEL ${bomber.level} · DRONES ${bomber.enemies.length} · ♥ ${bomber.lives} · BOMBAS ${bomber.bombs.length}/${bomber.bombCapacity} · RADIO ${bomber.range}`, 10, 18);
      if (bomber.transition) { c.fillStyle = '#071426cc'; c.fillRect(114, 210, 252, 50); c.fillStyle = '#ffe17c'; c.font = 'bold 20px monospace'; c.fillText(`NIVEL ${bomber.level} COMPLETO`, 126, 241); }
    }

    function moveMaze(dx, dy) {
      if (!dx && !dy) return;
      maze.wanted = { x: dx, y: dy };
    }
    function walkMaze(point, dir) {
      const y = point.y + dir.y;
      let x = point.x + dir.x;
      if (y === 7 && x < 0) x = 14;
      else if (y === 7 && x > 14) x = 0;
      if (x < 0 || x > 14 || y < 0 || y > 14) return null;
      return !maze.walls.has(cellId(x, y)) && { x, y };
    }
    function mazeDistance(start, target) {
      const queue = [{ ...start, distance: 0 }], visited = new Set([cellId(start.x, start.y)]);
      for (let i = 0; i < queue.length; i++) {
        const point = queue[i];
        if (point.x === target.x && point.y === target.y) return point.distance;
        for (const dir of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
          const next = walkMaze(point, dir), key = next && cellId(next.x, next.y);
          if (!next || visited.has(key)) continue;
          visited.add(key); queue.push({ ...next, distance: point.distance + 1 });
        }
      }
      return Infinity;
    }
    function ghostTarget(ghost) {
      if (maze.power) return maze.player;
      if (ghost.brain === 1) {
        const target = {
        x: Math.max(1, Math.min(13, maze.player.x + maze.direction.x * 3)),
        y: Math.max(1, Math.min(13, maze.player.y + maze.direction.y * 3))
        };
        return maze.walls.has(cellId(target.x, target.y)) ? maze.player : target;
      }
      if (ghost.brain === 2 && Math.abs(ghost.x - maze.player.x) + Math.abs(ghost.y - maze.player.y) > 5) return maze.player;
      if (ghost.brain === 2) return { x: 13, y: 13 };
      return maze.player;
    }
    function tickMaze() {
      if (maze.ended) return;
      maze.frame++;
      if (maze.invulnerable > 0) maze.invulnerable--;
      maze.visual.x += (maze.player.x * 32 + 16 - maze.visual.x) * .42;
      maze.visual.y += (maze.player.y * 32 + 16 - maze.visual.y) * .42;
      maze.ghosts.forEach(ghost => {
        if (ghost.eaten && maze.frame >= ghost.reviveAt) {
          ghost.eaten = false; ghost.x = ghost.homeX; ghost.y = ghost.homeY;
          ghost.visualX = ghost.x * 32 + 16; ghost.visualY = ghost.y * 32 + 16;
          ghost.direction = null; ghost.reviveFlash = 36;
        }
        if (ghost.eaten) return;
        if (ghost.reviveFlash > 0) ghost.reviveFlash--;
        ghost.visualX += (ghost.x * 32 + 16 - ghost.visualX) * .36;
        ghost.visualY += (ghost.y * 32 + 16 - ghost.visualY) * .36;
      });
      if (maze.frame % 5 === 0) {
        const preferred = walkMaze(maze.player, maze.wanted);
        if (preferred) maze.direction = maze.wanted;
        const next = walkMaze(maze.player, maze.direction);
        if (next) maze.player = next;
        const key = cellId(maze.player.x, maze.player.y);
        if (maze.dots.delete(key)) { addScore(10); playGameSound('maze', 'dot'); }
        const powerKey = cellId(maze.player.x, maze.player.y);
        if (maze.powerDots.delete(powerKey)) { maze.power = 180; addScore(50); playGameSound('maze', 'power'); }
      }
      if (maze.frame % Math.max(3, 7 - Math.floor((maze.level - 1) / 2)) === 0) maze.ghosts.forEach(ghost => {
        if (ghost.eaten) return;
        const options = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
          .map(dir => walkMaze(ghost, dir)).filter(Boolean);
        if (!options.length) return;
        const target = ghostTarget(ghost);
        const reverse = ghost.direction && options.find(p => p.x === ghost.x - ghost.direction.x && p.y === ghost.y - ghost.direction.y);
        const forwardOptions = options.length > 1 && reverse ? options.filter(p => p !== reverse) : options;
        forwardOptions.sort((a, b) => mazeDistance(a, target) - mazeDistance(b, target));
        const next = maze.power
          ? forwardOptions[forwardOptions.length - 1]
          : forwardOptions[Math.random() < .84 ? 0 : Math.floor(Math.random() * forwardOptions.length)];
        ghost.direction = { x: next.x - ghost.x, y: next.y - ghost.y };
        ghost.x = next.x; ghost.y = next.y;
      });
      if (maze.power > 0) maze.power--;
      for (let i = maze.ghosts.length - 1; i >= 0; i--) {
        const ghost = maze.ghosts[i];
        if (maze.invulnerable || ghost.eaten || ghost.x !== maze.player.x || ghost.y !== maze.player.y) continue;
        if (maze.power) { ghost.eaten = true; ghost.reviveAt = maze.frame + 480; ghost.visualX = ghost.x * 32 + 16; ghost.visualY = ghost.y * 32 + 16; addScore(100); playGameSound('maze', 'ghost'); }
        else {
          maze.lives--; maze.player = { x: 1, y: 1 }; maze.visual = { x: 48, y: 48 }; maze.direction = { x: 0, y: 0 }; maze.wanted = { x: 0, y: 0 }; maze.invulnerable = 40; playGameSound('maze', 'hit');
          if (!maze.lives) { finish('EL EXPLORADOR QUEDÓ SIN ENERGÍA'); return; }
          break;
        }
      }
      if (!maze.dots.size && !maze.powerDots.size) {
        const nextLevel = maze.level + 1, lives = maze.lives;
        playGameSound('maze', 'level'); resetMaze(nextLevel, lives); renderMaze(); return;
      }
      renderMaze();
    }
    function renderMaze() {
      const c = ctx, size = 32; c.fillStyle = '#070d20'; c.fillRect(0, 0, SIZE, SIZE);
      for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
        const px = x * size, py = y * size;
        if (maze.walls.has(cellId(x, y))) {
          c.fillStyle = '#152457'; c.fillRect(px + 1, py + 1, 30, 30); c.fillStyle = '#263f88'; c.fillRect(px + 4, py + 4, 24, 24);
          c.fillStyle = '#4d74c4'; c.fillRect(px + 4, py + 4, 24, 3); c.fillRect(px + 4, py + 4, 3, 24);
          c.fillStyle = '#111c47'; c.fillRect(px + 25, py + 7, 3, 21); c.fillRect(px + 7, py + 25, 18, 3);
        } else if (maze.powerDots.has(cellId(x, y))) {
          const pulse = 6 + Math.floor((Math.sin(maze.frame * .2) + 1) * 2);
          c.fillStyle = '#3cecff'; c.fillRect(px + 16 - pulse / 2, py + 16 - pulse / 2, pulse, pulse);
          c.fillStyle = '#eaffff'; c.fillRect(px + 14, py + 14, 4, 4);
        } else if (maze.dots.has(cellId(x, y))) {
          c.fillStyle = '#ffe7a1'; c.fillRect(px + 14, py + 14, 4, 4);
        }
      }
      maze.ghosts.forEach((g, i) => {
        const gx = g.visualX - 12, gy = g.visualY - 12, foot = Math.floor(maze.frame / 4 + i) % 2;
        if (g.eaten) {
          c.fillStyle = '#effaff'; c.fillRect(gx + 5, gy + 7, 5, 8); c.fillRect(gx + 13, gy + 7, 5, 8);
          c.fillStyle = '#263c88'; c.fillRect(gx + 7, gy + 10, 2, 4); c.fillRect(gx + 15, gy + 10, 2, 4);
          return;
        }
        if (g.reviveFlash > 0 && maze.frame % 8 < 4) return;
        const bodyColor = maze.power ? (maze.power < 35 && maze.frame % 8 < 4 ? '#f5f8ff' : '#38b9ff') : g.color;
        c.fillStyle = '#172346'; c.fillRect(gx + 1, gy + 4, 22, 18);
        c.fillStyle = bodyColor; c.fillRect(gx + 4, gy + 3, 14, 17); c.fillRect(gx + 2, gy + 7, 18, 11); c.fillRect(gx + 5, gy + 1, 12, 3);
        c.fillRect(gx + 2, gy + 18, 5, foot ? 3 : 1); c.fillRect(gx + 9, gy + 18, 5, foot ? 1 : 3); c.fillRect(gx + 16, gy + 18, 4, foot ? 3 : 1);
        if (!maze.power) {
          c.fillStyle = '#fff'; c.fillRect(gx + 6, gy + 8, 4, 6); c.fillRect(gx + 13, gy + 8, 4, 6);
          c.fillStyle = '#111b3b'; c.fillRect(gx + 8, gy + 10, 2, 3); c.fillRect(gx + 15, gy + 10, 2, 3);
        } else {
          c.fillStyle = '#fff'; c.fillRect(gx + 5, gy + 9, 3, 3); c.fillRect(gx + 14, gy + 9, 3, 3);
          c.fillStyle = '#fff'; c.fillRect(gx + 7, gy + 15, 3, 2); c.fillRect(gx + 14, gy + 15, 3, 2);
        }
      });
      const facing = maze.direction.x < 0 ? Math.PI : maze.direction.y < 0 ? -Math.PI / 2 : maze.direction.y > 0 ? Math.PI / 2 : 0;
      if (!(maze.invulnerable > 0 && maze.frame % 6 < 3)) {
        const openMouth = Math.floor(maze.frame / 3) % 2 === 0;
        const pacman = openMouth
          ? ['...YYYY...', '..YYYYYY..', '.YYYYYYYY.', 'YYYYYYYY..', 'YYYYYYY...', 'YYYYYYYY..', '.YYYYYYYY.', '..YYYYYY..', '...YYYY...']
          : ['...YYYY...', '..YYYYYY..', '.YYYYYYYY.', 'YYYYYYYYYY', 'YYYYYYYYYY', 'YYYYYYYYYY', '.YYYYYYYY.', '..YYYYYY..', '...YYYY...'];
        c.save(); c.translate(maze.visual.x, maze.visual.y); c.rotate(facing);
        drawPixelSprite(c, -15, -13, pacman, { Y: '#ffe12f' }, 3);
        c.fillStyle = '#fff5a3'; c.fillRect(-6, -7, 3, 3); c.restore();
      }
      const ghostsOut = maze.ghosts.filter(ghost => !ghost.eaten).length;
      c.fillStyle = '#c3d4f2'; c.font = 'bold 11px monospace'; c.fillText(`PAC-MAN · NIVEL ${maze.level} · ♥ ${maze.lives} · FANTASMAS ${ghostsOut}/3 · ${maze.power ? 'POWER!' : 'READY'}`, 10, 18);
    }

    const floors = [{ y: 440, left: 0, right: 480 }, { y: 360, left: 32, right: 448 }, { y: 280, left: 32, right: 448 }, { y: 200, left: 32, right: 448 }, { y: 120, left: 32, right: 448 }];
    const ladders = [{ x: 414, low: 360, high: 280 }, { x: 66, low: 280, high: 200 }, { x: 414, low: 200, high: 120 }, { x: 66, low: 440, high: 360 }];
    const towerStages = [
      { name: 'TALLER DE MOTORES', sky: '#101a35', glow: '#294567', beam: '#557aa0', floor: '#36506b', edge: '#74e5ed', light: '#ffc86d' },
      { name: 'MERCADO NOCTURNO', sky: '#241832', glow: '#51284b', beam: '#9b5478', floor: '#49344d', edge: '#ff91b7', light: '#ffcb62' },
      { name: 'INVERNADERO PIXEL', sky: '#102b2d', glow: '#20544a', beam: '#45816b', floor: '#31564a', edge: '#8df0bb', light: '#e9df77' },
      { name: 'FABRICA DE NEON', sky: '#171e38', glow: '#344079', beam: '#6370bc', floor: '#3b4771', edge: '#83dcff', light: '#f6c870' },
      { name: 'AZOTEA ESTELAR', sky: '#1d1933', glow: '#464077', beam: '#7a67a9', floor: '#45405d', edge: '#c3a9ff', light: '#ffe092' }
    ];
    function jumpTower() {
      if (activeMode !== 'tower' || !tower.player.grounded) return;
      tower.player.vy = -7.7; tower.player.grounded = false; playGameSound('tower', 'jump');
    }
    function swingHammer() {
      if (activeMode !== 'tower' || tower.ended || tower.transition || tower.hammerCooldown || !tower.hammerUses) return;
      tower.hammerUses--; tower.hammerFrames = 14; tower.hammerCooldown = 42; playGameSound('tower', 'hammer');
      const facing = tower.facing || 1;
      const target = tower.barrels.find(barrel => (barrel.x - tower.player.x) * facing > 0 &&
        !barrel.falling && Math.abs(barrel.x - tower.player.x) < 58 && Math.abs(barrel.y - (tower.player.y + 12)) < 38);
      const fireball = tower.fireballs.find(enemy => (enemy.x - tower.player.x) * facing > 0 &&
        !enemy.falling && Math.abs(enemy.x - tower.player.x) < 58 && Math.abs(enemy.y - (tower.player.y + 12)) < 38);
      if (target) {
        tower.barrels = tower.barrels.filter(barrel => barrel !== target);
        tower.impacts.push({ x: target.x, y: target.y, life: 18 });
        addScore(100); playGameSound('tower', 'collect');
      } else if (fireball) {
        tower.fireballs = tower.fireballs.filter(enemy => enemy !== fireball);
        tower.impacts.push({ x: fireball.x, y: fireball.y, life: 18 });
        addScore(150); playGameSound('tower', 'collect');
      }
    }
    function tickTower() {
      if (tower.ended) return;
      tower.frame++;
      if (tower.transition > 0) {
        tower.transition--;
        renderTower(); return;
      }
      if (tower.hammerCooldown > 0) tower.hammerCooldown--;
      if (tower.hammerFrames > 0) tower.hammerFrames--;
      tower.impacts.forEach(impact => impact.life--);
      tower.impacts = tower.impacts.filter(impact => impact.life > 0);
      const p = tower.player;
      p.x = Math.max(16, Math.min(464, p.x + tower.input.x * 3.2));
      const ladder = ladders.find(l => Math.abs(p.x - l.x) < 20 && p.y + 24 > l.high && p.y + 24 <= l.low + 4);
      p.climbing = Boolean(ladder && tower.input.y);
      if (p.climbing) { p.y = Math.max(ladder.high - 24, Math.min(ladder.low - 24, p.y + tower.input.y * 2.6)); p.vy = 0; p.grounded = false; }
      else {
        const previousBottom = p.y + 24; p.vy = Math.min(8, p.vy + .5); p.y += p.vy; p.grounded = false;
        for (const floor of floors) if (p.vy >= 0 && previousBottom <= floor.y && p.y + 24 >= floor.y && p.x + 13 > floor.left && p.x - 13 < floor.right) { p.y = floor.y - 24; p.vy = 0; p.grounded = true; break; }
      }
      if (tower.frame % Math.max(52, 105 - (tower.level - 1) * 8) === 0) tower.barrels.push({ x: 430, y: 107, floor: 4, dir: -1, falling: false });
      if (tower.frame % Math.max(112, 230 - (tower.level - 1) * 20) === 0 && tower.fireballs.length < Math.min(3, 1 + Math.floor((tower.level - 1) / 2))) {
        const floorIndex = Math.min(2, Math.floor((tower.level - 1) / 2));
        tower.fireballs.push({ x: tower.frame % 2 ? 42 : 438, y: floors[floorIndex].y - 13, floor: floorIndex, dir: tower.frame % 2 ? 1 : -1, falling: false, phase: tower.frame });
      }
      tower.barrels.forEach(b => {
        if (b.falling) {
          b.y = Math.min(b.targetY, b.y + 5.4);
          if (b.y >= b.targetY) {
            b.y = b.targetY; b.floor = b.targetFloor; b.falling = false; b.dir *= -1;
          }
          return;
        }
        b.x += b.dir * (2.3 + (tower.level - 1) * .18);
        const floor = floors[b.floor];
        if (b.x < floor.left + 12 || b.x > floor.right - 12) {
          if (b.floor > 0) {
            b.x = b.dir < 0 ? floor.left + 12 : floor.right - 12;
            b.falling = true; b.targetFloor = b.floor - 1; b.targetY = floors[b.targetFloor].y - 13;
          } else if (b.dir < 0) b.x = floor.left - 24;
          else { b.x = floor.right - 12; b.dir = -1; }
        }
      });
      tower.barrels = tower.barrels.filter(b => b.floor > 0 || b.x > 18);
      tower.fireballs.forEach(enemy => {
        if (enemy.falling) {
          enemy.y = Math.min(enemy.targetY, enemy.y + 4.6);
          if (enemy.y >= enemy.targetY) {
            enemy.y = enemy.targetY; enemy.floor = enemy.targetFloor; enemy.falling = false; enemy.dir *= -1;
          }
          return;
        }
        enemy.x += enemy.dir * (1.8 + (tower.level - 1) * .16);
        const floor = floors[enemy.floor];
        if (enemy.x < floor.left + 12 || enemy.x > floor.right - 12) {
          if (enemy.floor > 0) {
            enemy.x = enemy.dir < 0 ? floor.left + 12 : floor.right - 12;
            enemy.falling = true; enemy.targetFloor = enemy.floor - 1; enemy.targetY = floors[enemy.targetFloor].y - 13;
          } else if (enemy.dir < 0) enemy.x = floor.left - 24;
          else { enemy.x = floor.right - 12; enemy.dir = -1; }
        }
      });
      tower.fireballs = tower.fireballs.filter(enemy => enemy.floor > 0 || enemy.x > 18);
      const hazard = [...tower.barrels, ...tower.fireballs].find(item => !item.falling && !tower.invulnerable && Math.abs(p.x - item.x) < 23 && Math.abs(p.y + 12 - item.y) < 23);
      if (hazard) {
        tower.lives--; p.x = 54; p.y = 416; p.vy = 0;
        tower.invulnerable = 45; playGameSound('tower', 'hit');
        tower.barrels = tower.barrels.filter(other => other !== hazard);
        tower.fireballs = tower.fireballs.filter(other => other !== hazard);
        if (!tower.lives) { finish('EL MECÁNICO SE QUEDÓ SIN ENERGÍA'); return; }
      }
      if (tower.invulnerable > 0) tower.invulnerable--;
      tower.gems = tower.gems.filter(gem => {
        if (Math.abs(p.x - gem.x) < 20 && Math.abs(p.y + 12 - gem.y) < 20) { addScore(50); playGameSound('tower', 'collect'); return false; }
        return true;
      });
      tower.hammers = tower.hammers.filter(hammer => {
        if (Math.abs(p.x - hammer.x) < 21 && Math.abs(p.y + 12 - hammer.y) < 22) {
          tower.hammerUses = 4; addScore(25); playGameSound('tower', 'collect'); return false;
        }
        return true;
      });
      if (p.y < 120 && p.x > 390 && !tower.gems.length) {
        if (tower.level >= 5) { finish('¡RESCATASTE A PAULINE!'); return; }
        tower.level++; tower.transition = 48; tower.input = { x: 0, y: 0 }; buildTowerLevel(); playGameSound('tower', 'level');
      } else if (p.y < 120 && p.x > 390 && tower.gems.length && tower.frame % 40 === 0) {
        playGameSound('tower', 'hit');
      }
      renderTower();
    }
    function renderTower() {
      const c = ctx, stage = towerStages[(tower.level - 1) % towerStages.length];
      const backdrop = c.createLinearGradient(0, 0, SIZE, SIZE);
      backdrop.addColorStop(0, stage.sky); backdrop.addColorStop(1, '#08111f');
      c.fillStyle = backdrop; c.fillRect(0, 0, SIZE, SIZE);
      c.fillStyle = stage.glow + '55'; c.beginPath(); c.ellipse(360, 260, 142, 210, -.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#070e1c88'; c.fillRect(0, 58, SIZE, 345);
      for (let x = 16; x < SIZE; x += 48) {
        c.fillStyle = stage.beam + '55'; c.fillRect(x, 68, 3, 315);
        c.fillStyle = stage.light + '65'; c.fillRect(x - 2, 74 + (x % 3) * 17, 7, 3);
      }
      c.strokeStyle = stage.beam + '99'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 77); c.lineTo(SIZE, 77); c.moveTo(0, 400); c.lineTo(SIZE, 400); c.stroke();
      c.fillStyle = '#080f1ecc'; c.fillRect(292, 105, 148, 214);
      c.strokeStyle = stage.beam; c.lineWidth = 3; c.strokeRect(292, 105, 148, 214);
      c.fillStyle = stage.glow; c.fillRect(305, 120, 122, 14);
      for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? stage.light + 'aa' : stage.edge + 'bb'; c.fillRect(307 + i * 22, 146, 10, 116 - i * 8); }
      c.fillStyle = '#dce8f7'; c.font = 'bold 10px monospace'; c.fillText(stage.name, 12, 23);
      c.fillStyle = stage.edge; c.font = 'bold 8px monospace'; c.fillText(`RONDA ${String(tower.level).padStart(2, '0')}`, 12, 42);
      floors.forEach((floor, i) => {
        c.fillStyle = i % 2 ? stage.floor : stage.beam; c.fillRect(floor.left, floor.y, floor.right - floor.left, 11);
        c.fillStyle = stage.edge; c.fillRect(floor.left, floor.y, floor.right - floor.left, 3);
        c.fillStyle = '#08101b'; c.fillRect(floor.left, floor.y + 8, floor.right - floor.left, 4);
        for (let x = floor.left + 12; x < floor.right; x += 34) {
          c.fillStyle = stage.beam; c.fillRect(x, floor.y + 5, 19, 3);
          c.fillStyle = stage.light; c.fillRect(x + 3, floor.y + 2, 3, 2);
        }
        c.fillStyle = stage.light; c.fillRect(floor.left + 3, floor.y + 5, 3, 2); c.fillRect(floor.right - 6, floor.y + 5, 3, 2);
      });
      ladders.forEach(l => { c.strokeStyle = '#edc66b'; c.lineWidth = 4; c.beginPath(); c.moveTo(l.x - 8, l.low); c.lineTo(l.x - 8, l.high); c.moveTo(l.x + 8, l.low); c.lineTo(l.x + 8, l.high); for (let y = l.high + 8; y < l.low; y += 14) { c.moveTo(l.x - 8, y); c.lineTo(l.x + 8, y); } c.stroke(); });
      tower.gems.forEach(g => {
        const bob = Math.sin(tower.frame * .12 + g.x) * 2;
        c.save(); c.translate(g.x, g.y + bob); c.rotate(Math.PI / 4);
        c.fillStyle = '#ffdd6a55'; c.fillRect(-12, -12, 24, 24);
        c.fillStyle = '#ffe172'; c.fillRect(-7, -7, 14, 14); c.fillStyle = '#fff8c4'; c.fillRect(-4, -5, 4, 5); c.restore();
      });
      tower.hammers.forEach(item => {
        const bob = Math.sin(tower.frame * .13 + item.x) * 3;
        c.save(); c.translate(item.x, item.y + bob);
        c.fillStyle = '#ffe17b30'; c.fillRect(-16, -16, 32, 32);
        c.fillStyle = '#975c36'; c.fillRect(-2, -5, 4, 19);
        c.fillStyle = '#d6e4f0'; c.fillRect(-11, -11, 22, 8); c.fillStyle = '#ffffff'; c.fillRect(-8, -10, 7, 3);
        c.fillStyle = '#647c96'; c.fillRect(5, -10, 5, 6); c.restore();
      });
      tower.barrels.forEach(b => {
        c.save(); c.translate(b.x, b.y); c.rotate(b.falling ? 0 : tower.frame * b.dir * .13);
        c.fillStyle = '#512d2c'; c.fillRect(-13, -13, 26, 26);
        c.fillStyle = '#bd5c3f'; c.fillRect(-10, -10, 20, 20);
        c.fillStyle = '#ffd27a'; c.fillRect(-12, -6, 24, 3); c.fillRect(-12, 4, 24, 3);
        c.fillStyle = '#7c382f'; c.fillRect(-3, -9, 6, 18);
        c.fillStyle = '#f39a61'; c.fillRect(-7, -8, 3, 4); c.restore();
      });
      tower.fireballs.forEach((enemy, index) => {
        const flicker = (Math.floor(tower.frame / 4 + index) % 2) * 3;
        c.fillStyle = '#ff542c30'; c.fillRect(enemy.x - 16, enemy.y - 16, 32, 31);
        c.fillStyle = '#c92e3f'; c.fillRect(enemy.x - 11, enemy.y - 8, 22, 18);
        c.fillStyle = '#ff653e'; c.fillRect(enemy.x - 9, enemy.y - 12 - flicker, 18, 18);
        c.fillStyle = '#ffbd4e'; c.fillRect(enemy.x - 6, enemy.y - 17 - flicker, 12, 12);
        c.fillStyle = '#fff0a2'; c.fillRect(enemy.x - 3, enemy.y - 15 - flicker, 6, 7);
        c.fillStyle = '#63263c'; c.fillRect(enemy.x - 6, enemy.y - 3, 4, 4); c.fillRect(enemy.x + 2, enemy.y - 3, 4, 4);
      });
      tower.impacts.forEach(impact => {
        const radius = 4 + (18 - impact.life) * 1.2, alpha = Math.min(1, impact.life / 8);
        c.save(); c.globalAlpha = alpha; c.strokeStyle = '#ffe17b'; c.lineWidth = 3;
        c.beginPath(); c.arc(impact.x, impact.y, radius, 0, Math.PI * 2); c.stroke();
        for (let i = 0; i < 4; i++) { const angle = i * Math.PI / 2 + tower.frame * .08; c.fillStyle = i % 2 ? '#fff4b3' : '#ff974f'; c.fillRect(impact.x + Math.cos(angle) * radius - 2, impact.y + Math.sin(angle) * radius - 2, 4, 4); }
        c.restore();
      });
      const p = tower.player;
      tower.facing = tower.input.x || tower.facing || 1;
      if (!(tower.invulnerable > 0 && tower.frame % 6 < 3)) drawDonkeyHero(c, p.x, p.y - 3, tower.frame, tower.facing);
      if (tower.hammerFrames > 0) {
        const hx = p.x + tower.facing * 24, hy = p.y + 5;
        c.fillStyle = '#8b5a3c'; c.fillRect(hx - 2, hy, 4, 20);
        c.fillStyle = '#ffe48a'; c.fillRect(hx - 12, hy - 5, 24, 8); c.fillStyle = '#fff2b4'; c.fillRect(hx - 9, hy - 3, 6, 3);
      }
      c.fillStyle = '#e7eefc'; c.font = 'bold 10px monospace'; c.fillText(`♥ ${tower.lives}   REPUESTOS ${tower.gems.length}   MARTILLO ${tower.hammerUses}/4`, 12, 57);
      c.fillStyle = stage.light; c.font = 'bold 11px monospace'; c.fillText(tower.gems.length ? 'RECOGE LOS REPUESTOS' : '¡SUBE AL DRON!', 313, 91);
      c.fillStyle = '#4e779e'; c.fillRect(414, 101, 36, 9); c.fillStyle = '#78f2ff'; c.fillRect(419, 98 + Math.sin(tower.frame * .2) * 2, 26, 8); c.fillStyle = '#fff7bd'; c.fillRect(427, 94, 10, 4);
      if (tower.transition) { c.fillStyle = '#071426dd'; c.fillRect(124, 206, 232, 54); c.fillStyle = '#ffe28a'; c.font = 'bold 20px monospace'; c.fillText(`NIVEL ${tower.level}`, 178, 240); }
    }

    function tick(mode) {
      if (mode === 'flight') tickFlight();
      else if (mode === 'bomber') tickBomber();
      else if (mode === 'maze') tickMaze();
      else if (mode === 'tower') tickTower();
    }
    function render(mode) {
      if (mode === 'flight') renderFlight();
      else if (mode === 'bomber') renderBomber();
      else if (mode === 'maze') renderMaze();
      else if (mode === 'tower') renderTower();
    }
    function direction(mode, dir) {
      if (mode === 'flight') { if (dir.y < 0) jumpFlight(); }
      else if (mode === 'bomber') {
        bomber.input = { x: dir.x, y: dir.y };
        if (dir.x || dir.y) { moveBomber(dir.x, dir.y); bomber.moveAt = bomber.frame + 5; }
      }
      else if (mode === 'maze') moveMaze(dir.x, dir.y);
      else if (mode === 'tower') {
        if (dir.x) { tower.input = { x: dir.x, y: 0 }; tower.facing = dir.x; }
        else if (dir.y < 0) {
          if (ladders.some(l => Math.abs(tower.player.x - l.x) < 20 && tower.player.y + 24 > l.high && tower.player.y + 24 <= l.low + 4)) tower.input = { x: 0, y: -1 };
          else jumpTower();
        } else if (dir.y > 0 && ladders.some(l => Math.abs(tower.player.x - l.x) < 20 && tower.player.y + 24 > l.high && tower.player.y + 24 <= l.low + 4)) tower.input = { x: 0, y: 1 };
        else tower.input = { x: 0, y: 0 };
      }
    }
    function action(mode) {
      if (mode === 'flight') jumpFlight();
      else if (mode === 'bomber') placeBomb();
      else if (mode === 'tower') swingHammer();
    }
    function jump(mode) {
      if (mode === 'tower') jumpTower();
    }
    function pointerDown(mode, x, y) {
      if (mode === 'flight') jumpFlight();
      else if (mode === 'tower' && y < 240) jumpTower();
      else if (mode === 'bomber' && x > 280) placeBomb();
      else if (mode === 'maze') {
        const dx = x - maze.visual.x, dy = y - maze.visual.y;
        moveMaze(Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0, Math.abs(dy) >= Math.abs(dx) ? Math.sign(dy) : 0);
      }
    }
    function keyDown(mode, event) {
      const key = event.key.toLowerCase();
      if (mode === 'flight' && (key === ' ' || key === 'arrowup' || key === 'w')) { jumpFlight(); return true; }
      if (mode === 'bomber' && key === ' ') { if (!event.repeat) placeBomb(); return true; }
      if (mode === 'tower' && (key === ' ' || key === 'arrowup' || key === 'w')) {
        if (key === ' ' && !event.repeat) jumpTower();
        else if (key !== ' ') direction(mode, { x: 0, y: -1 });
        return true;
      }
      if (mode === 'tower' && (key === 'x' || key === 'j')) { if (!event.repeat) swingHammer(); return true; }
      return false;
    }
    return { start, tick, render, direction, action, jump, pointerDown, keyDown, setFlightDifficulty };
  }

  window.FeriaArcadeExtras = { modes: EXTRA_MODES, create };
})();
