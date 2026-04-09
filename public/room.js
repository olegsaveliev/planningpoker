// --- State ---

const state = {
  roomId: window.location.pathname.split('/room/')[1],
  mySocketId: null,
  myName: null,
  mySeatIndex: null,
  isHost: false,
  phase: 'voting',
  participants: [],
  selectedVote: null,
};

// --- Color palettes for characters (20 unique) ---

const PALETTES = [
  { hat: '#e63946', shirt: '#457b9d', skin: '#ffd6a5', pants: '#2a4d6e', shoes: '#333', name: '#e63946' },
  { hat: '#2a9d8f', shirt: '#e9c46a', skin: '#ffd6a5', pants: '#264653', shoes: '#333', name: '#2a9d8f' },
  { hat: '#6a4c93', shirt: '#1982c4', skin: '#ffd6a5', pants: '#1a3550', shoes: '#333', name: '#6a4c93' },
  { hat: '#f77f00', shirt: '#d62828', skin: '#ffd6a5', pants: '#5a1a1a', shoes: '#333', name: '#f77f00' },
  { hat: '#06d6a0', shirt: '#ef476f', skin: '#ffd6a5', pants: '#8a2040', shoes: '#333', name: '#06d6a0' },
  { hat: '#118ab2', shirt: '#ffd166', skin: '#ffd6a5', pants: '#6b5a10', shoes: '#333', name: '#118ab2' },
  { hat: '#ff6b6b', shirt: '#4ecdc4', skin: '#ffd6a5', pants: '#2a7a72', shoes: '#333', name: '#ff6b6b' },
  { hat: '#845ec2', shirt: '#ff6f91', skin: '#ffd6a5', pants: '#a03050', shoes: '#333', name: '#845ec2' },
  { hat: '#00c9a7', shirt: '#c34a36', skin: '#ffd6a5', pants: '#6a2a1a', shoes: '#333', name: '#00c9a7' },
  { hat: '#ffc75f', shirt: '#5b5ea6', skin: '#ffd6a5', pants: '#3a3c6a', shoes: '#333', name: '#ffc75f' },
  { hat: '#d4a373', shirt: '#2a6f97', skin: '#ffd6a5', pants: '#1d3557', shoes: '#333', name: '#d4a373' },
  { hat: '#e76f51', shirt: '#264653', skin: '#ffd6a5', pants: '#1a3040', shoes: '#333', name: '#e76f51' },
  { hat: '#7209b7', shirt: '#f72585', skin: '#ffd6a5', pants: '#a01050', shoes: '#333', name: '#7209b7' },
  { hat: '#3a86ff', shirt: '#fb5607', skin: '#ffd6a5', pants: '#8a3000', shoes: '#333', name: '#3a86ff' },
  { hat: '#80b918', shirt: '#dd1c1a', skin: '#ffd6a5', pants: '#7a1010', shoes: '#333', name: '#80b918' },
  { hat: '#e07a5f', shirt: '#3d405b', skin: '#ffd6a5', pants: '#2a2c40', shoes: '#333', name: '#e07a5f' },
  { hat: '#81b29a', shirt: '#f2cc8f', skin: '#ffd6a5', pants: '#8a7040', shoes: '#333', name: '#81b29a' },
  { hat: '#bc6c25', shirt: '#606c38', skin: '#ffd6a5', pants: '#3a4220', shoes: '#333', name: '#bc6c25' },
  { hat: '#9b5de5', shirt: '#00bbf9', skin: '#ffd6a5', pants: '#006a8a', shoes: '#333', name: '#9b5de5' },
  { hat: '#f15bb5', shirt: '#00f5d4', skin: '#ffd6a5', pants: '#008a70', shoes: '#333', name: '#f15bb5' },
];

// --- Pixel character template ---

const CHAR_MAP = [
  [0,0,0,'h','h','h','h',0,0,0],
  [0,0,'h','h','h','h','h','h',0,0],
  [0,0,'h','h','h','h','h','h',0,0],
  [0,0,'s','s','s','s','s','s',0,0],
  [0,0,'s','e','s','s','e','s',0,0],
  [0,0,'s','s','s','s','s','s',0,0],
  [0,0,0,'s','s','s','s',0,0,0],
  [0,'b','b','b','b','b','b','b','b',0],
  [0,'b','b','b','b','b','b','b','b',0],
  ['b','b','b','b','b','b','b','b','b','b'],
  [0,0,'b','b','b','b','b','b',0,0],
  [0,0,'p','p',0,0,'p','p',0,0],
  [0,0,'p','p',0,0,'p','p',0,0],
  [0,'x','x','x',0,0,'x','x','x',0],
];

