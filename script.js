/* ══════════════════════════════════════
   SEARCH LOGIC & LOOKUP
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
    const number = input.value.trim();

    if (!/^[6-9]\d{9}$/.test(number)) {
        showStatus('❌ Valid 10-digit number daalein (6-9 se start hona chahiye)', 'error');
        return;
    }

    resultsDiv.innerHTML = '';
    showStatus('⏳ Searching Darkie Zone database... please wait', 'loading');
    btn.disabled = true;

    try {
        const res = await fetch(`https://ftosint.world/api/number?key=danish-nfs&num=${number}`);

        if (!res.ok) {
            showStatus(`❌ API Error ${res.status}. Baad mein try karein.`, 'error');
            return;
        }

        const rawText = await res.text();
        let data;
        try {
            // Try direct parse first
            data = JSON.parse(rawText);
        } catch(e) {
            // Fallback: extract JSON object
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                showStatus('❌ API ne invalid response diya.', 'error');
                return;
            }
            try {
                data = JSON.parse(jsonMatch[0]);
            } catch(e2) {
                showStatus('❌ Error parsing data.', 'error');
                return;
            }
        }

        if (!data.success) {
            showStatus(`❌ ${data.error || data.message || 'Koi data nahi mila'}`, 'error');
            return;
        }

        if (!data.results || data.results.length === 0) {
            showStatus('😕 Is number ka koi record nahi mila', 'error');
            return;
        }

        // Normalize new API fields to old field names
        data.results = data.results.map(r => ({
            ...r,
            aadhar      : r.id       ?? r.aadhar ?? null,
            father_name : r.fname    ?? r.father_name ?? null,
            alternate   : r.alt      ?? r.alternate ?? null,
            email       : (r.email === 'N/A' || r.email === '') ? null : r.email,
            aadhar_disp : (r.id === 'N/A' || r.id === '') ? null : (r.id ?? r.aadhar ?? null),
        }));

        // Remove duplicates (same id + mobile + name)
        const seen = new Set();
        data.results = data.results.filter(r => {
            const key = `${r.mobile}-${r.aadhar}-${r.name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const truecallerLine = data.truecaller_name
            ? ` | 📲 Truecaller: <b>${data.truecaller_name}</b>` : '';
        showStatus(`✅ ${data.results.length} record${data.results.length > 1 ? 's' : ''} mila!${truecallerLine}`, 'success');
        renderResults(data.results, data.truecaller_name);

    } catch (err) {
        showStatus('❌ Network error. Please check your internet connection.', 'error');
        console.error(err);
    } finally {
        btn.disabled = false;
    }
}

function showStatus(msg, cls) {
    statusEl.innerHTML = msg;
    statusEl.className = 'status ' + cls;
}


/* ══════════════════════════════════════
   RENDER RESULTS + MODERN RESPONSIVE TILES
══════════════════════════════════════ */
function renderResults(results, truecallerName) {
    // Show truecaller banner if available
    if (truecallerName) {
        const banner = document.createElement('div');
        banner.className = 'truecaller-banner';
        banner.innerHTML = `📲 <strong>Truecaller Name:</strong> ${truecallerName}`;
        resultsDiv.appendChild(banner);
    }

    results.forEach((r, i) => {
        const card = document.createElement('div');
        card.className = 'card';

        // Clean address — replace ! and run-on text with comma-space
        const addressClean = r.address
            ? r.address.replace(/!+/g, ', ').replace(/^,\s*/, '').replace(/,\s*,/g, ',').replace(/\n/g, ' ').trim()
            : null;

        // Normalize null-ish values
        const fname    = (r.father_name === 'N/A' || !r.father_name) ? null : r.father_name;
        const aadhar   = (r.aadhar_disp === 'N/A' || !r.aadhar_disp) ? null : r.aadhar_disp;
        const alternate= (r.alternate === 'N/A' || !r.alternate) ? null : r.alternate;
        const email    = r.email || null;

        // Build plain-text for clipboard
        const copyText = buildCopyText(r, addressClean, i + 1, truecallerName);

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
                ${tile('👨', "Father's Name", fname)}
                ${tile('🆔', 'Aadhaar Number', aadhar)}
                ${tile('📡', 'Telecom Circle', r.circle, 'circle')}
                ${tile('📞', 'Alternate Number', alternate)}
                ${tile('📧', 'Email Address', email)}
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

function buildCopyText(r, addressClean, num, truecallerName) {
    const fname    = (r.father_name === 'N/A' || !r.father_name) ? '—' : r.father_name;
    const aadhar   = (r.aadhar_disp === 'N/A' || !r.aadhar_disp) ? '—' : r.aadhar_disp;
    const alternate= (r.alternate === 'N/A' || !r.alternate) ? '—' : r.alternate;
    const email    = (!r.email || r.email === 'N/A') ? '—' : r.email;

    const lines = [
        `━━━━ Record #${num} ━━━━`,
        `📱 Mobile    : ${r.mobile    ?? '—'}`,
        `👤 Name      : ${r.name      ?? '—'}`,
        `📲 Truecaller: ${truecallerName ?? '—'}`,
        `👨 Father    : ${fname}`,
        `🏠 Address   : ${addressClean ?? '—'}`,
        `📞 Alternate : ${alternate}`,
        `📡 Circle    : ${r.circle    ?? '—'}`,
        `🆔 Aadhaar   : ${aadhar}`,
        `📧 Email     : ${email}`,
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