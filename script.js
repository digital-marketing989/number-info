/* ══════════════════════════════════════
   GATE LOGIC — STRICT 3-STEP VERIFICATION
   1. Click Join Link -> 4s countdown
   2. Click Confirm -> Verification animation
   3. All 3 must be verified before access
   No bypass possible
══════════════════════════════════════ */
const confirmed = new Set();
const linkClicked = new Set();

// Step 1: User clicks the WhatsApp Join link
function onLinkClick(n) {
    if (confirmed.has(n)) return;
    linkClicked.add(n);

    const confirmBtn = document.getElementById(`confirmBtn${n}`);
    if (!confirmBtn) return;

    // Start 4-second countdown
    let remaining = 4;
    confirmBtn.disabled = true;
    confirmBtn.classList.add('counting');
    confirmBtn.textContent = `⏳ Joining... (${remaining}s)`;

    const timer = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            confirmBtn.textContent = `⏳ Joining... (${remaining}s)`;
        } else {
            clearInterval(timer);
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('counting');
            confirmBtn.textContent = n === 3 ? '✅ Confirm I Followed' : `✅ Confirm I Joined Group ${n}`;
        }
    }, 1000);
}

// Step 2: User confirms membership
function confirmJoin(n) {
    if (confirmed.has(n)) return;
    const confirmBtn = document.getElementById(`confirmBtn${n}`);
    if (!confirmBtn || confirmBtn.disabled) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = '🔄 Verifying...';

    setTimeout(() => {
        confirmed.add(n);

        // Mark step card as done
        const stepCard = document.getElementById(`step${n}`);
        if (stepCard) stepCard.classList.add('done');

        const stepNum = document.getElementById(`stepNum${n}`);
        if (stepNum) stepNum.textContent = '✓';

        // Disable join button for this step
        const joinBtn = document.getElementById(`joinBtn${n}`);
        if (joinBtn) {
            joinBtn.style.opacity = '0.5';
            joinBtn.style.pointerEvents = 'none';
        }

        // Update confirm button
        confirmBtn.disabled = true;
        confirmBtn.classList.remove('counting');
        confirmBtn.classList.add('verified');
        confirmBtn.textContent = '✅ Verified';

        // Update progress bar
        const count = confirmed.size;
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        if (progressFill) progressFill.style.width = `${(count / 3) * 100}%`;
        if (progressText) progressText.textContent = `${count} / 3 Completed`;

        // Update Access button
        const accessBtn = document.getElementById('accessBtn');
        if (count >= 3) {
            accessBtn.disabled = false;
            accessBtn.classList.add('ready');
            accessBtn.textContent = '🔓 ACCESS GRANTED — Open Tool 🚀';
        } else {
            accessBtn.textContent = `🔒 Join All 3 To Unlock (${count}/3 Done)`;
        }
    }, 700);
}

// Step 3: Grant access after all 3 are verified
function grantAccess() {
    if (confirmed.size < 3) {
        alert('⚠️ Access Denied! Teeno WhatsApp links join karna mandatory hai.');
        return;
    }

    const overlay = document.getElementById('gateOverlay');
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.4s ease';

    setTimeout(() => {
        overlay.style.display = 'none';
        const mainApp = document.getElementById('mainApp');
        mainApp.style.display = 'block';
        mainApp.classList.remove('hidden');
        setTimeout(() => document.getElementById('numberInput')?.focus(), 300);
    }, 400);
}


/* ══════════════════════════════════════
   SEARCH LOGIC & SECURITY ENFORCEMENT
══════════════════════════════════════ */
const input      = document.getElementById('numberInput');
const btn        = document.getElementById('searchBtn');
const statusEl   = document.getElementById('status');
const resultsDiv = document.getElementById('results');

input?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
});

input?.addEventListener('keypress', e => {
    if (e.key === 'Enter') btn.click();
});

btn?.addEventListener('click', search);