// Generic pixel-map → box-shadow builder (reused for characters, chairs, hourglass, coffee, cups)
function buildPixelShadow(map, colorMap) {
  const shadows = [];
  map.forEach((row, y) => {
    row.forEach((px, x) => {
      const color = colorMap[px];
      if (color) shadows.push(`${x}px ${y}px 0 0 ${color}`);
    });
  });
  return shadows.join(',');
}

function buildCharacterShadow(palette) {
  return buildPixelShadow(CHAR_MAP, { h: palette.hat, s: palette.skin, b: palette.shirt, p: palette.pants, x: palette.shoes, e: '#333' });
}

const PRECOMPUTED_SHADOWS = PALETTES.map(p => buildCharacterShadow(p));

// --- Pixel chair for empty seats ---

const CHAIR_MAP = [
  [0,'w','w','w','w','w',0],
  [0,'w','c','c','c','w',0],
  [0,'w','c','c','c','w',0],
  ['w','w','w','w','w','w','w'],
  ['w',0,0,0,0,0,'w'],
  ['w',0,0,0,0,0,'w'],
];

const CHAIR_SHADOW = buildPixelShadow(CHAIR_MAP, { w: '#8b6340', c: '#c4956a' });

// --- Pixel hourglass for loading screen ---

const HOURGLASS_MAP = [
  [1,1,1,1,1,1,1],
  [0,1,0,0,0,1,0],
  [0,0,1,0,1,0,0],
  [0,0,0,1,0,0,0],
  [0,0,1,0,1,0,0],
  [0,1,0,0,0,1,0],
  [1,1,1,1,1,1,1],
];

(function buildHourglass() {
  const el = document.getElementById('hourglass');
  if (!el) return;
  el.style.boxShadow = buildPixelShadow(HOURGLASS_MAP, { 1: '#ffd700' });
})();

// --- Table geometry: 20 seats around an oval poker table ---

const ROOM_W = 1100, ROOM_H = 700;
const TABLE_CX = 550, TABLE_CY = 350;
const SEAT_RX = 380, SEAT_RY = 260;  // outer ellipse (characters)
const CARD_RX = 270, CARD_RY = 180;  // inner ellipse (vote cards on felt)

// 20 seat angles (degrees clockwise from 12 o'clock)
// Top(6), Right(3+1end), Bottom(6), Left(3+1end) = 20
const SEAT_ANGLES = [
  330, 342, 354, 6, 18, 30,       // 0-5: top
  55, 78, 102, 125,               // 6-9: right (8≈end)
  150, 162, 174, 186, 198, 210,   // 10-15: bottom
  235, 258, 282, 305,             // 16-19: left (18≈end)
];

function clockToXY(deg, rx, ry) {
  const rad = deg * Math.PI / 180;
  return { x: TABLE_CX + rx * Math.sin(rad), y: TABLE_CY - ry * Math.cos(rad) };
}

// Precompute seat positions (center of each seat slot)
const SEAT_POSITIONS = SEAT_ANGLES.map(a => clockToXY(a, SEAT_RX, SEAT_RY));
// Precompute card positions on inner ellipse
const CARD_POSITIONS = SEAT_ANGLES.map(a => clockToXY(a, CARD_RX, CARD_RY));

const DOOR_ORIGIN = { x: 1040, y: 350 };
const COFFEE_POS = { x: 940, y: 65 };
const renderedParticipants = new Set();
let isFirstRoomState = true;
let consensusTimer = null;

// --- Build coffee machine pixel art ---

const COFFEE_MAP = [
  [0,0,'g','g','g','g','g','g','g',0,0],
  [0,'g','g','g','g','g','g','g','g','g',0],
  [0,'g','d','d','d','d','d','d','d','g',0],
  [0,'g','d','r',0,'d',0,'n','d','g',0],
  [0,'g','d','d','d','d','d','d','d','g',0],
  [0,'g','g','g','g','g','g','g','g','g',0],
  [0,'g','g','g','g','g','g','g','g','g',0],
  [0,'g','g',0,'m','m','m',0,'g','g',0],
  [0,'g','g',0,'m',0,'m',0,'g','g',0],
  [0,0,0,0,'b','b','b','b',0,0,0],
  [0,0,0,0,'b','w','w','b',0,0,0],
  [0,0,0,0,'b','b','b','b',0,0,0],
];

