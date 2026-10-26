const STORAGE_KEY = "block-by-block-demo-v1";
const SAMPLE_TRANSACTIONS = [
  { from: "Avery", to: "Campus Bookstore", amount: 2.5 },
  { from: "Blockchain Club", to: "Avery", amount: 1.25 },
];
const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const els = {
  status: document.querySelector("#chain-status"), statusIcon: document.querySelector("#status-icon"),
  statusTitle: document.querySelector("#status-title"), statusMessage: document.querySelector("#status-message"),
  chain: document.querySelector("#chain-list"), blockCount: document.querySelector("#block-count"),
  pending: document.querySelector("#pending-list"), pendingCount: document.querySelector("#pending-count"),
  form: document.querySelector("#transaction-form"), from: document.querySelector("#from-input"),
  to: document.querySelector("#to-input"), amount: document.querySelector("#amount-input"),
  difficulty: document.querySelector("#difficulty-select"), mine: document.querySelector("#mine-button"),
  mineLabel: document.querySelector("#mine-label"), mineCaption: document.querySelector("#mine-caption"),
  progress: document.querySelector("#mining-progress"), nonce: document.querySelector("#nonce-count"),
  progressFill: document.querySelector("#progress-fill"), miningMessage: document.querySelector("#mining-message"),
  hashPreview: document.querySelector("#hash-preview"), dialog: document.querySelector("#edit-dialog"),
  resetDialog: document.querySelector("#reset-dialog"),
  editForm: document.querySelector("#edit-form"), editFrom: document.querySelector("#edit-from"),
  editTo: document.querySelector("#edit-to"), editAmount: document.querySelector("#edit-amount"),
  toast: document.querySelector("#toast"),
};

let state = { chain: [], pending: [], difficulty: 2 };
let validation = [];
let mining = false;
let editTarget = null;
let toastTimeout;

const shortHash = (hash) => hash ? `${hash.slice(0, 12)}…${hash.slice(-8)}` : "—";
const hashPayload = (block) => JSON.stringify({
  index: block.index, timestamp: block.timestamp, transactions: block.transactions,
  previousHash: block.previousHash, difficulty: block.difficulty, nonce: block.nonce,
});

async function sha256(text) {
  if (!globalThis.crypto?.subtle) return sha256Fallback(text);
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sha256Fallback(text) {
  // Keep hashing available in previews that do not expose the Web Crypto API.
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const stateWords = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const rotateRight = (word, amount) => (word >>> amount) | (word << (32 - amount));
  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = new Uint32Array(64);
    for (let i = 0; i < 16; i += 1) words[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotateRight(words[i - 15], 7) ^ rotateRight(words[i - 15], 18) ^ (words[i - 15] >>> 3);
      const s1 = rotateRight(words[i - 2], 17) ^ rotateRight(words[i - 2], 19) ^ (words[i - 2] >>> 10);
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = stateWords;
    for (let i = 0; i < 64; i += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + SHA256_ROUND_CONSTANTS[i] + words[i]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    stateWords[0] = (stateWords[0] + a) >>> 0; stateWords[1] = (stateWords[1] + b) >>> 0;
    stateWords[2] = (stateWords[2] + c) >>> 0; stateWords[3] = (stateWords[3] + d) >>> 0;
    stateWords[4] = (stateWords[4] + e) >>> 0; stateWords[5] = (stateWords[5] + f) >>> 0;
    stateWords[6] = (stateWords[6] + g) >>> 0; stateWords[7] = (stateWords[7] + h) >>> 0;
  }
  return stateWords.map((word) => word.toString(16).padStart(8, "0")).join("");
}

async function calculateHash(block) {
  return sha256(hashPayload(block));
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { /* The app still works for this tab when browser storage is blocked. */ }
}

function makeGenesis() {
  return {
    index: 0, timestamp: "2025-09-15T12:00:00.000Z", transactions: [],
    previousHash: "0", difficulty: 0, nonce: 0, hash: "",
  };
}

async function mineSeedBlock(previousHash, index, transaction) {
  const block = {
    index, timestamp: new Date(Date.UTC(2025, 8, 15, 12, index * 3)).toISOString(),
    transactions: [transaction], previousHash, difficulty: 2, nonce: 0, hash: "",
  };
  do {
    block.hash = await calculateHash(block);
    if (!block.hash.startsWith("00")) block.nonce += 1;
  } while (!block.hash.startsWith("00"));
  return block;
}

async function seedChain() {
  const genesis = makeGenesis();
  genesis.hash = await calculateHash(genesis);
  const first = await mineSeedBlock(genesis.hash, 1, SAMPLE_TRANSACTIONS[0]);
  const second = await mineSeedBlock(first.hash, 2, SAMPLE_TRANSACTIONS[1]);
  state = { chain: [genesis, first, second], pending: [], difficulty: 2 };
  saveState();
}

async function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.chain) && saved.chain.length > 0 && Array.isArray(saved.pending)) {
      state = {
        chain: saved.chain, pending: saved.pending,
        difficulty: [1, 2, 3].includes(Number(saved.difficulty)) ? Number(saved.difficulty) : 2,
      };
      return;
    }
  } catch { /* Invalid or unavailable local storage is replaced with the starter chain. */ }
  await seedChain();
}