async function search() {
    // STRICT SECURITY GATE CHECK
    if (confirmed.size < 3) {
        showStatus('🔒 Pehle teeno WhatsApp groups aur channel join karna zaroori hai!', 'error');
        const overlay = document.getElementById('gateOverlay');
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        const mainApp = document.getElementById('mainApp');
        mainApp.style.display = 'none';
        mainApp.classList.add('hidden');
        return;
    }

    const number = input.value.trim();

    if (!/^[6-9]\d{9}$/.test(number)) {
        showStatus('❌ Valid 10-digit number daalein (6-9 se start hona chahiye)', 'error');
        return;
    }

    resultsDiv.innerHTML = '';
    showStatus('⏳ Searching Darkie Zone database... please wait', 'loading');
    btn.disabled = true;

    try {
        const res = await fetch(`/api/search/${number}`);

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showStatus(`❌ ${err.error || 'Server error ' + res.status}`, 'error');
            return;
        }

        const data = await res.json();

        if (!data.success) {
            showStatus(`❌ ${data.error || 'Koi data nahi mila'}`, 'error');
            return;
        }

        if (!data.results || data.results.length === 0) {
            showStatus('😕 Is number ka koi record nahi mila', 'error');
            return;
        }

        showStatus(`✅ ${data.results.length} record${data.results.length > 1 ? 's' : ''} mila!`, 'success');
        renderResults(data.results);

    } catch (err) {
        showStatus('❌ Network error. Backend chal raha hai? (localhost:5000)', 'error');
        console.error(err);
    } finally {
        btn.disabled = false;
    }
}

function showStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className   = 'status ' + cls;
}


/* ══════════════════════════════════════
   RENDER RESULTS + MODERN RESPONSIVE TILES
══════════════════════════════════════ */
function renderResults(results) {
    results.forEach((r, i) => {
        const card = document.createElement('div');
        card.className = 'card';

        // Clean address — replace multiple ! with comma-space
        const addressClean = r.address
            ? r.address.replace(/!+/g, ', ').replace(/^,\s*/, '').replace(/,\s*,/g, ',').trim()
            : null;

        // Build plain-text for clipboard
        const copyText = buildCopyText(r, addressClean, i + 1);

        card.innerHTML = `
            <div class="card-header">
                <div class="card-title-group">
                    <span class="card-badge">RECORD #${i + 1}</span>
                    <span class="card-chip">OSINT INTEL</span>
                </div>
                <button class="copy-btn" id="copyBtn${i}" onclick="copyRecord(${i}, \`${escapeBt(copyText)}\`)">
                    📋 Copy Record
                </button>
            </div>

            <div class="info-grid">
                ${tile('📱', 'Mobile Number', r.mobile, 'highlight')}
                ${tile('👤', 'Full Name', r.name)}
                ${tile('👨', "Father's Name", r.father_name)}
                ${tile('🆔', 'Aadhaar Number', r.aadhar)}
                ${tile('📡', 'Telecom Circle', r.circle, 'circle')}
                ${tile('📞', 'Alternate Number', r.alternate)}
                ${tile('📧', 'Email Address', r.email)}
                ${tile('🏠', 'Registered Address', addressClean, 'address full-width')}
            </div>
        `;
        resultsDiv.appendChild(card);
    });
}

function tile(icon, label, val, type = '') {
    const isEmpty = val === null || val === undefined || val === '';
    const displayVal = isEmpty ? '—' : val;
    const isFullWidth = type.includes('full-width') ? 'full-width' : '';
    const valClass = isEmpty ? 'info-value null-val' : `info-value ${type}`;

    return `
    <div class="info-tile ${isFullWidth}">
        <div class="info-icon">${icon}</div>
        <div class="info-content">
            <span class="info-label">${label}</span>
            <span class="${valClass}">${displayVal}</span>
        </div>
    </div>`;
}

function buildCopyText(r, addressClean, num) {
    const lines = [
        `━━━━ Record #${num} ━━━━`,
        `📱 Mobile    : ${r.mobile    ?? '—'}`,
        `👤 Name      : ${r.name      ?? '—'}`,
        `👨 Father    : ${r.father_name ?? '—'}`,
        `🏠 Address   : ${addressClean ?? '—'}`,
        `📞 Alternate : ${r.alternate ?? '—'}`,
        `📡 Circle    : ${r.circle    ?? '—'}`,
        `🆔 Aadhaar   : ${r.aadhar   ?? '—'}`,
        `📧 Email     : ${r.email     ?? '—'}`,
        `━━━━━━━━━━━━━━━━━`,
        `🛡️ DARKIE ZONE CYBERSECURITY`,
    ];
    return lines.join('\n');
}

// Escape backticks for inline template literal usage
function escapeBt(str) {
    return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function copyRecord(idx, text) {
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById(`copyBtn${idx}`);
        btn.textContent = '✅ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '📋 Copy Record';
            btn.classList.remove('copied');
        }, 2000);
    }).catch(() => {
        // Fallback for older browsers or non-secure contexts
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity  = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);

        const btn = document.getElementById(`copyBtn${idx}`);
        btn.textContent = '✅ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '📋 Copy Record';
            btn.classList.remove('copied');
        }, 2000);
    });
}