(function buildCoffeeMachine() {
  const el = document.querySelector('.coffee-machine');
  if (!el) return;
  el.style.boxShadow = buildPixelShadow(COFFEE_MAP, { g: '#777', d: '#555', r: '#e63946', n: '#4caf50', m: '#666', b: '#8b5e3c', w: '#d4a57a' });
})();

// --- Coffee cup pixel art (for table) ---

const CUP_MAP = [
  [0,'b','w','w','b',0],
  [0,'b','w','w','b','h'],
  [0,'b','w','w','b','h'],
  [0,'b','b','b','b',0],
];

const CUP_SHADOW = buildPixelShadow(CUP_MAP, { b: '#8b5e3c', w: '#d4a57a', h: '#8b5e3c' });

// --- Position seat slots on page load ---

const seatSlots = document.querySelectorAll('.seat-slot');
const pokerTable = document.querySelector('.poker-table');

seatSlots.forEach((slot, i) => {
  const pos = SEAT_POSITIONS[i];
  slot.style.left = (pos.x - 35) + 'px';
  slot.style.top = (pos.y - 21) + 'px';
});

// --- Room scaling to fit viewport ---

function fitRoom() {
  const wrapper = document.querySelector('.room-wrapper');
  const room = document.getElementById('room');
  if (!wrapper || !room) return;

  // Temporarily remove zoom to measure natural wrapper size
  room.style.zoom = '1';
  const availW = wrapper.clientWidth - 8;
  const availH = wrapper.clientHeight - 8;
  const scale = Math.min(availW / ROOM_W, availH / ROOM_H, 1);
  // zoom changes layout size unlike transform:scale, so bottom UI stays visible
  room.style.zoom = scale;
}

let resizeRAF = null;
window.addEventListener('resize', () => {
  if (resizeRAF) cancelAnimationFrame(resizeRAF);
  resizeRAF = requestAnimationFrame(fitRoom);
});
fitRoom();

// --- Side panel toggle (button on table) ---

const sidePanel = document.getElementById('sidePanel');
const tableCardsBtn = document.getElementById('tableCardsBtn');

tableCardsBtn.addEventListener('click', () => {
  const isOpen = sidePanel.classList.toggle('open');
  tableCardsBtn.textContent = isOpen ? 'CLOSE' : 'PICK CARDS';
  tableCardsBtn.classList.toggle('active', isOpen);
});

// --- Socket.IO ---

const socket = io();

// DOM refs
const nameOverlay = document.getElementById('nameOverlay');
const nameInput = document.getElementById('nameInput');
const nameBtn = document.getElementById('nameBtn');
const nameError = document.getElementById('nameError');
const roomIdLabel = document.getElementById('roomIdLabel');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const hostControls = document.getElementById('hostControls');
const revealBtn = document.getElementById('revealBtn');
const resetBtn = document.getElementById('resetBtn');
const whiteboardText = document.getElementById('whiteboardText');
const cards = document.querySelectorAll('.card');
const loadingScreen = document.getElementById('loadingScreen');

// Init
roomIdLabel.textContent = 'Room: ' + state.roomId;

fetch('/api/room-exists/' + encodeURIComponent(state.roomId))
  .then(res => res.json())
  .then(data => {
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (!data.exists) {
      nameError.textContent = 'Room not found';
      nameBtn.disabled = true;
      nameInput.disabled = true;
    }
  })
  .catch(() => { if (loadingScreen) loadingScreen.classList.add('hidden'); });

// --- Marvel hero names ---

const HERO_NAMES = [
  'Iron Man', 'Thor', 'Hulk', 'Widow', 'Hawkeye',
  'Cap', 'Panther', 'Spider-Man', 'Ant-Man', 'Wasp',
  'Falcon', 'Vision', 'Wanda', 'Loki', 'Groot',
  'Rocket', 'Gamora', 'Drax', 'Nebula', 'Star-Lord',
  'Shang-Chi', 'She-Hulk', 'Moon Knight', 'Ms Marvel',
  'Deadpool', 'Wolverine', 'Storm', 'Cyclops', 'Rogue',
  'Daredevil', 'Punisher', 'Blade', 'Nova', 'Cable',
].filter(n => n.length <= 12);

// --- Name entry ---

const randomNameBtn = document.getElementById('randomNameBtn');

