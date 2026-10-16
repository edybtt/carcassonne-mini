'use strict';
(() => {
  // ================= Constants =================
  // Sides: 0 = N, 1 = E, 2 = S, 3 = W (clockwise)
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  // Up to 8 players: red, blue, yellow, purple, orange, teal, pink, charcoal
  const PLAYER_COLORS = ['#e03a2f', '#2f6fe0', '#f2c12e', '#9b4dca', '#f2811d', '#16b5b0', '#ec5fa8', '#3b3f48'];
  const MAX_PLAYERS = PLAYER_COLORS.length;
  const MAX_MEEPLES = 100;
  // dark colors get a light outline on the "+N" popups
  const isDark = c => {
    const n = parseInt(String(c).slice(1), 16);
    return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 90;
  };
  const MIN_SIZE = 28, MAX_SIZE = 190;   // zoom (px per tile); big boards can zoom out further, see minZoom()
  const COL = {
    field: '#8bbd4f', tuft: '#6f9d3a',
    city: '#dcae66', wall: '#7a4c24',
    road: '#f4ecd6', roadEdge: '#8c7552',
    roof: '#b8452e', stone: '#efe6d2', dark: '#4e3826',
    pennant: '#1f4fa3',
  };
  const KIND = {
    road: { done: 'road completed', open: 'unfinished road' },
    city: { done: 'city completed', open: 'unfinished city' },
    monastery: { done: 'monastery completed', open: 'unfinished monastery' },
  };

  // Base set (72 tiles). e = edges N,E,S,W: C = city, R = road, F = field.
  // f = the tile's features; s = the sides each one touches; p = pennant.
  const TILE_DEFS = {
    A: { n: 2, e: 'FFRF', f: [{ t: 'monastery', s: [] }, { t: 'road', s: [2] }] },
    B: { n: 4, e: 'FFFF', f: [{ t: 'monastery', s: [] }] },
    C: { n: 1, e: 'CCCC', f: [{ t: 'city', s: [0, 1, 2, 3], p: 1 }] },
    D: { n: 4, e: 'CRFR', f: [{ t: 'city', s: [0] }, { t: 'road', s: [1, 3] }] },
    E: { n: 5, e: 'CFFF', f: [{ t: 'city', s: [0] }] },
    F: { n: 2, e: 'FCFC', f: [{ t: 'city', s: [1, 3], p: 1 }] },
    G: { n: 1, e: 'CFCF', f: [{ t: 'city', s: [0, 2] }] },
    H: { n: 3, e: 'FCFC', f: [{ t: 'city', s: [1] }, { t: 'city', s: [3] }] },
    I: { n: 2, e: 'CFFC', f: [{ t: 'city', s: [0] }, { t: 'city', s: [3] }] },
    J: { n: 3, e: 'CRRF', f: [{ t: 'city', s: [0] }, { t: 'road', s: [1, 2] }] },
    K: { n: 3, e: 'CFRR', f: [{ t: 'city', s: [0] }, { t: 'road', s: [2, 3] }] },
    L: { n: 3, e: 'CRRR', f: [{ t: 'city', s: [0] }, { t: 'road', s: [1] }, { t: 'road', s: [2] }, { t: 'road', s: [3] }] },
    M: { n: 2, e: 'CFFC', f: [{ t: 'city', s: [0, 3], p: 1 }] },
    N: { n: 3, e: 'CFFC', f: [{ t: 'city', s: [0, 3] }] },
    O: { n: 2, e: 'CRRC', f: [{ t: 'city', s: [0, 3], p: 1 }, { t: 'road', s: [1, 2] }] },
    P: { n: 3, e: 'CRRC', f: [{ t: 'city', s: [0, 3] }, { t: 'road', s: [1, 2] }] },
    Q: { n: 1, e: 'CCFC', f: [{ t: 'city', s: [0, 1, 3], p: 1 }] },
    R: { n: 3, e: 'CCFC', f: [{ t: 'city', s: [0, 1, 3] }] },
    S: { n: 2, e: 'CCRC', f: [{ t: 'city', s: [0, 1, 3], p: 1 }, { t: 'road', s: [2] }] },
    T: { n: 1, e: 'CCRC', f: [{ t: 'city', s: [0, 1, 3] }, { t: 'road', s: [2] }] },
    U: { n: 8, e: 'RFRF', f: [{ t: 'road', s: [0, 2] }] },
    V: { n: 9, e: 'FFRR', f: [{ t: 'road', s: [2, 3] }] },
    W: { n: 4, e: 'FRRR', f: [{ t: 'road', s: [1] }, { t: 'road', s: [2] }, { t: 'road', s: [3] }] },
    X: { n: 1, e: 'RRRR', f: [{ t: 'road', s: [0] }, { t: 'road', s: [1] }, { t: 'road', s: [2] }, { t: 'road', s: [3] }] },
  };
  const START_TILE = 'D';
  for (const id in TILE_DEFS) {
    const d = TILE_DEFS[id];
    d.sideFeature = [-1, -1, -1, -1];
    d.f.forEach((f, i) => f.s.forEach(s => (d.sideFeature[s] = i)));
    d.roadCount = d.f.filter(f => f.t === 'road').length;
    d.monastery = d.f.some(f => f.t === 'monastery');
  }

  // ================= State =================
  let players = [];           // {name, ai, color, score, meeples, owner}
  let board = new Map();      // "x,y" -> {x, y, type, rot, meeple: {p, f} | null, by, seed}
  let deck = [];
  let remoteDeck = 0;         // on a client: how many tiles the host still has in the deck
  let cur = 0;
  let turnNo = 0;
  let tile = null;            // type of the tile drawn this turn
  let rot = 0;
  let phase = 'idle';         // idle | place | meeple | ai | wait | over
  let pending = null;         // {x, y} – tile "in the air" (computer's move / sent to the host)
  let candidates = [];        // [{x, y, rots: [...]}]
  let placed = null;          // tile placed this turn (meeple phase)
  let lastPlaced = null;
  let meepleSpots = [];
  let gameId = 0;
  let popups = [];
  let flashes = [];

  // Turn time (seconds, 0 = no limit)
  const TURN_TIMES = [15, 30, 45, 60, 90, 0];
  let turnTime = 30;

  // Game settings. "custom" uses the number typed in by the player (deckN / meepleN).
  const DECK_SIZES = {
    small: { label: 'Small', n: 36 },
    normal: { label: 'Normal', n: 72 },
    large: { label: 'Large', n: 108 },
    custom: { label: 'Custom' },
  };
  const MEEPLE_COUNTS = {
    few: { label: 'Few', n: 5 },
    normal: { label: 'Normal', n: 7 },
    many: { label: 'Many', n: 10 },
    custom: { label: 'Custom' },
  };
  // Animations are only for show – the game never waits for them. Off = no meeple flights, score popups,
  // flashes or camera glides.
  const ANIM_MODES = {
    on: { label: 'On', n: 'animated' },
    off: { label: 'Off', n: 'static' },
  };
  const DECK_MIN = 10, DECK_MAX = 10000;
  const DEFAULT_SETTINGS = { deck: 'normal', meeples: 'normal', time: 30, anim: 'on', deckN: 72, meepleN: 7 };
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const intIn = (v, min, max, def) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
  };
  const cleanSettings = s => ({
    deck: s && hasOwn(DECK_SIZES, s.deck) ? s.deck : DEFAULT_SETTINGS.deck,
    meeples: s && hasOwn(MEEPLE_COUNTS, s.meeples) ? s.meeples : DEFAULT_SETTINGS.meeples,
    time: s && TURN_TIMES.includes(s.time) ? s.time : DEFAULT_SETTINGS.time,
    anim: s && s.anim === 'off' ? 'off' : 'on',
    deckN: intIn(s && s.deckN, DECK_MIN, DECK_MAX, DEFAULT_SETTINGS.deckN),
    meepleN: intIn(s && s.meepleN, 1, MAX_MEEPLES, DEFAULT_SETTINGS.meepleN),
  });
  // total number of tiles (start tile included) and meeples per player for some settings
  const deckTotalFor = s => (s.deck === 'custom' ? s.deckN : DECK_SIZES[s.deck].n);
  const meeplesFor = s => (s.meeples === 'custom' ? s.meepleN : MEEPLE_COUNTS[s.meeples].n);
  let deckTotal = 71;          // deck size at the start of the game (used by the computer)
  let turnTimer = null, turnDeadline = 0, turnLimitMs = 0;
  let animations = true;       // false for the "Animations: Off" setting
  function setAnimations(on) {
    animations = on;
    document.body.classList.toggle('no-anim', !on);
  }

  // Meeple animation: flies in from the right and lands on the board
  const MEEPLE_FLY_MS = 650, MEEPLE_LAND_MS = 380, MEEPLE_ANIM_MS = MEEPLE_FLY_MS + MEEPLE_LAND_MS;
  const meepleAnims = new Map();  // "x,y" -> start time
  const startMeepleAnim = (x, y) => { if (animations) meepleAnims.set(x + ',' + y, performance.now()); };

  // ...and once scored, it heads back to the right: a little hop, then an arc.
  const MEEPLE_HOP_MS = 240, MEEPLE_LEAVE_MS = 720, MEEPLE_OUT_MS = MEEPLE_HOP_MS + MEEPLE_LEAVE_MS;
  let leavingMeeples = [];        // {x, y (board coordinates), color, t0, showAt}
  let landingMeeples = [];        // {x, y, color, t0}: scored while still flying in, so they land first
  function startLeaveAnim(x, y, color, showAt = 0) {
    if (!animations) return;
    // when several leave at once, they go one after another (cascade)
    const now = performance.now();
    const queued = leavingMeeples.filter(a => a.t0 > now - 40).length;
    leavingMeeples.push({ x, y, color, showAt, t0: Math.max(now, showAt) + Math.min(queued * 80, 1200) });
  }
  // The game never waits for animations, so a meeple can be scored while it is still flying in:
  // then it finishes its landing first and only after that heads back to the right.
  function meepleScored(t, f, color) {
    const [px, py] = featurePos(t.type, f, t.rot);
    const k = key(t.x, t.y), t0 = meepleAnims.get(k);
    let showAt = 0;
    if (t0 !== undefined && animations) {
      landingMeeples.push({ x: t.x + px, y: t.y + py, color, t0 });
      meepleAnims.delete(k);
      showAt = t0 + MEEPLE_ANIM_MS;
    }
    startLeaveAnim(t.x + px, t.y + py, color, showAt);
  }
  // how long to wait before the final screen so every meeple can be seen leaving
  const finalDelay = () => (animations ? Math.max(1200, ...leavingMeeples.map(a => a.t0 + MEEPLE_OUT_MS - performance.now() + 300)) : 0);

  // Online: the host owns the game, clients receive the state and only send moves.
  const net = {
    role: 'local',            // local | host | client
    myId: 'local',            // who I am (players[i].owner === myId => my player)
    peer: null, ready: false,
    conns: new Map(),         // on the host: peerId -> connection
    host: null,               // on a client: the connection to the host
    code: '', seats: [], outbox: [], queued: false, aiCount: 0,
    sent: null,               // on the host: the board as last sent ("x,y" -> row), null = send it all
  };

  const key = (x, y) => x + ',' + y;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cleanName = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 14);
  const isMine = i => !!players[i] && !players[i].ai && players[i].owner === net.myId;
  const humanTurn = () => isMine(cur);
  const gameRunning = () => ['place', 'meeple', 'ai', 'wait'].includes(phase);
  const timeLabel = t => (t ? `${t} seconds` : 'No limit');
  const deckLeft = () => (net.role === 'client' ? remoteDeck : deck.length);
  const startTile = () => ({ x: 0, y: 0, type: START_TILE, rot: 0, meeple: null, by: -1, seed: 1 });

  // ================= Rules =================
  const edgeOf = (type, r, side) => TILE_DEFS[type].e[(side - r + 4) % 4];
  const featureAt = (t, side) => TILE_DEFS[t.type].sideFeature[(side - t.rot + 4) % 4];
  const rotSides = (f, r) => f.s.map(s => (s + r) % 4);
  const isOpposite = s => s.length === 2 && (s[0] + 2) % 4 === s[1];

  function fits(type, r, x, y) {
    if (board.has(key(x, y))) return false;
    let neighbours = 0;
    for (let s = 0; s < 4; s++) {
      const n = board.get(key(x + DX[s], y + DY[s]));
      if (!n) continue;
      neighbours++;
      if (edgeOf(type, r, s) !== edgeOf(n.type, n.rot, (s + 2) % 4)) return false;
    }
    return neighbours > 0;
  }

  function computeCandidates(type) {
    const empty = new Map();
    for (const t of board.values()) {
      for (let s = 0; s < 4; s++) {
        const x = t.x + DX[s], y = t.y + DY[s];
        const k = key(x, y);
        if (!board.has(k) && !empty.has(k)) empty.set(k, { x, y });
      }
    }
    const res = [];
    for (const c of empty.values()) {
      const rots = [0, 1, 2, 3].filter(r => fits(type, r, c.x, c.y));
      if (rots.length) res.push({ x: c.x, y: c.y, rots });
    }
    return res;
  }

  // Walks a structure (road / city) starting from feature fi of the tile at (x, y).
  function structureOf(x, y, fi) {
    const t0 = board.get(key(x, y));
    const f0 = TILE_DEFS[t0.type].f[fi];
    if (f0.t === 'monastery') {
      const tiles = [[x, y]];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if ((dx || dy) && board.has(key(x + dx, y + dy))) tiles.push([x + dx, y + dy]);
        }
      }
      const meeples = t0.meeple && t0.meeple.f === fi ? [{ x, y, f: fi, p: t0.meeple.p }] : [];
      return { kind: 'monastery', size: tiles.length, complete: tiles.length === 9, open: 9 - tiles.length,
        pennants: 0, meeples, tiles, visited: [x + ',' + y + ',' + fi] };
    }
    const visited = new Set([x + ',' + y + ',' + fi]);
    const tileKeys = new Set();
    const stack = [[x, y, fi]];
    const meeples = [];
    let open = 0, pennants = 0;
    while (stack.length) {
      const [cx, cy, cf] = stack.pop();
      const t = board.get(key(cx, cy));
      const f = TILE_DEFS[t.type].f[cf];
      tileKeys.add(key(cx, cy));
      if (f.p) pennants++;
      if (t.meeple && t.meeple.f === cf) meeples.push({ x: cx, y: cy, f: cf, p: t.meeple.p });
      for (const os of f.s) {
        const s = (os + t.rot) % 4;
        const nx = cx + DX[s], ny = cy + DY[s];
        const n = board.get(key(nx, ny));
        if (!n) { open++; continue; }
        const nf = featureAt(n, (s + 2) % 4);
        const vk = nx + ',' + ny + ',' + nf;
        if (!visited.has(vk)) { visited.add(vk); stack.push([nx, ny, nf]); }
      }
    }
    const tiles = [...tileKeys].map(k => k.split(',').map(Number));
    return { kind: f0.t, size: tiles.length, complete: open === 0, open, pennants, meeples, tiles, visited: [...visited] };
  }

  function pointsFor(st, endGame) {
    if (st.kind === 'road') return st.size;
    if (st.kind === 'city') return (st.size + st.pennants) * (endGame ? 1 : 2);
    return endGame ? st.size : 9;
  }

  function winnersOf(meeples) {
    const count = {};
    for (const m of meeples) count[m.p] = (count[m.p] || 0) + 1;
    const max = Math.max(...Object.values(count));
    return Object.keys(count).filter(p => count[p] === max).map(Number);
  }

  // Occupied structures that the tile at (x, y) has just completed.
  function findCompletions(x, y) {
    const res = [];
    const seen = new Set();
    const t = board.get(key(x, y));
    TILE_DEFS[t.type].f.forEach((f, fi) => {
      if (f.t === 'monastery' || seen.has(x + ',' + y + ',' + fi)) return;
      const st = structureOf(x, y, fi);
      st.visited.forEach(v => seen.add(v));
      if (st.complete && st.meeples.length) res.push(st);
    });
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const n = board.get(key(x + dx, y + dy));
        if (!n || !n.meeple || TILE_DEFS[n.type].f[n.meeple.f].t !== 'monastery') continue;
        const st = structureOf(n.x, n.y, n.meeple.f);
        if (st.complete) res.push(st);
      }
    }
    return res;
  }

  function computeMeepleSpots(t) {
    if (players[cur].meeples <= 0) return [];
    const spots = [];
    TILE_DEFS[t.type].f.forEach((f, fi) => {
      if (structureOf(t.x, t.y, fi).meeples.length === 0) spots.push({ fi, pos: featurePos(t.type, fi, t.rot) });
    });
    return spots;
  }

  // ================= Game flow =================
  // How many tiles of each type make up a game with `total` tiles: the base set scaled up or down
  // (largest remainder), always with the start tile, and with every type once there is room for all.
  function deckComposition(total) {
    const ids = Object.keys(TILE_DEFS);
    const base = ids.reduce((sum, id) => sum + TILE_DEFS[id].n, 0);
    const counts = {}, rest = [];
    let used = 0;
    for (const id of ids) {
      const exact = TILE_DEFS[id].n * total / base;
      counts[id] = Math.floor(exact);
      used += counts[id];
      rest.push({ id, frac: exact - counts[id] });
    }
    rest.sort((a, b) => b.frac - a.frac);
    for (let i = 0; used < total; i++, used++) counts[rest[i % rest.length].id]++;
    for (const id of ids) {
      const min = total >= ids.length || id === START_TILE ? 1 : 0;
      while (counts[id] < min) {
        const big = ids.reduce((a, b) => (counts[b] > counts[a] ? b : a));
        counts[big]--;
        counts[id]++;
      }
    }
    return counts;
  }

  function buildDeck(total) {
    const counts = deckComposition(total);
    counts[START_TILE]--; // already on the board
    const d = [];
    for (const id in counts) {
      for (let i = 0; i < counts[id]; i++) d.push(id);
    }
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  // cfg: [{name, ai, owner}] – owner = who controls the player ('local', 'host' or a client's id)
  // settings: {deck, meeples, time, anim, deckN, meepleN} – see DEFAULT_SETTINGS
  function newGame(cfg, settings) {
    gameId++;
    const s = cleanSettings(settings);
    turnTime = s.time;
    setAnimations(s.anim !== 'off');
    net.sent = null;
    meepleAnims.clear();
    leavingMeeples = []; landingMeeples = [];
    players = cfg.slice(0, MAX_PLAYERS).map((c, i) => ({
      name: cleanName(c.name) || `Player ${i + 1}`, ai: !!c.ai, color: PLAYER_COLORS[i],
      score: 0, meeples: meeplesFor(s), owner: c.ai ? null : (c.owner || 'local'),
    }));
    board = new Map([[key(0, 0), startTile()]]);
    deck = buildDeck(deckTotalFor(s));
    deckTotal = deck.length;
    cur = 0; turnNo = 0; lastPlaced = null; placed = null; pending = null;
    popups = []; flashes = [];
    logEl.innerHTML = '';
    log(['New game! ', { p: 0 }, ' goes first.'], 'sep');
    log([settingsSummary(s)]);
    closeModal();
    fitView(false);
    startTurn();
  }

  function startTurn() {
    pending = null; placed = null; meepleSpots = [];
    tile = null;
    turnNo++;
    while (deck.length && !tile) {
      const t = deck.pop();
      const c = computeCandidates(t);
      if (c.length) {
        tile = t; candidates = c; rot = 0;
      } else {
        log(['A tile did not fit anywhere and was removed from the game.']);
        emit({ k: 'toast', text: 'The tile fits nowhere – drawing another one' });
      }
    }
    if (!tile) { endGame(); return; }
    startTurnTimer();
    if (players[cur].ai) {
      phase = 'ai';
      updateUI();
      runAI();
      return;
    }
    phase = 'place';
    updateUI();
    if (isMine(cur)) {
      if (net.role !== 'local') toast('Your turn!');
      else if (players.filter(p => !p.ai).length > 1) toast(`${players[cur].name}'s turn`);
    }
  }

  function placeTile() {
    const t = { x: pending.x, y: pending.y, type: tile, rot, meeple: null, by: cur, seed: Math.floor(Math.random() * 1e6) };
    board.set(key(t.x, t.y), t);
    placed = t;
    pending = null;
    meepleSpots = computeMeepleSpots(t);
  }

  function finishTurn() {
    for (const st of findCompletions(placed.x, placed.y)) applyScore(st, false);
    lastPlaced = placed;
    placed = null;
    meepleSpots = [];
    cur = (cur + 1) % players.length;
    startTurn();
  }

  function applyScore(st, endGame) {
    const pts = pointsFor(st, endGame);
    const winners = winnersOf(st.meeples);
    for (const p of winners) {
      players[p].score += pts;
      const m = st.meeples.find(mm => mm.p === p);
      const t = board.get(key(m.x, m.y));
      const [px, py] = featurePos(t.type, m.f, t.rot);
      emit({ k: 'pop', x: m.x + px, y: m.y + py - 0.2, text: '+' + pts, color: players[p].color });
    }
    emit({ k: 'flash', tiles: st.tiles, color: players[winners[0]].color });
    for (const m of st.meeples) {
      const t = board.get(key(m.x, m.y));
      meepleScored(t, m.f, players[m.p].color);
      t.meeple = null;
      players[m.p].meeples++;
    }
    const what = endGame ? KIND[st.kind].open : KIND[st.kind].done;
    let extra = st.kind === 'monastery' && !endGame ? '' : tilesText(st.size);
    if (st.pennants) extra += `, ${st.pennants} ${st.pennants === 1 ? 'pennant' : 'pennants'}`;
    const parts = [];
    winners.forEach((p, i) => { if (i) parts.push(' & '); parts.push({ p }); });
    parts.push(` +${pts} · ${what}${extra ? ` (${extra})` : ''}`);
    log(parts);
  }

  function endGame() {
    stopTurnTimer();
    phase = 'over';
    tile = null; pending = null;
    log(['The deck is empty – final scoring'], 'sep');
    for (const t of board.values()) {
      if (t.meeple) applyScore(structureOf(t.x, t.y, t.meeple.f), true);
    }
    updateUI();
    const id = gameId;
    setTimeout(() => { if (id === gameId) showFinal(); }, finalDelay());
  }

  // ================= Player actions =================
  // Clicking a gold spot places the tile right away. Then: click the tile = rotate, click another spot = move,
  // click a circle = meeple, "No meeple" = end the turn.
  // On a client, actions go to the host; the host applies them and sends back the new state.
  function nextRot(rots, r) {
    for (let k = 1; k <= 4; k++) if (rots.includes((r + k) % 4)) return (r + k) % 4;
    return r;
  }
  const candidateAt = (x, y) => candidates.find(c => c.x === x && c.y === y);

  function rotateAction() {
    if (!isMine(cur)) return;
    if (phase === 'place') {
      rot = (rot + 1) % 4;
      updateUI();
    } else if (phase === 'meeple') {
      if (net.role === 'client') sendAct({ a: 'rotate' });
      else doRotatePlaced();
    }
  }

  function doRotatePlaced() {
    const c = candidateAt(placed.x, placed.y);
    if (c) placed.rot = rot = nextRot(c.rots, placed.rot);
    meepleSpots = computeMeepleSpots(placed);
    updateUI();
  }

  function placeAt(x, y, r) {
    if (net.role === 'client') {
      pending = { x, y };
      rot = r;
      sendAct({ a: 'place', x, y, rot: r });
    } else {
      doPlace(x, y, r);
    }
  }

  // Places (or moves) the current tile; the turn stays open for rotating and the meeple choice.
  function doPlace(x, y, r) {
    if (placed) board.delete(key(placed.x, placed.y));
    pending = { x, y };
    rot = r;
    placeTile();
    phase = 'meeple';
    updateUI();
  }

  function undoAction() {
    if (phase !== 'meeple' || !isMine(cur)) return;
    if (net.role === 'client') sendAct({ a: 'undo' });
    else doUndo();
  }

  // Takes the tile off the board and back into your hand (same rotation).
  function doUndo() {
    board.delete(key(placed.x, placed.y));
    rot = placed.rot;
    placed = null;
    pending = null;
    meepleSpots = [];
    phase = 'place';
    updateUI();
  }

  function skipAction() {
    if (phase !== 'meeple' || !isMine(cur)) return;
    if (net.role === 'client') sendAct({ a: 'skip' });
    else finishTurn();
  }

  function chooseMeeple(fi) {
    if (net.role === 'client') sendAct({ a: 'meeple', fi });
    else doMeeple(fi);
  }

  // The meeple flies onto the board just for show: the turn goes on right away.
  function doMeeple(fi) {
    putMeeple(fi);
    finishTurn();
  }

  function putMeeple(fi) {
    placed.meeple = { p: cur, f: fi };
    players[cur].meeples--;
    startMeepleAnim(placed.x, placed.y);
  }

  function handleClick(sx, sy) {
    if (!humanTurn() || (phase !== 'place' && phase !== 'meeple')) return;
    if (phase === 'meeple') {
      const sp = spotAt(sx, sy);
      if (sp) { chooseMeeple(sp.fi); return; }
    }
    const { x, y } = cellAt(sx, sy);
    if (placed && placed.x === x && placed.y === y) { rotateAction(); return; }
    const c = candidateAt(x, y);
    if (c) placeAt(x, y, c.rots.includes(rot) ? rot : nextRot(c.rots, rot));
  }

  // ---------- Turn timer ----------
  function startTurnTimer() {
    clearTimeout(turnTimer);
    turnLimitMs = turnTime * 1000;
    turnDeadline = 0;
    if (!turnLimitMs || !players[cur] || players[cur].ai) return;
    turnDeadline = performance.now() + turnLimitMs;
    const id = gameId, t = turnNo;
    turnTimer = setTimeout(() => { if (id === gameId && t === turnNo) onTimeout(); }, turnLimitMs);
  }

  function stopTurnTimer() {
    clearTimeout(turnTimer);
    turnDeadline = 0;
  }

  // Time is up: the tile is placed automatically (no meeple) and the turn moves on.
  function onTimeout() {
    if (phase !== 'place' && phase !== 'meeple') return;
    if (phase === 'place') {
      const mv = aiChooseMove(false);
      pending = { x: mv.x, y: mv.y };
      rot = mv.rot;
      placeTile();
    }
    log([{ p: cur }, ' ran out of time.']);
    emit({ k: 'toast', text: `Time's up for ${players[cur].name}!` });
    finishTurn();
  }

  // ================= Computer player =================
  // The computer moves instantly; its meeples still fly in and out on screen (animations never hold up the game).
  let aiPumping = false;
  function runAI() {
    if (!aiPumping) { aiPumping = true; const id = gameId; setTimeout(() => pumpAI(id), 0); }
  }

  // Plays computer turns one after another for ~12 ms, then lets the page draw and carries on.
  // aiPumping stays true while a turn runs, so the runAI() of the next computer turn doesn't queue another pump.
  function pumpAI(id) {
    const until = performance.now() + 12;
    while (id === gameId && phase === 'ai') {
      const mv = aiChooseMove(true);
      rot = mv.rot;
      pending = { x: mv.x, y: mv.y };
      placeTile();
      if (mv.f !== null) putMeeple(mv.f);
      finishTurn();
      if (performance.now() > until) break;
    }
    aiPumping = false;
    // still the computer's turn (in this game or in a new game started meanwhile): keep going
    if (phase === 'ai') runAI();
  }

  // Tries every spot, rotation and meeple option. The occupied structures of the board are valued once
  // (aiBaseline); for each option only the structures touching the new tile are walked again, so the
  // computer stays fast on very big boards.
  function aiChooseMove(allowMeeple) {
    const me = cur;
    const base = aiBaseline();
    const feats = TILE_DEFS[tile].f;
    let best = null, bestVal = -Infinity;
    for (const c of candidates) {
      for (const r of c.rots) {
        const t = { x: c.x, y: c.y, type: tile, rot: r, meeple: null };
        const k = key(c.x, c.y);
        board.set(k, t);
        // structures through the new tile; two features of one tile can join into the same structure
        const sts = feats.map((f, fi) => structureOf(c.x, c.y, fi));
        const rep = feats.map((f, fi) => {
          const self = c.x + ',' + c.y + ',' + fi;
          for (let j = 0; j < fi; j++) if (sts[j].visited.includes(self)) return j;
          return fi;
        });
        const near = nearMonasteries(c.x, c.y);
        const options = [null];
        if (allowMeeple && players[me].meeples > 0) {
          sts.forEach((st, fi) => { if (st.meeples.length === 0) options.push(fi); });
        }
        for (const fi of options) {
          const v = evaluate(me, fi, sts, rep, near, base) + Math.random() * 0.3;
          if (v > bestVal) { bestVal = v; best = { x: c.x, y: c.y, rot: r, f: fi }; }
        }
        board.delete(k);
      }
    }
    return best;
  }

  // Occupied monasteries around (not on) the tile at (x, y), walked with that tile on the board.
  function nearMonasteries(x, y) {
    const res = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const n = (dx || dy) && board.get(key(x + dx, y + dy));
        if (n && n.meeple && TILE_DEFS[n.type].f[n.meeple.f].t === 'monastery') res.push(structureOf(n.x, n.y, n.meeple.f));
      }
    }
    return res;
  }

  // Expected value of an unfinished, occupied structure for its owners.
  function projValue(st) {
    const late = Math.min(1, deck.length / 20);
    if (st.kind === 'road') return st.size + 1.2 * late;
    if (st.kind === 'city') {
      const chance = (st.open <= 1 ? 0.75 : st.open <= 2 ? 0.55 : st.open <= 4 ? 0.35 : 0.2) * late;
      return (st.size + st.pennants) * (1 + chance) + 1.5 * late;
    }
    return st.size + (9 - st.size) * 0.55 * late;
  }

  // Every occupied structure on the board right now: its value, owners and which features belong to it.
  function aiBaseline() {
    const structs = [];
    const featStruct = new Map();   // "x,y,f" -> index in structs
    const proj = players.map(() => 0);
    for (const b of board.values()) {
      if (!b.meeple || featStruct.has(b.x + ',' + b.y + ',' + b.meeple.f)) continue;
      const st = structureOf(b.x, b.y, b.meeple.f);
      const s = { val: projValue(st), winners: winnersOf(st.meeples) };
      st.visited.forEach(v => featStruct.set(v, structs.length));
      structs.push(s);
      s.winners.forEach(p => (proj[p] += s.val));
    }
    return { structs, featStruct, proj };
  }

  // How good the position is for "me" compared with the best opponent, after placing the tile
  // (structures sts, nearby monasteries near) with a meeple on feature mfi (or none).
  function evaluate(me, mfi, sts, rep, near, base) {
    const score = players.map(p => p.score);
    const hand = players.map(p => p.meeples);
    const proj = base.proj.slice();
    const dropped = new Set();
    // a structure of the baseline that the new tile changed: forget its old value
    const drop = i => {
      if (i === undefined || dropped.has(i)) return;
      dropped.add(i);
      base.structs[i].winners.forEach(p => (proj[p] -= base.structs[i].val));
    };
    const count = (st, extra) => {
      const meeples = extra ? st.meeples.concat(extra) : st.meeples;
      if (!meeples.length) return;
      const winners = winnersOf(meeples);
      if (st.complete) {
        const pts = pointsFor(st, false);
        winners.forEach(p => (score[p] += pts));
        meeples.forEach(m => hand[m.p]++);
      } else {
        const val = projValue(st);
        winners.forEach(p => (proj[p] += val));
      }
    };
    if (mfi !== null) hand[me]--;
    sts.forEach((st, fi) => {
      if (rep[fi] !== fi) return;
      st.visited.forEach(v => drop(base.featStruct.get(v)));
      count(st, mfi !== null && rep[mfi] === fi ? { p: me } : null);
    });
    for (const st of near) {
      drop(base.featStruct.get(st.visited[0]));
      count(st, null);
    }
    const meepleWorth = 0.4 + 1.6 * (deck.length / Math.max(1, deckTotal));
    const total = score.map((s, i) => s + proj[i] + hand[i] * meepleWorth * (hand[i] <= 2 ? 1.5 : 1));
    let opp = -Infinity;
    total.forEach((v, i) => { if (i !== me && v > opp) opp = v; });
    return total[me] - opp;
  }

  // ================= Drawing tiles =================
  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sumDir(s) {
    let x = 0, y = 0;
    for (const k of s) { x += DIR[k][0]; y += DIR[k][1]; }
    return [x, y];
  }

  // Where the meeple stands on a feature (tile coordinates, -0.5..0.5).
  function featurePos(type, fi, r) {
    const f = TILE_DEFS[type].f[fi];
    if (f.t === 'monastery') return [0, 0.02];
    const s = rotSides(f, r);
    if (f.t === 'road') {
      if (s.length === 1) return [DIR[s[0]][0] * 0.32, DIR[s[0]][1] * 0.32];
      if (isOpposite(s)) return [0, 0];
      const [x, y] = sumDir(s);
      return [x * 0.14, y * 0.14];
    }
    if (s.length === 4 || isOpposite(s)) return [0, 0];
    if (s.length === 1) return [DIR[s[0]][0] * 0.35, DIR[s[0]][1] * 0.35];
    const [x, y] = sumDir(s);
    return s.length === 2 ? [x * 0.17, y * 0.17] : [x * 0.12, y * 0.12];
  }

  function pennantPos(s) {
    if (s.length === 4) return [0.26, -0.26];
    if (isOpposite(s)) return [DIR[s[0]][0] * 0.32, DIR[s[0]][1] * 0.32];
    const [x, y] = sumDir(s);
    if (s.length === 2) return [x * 0.37, 0];
    return [x * 0.3 - y * 0.24, y * 0.3 + x * 0.24];
  }

  function roadPath(ctx, s) {
    ctx.beginPath();
    const ax = DIR[s[0]][0] * 0.5, ay = DIR[s[0]][1] * 0.5;
    ctx.moveTo(ax, ay);
    if (s.length === 1) { ctx.lineTo(0, 0); return; }
    const bx = DIR[s[1]][0] * 0.5, by = DIR[s[1]][1] * 0.5;
    if (isOpposite(s)) ctx.lineTo(bx, by);
    else ctx.quadraticCurveTo(0, 0, bx, by);
  }

  function drawRoad(ctx, s) {
    ctx.lineCap = 'butt';
    roadPath(ctx, s);
    ctx.strokeStyle = COL.roadEdge; ctx.lineWidth = 0.14; ctx.stroke();
    roadPath(ctx, s);
    ctx.strokeStyle = COL.road; ctx.lineWidth = 0.095; ctx.stroke();
  }

  function drawCity(ctx, s) {
    let shape, k = 0;
    if (s.length === 4) shape = 'full';
    else if (s.length === 1) { shape = 'cap'; k = s[0]; }
    else if (s.length === 3) { shape = 'three'; k = ([0, 1, 2, 3].find(x => !s.includes(x)) + 2) % 4; }
    else if (isOpposite(s)) { shape = 'band'; k = s.includes(0) ? 0 : 1; }
    else { shape = 'corner'; k = s.find(x => s.includes((x + 3) % 4)); }

    ctx.save();
    ctx.rotate(k * Math.PI / 2);
    // the base shape is drawn for the canonical orientation, then rotated
    ctx.beginPath();
    switch (shape) {
      case 'full': ctx.rect(-0.5, -0.5, 1, 1); break;
      case 'cap':
        ctx.moveTo(-0.5, -0.5); ctx.lineTo(0.5, -0.5);
        ctx.quadraticCurveTo(0, 0.1, -0.5, -0.5); break;
      case 'band':
        ctx.moveTo(-0.5, -0.5); ctx.lineTo(0.5, -0.5);
        ctx.quadraticCurveTo(0.1, 0, 0.5, 0.5); ctx.lineTo(-0.5, 0.5);
        ctx.quadraticCurveTo(-0.1, 0, -0.5, -0.5); break;
      case 'corner':
        ctx.moveTo(-0.5, -0.5); ctx.lineTo(0.5, -0.5);
        ctx.quadraticCurveTo(0.05, 0.05, -0.5, 0.5); break;
      case 'three':
        ctx.moveTo(-0.5, -0.5); ctx.lineTo(0.5, -0.5); ctx.lineTo(0.5, 0.5);
        ctx.quadraticCurveTo(0, -0.1, -0.5, 0.5); break;
    }
    ctx.closePath();
    ctx.fillStyle = COL.city;
    ctx.fill();

    // the walls (only towards the field)
    ctx.beginPath();
    switch (shape) {
      case 'cap': ctx.moveTo(0.5, -0.5); ctx.quadraticCurveTo(0, 0.1, -0.5, -0.5); break;
      case 'band':
        ctx.moveTo(0.5, -0.5); ctx.quadraticCurveTo(0.1, 0, 0.5, 0.5);
        ctx.moveTo(-0.5, 0.5); ctx.quadraticCurveTo(-0.1, 0, -0.5, -0.5); break;
      case 'corner': ctx.moveTo(0.5, -0.5); ctx.quadraticCurveTo(0.05, 0.05, -0.5, 0.5); break;
      case 'three': ctx.moveTo(0.5, 0.5); ctx.quadraticCurveTo(0, -0.1, -0.5, 0.5); break;
    }
    ctx.strokeStyle = COL.wall;
    ctx.lineWidth = 0.05;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawHouse(ctx, w, h) {
    ctx.lineWidth = 0.018;
    ctx.strokeStyle = COL.dark;
    ctx.fillStyle = COL.stone;
    ctx.beginPath(); ctx.rect(-w / 2, 0, w, h); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w / 2 - 0.03, 0); ctx.lineTo(0, -h * 0.85); ctx.lineTo(w / 2 + 0.03, 0); ctx.closePath();
    ctx.fillStyle = COL.roof; ctx.fill(); ctx.stroke();
  }

  function drawMonastery(ctx) {
    ctx.save();
    ctx.translate(0, -0.04);
    drawHouse(ctx, 0.3, 0.19);
    ctx.fillStyle = COL.dark;
    ctx.fillRect(-0.03, 0.08, 0.06, 0.11);
    ctx.beginPath();
    ctx.moveTo(0, -0.16); ctx.lineTo(0, -0.27);
    ctx.moveTo(-0.04, -0.225); ctx.lineTo(0.04, -0.225);
    ctx.lineWidth = 0.022; ctx.strokeStyle = COL.dark; ctx.stroke();
    ctx.restore();
  }

  function drawVillage(ctx) {
    ctx.save();
    ctx.translate(0, -0.02);
    drawHouse(ctx, 0.13, 0.1);
    ctx.restore();
  }

  function drawPennant(ctx, [x, y]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(-0.06, -0.065); ctx.lineTo(0.06, -0.065); ctx.lineTo(0.06, 0.01);
    ctx.quadraticCurveTo(0.06, 0.06, 0, 0.085);
    ctx.quadraticCurveTo(-0.06, 0.06, -0.06, 0.01);
    ctx.closePath();
    ctx.fillStyle = COL.pennant; ctx.fill();
    ctx.strokeStyle = '#f7f1df'; ctx.lineWidth = 0.016; ctx.stroke();
    ctx.restore();
  }

  function drawTile(ctx, type, r, cx, cy, size, seed) {
    const d = TILE_DEFS[type];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(size, size);
    ctx.beginPath(); ctx.rect(-0.5, -0.5, 1, 1); ctx.clip();

    ctx.fillStyle = COL.field;
    ctx.fillRect(-0.5, -0.5, 1, 1);
    const rand = rng(seed || 7);
    ctx.strokeStyle = COL.tuft; ctx.lineWidth = 0.018; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const x = rand() * 0.9 - 0.45, y = rand() * 0.9 - 0.45;
      ctx.moveTo(x - 0.025, y - 0.03); ctx.lineTo(x, y); ctx.lineTo(x + 0.025, y - 0.03);
    }
    ctx.stroke();

    for (const f of d.f) if (f.t === 'road') drawRoad(ctx, rotSides(f, r));
    if (d.roadCount >= 3) drawVillage(ctx);
    for (const f of d.f) if (f.t === 'city') drawCity(ctx, rotSides(f, r));
    if (d.monastery) drawMonastery(ctx);
    for (const f of d.f) if (f.p) drawPennant(ctx, pennantPos(rotSides(f, r)));

    ctx.strokeStyle = 'rgba(40, 30, 10, 0.35)';
    ctx.lineWidth = 0.014;
    ctx.strokeRect(-0.5, -0.5, 1, 1);
    ctx.restore();
  }

  // The meeple outline (head + body) centered at (x, y) with the given size; p is a context or a Path2D.
  const MEEPLE_BODY = [[-0.46, -0.06], [-0.46, 0.07], [-0.17, 0.08], [-0.34, 0.48], [-0.08, 0.48], [0, 0.3],
    [0.08, 0.48], [0.34, 0.48], [0.17, 0.08], [0.46, 0.07], [0.46, -0.06], [0.13, -0.15]];
  function meepleShape(p, x, y, s) {
    p.moveTo(x + 0.17 * s, y - 0.3 * s);
    p.arc(x, y - 0.3 * s, 0.17 * s, 0, Math.PI * 2);
    p.moveTo(x - 0.13 * s, y - 0.15 * s);
    for (const [px, py] of MEEPLE_BODY) p.lineTo(x + px * s, y + py * s);
    p.closePath();
  }
  const meepleOutline = color => (isDark(color) ? 'rgba(250, 244, 230, 0.95)' : 'rgba(20, 14, 8, 0.9)');

  // o = {angle, sx, sy}: tilt and squash, anchored at the feet (for the landing)
  function drawMeeple(ctx, x, y, size, color, alpha = 1, o = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y + size * 0.48);
    if (o.angle) ctx.rotate(o.angle);
    ctx.scale(size * (o.sx || 1), size * (o.sy || 1));
    ctx.translate(0, -0.48);
    ctx.beginPath();
    meepleShape(ctx, 0, 0, 1);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.16;
    ctx.strokeStyle = meepleOutline(color);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fill();
    // a small shine on the head
    ctx.globalAlpha = alpha * 0.45;
    ctx.beginPath();
    ctx.arc(-0.05, -0.35, 0.06, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }

  function drawMeepleShadow(ctx, x, footY, size, alpha, spread = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#1a1208';
    ctx.beginPath();
    ctx.ellipse(x, footY, size * 0.42 * spread, size * 0.13 * spread, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // The meeple arcs in from the right of the board, squashes on landing and kicks up a little dust.
  function drawFlyingMeeple(ctx, tx, ty, size, color, elapsed) {
    const footY = ty + size * 0.48;
    if (elapsed < MEEPLE_FLY_MS) {
      const t = elapsed / MEEPLE_FLY_MS;
      const e = 1 - Math.pow(1 - t, 3);
      const sx = W + size * 1.5, sy = Math.max(size, ty - size * 4);
      const cx = (sx + tx) / 2, cy = Math.min(sy, ty) - size * 3.5;
      const x = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * cx + e * e * tx;
      const y = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * cy + e * e * ty;
      drawMeepleShadow(ctx, tx, footY, size, 0.35 * e, 0.5 + 0.5 * e);
      drawMeeple(ctx, x, y, size * (1.45 - 0.45 * e), color, 1, { angle: -1.1 * (1 - e) });
      return;
    }
    const s = Math.min(1, (elapsed - MEEPLE_FLY_MS) / MEEPLE_LAND_MS);
    const bounce = Math.cos(s * Math.PI * 3) * Math.pow(1 - s, 2);
    // dust: a widening ring and a few specks flying sideways
    ctx.save();
    ctx.globalAlpha = 0.7 * (1 - s);
    ctx.strokeStyle = '#fff6dc';
    ctx.lineWidth = Math.max(1.5, size * 0.08);
    const rr = size * (0.45 + 1.1 * s);
    ctx.beginPath();
    ctx.ellipse(tx, footY, rr, rr * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f3e7c6';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const d = size * (0.35 + 1.25 * s);
      const lift = size * 0.55 * Math.sin(s * Math.PI) * (i % 2 ? 1 : 0.6);
      ctx.beginPath();
      ctx.arc(tx + Math.cos(a) * d, footY + Math.sin(a) * d * 0.32 - lift, Math.max(1, size * 0.07 * (1 - s)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    drawMeepleShadow(ctx, tx, footY, size, 0.35, 1 + 0.15 * bounce);
    drawMeeple(ctx, tx, ty, size, color, 1, { sx: 1 + 0.22 * bounce, sy: 1 - 0.28 * bounce });
  }

  // The way back: a scored meeple crouches, hops and flies in an arc to the right of the board.
  function drawLeavingMeeple(ctx, tx, ty, size, color, elapsed) {
    const footY = ty + size * 0.48;
    if (elapsed < 0) {                 // waiting for its turn in the cascade
      drawMeepleShadow(ctx, tx, footY, size, 0.3);
      drawMeeple(ctx, tx, ty, size, color);
      return;
    }
    if (elapsed < MEEPLE_HOP_MS) {
      const s = elapsed / MEEPLE_HOP_MS;
      const crouch = Math.sin(Math.min(1, s / 0.7) * Math.PI);    // squashes and springs back
      const stretch = s > 0.7 ? (s - 0.7) / 0.3 : 0;               // then stretches as it takes off
      // glowing ring in the player's color
      ctx.save();
      ctx.globalAlpha = 0.85 * (1 - s);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, size * 0.1);
      const rr = size * (0.35 + 0.9 * s);
      ctx.beginPath();
      ctx.ellipse(tx, footY, rr, rr * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawMeepleShadow(ctx, tx, footY, size, 0.3, 1 + 0.15 * crouch);
      drawMeeple(ctx, tx, ty, size, color, 1, { sx: 1 + 0.2 * crouch - 0.08 * stretch, sy: 1 - 0.25 * crouch + 0.15 * stretch });
      return;
    }
    const t = Math.min(1, (elapsed - MEEPLE_HOP_MS) / MEEPLE_LEAVE_MS);
    const ex = W + size * 1.5, ey = Math.max(size, ty - size * 4);
    const cx = (tx + ex) / 2, cy = Math.min(ty, ey) - size * 3.5;
    const at = k => {
      const e = k * k * (1.4 - 0.4 * k);    // starts gently and speeds up towards the edge
      return [
        (1 - e) * (1 - e) * tx + 2 * (1 - e) * e * cx + e * e * ex,
        (1 - e) * (1 - e) * ty + 2 * (1 - e) * e * cy + e * e * ey,
        e,
      ];
    };
    drawMeepleShadow(ctx, tx, footY, size, 0.3 * (1 - t), 1 - 0.5 * t);
    // a trail of sparkles behind it
    ctx.save();
    ctx.fillStyle = color;
    for (let i = 1; i <= 4; i++) {
      const k = t - i * 0.05;
      if (k <= 0) break;
      const [x, y] = at(k);
      ctx.globalAlpha = 0.55 * (1 - i / 5);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.5, size * (0.12 - i * 0.02)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    const [x, y, e] = at(t);
    drawMeeple(ctx, x, y, size * (1 + 0.45 * e), color, 1, { angle: 1.1 * e });
  }

  // ================= Board (canvas) =================
  const wrap = document.getElementById('boardWrap');
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const preview = document.getElementById('preview');
  const pctx = preview.getContext('2d');
  const cam = { x: 0, y: 0, size: 84 };
  let camAnim = null;
  let W = 0, H = 0, dpr = 1;
  let dirty = true;
  let hover = null, hoverPx = null;

  function resize() {
    const r = wrap.getBoundingClientRect();
    const first = W === 0;
    const oldW = W, oldH = H;
    dpr = window.devicePixelRatio || 1;
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (first) fitView(false);
    else { cam.x += (W - oldW) / 2; cam.y += (H - oldH) / 2; }
    const ps = preview.getBoundingClientRect().width || 110;
    preview.width = Math.round(ps * dpr);
    preview.height = Math.round(ps * dpr);
    drawPreview();
    dirty = true;
  }

  function cellAt(sx, sy) {
    return { x: Math.round((sx - cam.x) / cam.size), y: Math.round((sy - cam.y) / cam.size) };
  }

  function spotAt(sx, sy) {
    if (phase !== 'meeple' || !placed) return null;
    const S = cam.size;
    let best = null, bestD = Math.max(18, S * 0.2);
    for (const sp of meepleSpots) {
      const px = cam.x + (placed.x + sp.pos[0]) * S, py = cam.y + (placed.y + sp.pos[1]) * S;
      const d = Math.hypot(px - sx, py - sy);
      if (d < bestD) { bestD = d; best = sp; }
    }
    return best;
  }

  function bounds() {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of board.values()) {
      minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x);
      minY = Math.min(minY, t.y); maxY = Math.max(maxY, t.y);
    }
    if (minX === Infinity) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    return { minX, maxX, minY, maxY };
  }

  function fitView(animate) {
    if (!W) return;
    const b = bounds();
    const w = b.maxX - b.minX + 3, h = b.maxY - b.minY + 3;
    const size = clamp(Math.min(W / w, H / h, 96), minZoom(), MAX_SIZE);
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const target = { x: W / 2 - cx * size, y: H / 2 - cy * size, size };
    if (animate && animations) camAnim = { from: { ...cam }, to: target, t0: performance.now() };
    else Object.assign(cam, target);
    dirty = true;
  }

  function ensureVisible(x, y) {
    const S = cam.size, sx = cam.x + x * S, sy = cam.y + y * S, m = S * 0.7;
    if (sx < m || sx > W - m || sy < m || sy > H - m) {
      const to = { x: W / 2 - x * S, y: H / 2 - y * S, size: S };
      if (animations) camAnim = { from: { ...cam }, to, t0: performance.now() };
      else { camAnim = null; Object.assign(cam, to); dirty = true; }
    }
  }

  function zoomAt(sx, sy, factor) {
    const ns = clamp(cam.size * factor, minZoom(), MAX_SIZE);
    const wx = (sx - cam.x) / cam.size, wy = (sy - cam.y) / cam.size;
    cam.size = ns;
    cam.x = sx - wx * ns;
    cam.y = sy - wy * ns;
    camAnim = null;
    dirty = true;
  }

  // a rounded rectangle added to c (a context or a Path2D)
  function roundRectPath(c, x, y, w, h, r) {
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // ================= Board chunks =================
  // The board is painted in chunks of CHUNK × CHUNK tiles. A chunk runs drawTile once for each of its
  // tiles against a PathRecorder, which gathers everything into a few big Path2D objects (one per
  // color and line style) in board units. Panning and zooming then only repaint those paths with the
  // camera transform: crisp at any zoom and smooth even with thousands of tiles on screen. A chunk is
  // recorded again only when its tiles change (a cheap hash of them is checked every frame).
  const CHUNK = 10, CHUNK_BUDGET_MS = 8;
  const chunks = new Map();          // chunk id -> {hash, layers: [{fill, style, width, cap, minSize, path}]}
  let chunksBehind = false;          // some chunks still wait to be recorded (done over the next frames)

  // A stand-in for a 2D context: it follows the transforms and records every fill / stroke into the
  // Path2D of its style. Tiles never overlap, so clip() has nothing to do.
  class PathRecorder {
    constructor() {
      this.layers = new Map();
      this.m = [1, 0, 0, 1, 0, 0];
      this.stack = [];
      this.cmds = [];
      this.fillStyle = '#000'; this.strokeStyle = '#000'; this.lineWidth = 1; this.lineCap = 'butt';
    }
    save() { this.stack.push(this.m.slice()); }
    restore() { this.m = this.stack.pop() || [1, 0, 0, 1, 0, 0]; }
    translate(x, y) { const m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; }
    scale(sx, sy) { const m = this.m; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; }
    rotate(a) {
      const m = this.m, c = Math.cos(a), s = Math.sin(a), [a0, b0, c0, d0] = m;
      m[0] = a0 * c + c0 * s; m[1] = b0 * c + d0 * s; m[2] = c0 * c - a0 * s; m[3] = d0 * c - b0 * s;
    }
    pt(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
    beginPath() { this.cmds = []; }
    moveTo(x, y) { this.cmds.push(0, ...this.pt(x, y)); }
    lineTo(x, y) { this.cmds.push(1, ...this.pt(x, y)); }
    quadraticCurveTo(cx, cy, x, y) { this.cmds.push(2, ...this.pt(cx, cy), ...this.pt(x, y)); }
    closePath() { this.cmds.push(3); }
    rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
    clip() {}
    fill() { this.add(true, this.fillStyle, 0, ''); }
    stroke() { this.add(false, this.strokeStyle, this.lineWidth * Math.hypot(this.m[0], this.m[1]), this.lineCap); }
    fillRect(x, y, w, h) { const keep = this.cmds; this.cmds = []; this.rect(x, y, w, h); this.fill(); this.cmds = keep; }
    strokeRect(x, y, w, h) { const keep = this.cmds; this.cmds = []; this.rect(x, y, w, h); this.stroke(); this.cmds = keep; }
    add(fill, style, width, cap) {
      const k = (fill ? 'f' : 's') + style + '|' + width + '|' + cap;
      let l = this.layers.get(k);
      if (!l) {
        // the grass tufts are left out once tiles get small
        l = { fill, style, width, cap, minSize: style === COL.tuft ? 18 : 0, path: new Path2D() };
        this.layers.set(k, l);
      }
      const c = this.cmds, p = l.path;
      for (let i = 0; i < c.length;) {
        if (c[i] === 0) { p.moveTo(c[i + 1], c[i + 2]); i += 3; }
        else if (c[i] === 1) { p.lineTo(c[i + 1], c[i + 2]); i += 3; }
        else if (c[i] === 2) { p.quadraticCurveTo(c[i + 1], c[i + 2], c[i + 3], c[i + 4]); i += 5; }
        else { p.closePath(); i += 1; }
      }
    }
  }

  const chunkId = (cx, cy) => (cx + 50000) * 100000 + (cy + 50000);
  function tileHash(t) {
    let h = Math.imul(t.x, 73856093) ^ Math.imul(t.y, 19349663) ^ Math.imul(t.type.charCodeAt(0) * 4 + t.rot, 83492791) ^ t.seed;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    return h ^ (h >>> 12);
  }

  // Paints every tile on screen. Chunks that changed are recorded again, at most CHUNK_BUDGET_MS per
  // frame: the rest show their old look (or plain grass) and catch up over the next frames.
  function paintBoard(S) {
    const live = new Map();
    for (const t of board.values()) {
      const cx = Math.floor(t.x / CHUNK), cy = Math.floor(t.y / CHUNK), id = chunkId(cx, cy);
      let c = live.get(id);
      if (!c) live.set(id, c = { cx, cy, hash: 0, tiles: [] });
      c.hash = (c.hash + tileHash(t)) | 0;
      c.tiles.push(t);
    }
    for (const id of chunks.keys()) if (!live.has(id)) chunks.delete(id);

    // the part of the board on screen, in board units
    const x0 = -cam.x / S - 1, x1 = (W - cam.x) / S + 1, y0 = -cam.y / S - 1, y1 = (H - cam.y) / S + 1;
    const t0 = performance.now();
    chunksBehind = false;
    ctx.setTransform(S * dpr, 0, 0, S * dpr, cam.x * dpr, cam.y * dpr);
    ctx.lineJoin = 'miter';
    for (const [id, c] of live) {
      const left = c.cx * CHUNK - 0.5, top = c.cy * CHUNK - 0.5;
      if (left + CHUNK < x0 || left > x1 || top + CHUNK < y0 || top > y1) continue;
      let ch = chunks.get(id);
      if (!ch || ch.hash !== c.hash) {
        if (performance.now() - t0 < CHUNK_BUDGET_MS) {
          const rec = new PathRecorder();
          for (const t of c.tiles) drawTile(rec, t.type, t.rot, t.x, t.y, 1, t.seed);
          ch = { hash: c.hash, layers: [...rec.layers.values()] };
          chunks.set(id, ch);
        } else {
          chunksBehind = true;
        }
      }
      if (ch) {
        for (const l of ch.layers) {
          if (S < l.minSize) continue;
          if (l.fill) { ctx.fillStyle = l.style; ctx.fill(l.path); }
          else { ctx.strokeStyle = l.style; ctx.lineWidth = l.width; ctx.lineCap = l.cap; ctx.stroke(l.path); }
        }
      } else {
        const p = new Path2D();
        for (const t of c.tiles) p.rect(t.x - 0.5, t.y - 0.5, 1, 1);
        ctx.fillStyle = COL.field;
        ctx.fill(p);
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // How far you can zoom out: until the whole board fits on the screen (or MIN_SIZE for small boards,
  // never below 2 px per tile).
  let boundsMemo = null;
  function minZoom() {
    if (!boundsMemo || boundsMemo.board !== board || boundsMemo.size !== board.size) {
      boundsMemo = { board, size: board.size, b: bounds() };
    }
    const b = boundsMemo.b;
    return clamp(Math.min(W / (b.maxX - b.minX + 3), H / (b.maxY - b.minY + 3)), 2, MIN_SIZE);
  }

  function render(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const S = cam.size;
    const visible = (x, y) => {
      const sx = cam.x + x * S, sy = cam.y + y * S;
      return sx > -S && sx < W + S && sy > -S && sy < H + S;
    };

    paintBoard(S);

    // flash on the scored structures
    flashes = flashes.filter(f => now - f.t < 1300);
    for (const f of flashes) {
      ctx.globalAlpha = 0.5 * (1 - (now - f.t) / 1300);
      ctx.fillStyle = f.color;
      for (const [x, y] of f.tiles) ctx.fillRect(cam.x + (x - 0.5) * S, cam.y + (y - 0.5) * S, S, S);
    }
    ctx.globalAlpha = 1;

    // the last tile placed
    if (lastPlaced && board.has(key(lastPlaced.x, lastPlaced.y)) && lastPlaced.by >= 0) {
      ctx.strokeStyle = players[lastPlaced.by].color;
      ctx.lineWidth = 3;
      ctx.strokeRect(cam.x + (lastPlaced.x - 0.5) * S + 1.5, cam.y + (lastPlaced.y - 0.5) * S + 1.5, S - 3, S - 3);
    }

    // possible spots (gold = fits with the current rotation)
    const choosing = (phase === 'place' || phase === 'meeple') && humanTurn();
    if (choosing) {
      const fits = new Path2D(), others = new Path2D();
      const pad = Math.min(3, S * 0.1);
      for (const c of candidates) {
        if ((placed && placed.x === c.x && placed.y === c.y) || !visible(c.x, c.y)) continue;
        const ok = phase === 'place' && c.rots.includes(rot);
        roundRectPath(ok ? fits : others, cam.x + (c.x - 0.5) * S + pad, cam.y + (c.y - 0.5) * S + pad,
          S - 2 * pad, S - 2 * pad, Math.min(10, S * 0.12));
      }
      ctx.setLineDash(S < 16 ? [] : [6, 5]);
      ctx.lineWidth = S < 16 ? 1 : 2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'; ctx.fill(others);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.stroke(others);
      ctx.fillStyle = 'rgba(255, 233, 140, 0.22)'; ctx.fill(fits);
      ctx.strokeStyle = 'rgba(255, 233, 140, 0.9)'; ctx.stroke(fits);
      ctx.setLineDash([]);

      if (phase === 'place' && hover) {
        const c = candidateAt(hover.x, hover.y);
        if (c) {
          ctx.globalAlpha = 0.6;
          drawTile(ctx, tile, rot, cam.x + c.x * S, cam.y + c.y * S, S, 3);
          ctx.globalAlpha = 1;
          ctx.lineWidth = 3;
          ctx.strokeStyle = c.rots.includes(rot) ? '#7CFC8A' : '#ffd166';
          ctx.strokeRect(cam.x + (c.x - 0.5) * S + 1.5, cam.y + (c.y - 0.5) * S + 1.5, S - 3, S - 3);
        }
      }
    }

    // the tile "in the air": the computer's move or a move sent to the host
    if (pending && tile && !placed) {
      const sx = cam.x + pending.x * S, sy = cam.y + pending.y * S;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
      drawTile(ctx, tile, rot, sx, sy, S, 3);
      ctx.restore();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffe066';
      ctx.strokeRect(sx - S / 2 + 1.5, sy - S / 2 + 1.5, S - 3, S - 3);
    }

    // the tile placed this turn
    if (placed) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffe066';
      ctx.strokeRect(cam.x + (placed.x - 0.5) * S + 1.5, cam.y + (placed.y - 0.5) * S + 1.5, S - 3, S - 3);
    }

    // meeples: the ones standing on the board are painted together (shadows, bodies by color, shine),
    // freshly placed ones fly in on top
    const ms = S * 0.3;
    for (const [k, t0] of meepleAnims) {
      const t = board.get(k);
      if (!t || !t.meeple || now - t0 > MEEPLE_ANIM_MS) meepleAnims.delete(k);
    }
    const shadows = new Path2D(), shines = new Path2D(), bodies = new Map(), flying = [];
    for (const t of board.values()) {
      if (!t.meeple) continue;
      const [px, py] = featurePos(t.type, t.meeple.f, t.rot);
      const x = cam.x + (t.x + px) * S, y = cam.y + (t.y + py) * S;
      const color = players[t.meeple.p].color;
      const t0 = meepleAnims.get(key(t.x, t.y));
      if (t0 !== undefined) {
        flying.push([x, y, color, now - t0]);
      } else if (visible(t.x, t.y)) {
        const fy = y + ms * 0.48;
        shadows.moveTo(x + ms * 0.42, fy);
        shadows.ellipse(x, fy, ms * 0.42, ms * 0.13, 0, 0, Math.PI * 2);
        if (!bodies.has(color)) bodies.set(color, new Path2D());
        meepleShape(bodies.get(color), x, y, ms);
        shines.moveTo(x + 0.01 * ms, y - 0.35 * ms);
        shines.arc(x - 0.05 * ms, y - 0.35 * ms, 0.06 * ms, 0, Math.PI * 2);
      }
    }
    if (bodies.size) {
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#1a1208'; ctx.fill(shadows);
      ctx.globalAlpha = 1; ctx.lineJoin = 'round'; ctx.lineWidth = ms * 0.16;
      for (const [color, p] of bodies) {
        ctx.strokeStyle = meepleOutline(color); ctx.stroke(p);
        ctx.fillStyle = color; ctx.fill(p);
      }
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#fff'; ctx.fill(shines);
      ctx.globalAlpha = 1; ctx.lineJoin = 'miter';
    }
    for (const [x, y, color, dt] of flying) drawFlyingMeeple(ctx, x, y, ms, color, dt);

    // meeples scored while still flying in finish their landing
    landingMeeples = landingMeeples.filter(a => now - a.t0 < MEEPLE_ANIM_MS);
    for (const a of landingMeeples) drawFlyingMeeple(ctx, cam.x + a.x * S, cam.y + a.y * S, ms, a.color, now - a.t0);

    // scored meeples heading back to the right
    leavingMeeples = leavingMeeples.filter(a => now - a.t0 < MEEPLE_OUT_MS);
    for (const a of leavingMeeples) {
      if (now >= a.showAt) drawLeavingMeeple(ctx, cam.x + a.x * S, cam.y + a.y * S, ms, a.color, now - a.t0);
    }

    // meeple spots
    if (phase === 'meeple' && placed && humanTurn()) {
      const pulse = animations ? 0.5 + 0.5 * Math.sin(now / 220) : 0.5;
      const hs = hoverPx ? spotAt(hoverPx.x, hoverPx.y) : null;
      for (const sp of meepleSpots) {
        const sx = cam.x + (placed.x + sp.pos[0]) * S, sy = cam.y + (placed.y + sp.pos[1]) * S;
        if (sp === hs) {
          drawMeeple(ctx, sx, sy, ms, players[cur].color, 0.85);
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(7, S * (0.08 + 0.02 * pulse)), 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fill();
          ctx.lineWidth = Math.max(2, S * 0.03);
          ctx.strokeStyle = players[cur].color;
          ctx.stroke();
        }
      }
    }

    // floating "+N"
    popups = popups.filter(p => now - p.t < 1700);
    for (const p of popups) {
      const k = (now - p.t) / 1700;
      const sx = cam.x + p.x * S, sy = cam.y + p.y * S - k * 45;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.font = `800 ${Math.round(Math.max(18, S * 0.3))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = isDark(p.color) ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)';
      ctx.strokeText(p.text, sx, sy);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    if (camAnim) {
      const k = Math.min(1, (now - camAnim.t0) / 350);
      const e = 1 - Math.pow(1 - k, 3);
      for (const p of ['x', 'y', 'size']) cam[p] = camAnim.from[p] + (camAnim.to[p] - camAnim.from[p]) * e;
      if (k >= 1) camAnim = null;
      dirty = true;
    }
    if (dirty || popups.length || flashes.length || meepleAnims.size || leavingMeeples.length || landingMeeples.length || (phase === 'meeple' && animations)) {
      render(now);
      dirty = chunksBehind;
    }
    updateTimer(now);
    requestAnimationFrame(loop);
  }

  function drawPreview() {
    const w = preview.width;
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.clearRect(0, 0, w, w);
    const type = placed ? placed.type : tile;
    if (!type) return;
    const r = placed ? placed.rot : rot;
    drawTile(pctx, type, r, w / 2, w / 2, w * 0.86, 3);
    if (placed && placed.meeple) {
      const [px, py] = featurePos(placed.type, placed.meeple.f, placed.rot);
      drawMeeple(pctx, w / 2 + px * w * 0.86, w / 2 + py * w * 0.86, w * 0.26, players[placed.meeple.p].color);
    }
  }

  // ================= Mouse / touch =================
  const pointers = new Map();
  let drag = null, pinch = null;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    camAnim = null;
    if (pointers.size === 1) {
      drag = { sx: e.offsetX, sy: e.offsetY, cx: cam.x, cy: cam.y, moved: false, button: e.button };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: dist(a, b) || 1, size: cam.size, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, cx: cam.x, cy: cam.y };
      if (drag) drag.moved = true;
    }
  });

  canvas.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (p) { p.x = e.offsetX; p.y = e.offsetY; }
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const ns = clamp(pinch.size * dist(a, b) / pinch.d, minZoom(), MAX_SIZE);
      const wx = (pinch.mx - pinch.cx) / pinch.size, wy = (pinch.my - pinch.cy) / pinch.size;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      cam.size = ns; cam.x = mx - wx * ns; cam.y = my - wy * ns;
      dirty = true;
      return;
    }
    if (drag && pointers.size === 1) {
      const dx = e.offsetX - drag.sx, dy = e.offsetY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) > 6) { drag.moved = true; canvas.classList.add('dragging'); }
      if (drag.moved) { cam.x = drag.cx + dx; cam.y = drag.cy + dy; dirty = true; }
    }
    if (e.pointerType === 'mouse') {
      const c = cellAt(e.offsetX, e.offsetY);
      if (!hover || hover.x !== c.x || hover.y !== c.y) { hover = c; dirty = true; }
      hoverPx = { x: e.offsetX, y: e.offsetY };
    }
  });

  function endPointer(e) {
    const d = drag;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      canvas.classList.remove('dragging');
      drag = null;
      if (d && !d.moved && e.type === 'pointerup') {
        if (d.button === 2) rotateAction();
        else handleClick(e.offsetX, e.offsetY);
      }
    } else if (pointers.size === 1) {
      const [p] = [...pointers.values()];
      drag = { sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, moved: true, button: 0 };
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', e => {
    if (e.pointerType === 'mouse') { hover = null; hoverPx = null; dirty = true; }
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('hidden')) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'r') rotateAction();
    else if (k === 'enter' || k === ' ') { e.preventDefault(); skipAction(); }
    else if (k === 'escape' || k === 'backspace') { e.preventDefault(); undoAction(); }
    else if (k === 'c') fitView(true);
    else if (k === '+' || k === '=') zoomAt(W / 2, H / 2, 1.2);
    else if (k === '-') zoomAt(W / 2, H / 2, 1 / 1.2);
  });

  // ================= Interface =================
  const playersEl = document.getElementById('players');
  const statusEl = document.getElementById('status');
  const deckEl = document.getElementById('deckCount');
  const netEl = document.getElementById('netInfo');
  const logEl = document.getElementById('log');
  const toastEl = document.getElementById('toast');
  const modal = document.getElementById('modal');
  const modalBox = document.getElementById('modalBox');
  const btn = id => document.getElementById(id);
  const btnRotate = btn('btnRotate'), btnSkip = btn('btnSkip'), btnUndo = btn('btnUndo');
  const actionBar = btn('actionBar'), barText = btn('barText');
  const timerEl = btn('timer'), timerNum = btn('timerNum');
  let modalView = null;
  let shownSecs = -1;

  // The timer in the bottom bar (runs every frame, only touches the DOM when needed)
  function updateTimer(now) {
    const show = turnDeadline > 0 && turnLimitMs > 0 && (phase === 'place' || phase === 'meeple' || phase === 'wait');
    if (timerEl.hidden === show) timerEl.hidden = !show;
    if (!show) { shownSecs = -1; return; }
    const left = Math.max(0, turnDeadline - now);
    const secs = Math.ceil(left / 1000);
    if (secs !== shownSecs) {
      shownSecs = secs;
      timerNum.textContent = secs;
      timerEl.classList.toggle('low', secs <= 10);
    }
    timerEl.style.setProperty('--p', (left / turnLimitMs).toFixed(3));
  }

  const swatch = color => `<span class="swatch" style="background:${color}"></span>`;
  const playerTag = i => `${swatch(players[i].color)}<b>${esc(players[i].name)}</b>`;
  const tilesText = n => (n === 1 ? '1 tile' : `${n} tiles`);
  // meeple icons in the player list: at most 10, then "+N"
  const MEEPLE_ICONS = 10;
  const meepleIcons = n => '<i></i>'.repeat(Math.min(n, MEEPLE_ICONS)) + (n > MEEPLE_ICONS ? `<em>+${n - MEEPLE_ICONS}</em>` : '');

  function updateUI() {
    playersEl.classList.toggle('many', players.length > 4);
    playersEl.innerHTML = players.map((p, i) => {
      const tag = p.ai ? ' <small>(computer)</small>' : net.role !== 'local' && p.owner === net.myId ? ' <small>(you)</small>' : '';
      return `
      <div class="player ${i === cur && phase !== 'over' ? 'active' : ''}" style="--c:${p.color}">
        ${swatch(p.color)}
        <div class="pinfo">
          <div class="pname">${esc(p.name)}${tag}</div>
          <div class="meeples" title="${p.meeples} ${p.meeples === 1 ? 'meeple' : 'meeples'} left">${meepleIcons(p.meeples)}<span class="mnum">♟ ${p.meeples}</span></div>
        </div>
        <div class="score">${p.score}</div>
      </div>`;
    }).join('');

    deckEl.textContent = phase === 'over' ? 'Deck empty' : phase === 'idle' ? '' : `Tiles left: ${fmt(deckLeft())}`;
    netEl.hidden = net.role === 'local';
    netEl.textContent = net.role === 'host' ? `🌐 Online · you are the host · code ${net.code}` : `🌐 Online · lobby ${net.code}`;

    const mine = isMine(cur);
    const p = players[cur];
    let msg = '';
    if (phase === 'place') {
      msg = mine
        ? 'Click a gold spot to place the tile. Use ⟳ (or R) to rotate it first.'
        : 'is choosing a spot for the tile…';
    } else if (phase === 'meeple') {
      msg = mine
        ? 'Click the tile to rotate it, click another spot to move it. Then put a meeple on a circle or choose "No meeple".'
        : 'is deciding whether to place a meeple…';
    } else if (phase === 'ai') {
      msg = 'is thinking…';
    } else if (phase === 'wait') {
      msg = 'sending the move…';
    }
    if (phase === 'over') statusEl.innerHTML = '<b>Game over!</b>';
    else if (phase === 'idle' || !p) statusEl.textContent = 'Choose a game mode to start.';
    else statusEl.innerHTML = `${playerTag(cur)} · ${msg}`;

    // the bottom bar on the board
    actionBar.hidden = !gameRunning() || !p;
    if (p) {
      const c = placed && candidateAt(placed.x, placed.y);
      btnRotate.hidden = !(mine && (phase === 'place' || phase === 'meeple'));
      btnRotate.disabled = phase === 'meeple' && !(c && c.rots.length > 1);
      btnSkip.hidden = btnUndo.hidden = !(mine && phase === 'meeple');
      btnSkip.textContent = meepleSpots.length ? 'No meeple' : '✓ Done';
      actionBar.classList.toggle('has-btns', !btnRotate.hidden);
      timerEl.style.setProperty('--ring', p.color);
      let text;
      if (mine && phase === 'place') text = 'Pick a gold spot';
      else if (mine && phase === 'meeple') {
        text = meepleSpots.length ? 'Place a meeple? Tap a circle' : p.meeples ? 'No meeple can go here' : 'You have no meeples left';
      } else if (phase === 'wait') text = 'Sending…';
      else if (phase === 'ai') text = `${playerTag(cur)} is thinking…`;
      else text = `${playerTag(cur)} is playing…`;
      barText.innerHTML = text;
    }
    btn('btnNew').textContent = net.role === 'client' ? 'Leave' : 'New game';

    drawPreview();
    dirty = true;
    if (net.role === 'host') queueBroadcast();
  }

  // Events (log, "+N", flashes, messages) are applied locally and, on the host, also sent to the clients.
  function emit(ev) {
    applyEvent(ev);
    if (net.role === 'host') net.outbox.push(ev);
  }
  const log = (parts, cls) => emit({ k: 'log', parts, cls: cls || '' });

  function applyEvent(ev) {
    if (!ev || typeof ev !== 'object') return;
    const now = performance.now();
    const color = safeColor(ev.color);
    if (ev.k === 'log') {
      addLog(ev.parts, ev.cls === 'sep' ? 'sep' : '');
    } else if (ev.k === 'toast') {
      toast(String(ev.text));
    } else if (!animations) {
      // instant mode: no "+N" popups or flashes
    } else if (ev.k === 'pop') {
      popups.push({ x: +ev.x || 0, y: +ev.y || 0, text: String(ev.text).slice(0, 8), color, t: now });
    } else if (ev.k === 'flash' && Array.isArray(ev.tiles)) {
      const tiles = ev.tiles.filter(Array.isArray).map(t => [+t[0] || 0, +t[1] || 0]);
      flashes.push({ tiles, color, t: now });
    }
  }
  const safeColor = c => (/^#[0-9a-f]{6}$/i.test(String(c)) ? c : '#888888');

  // parts: strings and {p: index} for a player's name
  function addLog(parts, cls) {
    if (!Array.isArray(parts)) return;
    const li = document.createElement('li');
    li.innerHTML = parts.map(x => {
      if (typeof x === 'string') return esc(x);
      if (x && Number.isInteger(x.p) && players[x.p]) return playerTag(x.p);
      return '';
    }).join('');
    if (cls) li.className = cls;
    logEl.prepend(li);
    while (logEl.children.length > 60) logEl.lastChild.remove();
  }

  let toastTimer = null;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  function openModal(html, view) {
    modalView = view || null;
    modalBox.innerHTML = html;
    modal.classList.remove('hidden');
  }
  function closeModal() {
    modalView = null;
    modal.classList.add('hidden');
  }
  modal.addEventListener('click', e => {
    if (e.target === modal && (modalView === 'rules' || modalView === 'final')) closeModal();
  });

  function resetToIdle() {
    gameId++;
    stopTurnTimer();
    meepleAnims.clear();
    leavingMeeples = []; landingMeeples = [];
    players = []; deck = []; remoteDeck = 0;
    board = new Map([[key(0, 0), startTile()]]);
    tile = null; pending = null; placed = null; lastPlaced = null;
    meepleSpots = []; candidates = []; popups = []; flashes = [];
    cur = 0; turnNo = 0;
    phase = 'idle';
    setAnimations(true);
    logEl.innerHTML = '';
    fitView(false);
    updateUI();
  }

  // ---------- Saved preferences ----------
  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem('carcassonne-mini-' + k));
      localStorage.setItem('carcassonne-mini-' + k, JSON.stringify(v));
    } catch (e) { /* no localStorage */ }
    return null;
  }
  const myName = () => cleanName(store('playerName')) || 'Player';

  // local game setup: how many players and, for each seat, a name and human / computer
  const defaultSeat = i => ({ name: i === 0 ? '' : i === 1 ? 'Computer' : `Computer ${i}`, ai: i > 0 });
  function loadCfg() {
    const c = store('setup');
    const cfg = { count: 2, players: Array.from({ length: MAX_PLAYERS }, (_, i) => defaultSeat(i)) };
    if (c && Array.isArray(c.players)) {
      c.players.slice(0, MAX_PLAYERS).forEach((p, i) => {
        if (p && typeof p === 'object') cfg.players[i] = { name: cleanName(p.name), ai: !!p.ai };
      });
      cfg.count = clamp(Math.round(+c.count) || 2, 2, MAX_PLAYERS);
    }
    if (!cfg.players[0].name) cfg.players[0].name = myName();
    return cfg;
  }

  // ---------- Main menu ----------
  const params = new URLSearchParams(location.search);
  let inviteCode = (params.get('lobby') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

  function showMenu() {
    openModal(`
      <h2>Carcassonne Mini</h2>
      <p class="muted">Place tiles, build roads, cities and monasteries, and score the most points.</p>
      ${inviteCode ? `<p class="invite">You've been invited to lobby <b>${esc(inviteCode)}</b>. Enter your name and press "Join".</p>` : ''}
      <label class="field"><span>Your name</span><input id="mName" maxlength="14" value="${esc(myName())}"></label>
      <div class="menu">
        <button class="btn big ${inviteCode ? '' : 'primary'}" id="mLocal">🎲 Play on this device<small>with friends next to you or against the computer</small></button>
        <button class="btn big" id="mHost">🌐 Create an online lobby<small>you get a code to send to your friends</small></button>
        <div class="join-row">
          <input id="mCode" placeholder="LOBBY CODE" maxlength="8" value="${esc(inviteCode)}" autocomplete="off" aria-label="Lobby code">
          <button class="btn ${inviteCode ? 'primary' : ''}" id="mJoin">Join</button>
        </div>
      </div>
      <div class="modal-actions">
        ${phase !== 'idle' ? '<button class="btn" id="mCancel">Back to game</button>' : ''}
        <button class="btn" id="mRules">Rules</button>
      </div>`, 'menu');
    const saveName = () => store('playerName', cleanName(btn('mName').value));
    btn('mName').addEventListener('change', saveName);
    btn('mLocal').addEventListener('click', () => { saveName(); showSetup(); });
    btn('mHost').addEventListener('click', () => { saveName(); hostLobby(); });
    const join = () => { saveName(); joinLobby(btn('mCode').value); };
    btn('mJoin').addEventListener('click', join);
    btn('mCode').addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
    btn('mRules').addEventListener('click', () => { saveName(); showRules(showMenu); });
    const cancel = btn('mCancel');
    if (cancel) cancel.addEventListener('click', closeModal);
  }

  // ---------- Game settings (tiles, meeples, time, animations) ----------
  const loadSettings = () => cleanSettings(store('settings'));
  const isClassic = s => ['deck', 'meeples', 'time', 'anim'].every(k => s[k] === DEFAULT_SETTINGS[k]);
  const shortTime = t => (t ? `${t} s` : 'no limit');
  const fmt = v => (typeof v === 'number' ? v.toLocaleString('en-US') : v);
  const settingsSummary = s =>
    `Tiles: ${DECK_SIZES[s.deck].label} (${fmt(deckTotalFor(s))}) · Meeples: ${MEEPLE_COUNTS[s.meeples].label} (${meeplesFor(s)}) · Time: ${shortTime(s.time)} · Animations: ${s.anim}`;

  // The "Custom" choices: which number they set, its limits and the steps of the −/+ buttons
  // ([below this number, step], so the step grows with the number).
  const CUSTOM = {
    deck: { num: 'deckN', min: DECK_MIN, max: DECK_MAX, unit: 'tiles in total', label: 'Number of tiles',
      steps: [[100, 10], [500, 50], [1000, 100], [5000, 500], [Infinity, 1000]] },
    meeples: { num: 'meepleN', min: 1, max: MAX_MEEPLES, unit: 'meeples per player', label: 'Meeples per player',
      steps: [[20, 1], [50, 5], [Infinity, 10]] },
  };
  const stepOf = (c, v) => c.steps.find(([below]) => v < below)[1];

  function settingsHTML(s) {
    const chips = (setKey, opts) => Object.keys(opts).map(k => `
      <button class="chip ${s[setKey] === k ? 'on' : ''}" data-set="${setKey}" data-val="${k}">${opts[k].label}<small>${fmt(k === 'custom' ? s[CUSTOM[setKey].num] : opts[k].n)}</small></button>`).join('');
    const custom = setKey => {
      if (s[setKey] !== 'custom') return '';
      const c = CUSTOM[setKey];
      return `
        <div class="custom-row">
          <button class="btn step" data-step="${setKey}" data-d="-1" aria-label="Fewer">−</button>
          <input type="number" inputmode="numeric" data-num="${setKey}" min="${c.min}" max="${c.max}" value="${s[c.num]}" aria-label="${c.label}">
          <button class="btn step" data-step="${setKey}" data-d="1" aria-label="More">+</button>
          <span class="custom-hint">${c.unit}<br><small>${fmt(c.min)}–${fmt(c.max)}</small></span>
        </div>`;
    };
    return `
      <div class="settings">
        <div class="set-row stack">
          <span class="set-label">🧩 Tiles</span>
          <div class="chips">${chips('deck', DECK_SIZES)}</div>
          ${custom('deck')}
        </div>
        <div class="set-row stack">
          <span class="set-label">♟ Meeples</span>
          <div class="chips">${chips('meeples', MEEPLE_COUNTS)}</div>
          ${custom('meeples')}
        </div>
        <div class="set-row">
          <span class="set-label">⏱ Time per turn</span>
          <select data-set="time" aria-label="Time per turn">
            ${TURN_TIMES.map(t => `<option value="${t}" ${t === s.time ? 'selected' : ''}>${timeLabel(t)}</option>`).join('')}
          </select>
        </div>
        <div class="set-row">
          <span class="set-label">✨ Animations</span>
          <div class="chips">${chips('anim', ANIM_MODES)}</div>
        </div>
        <div class="set-foot">
          <button class="btn small" data-set="classic" ${isClassic(s) ? 'disabled' : ''}>↺ Classic settings</button>
        </div>
      </div>`;
  }

  // Wires up the controls from settingsHTML. onChange(redraw) runs after every change; typing a
  // custom number does not redraw the dialog, so the input keeps its focus.
  function bindSettings(s, onChange) {
    modalBox.querySelectorAll('.chip[data-set]').forEach(b => b.addEventListener('click', () => {
      s[b.dataset.set] = b.dataset.val;
      onChange(true);
      const inp = b.dataset.val === 'custom' && modalBox.querySelector(`input[data-num="${b.dataset.set}"]`);
      if (inp) { inp.focus(); inp.select(); }
    }));
    const setNum = (setKey, v) => {
      const c = CUSTOM[setKey];
      s[c.num] = clamp(Math.round(v), c.min, c.max);
      const sub = modalBox.querySelector(`.chip[data-set="${setKey}"][data-val="custom"] small`);
      if (sub) sub.textContent = fmt(s[c.num]);
      onChange(false);
    };
    modalBox.querySelectorAll('input[data-num]').forEach(inp => {
      const setKey = inp.dataset.num;
      inp.addEventListener('input', () => {
        if (inp.value !== '' && Number.isFinite(+inp.value)) setNum(setKey, +inp.value);
      });
      inp.addEventListener('change', () => { inp.value = s[CUSTOM[setKey].num]; });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    });
    modalBox.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
      const setKey = b.dataset.step;
      const c = CUSTOM[setKey];
      const v = s[c.num];
      // −/+ jump to the next round number (72 → 80, 100 → 150, 1000 → 1500; 72 → 70, 100 → 90)
      if (Number(b.dataset.d) > 0) { const st = stepOf(c, v); setNum(setKey, Math.floor(v / st) * st + st); }
      else { const st = stepOf(c, v - 1); setNum(setKey, Math.ceil(v / st) * st - st); }
      const inp = modalBox.querySelector(`input[data-num="${setKey}"]`);
      if (inp) inp.value = s[c.num];
    }));
    const sel = modalBox.querySelector('select[data-set="time"]');
    sel.addEventListener('change', () => { s.time = Number(sel.value); onChange(true); });
    modalBox.querySelector('[data-set="classic"]').addEventListener('click', () => {
      Object.assign(s, DEFAULT_SETTINGS);
      onChange(true);
    });
  }

  // ---------- Playing on this device ----------
  function showSetup() {
    const cfg = loadCfg();
    const settings = loadSettings();
    const counts = Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => i + 2);
    const readInputs = () => {
      modalBox.querySelectorAll('input[data-i]').forEach(inp => (cfg.players[inp.dataset.i].name = inp.value));
      modalBox.querySelectorAll('select[data-i]').forEach(sel => (cfg.players[sel.dataset.i].ai = sel.value === 'ai'));
    };
    const draw = () => {
      openModal(`
        <h2>Play on this device</h2>
        <p class="muted">"Human" players take turns on the same screen.</p>
        <div class="count-row">
          <span class="set-label">Players</span>
          <div class="seg">${counts.map(n => `<button class="btn ${cfg.count === n ? 'on' : ''}" data-n="${n}" aria-label="${n} players">${n}</button>`).join('')}</div>
        </div>
        <div class="setup-rows">
          ${cfg.players.slice(0, cfg.count).map((p, i) => `
            <div class="setup-row">
              ${swatch(PLAYER_COLORS[i])}
              <input data-i="${i}" maxlength="14" value="${esc(p.name)}" aria-label="Player ${i + 1} name">
              <select data-i="${i}" aria-label="Player ${i + 1} type">
                <option value="human" ${p.ai ? '' : 'selected'}>Human</option>
                <option value="ai" ${p.ai ? 'selected' : ''}>Computer</option>
              </select>
            </div>`).join('')}
        </div>
        ${settingsHTML(settings)}
        <div class="modal-actions">
          <button class="btn" id="mBack">Back</button>
          <button class="btn primary" id="mStart">Start game</button>
        </div>`, 'setup');
      modalBox.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
        readInputs();
        cfg.count = Number(b.dataset.n);
        draw();
      }));
      bindSettings(settings, redraw => {
        store('settings', settings);
        if (redraw) { readInputs(); draw(); }
      });
      btn('mStart').addEventListener('click', () => {
        readInputs();
        store('setup', cfg);
        store('settings', settings);
        leaveOnline();
        newGame(cfg.players.slice(0, cfg.count).map(p => ({ name: p.name, ai: p.ai, owner: 'local' })), settings);
      });
      btn('mBack').addEventListener('click', () => { readInputs(); store('setup', cfg); showMenu(); });
    };
    draw();
  }

  function showRules(back) {
    openModal(`
      <h2>Rules</h2>
      <div class="rules">
        <h4>Your turn</h4>
        <p>1. You draw a tile. Place it next to the tiles on the board so that the edges match: city to city, road to road, field to field.</p>
        <p>2. If you like, put one of your meeples (7 with the classic settings) on a road, city or monastery of the tile you just placed. You can't join a structure that is already taken.</p>
        <h4>Scoring</h4>
        <ul>
          <li><b>Completed road:</b> 1 point per tile.</li>
          <li><b>Completed city:</b> 2 points per tile + 2 per blue pennant.</li>
          <li><b>Monastery surrounded</b> by 8 tiles: 9 points.</li>
        </ul>
        <p>When a structure is completed, its meeples come back to their owners. If several players have meeples in the same structure, whoever has the most takes the points (on a tie, they all do).</p>
        <p>At the end, unfinished structures are worth 1 point per tile (and 1 per pennant); a monastery is worth 1 + the number of its neighbors.</p>
        <p><i>Simplified version: no farmers on the fields.</i></p>
        <h4>Online</h4>
        <p>One of you creates a lobby and sends the code (or the link). The others open the site and join with the code. The host can also add computer players, then starts the game. Up to ${MAX_PLAYERS} players.</p>
        <h4>Time</h4>
        <p>Each player has a time limit per turn (30 seconds by default). When it runs out, the tile is placed automatically, without a meeple.</p>
        <h4>Controls</h4>
        <p>Click a gold spot to place the tile. After that, click the tile to rotate it, or click another spot to move it. Place a meeple by tapping a circle, or press <b>No meeple</b> to end your turn. <b>↶ Undo</b> takes the tile back into your hand.</p>
        <p>Drag with the mouse or a finger to move the board; use the mouse wheel or pinch to zoom.</p>
        <p><kbd>R</kbd> rotate · <kbd>Enter</kbd> / <kbd>Space</kbd> no meeple · <kbd>Esc</kbd> undo · <kbd>C</kbd> center</p>
      </div>
      <div class="modal-actions"><button class="btn primary" id="mBack">${back ? 'Back' : 'Got it'}</button></div>`, back ? 'rules-back' : 'rules');
    btn('mBack').addEventListener('click', () => (back ? back() : closeModal()));
  }

  function showFinal() {
    const ranking = players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score);
    const top = ranking[0].score;
    const winners = ranking.filter(r => r.score === top);
    const meWon = winners.some(w => isMine(w.i));
    const title = winners.length > 1 ? "It's a tie!"
      : meWon ? `Well done, ${esc(winners[0].name)}! 🎉` : `${esc(winners[0].name)} wins`;
    const again = net.role === 'host' ? 'Rematch' : net.role === 'client' ? 'Leave' : 'New game';
    openModal(`
      <h2>🏆 ${title}</h2>
      <p class="muted">The deck is empty. Final standings:</p>
      <ol class="ranking">
        ${ranking.map((r, k) => `
          <li class="${r.score === top ? 'win' : ''}">
            <span class="pos">${k + 1}.</span>${swatch(r.color)}<span class="nm">${esc(r.name)}</span><span class="pts">${r.score}</span>
          </li>`).join('')}
      </ol>
      ${net.role === 'client' ? '<p class="muted">The host can start a rematch – stay here if you want to play again.</p>' : ''}
      <div class="modal-actions">
        <button class="btn" id="mView">View board</button>
        <button class="btn primary" id="mAgain">${again}</button>
      </div>`, 'final');
    btn('mView').addEventListener('click', () => { closeModal(); fitView(true); });
    btn('mAgain').addEventListener('click', newGameButton);
  }

  function showError(msg) {
    openModal(`
      <h2>Oops…</h2>
      <p>${esc(msg)}</p>
      <div class="modal-actions"><button class="btn primary" id="mMenu">Menu</button></div>`, 'error');
    btn('mMenu').addEventListener('click', showMenu);
  }

  function newGameButton() {
    if (net.role === 'host') { refreshHostLobby(); showHostLobby(); }
    else if (net.role === 'client') showLeaveConfirm();
    else showMenu();
  }

  function showLeaveConfirm() {
    openModal(`
      <h2>Leave the game?</h2>
      <p>If you leave, the computer plays in your place until the end.</p>
      <div class="modal-actions">
        <button class="btn" id="mStay">Stay</button>
        <button class="btn primary" id="mLeave">Leave</button>
      </div>`, 'leave');
    btn('mStay').addEventListener('click', () => (phase === 'over' ? showFinal() : closeModal()));
    btn('mLeave').addEventListener('click', () => { leaveOnline(); resetToIdle(); showMenu(); });
  }

  // ================= Online (PeerJS / WebRTC) =================
  // The site is static (GitHub Pages), so the browsers connect directly to each other.
  // The public PeerJS server is only used so they can find each other by code.
  const PEER_PREFIX = 'carcmini-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function makeCode() {
    const a = new Uint32Array(5);
    crypto.getRandomValues(a);
    return [...a].map(v => CODE_CHARS[v % CODE_CHARS.length]).join('');
  }
  const shareLink = () => `${location.origin}${location.pathname}?lobby=${net.code}`;
  const onlineAvailable = () => {
    if (typeof Peer !== 'undefined') return true;
    showError('Online play could not be loaded. Check your internet connection and reload the page.');
    return false;
  };

  function safeSend(conn, msg) {
    try { if (conn && conn.open) conn.send(msg); } catch (e) { console.warn(e); }
  }

  function leaveOnline() {
    const peer = net.peer;
    const conns = [...net.conns.values()];
    if (net.role === 'host') conns.forEach(c => safeSend(c, { type: 'closed' }));
    net.host = null;
    net.conns.clear();
    net.peer = null;
    net.ready = false;
    net.role = 'local';
    net.myId = 'local';
    net.seats = [];
    net.outbox = [];
    net.sent = null;
    // let the "closed" message go out before closing the connections
    setTimeout(() => {
      conns.forEach(c => { try { c.close(); } catch (e) { /* already closed */ } });
      if (peer) try { peer.destroy(); } catch (e) { /* already destroyed */ }
    }, 300);
  }

  // ---------- Host ----------
  function hostLobby() {
    if (!onlineAvailable()) return;
    leaveOnline();
    resetToIdle();
    net.role = 'host';
    net.myId = 'host';
    net.code = makeCode();
    net.seats = [{ id: 'host', name: myName(), kind: 'host' }];
    net.aiCount = 0;
    net.settings = loadSettings();
    showHostLobby();
    openHostPeer(0);
    updateUI();
  }

  function openHostPeer(tries) {
    const peer = new Peer(PEER_PREFIX + net.code, { debug: 0 });
    net.peer = peer;
    peer.on('open', () => {
      if (net.peer !== peer) return;
      net.ready = true;
      refreshHostLobby();
      updateUI();
    });
    peer.on('connection', conn => {
      if (net.peer !== peer) { conn.close(); return; }
      conn.on('data', msg => onHostData(conn, msg));
      conn.on('close', () => onHostConnClosed(conn));
      conn.on('error', () => onHostConnClosed(conn));
    });
    peer.on('disconnected', () => {
      // lost the link to the lobby server; players already connected keep playing
      if (net.peer === peer && !peer.destroyed) setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 1000);
    });
    peer.on('error', err => {
      if (net.peer !== peer) return;
      if (err.type === 'unavailable-id' && tries < 5) {
        peer.destroy();
        net.code = makeCode();
        openHostPeer(tries + 1);
      } else if (!net.ready) {
        leaveOnline();
        resetToIdle();
        showError('Could not create the lobby. Check your internet connection and try again.');
      } else {
        console.warn('PeerJS:', err.type);
      }
    });
  }

  function onHostData(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'hello') {
      if (net.conns.has(conn.peer)) return;
      const deny = gameRunning() ? 'The game has already started.'
        : net.seats.length >= MAX_PLAYERS ? `The lobby is full (max ${MAX_PLAYERS} players).` : '';
      if (deny) {
        safeSend(conn, { type: 'denied', reason: deny });
        setTimeout(() => conn.close(), 500);
        return;
      }
      net.conns.set(conn.peer, conn);
      const name = cleanName(msg.name) || 'Player';
      net.seats.push({ id: conn.peer, name, kind: 'remote' });
      toast(`${name} joined the lobby`);
      refreshHostLobby();
    } else if (msg.type === 'act') {
      onRemoteAction(conn.peer, msg);
    } else if (msg.type === 'sync' && net.conns.has(conn.peer)) {
      net.sent = null; // a client lost track of the board: send all of it again
      queueBroadcast();
    }
  }

  function onHostConnClosed(conn) {
    if (net.role !== 'host' || !net.conns.has(conn.peer)) return;
    net.conns.delete(conn.peer);
    const seat = net.seats.find(s => s.id === conn.peer);
    net.seats = net.seats.filter(s => s.id !== conn.peer);
    const pi = players.findIndex(p => p.owner === conn.peer && !p.ai);
    if (pi >= 0 && gameRunning()) {
      players[pi].ai = true;
      players[pi].owner = null;
      log([{ p: pi }, ' left the game – the computer takes over.']);
      emit({ k: 'toast', text: `${players[pi].name} left the game` });
      if (pi === cur && phase === 'meeple') finishTurn();
      else if (pi === cur && phase === 'place') { stopTurnTimer(); pending = null; phase = 'ai'; updateUI(); runAI(); }
      else updateUI();
    } else if (seat) {
      toast(`${seat.name} left the lobby`);
    }
    refreshHostLobby();
  }

  // A move from a client: check it and apply it just like a local one.
  function onRemoteAction(owner, msg) {
    if (!players[cur] || players[cur].ai || players[cur].owner !== owner) return;
    if (msg.a === 'place' && (phase === 'place' || phase === 'meeple')) {
      const c = candidateAt(msg.x, msg.y);
      if (c && c.rots.includes(msg.rot)) { doPlace(c.x, c.y, msg.rot); return; }
    } else if (msg.a === 'rotate' && phase === 'meeple') {
      doRotatePlaced();
      return;
    } else if (msg.a === 'meeple' && phase === 'meeple') {
      if (meepleSpots.some(s => s.fi === msg.fi)) { doMeeple(msg.fi); return; }
    } else if (msg.a === 'skip' && phase === 'meeple') {
      finishTurn();
      return;
    } else if (msg.a === 'undo' && phase === 'meeple') {
      doUndo();
      return;
    }
    queueBroadcast(); // invalid move: send the state again so the client gets unstuck
  }

  function queueBroadcast() {
    if (net.role !== 'host' || net.queued) return;
    net.queued = true;
    setTimeout(() => { net.queued = false; broadcastState(); }, 0);
  }

  function broadcastState() {
    if (net.role !== 'host' || !players.length) return;
    const msg = { type: 'state', s: snapshot(), ev: net.outbox };
    net.outbox = [];
    for (const c of net.conns.values()) safeSend(c, msg);
  }

  function snapshot() {
    return {
      players: players.map(p => ({ name: p.name, ai: p.ai, color: p.color, score: p.score, meeples: p.meeples, owner: p.owner })),
      board: boardDelta(),
      deck: deck.length, cur, turn: turnNo, tile, phase, rot,
      pending: pending ? { x: pending.x, y: pending.y } : null,
      placed: placed ? key(placed.x, placed.y) : null,
      last: lastPlaced ? key(lastPlaced.x, lastPlaced.y) : null,
      timeLeft: turnDeadline ? Math.max(0, Math.round(turnDeadline - performance.now())) : 0,
      timeLimit: turnLimitMs,
      anim: animations,
    };
  }

  // The board goes out as the tiles that changed since the previous message (all of them at the start
  // of a game or after a resync), so big boards stay cheap to send.
  function boardDelta() {
    const full = !net.sent;
    const sent = new Map(), set = [], del = [];
    for (const t of board.values()) {
      const row = [t.x, t.y, t.type, t.rot, t.meeple ? t.meeple.p : -1, t.meeple ? t.meeple.f : -1, t.by, t.seed];
      const k = key(t.x, t.y), str = row.join();
      sent.set(k, str);
      if (full || net.sent.get(k) !== str) set.push(row);
    }
    if (!full) for (const k of net.sent.keys()) if (!sent.has(k)) del.push(k);
    net.sent = sent;
    return { full, set, del, n: sent.size };
  }

  // Sends the lobby (seats + settings) to everyone; redraw = false keeps the host's dialog as it is.
  function refreshHostLobby(redraw = true) {
    if (net.role !== 'host') return;
    const info = {
      type: 'lobby', code: net.code, settings: net.settings,
      seats: net.seats.map(s => ({ id: s.id, name: s.name, kind: s.kind })),
    };
    for (const c of net.conns.values()) safeSend(c, info);
    if (redraw && modalView === 'hostLobby') showHostLobby();
  }

  function showHostLobby() {
    const seats = net.seats;
    const full = seats.length >= MAX_PLAYERS;
    openModal(`
      <h2>Online lobby</h2>
      ${net.ready ? `
        <div class="code-box">
          <div><small>Lobby code</small><b>${esc(net.code)}</b></div>
          <button class="btn small" id="mCopy">Copy link</button>
        </div>
        <input class="link" id="mLink" readonly value="${esc(shareLink())}" aria-label="Invite link">
        <p class="muted">Send the link or the code to your friends. When they join, they show up below.</p>`
      : '<p class="muted">Creating the lobby…</p>'}
      <div class="seats-head"><b>Players</b><span>${seats.length} / ${MAX_PLAYERS}</span></div>
      <div class="seats">
        ${seats.map((s, i) => `
          <div class="seat">
            ${swatch(PLAYER_COLORS[i])}
            <span class="nm">${esc(s.name)}${s.kind === 'host' ? ' <small>(you, host)</small>' : s.kind === 'ai' ? ' <small title="Computer">🤖</small>' : ''}</span>
            ${s.kind !== 'host' ? `<button class="kick" data-kick="${esc(s.id)}" title="Remove" aria-label="Remove ${esc(s.name)}">✕</button>` : ''}
          </div>`).join('')}
        ${full ? '' : '<div class="seat empty">Free seat…</div>'}
      </div>
      ${settingsHTML(net.settings)}
      <div class="modal-actions">
        <button class="btn" id="mClose">Close lobby</button>
        ${gameRunning() ? '<button class="btn" id="mResume">Back to game</button>' : ''}
        ${full ? '' : '<button class="btn" id="mAddAI">+ Computer</button>'}
        <button class="btn primary" id="mStartOnline" ${seats.length < 2 || !net.ready ? 'disabled' : ''}>Start game</button>
      </div>`, 'hostLobby');
    const copy = btn('mCopy');
    if (copy) copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(shareLink()); toast('Link copied!'); }
      catch (e) { btn('mLink').select(); toast('Select the link and copy it'); }
    });
    const link = btn('mLink');
    if (link) link.addEventListener('focus', () => link.select());
    modalBox.querySelectorAll('[data-kick]').forEach(b => b.addEventListener('click', () => kickSeat(b.dataset.kick)));
    bindSettings(net.settings, redraw => {
      store('settings', net.settings);
      refreshHostLobby(redraw);
    });
    btn('mClose').addEventListener('click', () => { leaveOnline(); resetToIdle(); showMenu(); });
    const resume = btn('mResume');
    if (resume) resume.addEventListener('click', closeModal);
    const add = btn('mAddAI');
    if (add) add.addEventListener('click', () => {
      if (net.seats.length >= MAX_PLAYERS) return;
      net.aiCount++;
      net.seats.push({ id: 'ai-' + net.aiCount, name: `Computer ${net.aiCount}`, kind: 'ai' });
      refreshHostLobby();
    });
    btn('mStartOnline').addEventListener('click', hostStart);
  }

  function kickSeat(id) {
    const conn = net.conns.get(id);
    net.seats = net.seats.filter(s => s.id !== id);
    if (conn) {
      safeSend(conn, { type: 'kicked' });
      setTimeout(() => conn.close(), 300); // onHostConnClosed does the rest
    }
    refreshHostLobby();
  }

  function hostStart() {
    if (net.seats.length < 2) return;
    const cfg = net.seats.slice(0, MAX_PLAYERS).map(s => ({
      name: s.name, ai: s.kind === 'ai', owner: s.kind === 'host' ? 'host' : s.kind === 'remote' ? s.id : null,
    }));
    for (const c of net.conns.values()) safeSend(c, { type: 'start' });
    net.outbox = [];
    newGame(cfg, net.settings);
  }

  // ---------- Client ----------
  function joinLobby(raw) {
    const code = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (code.length < 4) { toast('Enter the lobby code'); return; }
    if (!onlineAvailable()) return;
    leaveOnline();
    resetToIdle();
    net.role = 'client';
    net.settings = null;
    net.code = code;
    showClientLobby('Connecting…');
    const peer = new Peer({ debug: 0 });
    net.peer = peer;
    const fail = msg => {
      if (net.peer !== peer) return;
      leaveOnline();
      resetToIdle();
      showError(msg);
    };
    const timer = setTimeout(() => {
      if (!net.host || !net.host.open) fail(`Could not connect to lobby ${code}. Check the code and try again.`);
    }, 15000);
    peer.on('open', id => {
      if (net.peer !== peer) return;
      net.myId = id;
      const conn = peer.connect(PEER_PREFIX + code, { reliable: true });
      net.host = conn;
      conn.on('open', () => {
        clearTimeout(timer);
        inviteCode = '';
        safeSend(conn, { type: 'hello', name: myName() });
      });
      conn.on('data', msg => { if (net.host === conn) onClientData(msg, fail); });
      conn.on('close', () => { if (net.host === conn) fail('The connection to the host was closed.'); });
    });
    peer.on('error', err => {
      clearTimeout(timer);
      if (err.type === 'peer-unavailable') fail(`There is no open lobby with the code ${code}.`);
      else if (!net.host || !net.host.open) fail('Could not connect. Check your internet connection and try again.');
      else console.warn('PeerJS:', err.type);
    });
    updateUI();
  }

  function onClientData(msg, fail) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'lobby':
        net.seats = Array.isArray(msg.seats) ? msg.seats.slice(0, MAX_PLAYERS) : [];
        net.settings = cleanSettings(msg.settings);
        if (!gameRunning()) showClientLobby('You are in the lobby. Waiting for the host to start the game.');
        break;
      case 'start':
        gameId++;
        turnNo = -1;
        popups = []; flashes = [];
        meepleAnims.clear();
        leavingMeeples = []; landingMeeples = [];
        board = new Map([[key(0, 0), startTile()]]); // so the old game's meeples don't look like they are leaving
        logEl.innerHTML = '';
        net.needFit = true;
        closeModal();
        break;
      case 'state':
        try { applyState(msg.s, msg.ev); } catch (e) { console.warn('Invalid state', e); }
        break;
      case 'denied': fail(String(msg.reason || 'You cannot join this lobby.')); break;
      case 'kicked': fail('The host removed you from the lobby.'); break;
      case 'closed': fail('The host closed the lobby.'); break;
    }
  }

  const PHASES = ['place', 'meeple', 'ai', 'over'];
  function applyState(s, events) {
    const prevTurn = turnNo, prevPhase = phase;
    const oldBoard = board;
    if (animations !== (s.anim !== false)) setAnimations(s.anim !== false);
    players = s.players.slice(0, MAX_PLAYERS).map(p => ({
      name: cleanName(p.name) || 'Player', ai: !!p.ai, color: safeColor(p.color),
      score: Math.floor(+p.score) || 0, meeples: clamp(Math.floor(+p.meeples) || 0, 0, MAX_MEEPLES),
      owner: p.owner == null ? null : String(p.owner),
    }));
    // the board comes as changes: tiles to set and keys to delete (or all of it, with full)
    const delta = s.board && typeof s.board === 'object' ? s.board : { full: true, set: [], del: [], n: 0 };
    const set = Array.isArray(delta.set) ? delta.set : [];
    const del = Array.isArray(delta.del) ? delta.del.map(String) : [];
    board = delta.full ? new Map() : new Map(oldBoard);
    for (const k of del) board.delete(k);
    for (const row of set) {
      if (!Array.isArray(row)) continue;
      const [x, y, type, r, mp, mf, by, seed] = row;
      const d = TILE_DEFS[type];
      if (!d || !Number.isInteger(x) || !Number.isInteger(y)) continue;
      const meeple = players[mp] && d.f[mf] ? { p: mp, f: mf } : null;
      board.set(key(x, y), { x, y, type, rot: ((r | 0) % 4 + 4) % 4, meeple, by: players[by] ? by : -1, seed: seed | 0 });
      // a new meeple (mine or someone else's) → it flies in
      const old = oldBoard.get(key(x, y));
      if (meeple && !(old && old.meeple)) startMeepleAnim(x, y);
    }
    // out of step with the host (should not happen): ask for the whole board again
    if (board.size !== delta.n && !net.syncAsked) { net.syncAsked = true; safeSend(net.host, { type: 'sync' }); }
    if (delta.full) net.syncAsked = false;
    // a meeple that disappeared (scored) → it flies back to the right
    const changed = delta.full ? oldBoard.keys() : [...set.filter(Array.isArray).map(row => key(row[0], row[1])), ...del];
    for (const k of changed) {
      const old = oldBoard.get(k);
      const t = board.get(k);
      if (!old) continue;
      if (!old.meeple || !t || t.meeple || !players[old.meeple.p]) continue;
      meepleScored(old, old.meeple.f, players[old.meeple.p].color);
    }
    remoteDeck = Math.floor(+s.deck) || 0;
    turnLimitMs = Math.max(0, +s.timeLimit || 0);
    turnDeadline = s.timeLeft > 0 ? performance.now() + Number(s.timeLeft) : 0;
    cur = players[s.cur] ? s.cur : 0;
    turnNo = s.turn | 0;
    tile = TILE_DEFS[s.tile] ? s.tile : null;
    phase = PHASES.includes(s.phase) ? s.phase : 'ai';
    placed = (s.placed && board.get(s.placed)) || null;
    lastPlaced = (s.last && board.get(s.last)) || null;
    const hostPending = s.pending && Number.isInteger(s.pending.x) && Number.isInteger(s.pending.y) ? { x: s.pending.x, y: s.pending.y } : null;
    const hostRot = ((s.rot | 0) % 4 + 4) % 4;

    if ((phase === 'place' || phase === 'meeple') && isMine(cur) && tile) {
      // the possible spots are computed without the provisionally placed tile (so it can be moved)
      if (placed) board.delete(key(placed.x, placed.y));
      candidates = computeCandidates(tile);
      if (placed) board.set(key(placed.x, placed.y), placed);
      pending = null;
      if (placed) rot = placed.rot;
      else if (turnNo !== prevTurn) rot = 0;
    } else {
      candidates = [];
      pending = hostPending;
      rot = hostRot;
    }
    meepleSpots = phase === 'meeple' && placed && isMine(cur) ? computeMeepleSpots(placed) : [];

    if (Array.isArray(events)) events.slice(0, 50).forEach(applyEvent);
    if (net.needFit) { net.needFit = false; fitView(false); }
    if (placed) ensureVisible(placed.x, placed.y);
    else if (pending && !isMine(cur)) ensureVisible(pending.x, pending.y);
    if (turnNo !== prevTurn && isMine(cur) && phase === 'place') toast('Your turn!');
    updateUI();
    if (phase === 'over' && prevPhase !== 'over') {
      const id = gameId;
      setTimeout(() => { if (id === gameId && phase === 'over') showFinal(); }, finalDelay());
    }
  }

  function sendAct(a) {
    if (!net.host) return;
    safeSend(net.host, Object.assign({ type: 'act' }, a));
    phase = 'wait';
    updateUI();
  }

  function showClientLobby(msg) {
    const seats = net.seats;
    openModal(`
      <h2>Lobby ${esc(net.code)}</h2>
      <p class="muted">${esc(msg)}</p>
      ${seats.length ? `<div class="seats-head"><b>Players</b><span>${seats.length} / ${MAX_PLAYERS}</span></div>` : ''}
      <div class="seats">
        ${seats.map((s, i) => `
          <div class="seat">
            ${swatch(PLAYER_COLORS[i])}
            <span class="nm">${esc(cleanName(s.name))}${s.id === net.myId ? ' <small>(you)</small>' : s.kind === 'host' ? ' <small>(host)</small>' : s.kind === 'ai' ? ' <small title="Computer">🤖</small>' : ''}</span>
          </div>`).join('')}
      </div>
      ${net.settings ? `<p class="lobby-settings">${esc(settingsSummary(net.settings))}</p>` : ''}
      <div class="modal-actions"><button class="btn" id="mLeave">Leave</button></div>`, 'clientLobby');
    btn('mLeave').addEventListener('click', () => { leaveOnline(); resetToIdle(); showMenu(); });
  }

  // ================= Startup =================
  const onBtn = (el, fn) => el.addEventListener('click', e => { e.currentTarget.blur(); fn(); });
  onBtn(btnRotate, rotateAction);
  onBtn(btnSkip, skipAction);
  onBtn(btnUndo, undoAction);
  preview.addEventListener('click', rotateAction);
  onBtn(btn('btnRules'), () => showRules(null));
  onBtn(btn('btnNew'), newGameButton);
  onBtn(btn('btnCenter'), () => fitView(true));
  onBtn(btn('btnZoomIn'), () => zoomAt(W / 2, H / 2, 1.25));
  onBtn(btn('btnZoomOut'), () => zoomAt(W / 2, H / 2, 1 / 1.25));
  window.addEventListener('beforeunload', () => { if (net.role !== 'local') leaveOnline(); });

  board.set(key(0, 0), startTile());
  new ResizeObserver(resize).observe(wrap);
  resize();
  updateUI();
  showMenu();
  requestAnimationFrame(loop);

  // for debugging from the console
  window.__carcassonne = {
    get board() { return board; }, get players() { return players; },
    get phase() { return phase; }, get net() { return net; },
    get candidates() { return candidates; }, get spots() { return meepleSpots; }, get placed() { return placed; },
    get leaving() { return leavingMeeples; }, get cam() { return cam; },
    clickWorld: (x, y) => handleClick(cam.x + x * cam.size, cam.y + y * cam.size),
    deckComposition,
  };
})();