async function validateChain() {
  const results = [];
  let expectedPreviousHash = "0";
  let ancestryValid = true;
  for (const block of state.chain) {
    const calculated = await calculateHash(block);
    const linkMatches = block.previousHash === expectedPreviousHash;
    const hashMatches = block.hash === calculated;
    const proofMatches = block.index === 0 || calculated.startsWith("0".repeat(block.difficulty));
    const valid = ancestryValid && linkMatches && hashMatches && proofMatches;
    results.push({ calculated, linkMatches, hashMatches, proofMatches, ancestryValid, valid });
    ancestryValid = valid;
    expectedPreviousHash = calculated;
  }
  validation = results;
  renderStatus();
  renderChain();
  updateMineAvailability();
}

function renderStatus() {
  const firstBad = validation.findIndex((item) => !item.valid);
  if (firstBad === -1) {
    els.status.classList.remove("invalid");
    els.statusIcon.textContent = "✓";
    els.statusTitle.textContent = "Chain is intact";
    els.statusMessage.textContent = "Every block’s SHA-256, proof of work, and previous hash line up.";
    return;
  }
  const check = validation[firstBad];
  els.status.classList.add("invalid");
  els.statusIcon.textContent = "!";
  if (!check.hashMatches) {
    els.statusTitle.textContent = `Block ${firstBad} has changed`;
    els.statusMessage.textContent = `Its saved fingerprint no longer matches its contents. The next block still points to the old hash, so the break ripples forward.`;
  } else if (!check.linkMatches) {
    els.statusTitle.textContent = `The link to block ${firstBad} is broken`;
    els.statusMessage.textContent = "This block points to a different previous hash, so the chain no longer connects.";
  } else {
    els.statusTitle.textContent = `Block ${firstBad} needs new proof of work`;
    els.statusMessage.textContent = "The stored hash no longer meets the difficulty required by this block.";
  }
}

