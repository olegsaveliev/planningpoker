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

// --- Color palettes for characters ---

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
];

// --- Pixel character template ---
// 10 wide x 14 tall
// Keys: h=hat, s=skin, b=shirt(body), p=pants, x=shoes, e=eyes, 0=empty

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

function buildCharacterShadow(palette) {
  const colorMap = {
    h: palette.hat,
    s: palette.skin,
    b: palette.shirt,
    p: palette.pants,
    x: palette.shoes,
    e: '#333',
  };
  const shadows = [];
  CHAR_MAP.forEach((row, y) => {
    row.forEach((pixel, x) => {
      if (pixel !== 0) {
        shadows.push(`${x}px ${y}px 0 0 ${colorMap[pixel]}`);
      }
    });
  });
  return shadows.join(',');
}

// Precompute static box-shadow strings (avoids ~1120 iterations per render)
const PRECOMPUTED_SHADOWS = PALETTES.map((p) => buildCharacterShadow(p));

// --- Socket.IO ---

const socket = io();

// DOM refs
const nameOverlay = document.getElementById('nameOverlay');
const nameInput = document.getElementById('nameInput');
const nameBtn = document.getElementById('nameBtn');
const nameError = document.getElementById('nameError');
const roomIdLabel = document.getElementById('roomIdLabel');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const cardBar = document.getElementById('cardBar');
const hostControls = document.getElementById('hostControls');
const revealBtn = document.getElementById('revealBtn');
const resetBtn = document.getElementById('resetBtn');
const whiteboardText = document.getElementById('whiteboardText');
const cards = document.querySelectorAll('.card');
const deskSlots = document.querySelectorAll('.desk-slot');

// Init — check room existence before showing join form
roomIdLabel.textContent = 'Room: ' + state.roomId;

fetch('/api/room-exists/' + encodeURIComponent(state.roomId))
  .then((res) => res.json())
  .then((data) => {
    if (!data.exists) {
      nameError.textContent = 'Room not found';
      nameBtn.disabled = true;
      nameInput.disabled = true;
    }
  })
  .catch(() => {});

// --- Name entry ---

nameBtn.addEventListener('click', joinRoom);
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinRoom();
});

function joinRoom() {
  const name = nameInput.value.trim();
  if (!name) {
    nameError.textContent = 'Please enter a name';
    return;
  }
  if (name.length > 12) {
    nameError.textContent = 'Max 12 characters';
    return;
  }
  state.myName = name;
  socket.emit('join-room', { roomId: state.roomId, name, preferredSeat: state.mySeatIndex });
}

// --- Socket events ---

socket.on('connect', () => {
  state.mySocketId = socket.id;
  // If already joined (reconnect), rejoin with preferred seat
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
  // Hide overlay on first successful state
  if (!nameOverlay.classList.contains('hidden') && state.myName) {
    nameOverlay.classList.add('hidden');
  }

  const prevPhase = state.phase;
  state.mySocketId = socket.id;
  state.phase = data.phase;
  state.participants = data.participants;

  // Track own seat index for reconnects
  const me = data.participants.find((p) => p.socketId === socket.id);
  if (me) {
    state.mySeatIndex = me.seatIndex;
  }

  // Clear selected vote when a new round starts (fixes re-vote bug for all users)
  if (prevPhase === 'revealed' && data.phase === 'voting') {
    state.selectedVote = null;
  }

  // Check if we're still host
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
    // Fallback for non-HTTPS contexts
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

cards.forEach((card) => {
  card.addEventListener('click', () => {
    if (state.phase !== 'voting') return;
    const value = card.dataset.value;

    // Toggle: click same card to deselect (un-vote)
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
  cards.forEach((card) => {
    card.classList.remove('selected', 'disabled');
    if (state.phase === 'revealed') {
      card.classList.add('disabled');
    }
    if (card.dataset.value === state.selectedVote && state.phase === 'voting') {
      card.classList.add('selected');
    }
  });
}

// --- Host controls ---

revealBtn.addEventListener('click', () => {
  socket.emit('reveal-votes');
});

resetBtn.addEventListener('click', () => {
  state.selectedVote = null;
  socket.emit('reset-votes');
});

function updateHostButtons() {
  if (!state.isHost) return;
  if (state.phase === 'voting') {
    const anyVoted = state.participants.some((p) => p.hasVoted);
    revealBtn.classList.toggle('hidden', false);
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
    const numericVotes = state.participants
      .filter((p) => p.vote && p.vote !== '?')
      .map((p) => parseInt(p.vote, 10));

    const span = document.createElement('span');
    span.className = 'vote-summary';

    if (numericVotes.length > 0) {
      const avg = (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1);
      const counts = {};
      numericVotes.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
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

// --- Room rendering ---

function renderRoom() {
  // Clear existing characters from all slots
  deskSlots.forEach((slot) => {
    slot.innerHTML = '';
  });

  state.participants.forEach((p) => {
    const slot = document.querySelector(`.desk-slot[data-seat="${p.seatIndex}"]`);
    if (!slot) return;

    const palette = PALETTES[p.seatIndex % PALETTES.length];
    const isMe = p.socketId === state.mySocketId;

    // Desk
    const desk = document.createElement('div');
    desk.className = 'desk';

    // Laptop
    const laptop = document.createElement('div');
    laptop.className = 'laptop';

    const screen = document.createElement('div');
    screen.className = 'laptop-screen';
    if (state.phase === 'revealed' && p.vote) {
      screen.classList.add('revealed');
      screen.textContent = p.vote;
    } else if (p.hasVoted) {
      screen.classList.add('voted');
      screen.textContent = '\u2713';
    } else {
      screen.classList.add('waiting');
    }

    const base = document.createElement('div');
    base.className = 'laptop-base';

    laptop.appendChild(screen);
    laptop.appendChild(base);
    desk.appendChild(laptop);

    // Character
    const charWrap = document.createElement('div');
    charWrap.className = 'character-wrap';

    const charDiv = document.createElement('div');
    charDiv.className = 'character';
    charDiv.style.boxShadow = PRECOMPUTED_SHADOWS[p.seatIndex % PALETTES.length];

    const nameLabel = document.createElement('div');
    nameLabel.className = 'char-name';
    nameLabel.textContent = p.name;
    nameLabel.style.color = palette.name;
    if (isMe) {
      nameLabel.textContent = p.name + ' (you)';
    }

    // Container for character + vote card side by side
    const charRow = document.createElement('div');
    charRow.className = 'char-row';
    charRow.appendChild(charDiv);

    // Vote card mini (next to character, outside scale transform)
    if (p.hasVoted || (state.phase === 'revealed' && p.vote)) {
      const voteCard = document.createElement('div');
      voteCard.className = 'vote-card-mini';
      if (state.phase === 'revealed') {
        voteCard.classList.add('face-up');
        voteCard.textContent = p.vote;
      } else {
        voteCard.classList.add('face-down');
      }
      charRow.appendChild(voteCard);
    }

    charWrap.appendChild(charRow);
    charWrap.appendChild(nameLabel);

    slot.appendChild(desk);
    slot.appendChild(charWrap);
  });
}
