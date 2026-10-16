'use strict';
(() => {
  // ================= Constante =================
  // Laturi: 0 = N, 1 = E, 2 = S, 3 = V (în sensul acelor de ceasornic)
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const PLAYER_COLORS = ['#d7392b', '#2c6fd8', '#f0c02f', '#8e44b8'];
  const MAX_MEEPLES = 10;
  const MIN_SIZE = 28, MAX_SIZE = 190;
  const COL = {
    field: '#8bbd4f', tuft: '#6f9d3a',
    city: '#dcae66', wall: '#7a4c24',
    road: '#f4ecd6', roadEdge: '#8c7552',
    roof: '#b8452e', stone: '#efe6d2', dark: '#4e3826',
    pennant: '#1f4fa3',
  };
  const KIND = {
    road: { done: 'drum finalizat', open: 'drum neterminat' },
    city: { done: 'oraș finalizat', open: 'oraș neterminat' },
    monastery: { done: 'mănăstire finalizată', open: 'mănăstire neterminată' },
  };

  // Setul de bază (72 de piese). e = margini N,E,S,V: C = oraș, R = drum, F = câmp.
  // f = elementele piesei; s = laturile pe care le atinge; p = scut.
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

  // ================= Stare =================
  let players = [];           // {name, ai, color, score, meeples, owner}
  let board = new Map();      // "x,y" -> {x, y, type, rot, meeple: {p, f} | null, by, seed}
  let deck = [];
  let remoteDeck = 0;         // la client: câte piese mai are gazda în pachet
  let cur = 0;
  let turnNo = 0;
  let tile = null;            // tipul piesei trase în tura curentă
  let rot = 0;
  let phase = 'idle';         // idle | place | meeple | end | ai | wait | over
  let pending = null;         // {x, y} – piesa „în aer” (mutarea calculatorului / trimisă la gazdă)
  let candidates = [];        // [{x, y, rots: [...]}]
  let placed = null;          // piesa pusă în tura curentă (faza meeple)
  let lastPlaced = null;
  let meepleSpots = [];
  let gameId = 0;
  let popups = [];
  let flashes = [];

  // Timp pe tură (secunde, 0 = fără limită)
  const TURN_TIMES = [15, 30, 45, 60, 90, 0];
  let turnTime = 30;

  // Setările unui joc. Opțiunile au nume în engleză (Small / Normal / Large …).
  const DECK_SIZES = {
    small: { label: 'Small', factor: 0.5 },
    normal: { label: 'Normal', factor: 1 },
    large: { label: 'Large', factor: 1.5 },
  };
  const MEEPLE_COUNTS = {
    few: { label: 'Few', n: 5 },
    normal: { label: 'Normal', n: 7 },
    many: { label: 'Many', n: 10 },
  };
  const DEFAULT_SETTINGS = { deck: 'normal', meeples: 'normal', time: 30 };
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const cleanSettings = s => ({
    deck: s && hasOwn(DECK_SIZES, s.deck) ? s.deck : DEFAULT_SETTINGS.deck,
    meeples: s && hasOwn(MEEPLE_COUNTS, s.meeples) ? s.meeples : DEFAULT_SETTINGS.meeples,
    time: s && TURN_TIMES.includes(s.time) ? s.time : DEFAULT_SETTINGS.time,
  });
  let deckTotal = 71;          // câte piese avea pachetul la început (pentru calculator)
  let turnTimer = null, turnDeadline = 0, turnLimitMs = 0;

  // Animația meeple-ilor: zboară din dreapta și aterizează pe tablă
  const MEEPLE_FLY_MS = 650, MEEPLE_LAND_MS = 380, MEEPLE_ANIM_MS = MEEPLE_FLY_MS + MEEPLE_LAND_MS;
  const meepleAnims = new Map();  // "x,y" -> momentul pornirii
  const startMeepleAnim = (x, y) => meepleAnims.set(x + ',' + y, performance.now());

  // ...și când e punctat, se întoarce tot spre dreapta: o mică săritură, apoi zbor în arc.
  const MEEPLE_HOP_MS = 240, MEEPLE_LEAVE_MS = 720, MEEPLE_OUT_MS = MEEPLE_HOP_MS + MEEPLE_LEAVE_MS;
  let leavingMeeples = [];        // {x, y (coordonate pe tablă), color, t0}
  function startLeaveAnim(x, y, color) {
    // dacă pleacă mai mulți deodată, pleacă pe rând (în cascadă)
    const now = performance.now();
    const queued = leavingMeeples.filter(a => a.t0 > now - 40).length;
    leavingMeeples.push({ x, y, color, t0: now + Math.min(queued * 80, 1200) });
  }
  // cât să așteptăm ecranul final ca să se vadă toți meeple-ii plecând
  const finalDelay = () => Math.max(1200, ...leavingMeeples.map(a => a.t0 + MEEPLE_OUT_MS - performance.now() + 300));

  // Online: gazda ține jocul, clienții primesc starea și trimit doar mutări.
  const net = {
    role: 'local',            // local | host | client
    myId: 'local',            // cine sunt eu (players[i].owner === myId => jucătorul meu)
    peer: null, ready: false,
    conns: new Map(),         // la gazdă: peerId -> conexiune
    host: null,               // la client: conexiunea cu gazda
    code: '', seats: [], outbox: [], queued: false, aiCount: 0,
  };

  const key = (x, y) => x + ',' + y;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cleanName = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 14);
  const isMine = i => !!players[i] && !players[i].ai && players[i].owner === net.myId;
  const humanTurn = () => isMine(cur);
  const gameRunning = () => ['place', 'meeple', 'end', 'ai', 'wait'].includes(phase);
  const timeLabel = t => (t ? `${t} secunde` : 'Fără limită');
  const deckLeft = () => (net.role === 'client' ? remoteDeck : deck.length);
  const startTile = () => ({ x: 0, y: 0, type: START_TILE, rot: 0, meeple: null, by: -1, seed: 1 });

  // ================= Reguli =================
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

  // Parcurge o structură (drum / oraș) pornind de la elementul fi al piesei (x, y).
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

  // Structurile ocupate care tocmai au fost finalizate de piesa de la (x, y).
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

  // ================= Desfășurarea jocului =================
  // Câte piese de un tip intră în joc pentru o mărime de pachet (cel puțin una din fiecare).
  const tileCount = (id, size) => Math.max(1, Math.round(TILE_DEFS[id].n * DECK_SIZES[size].factor));
  const deckTotalFor = size => Object.keys(TILE_DEFS).reduce((sum, id) => sum + tileCount(id, size), 0);

  function buildDeck(size) {
    const d = [];
    for (const id in TILE_DEFS) {
      const n = tileCount(id, size) - (id === START_TILE ? 1 : 0);
      for (let i = 0; i < n; i++) d.push(id);
    }
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  // cfg: [{name, ai, owner}] – owner = cine controlează jucătorul ('local', 'host' sau id-ul unui client)
  // settings: {deck, meeples, time} – vezi DEFAULT_SETTINGS
  function newGame(cfg, settings) {
    gameId++;
    const s = cleanSettings(settings);
    turnTime = s.time;
    meepleAnims.clear();
    leavingMeeples = [];
    players = cfg.map((c, i) => ({
      name: cleanName(c.name) || `Jucător ${i + 1}`, ai: !!c.ai, color: PLAYER_COLORS[i],
      score: 0, meeples: MEEPLE_COUNTS[s.meeples].n, owner: c.ai ? null : (c.owner || 'local'),
    }));
    board = new Map([[key(0, 0), startTile()]]);
    deck = buildDeck(s.deck);
    deckTotal = deck.length;
    cur = 0; turnNo = 0; lastPlaced = null; placed = null; pending = null;
    popups = []; flashes = [];
    logEl.innerHTML = '';
    log(['Joc nou! Începe ', { p: 0 }, '.'], 'sep');
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
        log(['O piesă nu se potrivea nicăieri și a fost scoasă din joc.']);
        emit({ k: 'toast', text: 'Piesa nu se potrivește nicăieri – se trage alta' });
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
      if (net.role !== 'local') toast('E rândul tău!');
      else if (players.filter(p => !p.ai).length > 1) toast(`Rândul lui ${players[cur].name}`);
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
      const [px, py] = featurePos(t.type, m.f, t.rot);
      startLeaveAnim(m.x + px, m.y + py, players[m.p].color);
      t.meeple = null;
      players[m.p].meeples++;
    }
    const what = endGame ? KIND[st.kind].open : KIND[st.kind].done;
    let extra = st.kind === 'monastery' && !endGame ? '' : pieces(st.size);
    if (st.pennants) extra += `, ${st.pennants} ${st.pennants === 1 ? 'scut' : 'scuturi'}`;
    const parts = [];
    winners.forEach((p, i) => { if (i) parts.push(' & '); parts.push({ p }); });
    parts.push(` +${pts} · ${what}${extra ? ` (${extra})` : ''}`);
    log(parts);
  }

  function endGame() {
    stopTurnTimer();
    phase = 'over';
    tile = null; pending = null;
    log(['Pachetul s-a terminat – scor final'], 'sep');
    for (const t of board.values()) {
      if (t.meeple) applyScore(structureOf(t.x, t.y, t.meeple.f), true);
    }
    updateUI();
    const id = gameId;
    setTimeout(() => { if (id === gameId) showFinal(); }, finalDelay());
  }

  // ================= Acțiuni jucător =================
  // Click pe un loc auriu pune piesa direct. Apoi: click pe piesă = rotește, click pe alt loc = mută,
  // click pe un cerc = meeple, „Fără meeple” = termină tura.
  // La client, acțiunile pleacă la gazdă; gazda le aplică și trimite înapoi starea nouă.
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

  // Pune (sau mută) piesa curentă; tura rămâne deschisă pentru rotire și meeple.
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

  // Ia piesa de pe tablă înapoi în mână (cu aceeași rotație).
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

  // Meeple-ul zboară pe tablă; punctăm abia după ce aterizează.
  function doMeeple(fi) {
    putMeeple(fi);
    phase = 'end';
    updateUI();
    const id = gameId, t = turnNo;
    setTimeout(() => { if (id === gameId && t === turnNo && phase === 'end') finishTurn(); }, MEEPLE_ANIM_MS + 80);
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

  // ---------- Timp pe tură ----------
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

  // Timpul a expirat: piesa se pune automat (fără meeple) și tura trece mai departe.
  function onTimeout() {
    if (phase !== 'place' && phase !== 'meeple') return;
    if (phase === 'place') {
      const mv = aiChooseMove(false);
      pending = { x: mv.x, y: mv.y };
      rot = mv.rot;
      placeTile();
    }
    log([{ p: cur }, ' a rămas fără timp.']);
    emit({ k: 'toast', text: `Timpul a expirat pentru ${players[cur].name}!` });
    finishTurn();
  }

  // ================= Calculatorul =================
  function runAI() {
    const id = gameId;
    setTimeout(() => {
      if (id !== gameId) return;
      const mv = aiChooseMove(true);
      rot = mv.rot;
      pending = { x: mv.x, y: mv.y };
      ensureVisible(mv.x, mv.y);
      updateUI();
      setTimeout(() => {
        if (id !== gameId) return;
        placeTile();
        if (mv.f !== null) putMeeple(mv.f);
        updateUI();
        setTimeout(() => { if (id === gameId) finishTurn(); }, mv.f !== null ? MEEPLE_ANIM_MS + 80 : 450);
      }, 650);
    }, 450);
  }

  function aiChooseMove(allowMeeple) {
    const me = cur;
    let best = null, bestVal = -Infinity;
    for (const c of candidates) {
      for (const r of c.rots) {
        const t = { x: c.x, y: c.y, type: tile, rot: r, meeple: null };
        const k = key(c.x, c.y);
        board.set(k, t);
        const options = [null];
        if (allowMeeple && players[me].meeples > 0) {
          TILE_DEFS[tile].f.forEach((f, fi) => {
            if (structureOf(c.x, c.y, fi).meeples.length === 0) options.push(fi);
          });
        }
        for (const fi of options) {
          t.meeple = fi === null ? null : { p: me, f: fi };
          const v = evaluate(me, t) + Math.random() * 0.3;
          if (v > bestVal) { bestVal = v; best = { x: c.x, y: c.y, rot: r, f: fi }; }
        }
        board.delete(k);
      }
    }
    return best;
  }

  // Cât de bună e poziția pentru „me” comparativ cu cel mai bun adversar.
  function evaluate(me, t) {
    const score = players.map(p => p.score);
    const hand = players.map(p => p.meeples);
    if (t.meeple) hand[me]--;
    const seen = new Set();
    for (const st of findCompletions(t.x, t.y)) {
      const pts = pointsFor(st, false);
      winnersOf(st.meeples).forEach(p => (score[p] += pts));
      st.meeples.forEach(m => hand[m.p]++);
      st.visited.forEach(v => seen.add(v));
    }
    const late = Math.min(1, deck.length / 20);
    const proj = players.map(() => 0);
    for (const b of board.values()) {
      if (!b.meeple || seen.has(b.x + ',' + b.y + ',' + b.meeple.f)) continue;
      const st = structureOf(b.x, b.y, b.meeple.f);
      st.visited.forEach(v => seen.add(v));
      let val;
      if (st.kind === 'road') {
        val = st.size + 1.2 * late;
      } else if (st.kind === 'city') {
        const chance = (st.open <= 1 ? 0.75 : st.open <= 2 ? 0.55 : st.open <= 4 ? 0.35 : 0.2) * late;
        val = (st.size + st.pennants) * (1 + chance) + 1.5 * late;
      } else {
        val = st.size + (9 - st.size) * 0.55 * late;
      }
      winnersOf(st.meeples).forEach(p => (proj[p] += val));
    }
    const meepleWorth = 0.4 + 1.6 * (deck.length / Math.max(1, deckTotal));
    const total = score.map((s, i) => s + proj[i] + hand[i] * meepleWorth * (hand[i] <= 2 ? 1.5 : 1));
    let opp = -Infinity;
    total.forEach((v, i) => { if (i !== me && v > opp) opp = v; });
    return total[me] - opp;
  }

  // ================= Desen piese =================
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

  // Unde stă meeple-ul pe un element (coordonate în piesă, -0.5..0.5).
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
    // forma de bază e desenată pentru orientarea canonică, apoi rotită
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

    // zidurile (doar spre câmp)
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

  // o = {angle, sx, sy}: înclinare și turtire, ancorate la tălpi (pentru aterizare)
  function drawMeeple(ctx, x, y, size, color, alpha = 1, o = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y + size * 0.48);
    if (o.angle) ctx.rotate(o.angle);
    ctx.scale(size * (o.sx || 1), size * (o.sy || 1));
    ctx.translate(0, -0.48);
    ctx.beginPath();
    ctx.arc(0, -0.3, 0.17, 0, Math.PI * 2);
    ctx.moveTo(-0.13, -0.15);
    ctx.lineTo(-0.46, -0.06); ctx.lineTo(-0.46, 0.07); ctx.lineTo(-0.17, 0.08);
    ctx.lineTo(-0.34, 0.48); ctx.lineTo(-0.08, 0.48); ctx.lineTo(0, 0.3);
    ctx.lineTo(0.08, 0.48); ctx.lineTo(0.34, 0.48); ctx.lineTo(0.17, 0.08);
    ctx.lineTo(0.46, 0.07); ctx.lineTo(0.46, -0.06); ctx.lineTo(0.13, -0.15);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.16;
    ctx.strokeStyle = 'rgba(20, 14, 8, 0.9)';
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fill();
    // un mic luciu pe cap
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

  // Meeple-ul vine în arc din dreapta tablei, se turtește la aterizare și ridică puțin praf.
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
    // praf: un inel care se lărgește și câteva fire care sar în lateral
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

  // Drumul invers: meeple-ul punctat se ghemuiește, sare și zboară în arc spre dreapta tablei.
  function drawLeavingMeeple(ctx, tx, ty, size, color, elapsed) {
    const footY = ty + size * 0.48;
    if (elapsed < 0) {                 // își așteaptă rândul în cascadă
      drawMeepleShadow(ctx, tx, footY, size, 0.3);
      drawMeeple(ctx, tx, ty, size, color);
      return;
    }
    if (elapsed < MEEPLE_HOP_MS) {
      const s = elapsed / MEEPLE_HOP_MS;
      const crouch = Math.sin(Math.min(1, s / 0.7) * Math.PI);    // se turtește și revine
      const stretch = s > 0.7 ? (s - 0.7) / 0.3 : 0;               // apoi se întinde de avânt
      // inel strălucitor în culoarea jucătorului
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
      const e = k * k * (1.4 - 0.4 * k);    // pleacă lin și accelerează spre margine
      return [
        (1 - e) * (1 - e) * tx + 2 * (1 - e) * e * cx + e * e * ex,
        (1 - e) * (1 - e) * ty + 2 * (1 - e) * e * cy + e * e * ey,
        e,
      ];
    };
    drawMeepleShadow(ctx, tx, footY, size, 0.3 * (1 - t), 1 - 0.5 * t);
    // o dâră de sclipici în urmă
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

  // ================= Tabla (canvas) =================
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
    const size = clamp(Math.min(W / w, H / h, 96), MIN_SIZE, MAX_SIZE);
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const target = { x: W / 2 - cx * size, y: H / 2 - cy * size, size };
    if (animate) camAnim = { from: { ...cam }, to: target, t0: performance.now() };
    else Object.assign(cam, target);
    dirty = true;
  }

  function ensureVisible(x, y) {
    const S = cam.size, sx = cam.x + x * S, sy = cam.y + y * S, m = S * 0.7;
    if (sx < m || sx > W - m || sy < m || sy > H - m) {
      camAnim = { from: { ...cam }, to: { x: W / 2 - x * S, y: H / 2 - y * S, size: S }, t0: performance.now() };
    }
  }

  function zoomAt(sx, sy, factor) {
    const ns = clamp(cam.size * factor, MIN_SIZE, MAX_SIZE);
    const wx = (sx - cam.x) / cam.size, wy = (sy - cam.y) / cam.size;
    cam.size = ns;
    cam.x = sx - wx * ns;
    cam.y = sy - wy * ns;
    camAnim = null;
    dirty = true;
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function render(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const S = cam.size;
    const visible = (x, y) => {
      const sx = cam.x + x * S, sy = cam.y + y * S;
      return sx > -S && sx < W + S && sy > -S && sy < H + S;
    };

    for (const t of board.values()) {
      if (visible(t.x, t.y)) drawTile(ctx, t.type, t.rot, cam.x + t.x * S, cam.y + t.y * S, S, t.seed);
    }

    // sclipire pe structurile punctate
    flashes = flashes.filter(f => now - f.t < 1300);
    for (const f of flashes) {
      ctx.globalAlpha = 0.5 * (1 - (now - f.t) / 1300);
      ctx.fillStyle = f.color;
      for (const [x, y] of f.tiles) ctx.fillRect(cam.x + (x - 0.5) * S, cam.y + (y - 0.5) * S, S, S);
    }
    ctx.globalAlpha = 1;

    // ultima piesă pusă
    if (lastPlaced && board.has(key(lastPlaced.x, lastPlaced.y)) && lastPlaced.by >= 0) {
      ctx.strokeStyle = players[lastPlaced.by].color;
      ctx.lineWidth = 3;
      ctx.strokeRect(cam.x + (lastPlaced.x - 0.5) * S + 1.5, cam.y + (lastPlaced.y - 0.5) * S + 1.5, S - 3, S - 3);
    }

    // locuri posibile (aurii = se potrivesc cu rotația curentă)
    const choosing = (phase === 'place' || phase === 'meeple') && humanTurn();
    if (choosing) {
      ctx.setLineDash([6, 5]);
      for (const c of candidates) {
        if (placed && placed.x === c.x && placed.y === c.y) continue;
        const ok = phase === 'place' && c.rots.includes(rot);
        const x = cam.x + (c.x - 0.5) * S + 3, y = cam.y + (c.y - 0.5) * S + 3;
        roundRect(ctx, x, y, S - 6, S - 6, Math.min(10, S * 0.12));
        ctx.fillStyle = ok ? 'rgba(255, 233, 140, 0.22)' : 'rgba(255, 255, 255, 0.06)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = ok ? 'rgba(255, 233, 140, 0.9)' : 'rgba(255, 255, 255, 0.3)';
        ctx.stroke();
      }
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

    // piesa „în aer”: mutarea calculatorului sau o mutare trimisă la gazdă
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

    // piesa pusă în tura curentă
    if (placed) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffe066';
      ctx.strokeRect(cam.x + (placed.x - 0.5) * S + 1.5, cam.y + (placed.y - 0.5) * S + 1.5, S - 3, S - 3);
    }

    // meeple (cei proaspăt puși vin în zbor)
    const ms = S * 0.3;
    for (const [k, t0] of meepleAnims) {
      const t = board.get(k);
      if (!t || !t.meeple || now - t0 > MEEPLE_ANIM_MS) meepleAnims.delete(k);
    }
    for (const t of board.values()) {
      if (!t.meeple) continue;
      const [px, py] = featurePos(t.type, t.meeple.f, t.rot);
      const x = cam.x + (t.x + px) * S, y = cam.y + (t.y + py) * S;
      const color = players[t.meeple.p].color;
      const t0 = meepleAnims.get(key(t.x, t.y));
      if (t0 !== undefined) {
        drawFlyingMeeple(ctx, x, y, ms, color, now - t0);
      } else if (visible(t.x, t.y)) {
        drawMeepleShadow(ctx, x, y + ms * 0.48, ms, 0.3);
        drawMeeple(ctx, x, y, ms, color);
      }
    }

    // meeple punctați care se întorc spre dreapta
    leavingMeeples = leavingMeeples.filter(a => now - a.t0 < MEEPLE_OUT_MS);
    for (const a of leavingMeeples) {
      drawLeavingMeeple(ctx, cam.x + a.x * S, cam.y + a.y * S, ms, a.color, now - a.t0);
    }

    // locuri pentru meeple
    if (phase === 'meeple' && placed && humanTurn()) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 220);
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

    // „+N” plutitor
    popups = popups.filter(p => now - p.t < 1700);
    for (const p of popups) {
      const k = (now - p.t) / 1700;
      const sx = cam.x + p.x * S, sy = cam.y + p.y * S - k * 45;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.font = `800 ${Math.round(Math.max(18, S * 0.3))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
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
    if (dirty || popups.length || flashes.length || meepleAnims.size || leavingMeeples.length || phase === 'meeple') {
      render(now);
      dirty = false;
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
      const ns = clamp(pinch.size * dist(a, b) / pinch.d, MIN_SIZE, MAX_SIZE);
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

  // ================= Interfață =================
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

  // Cronometrul din bara de jos (rulează în fiecare cadru, modifică DOM-ul doar când e nevoie)
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
  const pieces = n => n === 1 ? '1 piesă' : n < 20 ? `${n} piese` : `${n} de piese`;

  function updateUI() {
    playersEl.innerHTML = players.map((p, i) => {
      const tag = p.ai ? ' <small>(calculator)</small>' : net.role !== 'local' && p.owner === net.myId ? ' <small>(tu)</small>' : '';
      return `
      <div class="player ${i === cur && phase !== 'over' ? 'active' : ''}" style="--c:${p.color}">
        ${swatch(p.color)}
        <div class="pinfo">
          <div class="pname">${esc(p.name)}${tag}</div>
          <div class="meeples" title="${p.meeples} meeple disponibili">${'<i></i>'.repeat(p.meeples)}</div>
        </div>
        <div class="score">${p.score}</div>
      </div>`;
    }).join('');

    deckEl.textContent = phase === 'over' ? 'Pachet gol' : phase === 'idle' ? '' : `Rămase: ${deckLeft()}`;
    netEl.hidden = net.role === 'local';
    netEl.textContent = net.role === 'host' ? `🌐 Online · ești gazda · cod ${net.code}` : `🌐 Online · lobby ${net.code}`;

    const mine = isMine(cur);
    const p = players[cur];
    let msg = '';
    if (phase === 'place') {
      msg = mine
        ? 'Click pe un loc auriu ca să pui piesa. Cu ⟳ (sau R) o rotești înainte.'
        : 'își alege locul pentru piesă…';
    } else if (phase === 'meeple') {
      msg = mine
        ? 'Click pe piesă o rotește, click pe alt loc o mută. Apoi pune un meeple pe un cerc sau alege „Fără meeple”.'
        : 'decide dacă pune un meeple…';
    } else if (phase === 'end') {
      msg = 'și-a încheiat tura.';
    } else if (phase === 'ai') {
      msg = 'se gândește…';
    } else if (phase === 'wait') {
      msg = 'se trimite mutarea…';
    }
    if (phase === 'over') statusEl.innerHTML = '<b>Jocul s-a terminat!</b>';
    else if (phase === 'idle' || !p) statusEl.textContent = 'Alege un mod de joc ca să începi.';
    else statusEl.innerHTML = `${playerTag(cur)} · ${msg}`;

    // bara de jos de pe tablă
    actionBar.hidden = !gameRunning() || !p;
    if (p) {
      const c = placed && candidateAt(placed.x, placed.y);
      btnRotate.hidden = !(mine && (phase === 'place' || phase === 'meeple'));
      btnRotate.disabled = phase === 'meeple' && !(c && c.rots.length > 1);
      btnSkip.hidden = btnUndo.hidden = !(mine && phase === 'meeple');
      btnSkip.textContent = meepleSpots.length ? 'Fără meeple' : '✓ Gata';
      actionBar.classList.toggle('has-btns', !btnRotate.hidden);
      timerEl.style.setProperty('--ring', p.color);
      let text;
      if (mine && phase === 'place') text = 'Alege un loc auriu';
      else if (mine && phase === 'meeple') {
        text = meepleSpots.length ? 'Pui un meeple? Atinge un cerc' : p.meeples ? 'Aici nu poți pune meeple' : 'Nu mai ai meeple';
      } else if (phase === 'wait') text = 'Se trimite…';
      else if (phase === 'ai') text = `${playerTag(cur)} se gândește…`;
      else if (phase === 'end') text = `${playerTag(cur)}`;
      else text = `${playerTag(cur)} mută…`;
      barText.innerHTML = text;
    }
    btn('btnNew').textContent = net.role === 'client' ? 'Ieși' : 'Joc nou';

    drawPreview();
    dirty = true;
    if (net.role === 'host') queueBroadcast();
  }

  // Evenimentele (jurnal, „+N”, sclipiri, mesaje) se aplică local și, la gazdă, pleacă și la clienți.
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
    } else if (ev.k === 'pop') {
      popups.push({ x: +ev.x || 0, y: +ev.y || 0, text: String(ev.text).slice(0, 8), color, t: now });
    } else if (ev.k === 'flash' && Array.isArray(ev.tiles)) {
      const tiles = ev.tiles.filter(Array.isArray).map(t => [+t[0] || 0, +t[1] || 0]);
      flashes.push({ tiles, color, t: now });
    }
  }
  const safeColor = c => (/^#[0-9a-f]{6}$/i.test(String(c)) ? c : '#888888');

  // parts: texte și {p: index} pentru numele unui jucător
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
    leavingMeeples = [];
    players = []; deck = []; remoteDeck = 0;
    board = new Map([[key(0, 0), startTile()]]);
    tile = null; pending = null; placed = null; lastPlaced = null;
    meepleSpots = []; candidates = []; popups = []; flashes = [];
    cur = 0; turnNo = 0;
    phase = 'idle';
    logEl.innerHTML = '';
    fitView(false);
    updateUI();
  }

  // ---------- Setări salvate ----------
  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem('carcassonne-mini-' + k));
      localStorage.setItem('carcassonne-mini-' + k, JSON.stringify(v));
    } catch (e) { /* fără localStorage */ }
    return null;
  }
  const myName = () => cleanName(store('name')) || 'Jucător';

  const DEFAULT_CFG = {
    count: 2,
    players: [
      { name: '', ai: false },
      { name: 'Calculator', ai: true },
      { name: 'Calculator 2', ai: true },
      { name: 'Calculator 3', ai: true },
    ],
  };
  function loadCfg() {
    const c = store('cfg');
    const cfg = c && Array.isArray(c.players) && c.players.length === 4 ? c : JSON.parse(JSON.stringify(DEFAULT_CFG));
    if (!cfg.players[0].name) cfg.players[0].name = myName();
    return cfg;
  }

  // ---------- Meniul principal ----------
  const params = new URLSearchParams(location.search);
  let inviteCode = (params.get('lobby') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

  function showMenu() {
    openModal(`
      <h2>Carcassonne Mini</h2>
      <p class="muted">Așază piese, construiește drumuri, orașe și mănăstiri și strânge cele mai multe puncte.</p>
      ${inviteCode ? `<p class="invite">Ai fost invitat în lobby-ul <b>${esc(inviteCode)}</b>. Scrie-ți numele și apasă „Intră”.</p>` : ''}
      <label class="field"><span>Numele tău</span><input id="mName" maxlength="14" value="${esc(myName())}"></label>
      <div class="menu">
        <button class="btn big ${inviteCode ? '' : 'primary'}" id="mLocal">🎲 Joc pe acest dispozitiv<small>cu prietenii de lângă tine sau cu calculatorul</small></button>
        <button class="btn big" id="mHost">🌐 Creează un lobby online<small>primești un cod pe care îl trimiți prietenilor</small></button>
        <div class="join-row">
          <input id="mCode" placeholder="COD LOBBY" maxlength="8" value="${esc(inviteCode)}" autocomplete="off" aria-label="Cod lobby">
          <button class="btn ${inviteCode ? 'primary' : ''}" id="mJoin">Intră</button>
        </div>
      </div>
      <div class="modal-actions">
        ${phase !== 'idle' ? '<button class="btn" id="mCancel">Înapoi la joc</button>' : ''}
        <button class="btn" id="mRules">Reguli</button>
      </div>`, 'menu');
    const saveName = () => store('name', cleanName(btn('mName').value) || 'Jucător');
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

  // ---------- Joc pe același dispozitiv ----------
  // ---------- Setările jocului (pachet, meeple, timp) ----------
  const loadSettings = () => cleanSettings(store('settings'));
  const isClassic = s => s.deck === DEFAULT_SETTINGS.deck && s.meeples === DEFAULT_SETTINGS.meeples && s.time === DEFAULT_SETTINGS.time;
  const shortTime = t => (t ? `${t} s` : 'fără limită');
  const settingsSummary = s =>
    `Piese: ${DECK_SIZES[s.deck].label} (${deckTotalFor(s.deck)}) · Meeple: ${MEEPLE_COUNTS[s.meeples].label} (${MEEPLE_COUNTS[s.meeples].n}) · Timp: ${shortTime(s.time)}`;

  function settingsHTML(s) {
    const chips = (setKey, opts, sub) => Object.keys(opts).map(k => `
      <button class="chip ${s[setKey] === k ? 'on' : ''}" data-set="${setKey}" data-val="${k}">${opts[k].label}<small>${sub(k)}</small></button>`).join('');
    return `
      <div class="settings">
        <div class="set-row">
          <span class="set-label">🧩 Piese</span>
          <div class="chips">${chips('deck', DECK_SIZES, k => deckTotalFor(k))}</div>
        </div>
        <div class="set-row">
          <span class="set-label">♟ Meeple</span>
          <div class="chips">${chips('meeples', MEEPLE_COUNTS, k => MEEPLE_COUNTS[k].n)}</div>
        </div>
        <div class="set-row">
          <span class="set-label">⏱ Timp pe tură</span>
          <select data-set="time" aria-label="Timp pe tură">
            ${TURN_TIMES.map(t => `<option value="${t}" ${t === s.time ? 'selected' : ''}>${timeLabel(t)}</option>`).join('')}
          </select>
        </div>
        <div class="set-foot">
          <button class="btn small" data-set="classic" ${isClassic(s) ? 'disabled' : ''}>↺ Setări clasice</button>
        </div>
      </div>`;
  }

  // Leagă butoanele din settingsHTML; onChange se cheamă după orice modificare.
  function bindSettings(s, onChange) {
    modalBox.querySelectorAll('.chip[data-set]').forEach(b => b.addEventListener('click', () => {
      s[b.dataset.set] = b.dataset.val;
      onChange();
    }));
    const sel = modalBox.querySelector('select[data-set="time"]');
    sel.addEventListener('change', () => { s.time = Number(sel.value); onChange(); });
    modalBox.querySelector('[data-set="classic"]').addEventListener('click', () => {
      Object.assign(s, DEFAULT_SETTINGS);
      onChange();
    });
  }

  function showSetup() {
    const cfg = loadCfg();
    const settings = loadSettings();
    const readInputs = () => {
      modalBox.querySelectorAll('input[data-i]').forEach(inp => (cfg.players[inp.dataset.i].name = inp.value));
      modalBox.querySelectorAll('select[data-i]').forEach(sel => (cfg.players[sel.dataset.i].ai = sel.value === 'ai'));
    };
    const draw = () => {
      openModal(`
        <h2>Joc pe acest dispozitiv</h2>
        <p class="muted">Jucătorii „Om” mută pe rând, pe același ecran.</p>
        <div class="seg">${[2, 3, 4].map(n => `<button class="btn ${cfg.count === n ? 'on' : ''}" data-n="${n}">${n} jucători</button>`).join('')}</div>
        <div class="setup-rows">
          ${cfg.players.slice(0, cfg.count).map((p, i) => `
            <div class="setup-row">
              ${swatch(PLAYER_COLORS[i])}
              <input data-i="${i}" maxlength="14" value="${esc(p.name)}" aria-label="Nume jucător ${i + 1}">
              <select data-i="${i}" aria-label="Tip jucător ${i + 1}">
                <option value="human" ${p.ai ? '' : 'selected'}>Om</option>
                <option value="ai" ${p.ai ? 'selected' : ''}>Calculator</option>
              </select>
            </div>`).join('')}
        </div>
        ${settingsHTML(settings)}
        <div class="modal-actions">
          <button class="btn" id="mBack">Înapoi</button>
          <button class="btn primary" id="mStart">Începe jocul</button>
        </div>`, 'setup');
      modalBox.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
        readInputs();
        cfg.count = Number(b.dataset.n);
        draw();
      }));
      bindSettings(settings, () => { readInputs(); store('settings', settings); draw(); });
      btn('mStart').addEventListener('click', () => {
        readInputs();
        store('cfg', cfg);
        store('settings', settings);
        leaveOnline();
        newGame(cfg.players.slice(0, cfg.count).map(p => ({ name: p.name, ai: p.ai, owner: 'local' })), settings);
      });
      btn('mBack').addEventListener('click', () => { readInputs(); store('cfg', cfg); showMenu(); });
    };
    draw();
  }

  function showRules(back) {
    openModal(`
      <h2>Reguli</h2>
      <div class="rules">
        <h4>Tura ta</h4>
        <p>1. Primești o piesă. Pune-o lângă cele de pe tablă, astfel încât marginile să se potrivească: oraș cu oraș, drum cu drum, câmp cu câmp.</p>
        <p>2. Dacă vrei, pune unul dintre meeple-ii tăi (7 în setările clasice) pe un drum, oraș sau mănăstire de pe piesa abia pusă. Nu poți intra într-o structură deja ocupată.</p>
        <h4>Puncte</h4>
        <ul>
          <li><b>Drum terminat:</b> 1 punct pe piesă.</li>
          <li><b>Oraș terminat:</b> 2 puncte pe piesă + 2 pe fiecare scut albastru.</li>
          <li><b>Mănăstire înconjurată</b> de 8 piese: 9 puncte.</li>
        </ul>
        <p>Când o structură se termină, meeple-ul se întoarce la tine. Dacă mai mulți jucători au meeple în aceeași structură, ia punctele cel cu cei mai mulți (la egalitate, toți).</p>
        <p>La final, structurile neterminate valorează 1 punct pe piesă (și 1 pe scut); mănăstirea, 1 + numărul vecinilor.</p>
        <p><i>Versiune simplificată: fără fermieri pe câmpuri.</i></p>
        <h4>Online</h4>
        <p>Unul dintre voi creează un lobby și trimite codul (sau linkul). Ceilalți deschid site-ul și intră cu codul. Gazda poate adăuga și calculatoare, apoi pornește jocul.</p>
        <h4>Timp</h4>
        <p>Fiecare jucător are un timp pe tură (implicit 30 de secunde). Dacă expiră, piesa se pune automat, fără meeple.</p>
        <h4>Controale</h4>
        <p>Click pe un loc auriu pune piesa. După aceea, click pe piesă o rotește, iar click pe alt loc o mută. Pui meeple atingând un cerc, sau apeși <b>Fără meeple</b> ca să termini tura. Cu <b>↶ Anulează</b> iei piesa înapoi în mână.</p>
        <p>Trage cu mouse-ul/degetul ca să muți tabla, rotița sau ciupirea pentru zoom.</p>
        <p><kbd>R</kbd> rotește · <kbd>Enter</kbd> / <kbd>Space</kbd> fără meeple · <kbd>Esc</kbd> anulează · <kbd>C</kbd> centrează</p>
      </div>
      <div class="modal-actions"><button class="btn primary" id="mBack">${back ? 'Înapoi' : 'Am înțeles'}</button></div>`, back ? 'rules-back' : 'rules');
    btn('mBack').addEventListener('click', () => (back ? back() : closeModal()));
  }

  function showFinal() {
    const ranking = players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score);
    const top = ranking[0].score;
    const winners = ranking.filter(r => r.score === top);
    const meWon = winners.some(w => isMine(w.i));
    const title = winners.length > 1 ? 'Egalitate!'
      : meWon ? `Bravo, ${esc(winners[0].name)}! 🎉` : `A câștigat ${esc(winners[0].name)}`;
    const again = net.role === 'host' ? 'Revanșă' : net.role === 'client' ? 'Ieși' : 'Joc nou';
    openModal(`
      <h2>🏆 ${title}</h2>
      <p class="muted">Pachetul s-a terminat. Clasament final:</p>
      <ol class="ranking">
        ${ranking.map((r, k) => `
          <li class="${r.score === top ? 'win' : ''}">
            <span class="pos">${k + 1}.</span>${swatch(r.color)}<span class="nm">${esc(r.name)}</span><span class="pts">${r.score}</span>
          </li>`).join('')}
      </ol>
      ${net.role === 'client' ? '<p class="muted">Gazda poate porni o revanșă – rămâi aici dacă vrei să mai joci.</p>' : ''}
      <div class="modal-actions">
        <button class="btn" id="mView">Vezi tabla</button>
        <button class="btn primary" id="mAgain">${again}</button>
      </div>`, 'final');
    btn('mView').addEventListener('click', () => { closeModal(); fitView(true); });
    btn('mAgain').addEventListener('click', newGameButton);
  }

  function showError(msg) {
    openModal(`
      <h2>Ups…</h2>
      <p>${esc(msg)}</p>
      <div class="modal-actions"><button class="btn primary" id="mMenu">Meniu</button></div>`, 'error');
    btn('mMenu').addEventListener('click', showMenu);
  }

  function newGameButton() {
    if (net.role === 'host') { refreshHostLobby(); showHostLobby(); }
    else if (net.role === 'client') showLeaveConfirm();
    else showMenu();
  }

  function showLeaveConfirm() {
    openModal(`
      <h2>Ieși din joc?</h2>
      <p>Dacă ieși, calculatorul joacă în locul tău până la final.</p>
      <div class="modal-actions">
        <button class="btn" id="mStay">Rămân</button>
        <button class="btn primary" id="mLeave">Ieși</button>
      </div>`, 'leave');
    btn('mStay').addEventListener('click', () => (phase === 'over' ? showFinal() : closeModal()));
    btn('mLeave').addEventListener('click', () => { leaveOnline(); resetToIdle(); showMenu(); });
  }

  // ================= Online (PeerJS / WebRTC) =================
  // Site-ul e static (GitHub Pages), deci browserele se conectează direct între ele.
  // Serverul public PeerJS e folosit doar ca să se găsească unii pe alții după cod.
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
    showError('Modul online nu s-a putut încărca. Verifică conexiunea la internet și reîncarcă pagina.');
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
    // lăsăm mesajul „closed” să plece înainte să închidem conexiunile
    setTimeout(() => {
      conns.forEach(c => { try { c.close(); } catch (e) { /* deja închisă */ } });
      if (peer) try { peer.destroy(); } catch (e) { /* deja distrus */ }
    }, 300);
  }

  // ---------- Gazda ----------
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
      // legătura cu serverul de lobby s-a pierdut; jocurile deja conectate merg mai departe
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
        showError('Nu am putut crea lobby-ul. Verifică conexiunea la internet și încearcă din nou.');
      } else {
        console.warn('PeerJS:', err.type);
      }
    });
  }

  function onHostData(conn, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'hello') {
      if (net.conns.has(conn.peer)) return;
      const deny = gameRunning() ? 'Jocul a început deja.' : net.seats.length >= 4 ? 'Lobby-ul e plin (maxim 4 jucători).' : '';
      if (deny) {
        safeSend(conn, { type: 'denied', reason: deny });
        setTimeout(() => conn.close(), 500);
        return;
      }
      net.conns.set(conn.peer, conn);
      const name = cleanName(msg.name) || 'Jucător';
      net.seats.push({ id: conn.peer, name, kind: 'remote' });
      toast(`${name} a intrat în lobby`);
      refreshHostLobby();
    } else if (msg.type === 'act') {
      onRemoteAction(conn.peer, msg);
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
      log([{ p: pi }, ' a ieșit din joc – calculatorul îi preia locul.']);
      emit({ k: 'toast', text: `${players[pi].name} a ieșit din joc` });
      if (pi === cur && phase === 'meeple') finishTurn();
      else if (pi === cur && phase === 'place') { stopTurnTimer(); pending = null; phase = 'ai'; updateUI(); runAI(); }
      else updateUI();
    } else if (seat) {
      toast(`${seat.name} a ieșit din lobby`);
    }
    refreshHostLobby();
  }

  // O mutare venită de la un client: o verificăm și o aplicăm ca pe una locală.
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
    queueBroadcast(); // mutare invalidă: retrimitem starea ca să se deblocheze clientul
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
      board: [...board.values()].map(t => [t.x, t.y, t.type, t.rot, t.meeple ? t.meeple.p : -1, t.meeple ? t.meeple.f : -1, t.by, t.seed]),
      deck: deck.length, cur, turn: turnNo, tile, phase, rot,
      pending: pending ? { x: pending.x, y: pending.y } : null,
      placed: placed ? key(placed.x, placed.y) : null,
      last: lastPlaced ? key(lastPlaced.x, lastPlaced.y) : null,
      timeLeft: turnDeadline ? Math.max(0, Math.round(turnDeadline - performance.now())) : 0,
      timeLimit: turnLimitMs,
    };
  }

  function refreshHostLobby() {
    if (net.role !== 'host') return;
    const info = {
      type: 'lobby', code: net.code, settings: net.settings,
      seats: net.seats.map(s => ({ id: s.id, name: s.name, kind: s.kind })),
    };
    for (const c of net.conns.values()) safeSend(c, info);
    if (modalView === 'hostLobby') showHostLobby();
  }

  function showHostLobby() {
    const seats = net.seats;
    openModal(`
      <h2>Lobby online</h2>
      ${net.ready ? `
        <div class="code-box">
          <div><small>Codul lobby-ului</small><b>${esc(net.code)}</b></div>
          <button class="btn small" id="mCopy">Copiază linkul</button>
        </div>
        <input class="link" id="mLink" readonly value="${esc(shareLink())}" aria-label="Link de invitație">
        <p class="muted">Trimite linkul sau codul prietenilor. Când intră, apar mai jos.</p>`
      : '<p class="muted">Se creează lobby-ul…</p>'}
      <div class="seats">
        ${seats.map((s, i) => `
          <div class="seat">
            ${swatch(PLAYER_COLORS[i])}
            <span class="nm">${esc(s.name)}${s.kind === 'host' ? ' <small>(tu, gazdă)</small>' : s.kind === 'ai' ? ' <small>(calculator)</small>' : ''}</span>
            ${s.kind !== 'host' ? `<button class="btn small" data-kick="${esc(s.id)}">Scoate</button>` : ''}
          </div>`).join('')}
        ${seats.length < 4 ? '<div class="seat empty">Loc liber…</div>' : ''}
      </div>
      ${settingsHTML(net.settings)}
      <div class="modal-actions">
        <button class="btn" id="mClose">Închide lobby-ul</button>
        ${gameRunning() ? '<button class="btn" id="mResume">Înapoi la joc</button>' : ''}
        ${seats.length < 4 ? '<button class="btn" id="mAddAI">+ Calculator</button>' : ''}
        <button class="btn primary" id="mStartOnline" ${seats.length < 2 || !net.ready ? 'disabled' : ''}>Pornește jocul</button>
      </div>`, 'hostLobby');
    const copy = btn('mCopy');
    if (copy) copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(shareLink()); toast('Link copiat!'); }
      catch (e) { btn('mLink').select(); toast('Selectează linkul și copiază-l'); }
    });
    const link = btn('mLink');
    if (link) link.addEventListener('focus', () => link.select());
    modalBox.querySelectorAll('[data-kick]').forEach(b => b.addEventListener('click', () => kickSeat(b.dataset.kick)));
    bindSettings(net.settings, () => {
      store('settings', net.settings);
      refreshHostLobby();
    });
    btn('mClose').addEventListener('click', () => { leaveOnline(); resetToIdle(); showMenu(); });
    const resume = btn('mResume');
    if (resume) resume.addEventListener('click', closeModal);
    const add = btn('mAddAI');
    if (add) add.addEventListener('click', () => {
      net.aiCount++;
      net.seats.push({ id: 'ai-' + net.aiCount, name: `Calculator ${net.aiCount}`, kind: 'ai' });
      refreshHostLobby();
    });
    btn('mStartOnline').addEventListener('click', hostStart);
  }

  function kickSeat(id) {
    const conn = net.conns.get(id);
    net.seats = net.seats.filter(s => s.id !== id);
    if (conn) {
      safeSend(conn, { type: 'kicked' });
      setTimeout(() => conn.close(), 300); // onHostConnClosed face restul
    }
    refreshHostLobby();
  }

  function hostStart() {
    if (net.seats.length < 2) return;
    const cfg = net.seats.map(s => ({
      name: s.name, ai: s.kind === 'ai', owner: s.kind === 'host' ? 'host' : s.kind === 'remote' ? s.id : null,
    }));
    for (const c of net.conns.values()) safeSend(c, { type: 'start' });
    net.outbox = [];
    newGame(cfg, net.settings);
  }

  // ---------- Client ----------
  function joinLobby(raw) {
    const code = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (code.length < 4) { toast('Scrie codul lobby-ului'); return; }
    if (!onlineAvailable()) return;
    leaveOnline();
    resetToIdle();
    net.role = 'client';
    net.settings = null;
    net.code = code;
    showClientLobby('Se conectează…');
    const peer = new Peer({ debug: 0 });
    net.peer = peer;
    const fail = msg => {
      if (net.peer !== peer) return;
      leaveOnline();
      resetToIdle();
      showError(msg);
    };
    const timer = setTimeout(() => {
      if (!net.host || !net.host.open) fail(`Nu m-am putut conecta la lobby-ul ${code}. Verifică codul și încearcă din nou.`);
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
      conn.on('close', () => { if (net.host === conn) fail('Conexiunea cu gazda s-a încheiat.'); });
    });
    peer.on('error', err => {
      clearTimeout(timer);
      if (err.type === 'peer-unavailable') fail(`Nu există niciun lobby deschis cu codul ${code}.`);
      else if (!net.host || !net.host.open) fail('Nu m-am putut conecta. Verifică internetul și încearcă din nou.');
      else console.warn('PeerJS:', err.type);
    });
    updateUI();
  }

  function onClientData(msg, fail) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'lobby':
        net.seats = Array.isArray(msg.seats) ? msg.seats.slice(0, 4) : [];
        net.settings = cleanSettings(msg.settings);
        if (!gameRunning()) showClientLobby('Ești în lobby. Aștepți ca gazda să pornească jocul.');
        break;
      case 'start':
        gameId++;
        turnNo = -1;
        popups = []; flashes = [];
        meepleAnims.clear();
        leavingMeeples = [];
        board = new Map([[key(0, 0), startTile()]]); // ca meeple-ii jocului vechi să nu pară că pleacă
        logEl.innerHTML = '';
        net.needFit = true;
        closeModal();
        break;
      case 'state':
        try { applyState(msg.s, msg.ev); } catch (e) { console.warn('Stare invalidă', e); }
        break;
      case 'denied': fail(String(msg.reason || 'Nu poți intra în acest lobby.')); break;
      case 'kicked': fail('Gazda te-a scos din lobby.'); break;
      case 'closed': fail('Gazda a închis lobby-ul.'); break;
    }
  }

  const PHASES = ['place', 'meeple', 'end', 'ai', 'over'];
  function applyState(s, events) {
    const prevTurn = turnNo, prevPhase = phase;
    const oldBoard = board;
    players = s.players.slice(0, 4).map(p => ({
      name: cleanName(p.name) || 'Jucător', ai: !!p.ai, color: safeColor(p.color),
      score: Math.floor(+p.score) || 0, meeples: clamp(Math.floor(+p.meeples) || 0, 0, MAX_MEEPLES),
      owner: p.owner == null ? null : String(p.owner),
    }));
    board = new Map();
    for (const [x, y, type, r, mp, mf, by, seed] of s.board) {
      const d = TILE_DEFS[type];
      if (!d || !Number.isInteger(x) || !Number.isInteger(y)) continue;
      const meeple = players[mp] && d.f[mf] ? { p: mp, f: mf } : null;
      board.set(key(x, y), { x, y, type, rot: ((r | 0) % 4 + 4) % 4, meeple, by: players[by] ? by : -1, seed: seed | 0 });
      // meeple nou (al meu sau al altcuiva) → intră în zbor
      const old = oldBoard.get(key(x, y));
      if (meeple && !(old && old.meeple)) startMeepleAnim(x, y);
    }
    // meeple dispărut (punctat) → se întoarce în zbor spre dreapta
    for (const [k, old] of oldBoard) {
      const t = board.get(k);
      if (!old.meeple || !t || t.meeple || !players[old.meeple.p]) continue;
      const [px, py] = featurePos(old.type, old.meeple.f, old.rot);
      startLeaveAnim(old.x + px, old.y + py, players[old.meeple.p].color);
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
      // locurile posibile se calculează fără piesa pusă provizoriu (ca s-o putem muta)
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
    if (turnNo !== prevTurn && isMine(cur) && phase === 'place') toast('E rândul tău!');
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
      <div class="seats">
        ${seats.map((s, i) => `
          <div class="seat">
            ${swatch(PLAYER_COLORS[i])}
            <span class="nm">${esc(cleanName(s.name))}${s.id === net.myId ? ' <small>(tu)</small>' : s.kind === 'host' ? ' <small>(gazdă)</small>' : s.kind === 'ai' ? ' <small>(calculator)</small>' : ''}</span>
          </div>`).join('')}
      </div>
      ${net.settings ? `<p class="lobby-settings">${esc(settingsSummary(net.settings))}</p>` : ''}
      <div class="modal-actions"><button class="btn" id="mLeave">Ieși</button></div>`, 'clientLobby');
    btn('mLeave').addEventListener('click', () => { leaveOnline(); resetToIdle(); showMenu(); });
  }

  // ================= Pornire =================
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

  // pentru depanare din consolă
  window.__carcassonne = {
    get board() { return board; }, get players() { return players; },
    get phase() { return phase; }, get net() { return net; },
    get candidates() { return candidates; }, get spots() { return meepleSpots; }, get placed() { return placed; },
    get leaving() { return leavingMeeples; }, get cam() { return cam; },
    clickWorld: (x, y) => handleClick(cam.x + x * cam.size, cam.y + y * cam.size),
  };
})();