function formatTime(timestamp) {
  if (timestamp === "2025-09-15T12:00:00.000Z") return "The beginning of this chain";
  return new Date(timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function renderChain() {
  els.blockCount.textContent = state.chain.length;
  els.chain.replaceChildren();
  state.chain.slice().reverse().forEach((block) => {
    const check = validation[block.index] ?? { valid: false, calculated: "", hashMatches: false, linkMatches: false, proofMatches: false };
    const card = document.createElement("article");
    card.className = `block-card${check.valid ? "" : " is-invalid"}`;
    const marker = document.createElement("div");
    marker.className = "block-marker";
    marker.textContent = block.index === 0 ? "⌂" : (check.valid ? "✓" : "!");
    card.append(marker);

    const top = document.createElement("div");
    top.className = "block-topline";
    const title = document.createElement("div");
    title.className = "block-title";
    const name = document.createElement("strong");
    name.textContent = block.index === 0 ? "Genesis block" : `Block ${block.index}`;
    const nonce = document.createElement("span");
    nonce.textContent = block.index === 0 ? "THE START" : `NONCE ${block.nonce}`;
    title.append(name, nonce);
    const badge = document.createElement("span");
    badge.className = `block-badge${check.valid ? "" : " bad"}`;
    badge.textContent = check.valid ? (block.index === 0 ? "ORIGIN" : `${block.difficulty} ZERO${block.difficulty === 1 ? "" : "S"}`) : "INVALID";
    top.append(title, badge);
    card.append(top);

    const time = document.createElement("div");
    time.className = "block-time";
    time.textContent = formatTime(block.timestamp);
    card.append(time);

    const fingerprints = document.createElement("div");
    fingerprints.className = "fingerprint-grid";
    fingerprints.append(makeFingerprint("HASH", check.calculated, "hash-value", check.hashMatches ? "Current SHA-256" : "Recalculated SHA-256 · differs from saved hash"));
    fingerprints.append(makeFingerprint("PREVIOUS HASH", block.previousHash, "previous-value", "Hash of the preceding block"));
    card.append(fingerprints);

    if (block.transactions.length) {
      const list = document.createElement("div");
      list.className = "transaction-list";
      const label = document.createElement("div");
      label.className = "block-transactions-label";
      label.textContent = "TRANSACTIONS IN THIS BLOCK";
      list.append(label);
      block.transactions.forEach((transaction, transactionIndex) => {
        const row = document.createElement("div");
        row.className = "transaction-row";
        const from = document.createElement("span"); from.className = "tx-from"; from.textContent = transaction.from;
        const arrow = document.createElement("span"); arrow.className = "tx-arrow"; arrow.textContent = "→";
        const to = document.createElement("span"); to.className = "tx-to"; to.textContent = transaction.to;
        const amount = document.createElement("span"); amount.className = "tx-amount"; amount.textContent = `${Number(transaction.amount).toLocaleString()} COIN`;
        const edit = document.createElement("button"); edit.type = "button"; edit.className = "edit-tx"; edit.textContent = "Edit";
        edit.setAttribute("aria-label", `Edit transaction ${transaction.from} to ${transaction.to} in block ${block.index}`);
        edit.addEventListener("click", () => openEdit(block.index, transactionIndex));
        row.append(from, arrow, to, amount, edit);
        list.append(row);
      });
      card.append(list);
    }
    els.chain.append(card);
  });
}

function makeFingerprint(label, hash, extraClass, ariaLabel) {
  const row = document.createElement("div"); row.className = "fingerprint";
  const key = document.createElement("label"); key.textContent = label;
  const value = document.createElement("code"); value.className = extraClass; value.textContent = shortHash(hash);
  value.title = hash; value.setAttribute("aria-label", ariaLabel);
  row.append(key, value);
  return row;
}

function renderPending() {
  els.pendingCount.textContent = state.pending.length;
  els.pending.replaceChildren();
  if (state.pending.length === 0) {
    const empty = document.createElement("div"); empty.className = "pending-empty"; empty.textContent = "Nothing queued yet. Add a transaction above.";
    els.pending.append(empty);
  } else {
    state.pending.forEach((transaction, index) => {
      const row = document.createElement("div"); row.className = "pending-row";
      const from = document.createElement("span"); from.textContent = transaction.from;
      const arrow = document.createElement("span"); arrow.textContent = "→";
      const to = document.createElement("span"); to.textContent = transaction.to;
      const amount = document.createElement("span"); amount.className = "pending-amount"; amount.textContent = `${Number(transaction.amount).toLocaleString()} COIN`;
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove-pending"; remove.textContent = "×"; remove.setAttribute("aria-label", "Remove pending transaction");
      remove.addEventListener("click", () => { state.pending.splice(index, 1); saveState(); renderPending(); updateMineAvailability(); });
      row.append(from, arrow, to, amount, remove); els.pending.append(row);
    });
  }
  updateMineAvailability();
}

function updateMineAvailability() {
  const chainIsValid = state.chain.length > 0 && validation.length === state.chain.length && validation.every((item) => item.valid);
  els.mine.disabled = mining || !chainIsValid;
  if (mining) els.mineCaption.textContent = "Trying one nonce after another until the hash fits…";
  else if (!chainIsValid) els.mineCaption.textContent = "Reset the demo chain before mining another block.";
  else if (state.pending.length === 0) els.mineCaption.textContent = "No transfers queued. You can mine an empty block or add a transaction first.";
  else els.mineCaption.textContent = `${state.pending.length} transaction${state.pending.length === 1 ? "" : "s"} ready to be added to the chain.`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => els.toast.classList.remove("visible"), 2400);
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const transaction = {
    from: els.from.value.trim(), to: els.to.value.trim(), amount: Number(els.amount.value),
  };
  if (!transaction.from || !transaction.to || !Number.isFinite(transaction.amount) || transaction.amount <= 0) return;
  if (transaction.from.toLowerCase() === transaction.to.toLowerCase()) {
    showToast("Choose two different names for the transfer."); return;
  }
  state.pending.push(transaction);
  saveState();
  renderPending();
  els.form.reset();
  els.from.focus();
  showToast("Transaction added to the queue.");
});

