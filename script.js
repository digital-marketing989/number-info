/* ══════════════════════════════════════
   SEARCH LOGIC & LOOKUP
══════════════════════════════════════ */
const input      = document.getElementById('numberInput');
const btn        = document.getElementById('searchBtn');
const statusEl   = document.getElementById('status');
const resultsDiv = document.getElementById('results');

let currentResultsData = [];
let currentTruecallerName = null;

input?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
});

input?.addEventListener('keypress', e => {
    if (e.key === 'Enter') btn.click();
});

btn?.addEventListener('click', search);

async function fetchWithTimeout(url, timeoutMs = 7000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

function parseJsonSafe(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e2) {
                return null;
            }
        }
        return null;
    }
}

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
        let data = null;
        let lastError = null;

        // 1. Try Primary API (osint-apis-hub)
        try {
            const res = await fetchWithTimeout(`https://osint-apis-hub.onrender.com/api/num-info?key=1MonthFree&q=91${number}`, 7000);
            if (res.ok) {
                const rawText = await res.text();
                const parsed = parseJsonSafe(rawText);
                if (parsed && (parsed.status === true || parsed.success === true)) {
                    data = parsed;
                } else if (parsed && (parsed.error || parsed.message)) {
                    lastError = parsed.error || parsed.message;
                }
            }
        } catch (e) {
            console.warn('Primary API unavailable or timed out:', e);
        }

        // 2. Fallback to backup fast API (ftosint.world) if primary didn't return data
        if (!data) {
            try {
                showStatus('⏳ Connecting to Darkie Zone fast node... please wait', 'loading');
                const res2 = await fetchWithTimeout(`https://ftosint.world/api/number?key=megule&num=${number}`, 9000);
                if (res2.ok) {
                    const rawText2 = await res2.text();
                    const parsed2 = parseJsonSafe(rawText2);
                    if (parsed2 && (parsed2.status === true || parsed2.success === true)) {
                        data = parsed2;
                    } else if (parsed2 && (parsed2.error || parsed2.message)) {
                        lastError = parsed2.error || parsed2.message;
                    }
                }
            } catch (e2) {
                console.warn('Backup API error:', e2);
            }
        }

        if (!data) {
            showStatus(`❌ ${lastError || 'Is number ka koi record nahi mila ya server offline hai'}`, 'error');
            return;
        }

        // Extract records from various possible response formats
        let rawRecords = [];
        if (Array.isArray(data.data)) {
            data.data.forEach(group => {
                if (group && Array.isArray(group.records)) {
                    rawRecords.push(...group.records);
                } else if (group && typeof group === 'object' && !group.records) {
                    rawRecords.push(group);
                }
            });
        } else if (Array.isArray(data.records)) {
            rawRecords.push(...data.records);
        } else if (Array.isArray(data.results)) {
            rawRecords.push(...data.results);
        }

        if (rawRecords.length === 0) {
            showStatus('😕 Is number ka koi record nahi mila', 'error');
            return;
        }

        // Normalize fields
        const normalized = rawRecords.map(r => {
            let mobile = '';
            let alternate = (r.alt === 'N/A' || r.alternate === 'N/A') ? null : (r.alt ?? r.alternate ?? null);

            if (Array.isArray(r.phone)) {
                const match = r.phone.find(p => p.endsWith(number));
                mobile = match || r.phone[0] || number;
                const others = r.phone.filter(p => p !== mobile);
                if (others.length > 0 && !alternate) {
                    alternate = others.map(p => p.replace(/^91(?=\d{10})/, '')).join(', ');
                }
            } else if (typeof r.phone === 'string') {
                mobile = r.phone;
            } else {
                mobile = r.mobile ?? number;
            }

            const mobileDisp = (typeof mobile === 'string' && mobile.startsWith('91') && mobile.length === 12)
                ? mobile.slice(2)
                : mobile;

            let addressStr = '';
            if (Array.isArray(r.address)) {
                const uniqueLines = [...new Set(r.address.filter(Boolean))];
                addressStr = uniqueLines.join(' | ');
            } else if (typeof r.address === 'string') {
                addressStr = r.address;
            }

            const docNum = r.document_number ?? r.passport_number ?? r.id ?? r.aadhar ?? null;
            const aadharDisp = (docNum === 'N/A' || docNum === '' || !docNum) ? null : docNum;
            const fname = r.father_name ?? r.fname ?? null;
            const fatherDisp = (fname === 'N/A' || fname === '' || !fname) ? null : fname;

            return {
                mobile      : mobileDisp || number,
                name        : r.full_name ?? r.name ?? '—',
                father_name : fatherDisp,
                circle      : r.region ?? r.circle ?? null,
                alternate   : alternate,
                email       : (r.email === 'N/A' || r.email === '') ? null : (r.email ?? null),
                aadhar      : aadharDisp,
                aadhar_disp : aadharDisp,
                address     : addressStr || null,
                nick        : r.nick ?? null,
            };
        });

        // Remove duplicates (same id + mobile + name + father_name)
        const seen = new Set();
        const dedupedResults = normalized.filter(r => {
            const key = `${r.mobile}-${r.aadhar}-${r.name}-${r.father_name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        if (dedupedResults.length === 0) {
            showStatus('😕 Is number ka koi record nahi mila', 'error');
            return;
        }

        const truecallerLine = data.truecaller_name
            ? ` | 📲 Truecaller: <b>${data.truecaller_name}</b>` : '';
        showStatus(`✅ ${dedupedResults.length} record${dedupedResults.length > 1 ? 's' : ''} mila!${truecallerLine}`, 'success');
        renderResults(dedupedResults, data.truecaller_name);

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
    currentResultsData = results;
    currentTruecallerName = truecallerName;

    // Show truecaller banner if available
    if (truecallerName) {
        const banner = document.createElement('div');
        banner.className = 'truecaller-banner';
        banner.innerHTML = `📲 <strong>Truecaller Name:</strong> ${truecallerName}`;
        resultsDiv.appendChild(banner);
    }

    // Results Actions Bar with "Copy All Records" button
    const actionsBar = document.createElement('div');
    actionsBar.className = 'results-actions-bar';
    actionsBar.innerHTML = `
        <div class="results-count-badge">
            <span class="count-pulse"></span>
            <span>Total Records: <strong>${results.length}</strong></span>
        </div>
        <button class="copy-all-btn" id="copyAllBtn" onclick="copyAllRecords()">
            📋 Copy All Records
        </button>
    `;
    resultsDiv.appendChild(actionsBar);

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

        card.innerHTML = `
            <div class="card-header">
                <div class="card-title-group">
                    <span class="card-badge">RECORD #${i + 1}</span>
                    <span class="card-chip">OSINT INTEL</span>
                </div>
                <button class="copy-btn" id="copyBtn${i}" onclick="copyRecord(${i})">
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

function buildAllRecordsCopyText(results, truecallerName) {
    const header = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🛡️ DARKIE ZONE CYBERSECURITY INTEL`,
        `📊 Total Records Found: ${results.length}`,
        truecallerName ? `📲 Truecaller: ${truecallerName}` : null,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
    ].filter(Boolean).join('\n');

    const recordsText = results.map((r, i) => {
        const addressClean = r.address
            ? r.address.replace(/!+/g, ', ').replace(/^,\s*/, '').replace(/,\s*,/g, ',').replace(/\n/g, ' ').trim()
            : null;
        return buildCopyText(r, addressClean, i + 1, truecallerName);
    }).join('\n\n');

    return `${header}${recordsText}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🛡️ Darkie Zone OSINT Tool`;
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
}

function fallbackCopy(text) {
    return new Promise((resolve, reject) => {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity  = '0';
            ta.style.left     = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const success = document.execCommand('copy');
            document.body.removeChild(ta);
            if (success) resolve();
            else reject(new Error('execCommand copy failed'));
        } catch (err) {
            reject(err);
        }
    });
}

function copyRecord(idx) {
    const r = currentResultsData[idx];
    if (!r) return;
    const addressClean = r.address
        ? r.address.replace(/!+/g, ', ').replace(/^,\s*/, '').replace(/,\s*,/g, ',').replace(/\n/g, ' ').trim()
        : null;
    const copyText = buildCopyText(r, addressClean, idx + 1, currentTruecallerName);
    const copyBtn = document.getElementById(`copyBtn${idx}`);

    copyToClipboard(copyText).then(() => {
        if (copyBtn) {
            copyBtn.textContent = '✅ Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = '📋 Copy Record';
                copyBtn.classList.remove('copied');
            }, 2000);
        }
    }).catch(err => console.error('Copy failed:', err));
}

function copyAllRecords() {
    if (!currentResultsData || currentResultsData.length === 0) return;
    const allText = buildAllRecordsCopyText(currentResultsData, currentTruecallerName);
    const copyAllBtn = document.getElementById('copyAllBtn');

    copyToClipboard(allText).then(() => {
        if (copyAllBtn) {
            copyAllBtn.innerHTML = '✅ All Records Copied!';
            copyAllBtn.classList.add('copied');
            setTimeout(() => {
                copyAllBtn.innerHTML = '📋 Copy All Records';
                copyAllBtn.classList.remove('copied');
            }, 2000);
        }
    }).catch(err => console.error('Copy all failed:', err));
}