nameBtn.addEventListener('click', joinRoom);
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
randomNameBtn.addEventListener('click', () => {
  nameInput.value = HERO_NAMES[Math.floor(Math.random() * HERO_NAMES.length)];
  joinRoom();
});

function joinRoom() {
  const name = nameInput.value.trim();
  if (!name) { nameError.textContent = 'Please enter a name'; return; }
  if (name.length > 12) { nameError.textContent = 'Max 12 characters'; return; }
  state.myName = name;
  socket.emit('join-room', { roomId: state.roomId, name, preferredSeat: state.mySeatIndex });
}

// --- Socket events ---

socket.on('connect', () => {
  state.mySocketId = socket.id;
  if (state.myName && nameOverlay.classList.contains('hidden')) {
    socket.emit('join-room', { roomId: state.roomId, name: state.myName, preferredSeat: state.mySeatIndex });
  }
});

socket.on('error-msg', ({ message }) => {
  if (nameOverlay && !nameOverlay.classList.contains('hidden')) {
    nameError.textContent = message;
  } else {
    alert(message);
  }
});

socket.on('room-state', (data) => {
  if (loadingScreen && !loadingScreen.classList.contains('hidden')) loadingScreen.classList.add('hidden');
  if (!nameOverlay.classList.contains('hidden') && state.myName) nameOverlay.classList.add('hidden');

  const prevPhase = state.phase;
  state.mySocketId = socket.id;
  state.phase = data.phase;
  state.participants = data.participants;

  const me = data.participants.find(p => p.socketId === socket.id);
  if (me) state.mySeatIndex = me.seatIndex;

  if (prevPhase === 'revealed' && data.phase === 'voting') state.selectedVote = null;

  if (data.hostSocketId === socket.id) {
    state.isHost = true;
    hostControls.classList.remove('hidden');
  } else {
    state.isHost = false;
    hostControls.classList.add('hidden');
  }

  renderRoom();
  updateHostButtons();
  updateCardBar();
  updateWhiteboard();
});

// --- Copy link ---

function showCopiedFeedback() {
  copyLinkBtn.textContent = 'Copied!';
  setTimeout(() => { copyLinkBtn.textContent = 'Copy Link'; }, 2000);
}

copyLinkBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href).then(showCopiedFeedback).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = window.location.href;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showCopiedFeedback();
  });
});

// --- Card selection ---

cards.forEach(card => {
  card.addEventListener('click', () => {
    if (state.phase !== 'voting') return;
    const value = card.dataset.value;
    if (state.selectedVote === value) {
      state.selectedVote = null;
      socket.emit('cast-vote', { vote: null });
      updateCardBar();
      return;
    }
    state.selectedVote = value;
    socket.emit('cast-vote', { vote: value });
    updateCardBar();
  });
});

function updateCardBar() {
  cards.forEach(card => {
    const wasSelected = card.classList.contains('selected');
    card.classList.remove('selected', 'disabled');
    if (state.phase === 'revealed') card.classList.add('disabled');
    if (card.dataset.value === state.selectedVote && state.phase === 'voting') {
      card.classList.add('selected');
      if (!wasSelected) spawnParticles(card);
    }
  });
}

// --- Host controls ---

revealBtn.addEventListener('click', () => socket.emit('reveal-votes'));
resetBtn.addEventListener('click', () => { state.selectedVote = null; socket.emit('reset-votes'); });

function updateHostButtons() {
  if (!state.isHost) return;
  if (state.phase === 'voting') {
    const anyVoted = state.participants.some(p => p.hasVoted);
    revealBtn.classList.remove('hidden');
    revealBtn.disabled = !anyVoted;
    revealBtn.style.opacity = anyVoted ? '1' : '0.4';
    resetBtn.classList.add('hidden');
  } else {
    revealBtn.classList.add('hidden');
    resetBtn.classList.remove('hidden');
  }
}

// --- Whiteboard ---

function updateWhiteboard() {
  whiteboardText.textContent = '';
  if (state.phase === 'revealed') {
    const numericVotes = state.participants.filter(p => p.vote && p.vote !== '?').map(p => parseInt(p.vote, 10));
    const span = document.createElement('span');
    span.className = 'vote-summary';
    if (numericVotes.length > 0) {
      const avg = (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1);
      const counts = {};
      numericVotes.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
      const mode = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      span.textContent = 'Avg: ' + avg + ' | Most: ' + mode[0] + ' (' + mode[1] + 'x)';
    } else {
      span.textContent = 'No numeric votes';
    }
    whiteboardText.appendChild(span);
  } else {
    whiteboardText.textContent = 'Pick your cards!';
  }
}