els.difficulty.addEventListener("change", () => {
  state.difficulty = Number(els.difficulty.value);
  saveState();
});

els.mine.addEventListener("click", async () => {
  if (mining || !state.chain.length || validation.some((item) => !item.valid)) return;
  mining = true;
  updateMineAvailability();
  els.mineLabel.textContent = "Mining in progress…";
  els.progress.hidden = false;
  const block = {
    index: state.chain.length, timestamp: new Date().toISOString(),
    transactions: structuredClone(state.pending), previousHash: state.chain.at(-1).hash,
    difficulty: state.difficulty, nonce: 0, hash: "",
  };
  const prefix = "0".repeat(block.difficulty);
  let attempts = 0;
  try {
    do {
      block.hash = await calculateHash(block);
      attempts += 1;
      if (attempts % 16 === 0) {
        els.nonce.textContent = `nonce ${block.nonce.toLocaleString()}`;
        els.hashPreview.textContent = block.hash;
        els.progressFill.style.width = `${Math.min(95, 8 + Math.log10(attempts + 1) * 27)}%`;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (!block.hash.startsWith(prefix)) block.nonce += 1;
    } while (!block.hash.startsWith(prefix));
    els.nonce.textContent = `nonce ${block.nonce.toLocaleString()}`;
    els.hashPreview.textContent = block.hash;
    els.progressFill.style.width = "100%";
    els.miningMessage.textContent = `Found one in ${attempts.toLocaleString()} ${attempts === 1 ? "guess" : "guesses"}!`;
    state.chain.push(block);
    state.pending = [];
    saveState();
    await validateChain();
    renderPending();
    showToast(`Block ${block.index} mined with ${attempts.toLocaleString()} ${attempts === 1 ? "guess" : "guesses"}.`);
  } catch (error) {
    showToast(`Mining failed: ${error.message}`);
  } finally {
    mining = false;
    els.mineLabel.textContent = "Mine next block";
    setTimeout(() => { els.progress.hidden = true; els.progressFill.style.width = "8%"; }, 1800);
    updateMineAvailability();
  }
});

function openEdit(blockIndex, transactionIndex) {
  editTarget = { blockIndex, transactionIndex };
  const transaction = state.chain[blockIndex].transactions[transactionIndex];
  els.editFrom.value = transaction.from;
  els.editTo.value = transaction.to;
  els.editAmount.value = transaction.amount;
  els.dialog.showModal();
}

els.editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editTarget) return;
  const transaction = {
    from: els.editFrom.value.trim(), to: els.editTo.value.trim(), amount: Number(els.editAmount.value),
  };
  if (!transaction.from || !transaction.to || !Number.isFinite(transaction.amount) || transaction.amount <= 0) return;
  if (transaction.from.toLowerCase() === transaction.to.toLowerCase()) {
    showToast("Choose two different names for the transfer."); return;
  }
  state.chain[editTarget.blockIndex].transactions[editTarget.transactionIndex] = transaction;
  saveState();
  els.dialog.close();
  editTarget = null;
  await validateChain();
  updateMineAvailability();
  showToast("Transaction edited. The chain now shows the break.");
});

document.querySelector("#cancel-edit").addEventListener("click", () => els.dialog.close());
els.dialog.addEventListener("click", (event) => { if (event.target === els.dialog) els.dialog.close(); });

document.querySelector("#reset-button").addEventListener("click", () => els.resetDialog.showModal());
document.querySelector("#cancel-reset").addEventListener("click", () => els.resetDialog.close());
document.querySelector("#confirm-reset").addEventListener("click", async () => {
  els.resetDialog.close();
  els.statusTitle.textContent = "Restoring the demo chain…";
  els.statusMessage.textContent = "Mining the two sample blocks again.";
  await seedChain();
  els.difficulty.value = "2";
  renderPending();
  await validateChain();
  showToast("Original demo chain restored.");
});

async function start() {
  await loadState();
  els.difficulty.value = String(state.difficulty);
  renderPending();
  await validateChain();
}

start();