// --- Card select particles ---

const PARTICLE_COLORS = ['#ffd700', '#ff6b6b', '#4caf50', '#4ecdc4', '#ff9800'];

function spawnParticles(card) {
  const rect = card.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 6; i++) {
    const el = document.createElement('div');
    el.className = 'card-particle';
    const angle = (Math.PI * 2 * i) / 6;
    const dist = 6 + Math.random() * 4;
    el.style.setProperty('--px', `${Math.cos(angle) * dist}px`);
    el.style.setProperty('--py', `${Math.sin(angle) * dist}px`);
    el.style.left = cx + 'px';
    el.style.top = cy + 'px';
    el.style.background = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// --- Greetings on arrival ---

const GREETINGS = [
  'Yo!', 'Sup!', 'Heyyy', 'Whaddup!', "Let's go!",
  'Hola!', 'Bonjour!', 'Ahoy!', 'Howdy!', "What's good!",
  'Ayo!', 'Wagwan!', 'Greetings!', 'Hey hey!', 'Ciao!',
  'G\'day!', 'Peace!', 'Namaste!', 'Oi oi!', 'Yooo!',
  'Ready!', "Let's goo!", 'Cheers!', 'Heyoo!', "What's poppin!",
];

// --- Room rendering (incremental) ---

function buildEmptyChair(slot) {
  const wrap = document.createElement('div');
  wrap.className = 'chair-wrap';
  const chair = document.createElement('div');
  chair.className = 'chair-pixel';
  chair.style.boxShadow = CHAIR_SHADOW;
  wrap.appendChild(chair);
  slot.appendChild(wrap);
}

function buildOccupiedSlot(slot, p) {
  const palette = PALETTES[p.seatIndex % PALETTES.length];
  const isMe = p.socketId === state.mySocketId;

  const isNewParticipant = !renderedParticipants.has(p.socketId);
  renderedParticipants.add(p.socketId);

  const charWrap = document.createElement('div');
  charWrap.className = 'character-wrap';

  if (isNewParticipant && SEAT_POSITIONS[p.seatIndex]) {
    const sp = SEAT_POSITIONS[p.seatIndex];
    charWrap.style.setProperty('--from-door-x', (DOOR_ORIGIN.x - sp.x) + 'px');
    charWrap.style.setProperty('--from-door-y', (DOOR_ORIGIN.y - sp.y) + 'px');
    charWrap.style.setProperty('--from-coffee-x', (COFFEE_POS.x - sp.x) + 'px');
    charWrap.style.setProperty('--from-coffee-y', (COFFEE_POS.y - sp.y) + 'px');
    charWrap.classList.add('walking-in');
  }

  const charDiv = document.createElement('div');
  charDiv.className = 'character';
  charDiv.style.boxShadow = PRECOMPUTED_SHADOWS[p.seatIndex % PALETTES.length];

  // Coffee cup in hand (permanent — every seated character holds one)
  const handCup = document.createElement('div');
  handCup.className = 'hand-cup';
  if (isNewParticipant) handCup.classList.add('grabbing');
  handCup.style.boxShadow = CUP_SHADOW;

  const nameLabel = document.createElement('div');
  nameLabel.className = 'char-name';
  nameLabel.textContent = isMe ? p.name + ' (you)' : p.name;
  nameLabel.style.color = palette.name;

  charWrap.appendChild(charDiv);
  charWrap.appendChild(handCup);
  charWrap.appendChild(nameLabel);

  // Speech bubble (hover tooltip)
  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';
  applyBubbleText(bubble, p);
  charWrap.appendChild(bubble);

  // Greeting on arrival
  if (isNewParticipant) {
    const greet = document.createElement('div');
    greet.className = 'greet-bubble';
    greet.textContent = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    charWrap.appendChild(greet);
    greet.addEventListener('animationend', () => greet.remove());
  }

  slot.appendChild(charWrap);

  // Vote card on table surface (positioned absolutely)
  appendTableCard(slot, p);
}

function appendTableCard(slot, p) {
  if (!(p.hasVoted || (state.phase === 'revealed' && p.vote))) return;

  const seatPos = SEAT_POSITIONS[p.seatIndex];
  const cardPos = CARD_POSITIONS[p.seatIndex];
  const dx = cardPos.x - seatPos.x;
  const dy = cardPos.y - seatPos.y;

  const card = document.createElement('div');
  card.className = 'vote-card-table';
  card.style.setProperty('--card-dx', (dx + 22) + 'px');
  card.style.setProperty('--card-dy', (dy + 2) + 'px');

  if (state.phase === 'revealed') {
    card.classList.add('face-up');
    card.textContent = p.vote;
    const revealIndex = state.participants.filter(pp => pp.vote).indexOf(p);
    card.style.setProperty('--reveal-delay', `${revealIndex * 0.12}s`);
  } else {
    card.classList.add('face-down');
  }

  slot.appendChild(card);
}

function applyBubbleText(bubble, p) {
  if (state.phase === 'revealed' && p.vote) bubble.textContent = 'Voted ' + p.vote;
  else if (p.hasVoted) bubble.textContent = 'Ready!';
  else bubble.textContent = 'Thinking...';
}

function updateSlotInPlace(slot, p) {
  // Update vote card on table
  const oldCard = slot.querySelector('.vote-card-table');
  const needsCard = p.hasVoted || (state.phase === 'revealed' && p.vote);
  const wantFaceUp = state.phase === 'revealed';

  if (needsCard) {
    const hasFaceUp = oldCard && oldCard.classList.contains('face-up');
    const hasFaceDown = oldCard && oldCard.classList.contains('face-down');
    if ((wantFaceUp && !hasFaceUp) || (!wantFaceUp && !hasFaceDown)) {
      if (oldCard) oldCard.remove();
      appendTableCard(slot, p);
    }
  } else if (oldCard) {
    oldCard.remove();
  }

  // Update speech bubble
  const bubble = slot.querySelector('.speech-bubble');
  if (bubble) applyBubbleText(bubble, p);
}

function renderRoom() {
  const seatToParticipant = {};
  state.participants.forEach(p => { seatToParticipant[p.seatIndex] = p; });

  if (isFirstRoomState) {
    isFirstRoomState = false;
    state.participants.forEach(p => {
      if (p.socketId !== state.mySocketId) renderedParticipants.add(p.socketId);
    });
  }

  const currentIds = new Set(state.participants.map(p => p.socketId));
  for (const id of renderedParticipants) {
    if (!currentIds.has(id)) renderedParticipants.delete(id);
  }

  seatSlots.forEach(slot => {
    const seatIdx = parseInt(slot.dataset.seat, 10);
    const p = seatToParticipant[seatIdx];
    const prev = slot.dataset.occupant || '';

    if (p) {
      if (prev === p.socketId) {
        updateSlotInPlace(slot, p);
      } else {
        slot.innerHTML = '';
        slot.dataset.occupant = p.socketId;
        buildOccupiedSlot(slot, p);
      }
    } else {
      if (prev !== 'empty' && prev !== 'leaving') {
        const charWrap = slot.querySelector('.character-wrap');
        if (charWrap && SEAT_POSITIONS[seatIdx]) {
          const sp = SEAT_POSITIONS[seatIdx];
          charWrap.style.setProperty('--from-door-x', (DOOR_ORIGIN.x - sp.x) + 'px');
          charWrap.style.setProperty('--from-door-y', (DOOR_ORIGIN.y - sp.y) + 'px');
          charWrap.classList.remove('walking-in');
          charWrap.classList.add('walking-out');
          // Remove vote card immediately
          const tableCard = slot.querySelector('.vote-card-table');
          if (tableCard) tableCard.remove();
          slot.dataset.occupant = 'leaving';
          setTimeout(() => {
            if (slot.dataset.occupant === 'leaving') {
              slot.innerHTML = '';
              slot.dataset.occupant = 'empty';
              buildEmptyChair(slot);
            }
          }, 700);
        } else {
          slot.innerHTML = '';
          slot.dataset.occupant = 'empty';
          buildEmptyChair(slot);
        }
      }
    }
  });

  // Consensus glow
  if (consensusTimer) { clearTimeout(consensusTimer); consensusTimer = null; }
  if (pokerTable) {
    pokerTable.classList.remove('consensus');
    if (state.phase === 'revealed') {
      let firstVote = null, count = 0, isConsensus = true;
      for (const p of state.participants) {
        if (!p.vote) continue;
        count++;
        if (!firstVote) firstVote = p.vote;
        else if (p.vote !== firstVote) { isConsensus = false; break; }
      }
      if (isConsensus && count >= 2) {
        const delay = count * 120 + 400;
        consensusTimer = setTimeout(() => pokerTable.classList.add('consensus'), delay);
      }
    }
  }
}
