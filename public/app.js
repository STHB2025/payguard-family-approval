const API = '';

let currentFilter = 'all';

// TAB NAVIGATION
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'dashboard') loadDashboard();
    if (btn.dataset.tab === 'approvals') loadApprovals();
    if (btn.dataset.tab === 'history') loadHistory();
  });
});

// TOAST
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { t.style.display = 'none'; }, 3000);
}

// FORMAT
function formatAmount(n) {
  return 'R ' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) + ' · ' +
    d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}
function statusBadge(status) {
  return `<span class="status-badge status-${status}">${status}</span>`;
}
function riskColor(level) {
  if (level === 'low') return '#10b981';
  if (level === 'medium') return '#f59e0b';
  return '#ef4444';
}
function riskFillColor(score) {
  if (score <= 30) return '#10b981';
  if (score <= 60) return '#f59e0b';
  return '#ef4444';
}

// RISK PREVIEW (live)
function updateRiskPreview() {
  const amount = parseFloat(document.getElementById('amount').value) || 0;
  const isNew = document.getElementById('isNewBeneficiary').checked;
  const isFirst = document.getElementById('isFirstPaymentPattern').checked;
  let score = 0;
  if (isNew) score += 40;
  if (amount > 5000) score += 30;
  if (isFirst) score += 25;
  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) score += 10;

  const preview = document.getElementById('risk-preview');
  const fill = document.getElementById('risk-fill');
  const label = document.getElementById('risk-score-label');
  const outcome = document.getElementById('risk-outcome-label');

  preview.style.display = 'block';
  fill.style.width = Math.min(score, 100) + '%';
  fill.style.background = riskFillColor(score);
  label.textContent = score;

  if (score <= 30) {
    outcome.innerHTML = '<span style="color:#10b981;font-weight:600;">✅ Auto-approved</span> — Low risk transaction';
  } else if (score <= 60) {
    outcome.innerHTML = '<span style="color:#f59e0b;font-weight:600;">🔔 Notification triggered</span> — Medium risk, trusted contact notified';
  } else {
    outcome.innerHTML = '<span style="color:#ef4444;font-weight:600;">⚠️ Approval required</span> — High risk, payment held for approval';
  }
}

['amount', 'isNewBeneficiary', 'isFirstPaymentPattern'].forEach(id => {
  document.getElementById(id).addEventListener('change', updateRiskPreview);
  document.getElementById(id).addEventListener('input', updateRiskPreview);
});

// SUBMIT PAYMENT
document.getElementById('payment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('.btn-primary');
  btn.textContent = 'Processing...';
  btn.disabled = true;

  const body = {
    recipient: document.getElementById('recipient').value,
    amount: parseFloat(document.getElementById('amount').value),
    reference: document.getElementById('reference').value,
    isNewBeneficiary: document.getElementById('isNewBeneficiary').checked,
    isFirstPaymentPattern: document.getElementById('isFirstPaymentPattern').checked,
  };

  try {
    const res = await fetch(API + '/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    const tx = data.transaction;

    document.getElementById('payment-form').style.display = 'none';
    const result = document.getElementById('payment-result');
    result.style.display = 'block';

    const icons = { approved: '✅', pending: '⏳', notified: '🔔', blocked: '🚫' };
    const titles = {
      approved: 'Payment Auto-Approved',
      pending: 'Approval Required',
      notified: 'Trusted Contact Notified',
      blocked: 'Payment Blocked'
    };
    const messages = {
      approved: 'Low risk detected. Your payment was processed automatically.',
      pending: 'High risk detected. Your payment is on hold until a trusted contact approves it.',
      notified: 'Medium risk detected. Your trusted contact has been notified.',
      blocked: 'This transaction was blocked.'
    };

    document.getElementById('result-icon').textContent = icons[tx.status];
    document.getElementById('result-title').textContent = titles[tx.status];
    document.getElementById('result-message').textContent = messages[tx.status];

    const details = document.getElementById('result-details');
    details.innerHTML = `
      <div class="result-detail-row"><span>Recipient</span><span>${tx.recipient}</span></div>
      <div class="result-detail-row"><span>Amount</span><span>${formatAmount(tx.amount)}</span></div>
      <div class="result-detail-row"><span>Reference</span><span>${tx.reference}</span></div>
      <div class="result-detail-row"><span>Risk Score</span><span style="color:${riskColor(tx.riskLevel)};font-weight:700">${tx.riskScore} (${tx.riskLevel})</span></div>
      <div class="result-detail-row"><span>Status</span><span>${statusBadge(tx.status)}</span></div>
    `;

    loadApprovalsCount();
  } catch (err) {
    showToast('Error processing payment. Please try again.');
  }

  btn.textContent = 'Submit Payment';
  btn.disabled = false;
});

document.getElementById('new-payment-btn').addEventListener('click', () => {
  document.getElementById('payment-form').reset();
  document.getElementById('risk-preview').style.display = 'none';
  document.getElementById('payment-form').style.display = 'block';
  document.getElementById('payment-result').style.display = 'none';
});

// LOAD DASHBOARD
async function loadDashboard() {
  try {
    const [stats, txs] = await Promise.all([
      fetch(API + '/api/stats').then(r => r.json()),
      fetch(API + '/api/transactions').then(r => r.json())
    ]);

    document.getElementById('stat-approved').textContent = stats.approved;
    document.getElementById('stat-blocked').textContent = stats.blocked;
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-total').textContent = stats.total;

    const activityEl = document.getElementById('recent-activity');
    const recent = txs.slice(0, 6);
    if (recent.length === 0) {
      activityEl.innerHTML = '<div class="empty-state">No transactions yet.</div>';
    } else {
      activityEl.innerHTML = recent.map(tx => `
        <div class="activity-item">
          <div class="activity-item-left">
            <span class="activity-item-name">${tx.recipient}</span>
            <span class="activity-item-ref">${tx.reference}</span>
          </div>
          <div class="activity-item-right">
            <span class="activity-amount">${formatAmount(tx.amount)}</span>
            ${statusBadge(tx.status)}
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

// LOAD APPROVALS COUNT
async function loadApprovalsCount() {
  try {
    const approvals = await fetch(API + '/api/pending-approvals').then(r => r.json());
    const badge = document.getElementById('approvals-badge');
    if (approvals.length > 0) {
      badge.textContent = approvals.length;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  } catch (err) {}
}

// LOAD APPROVALS
async function loadApprovals() {
  loadApprovalsCount();
  try {
    const approvals = await fetch(API + '/api/pending-approvals').then(r => r.json());
    const el = document.getElementById('approvals-list');

    if (approvals.length === 0) {
      el.innerHTML = '<div class="empty-state card" style="padding:40px;">No pending approvals. All transactions are resolved.</div>';
      return;
    }

    el.innerHTML = approvals.map(a => {
      const tx = a.transaction;
      return `
        <div class="approval-card" id="approval-${a.id}">
          <div class="approval-card-header">
            <div>
              <div class="approval-card-title">⚠️ High-Risk Payment — ${tx.recipient}</div>
              <div style="color:var(--gray-500);font-size:13px;margin-top:4px;">${formatTime(a.requestedAt)}</div>
            </div>
            <div class="approval-amount">${formatAmount(tx.amount)}</div>
          </div>
          <div class="approval-meta">
            <div class="approval-meta-item"><label>Reference</label>${tx.reference}</div>
            <div class="approval-meta-item"><label>Risk Score</label><span style="color:${riskColor(tx.riskLevel)};font-weight:700">${tx.riskScore}/100</span></div>
            <div class="approval-meta-item"><label>Beneficiary</label>${tx.isNewBeneficiary ? 'New beneficiary' : 'Known beneficiary'}</div>
            <div class="approval-meta-item"><label>Payment Pattern</label>${tx.isFirstPaymentPattern ? 'First-time' : 'Regular'}</div>
          </div>
          <div class="risk-reasons">
            ${tx.riskReasons.map(r => `<span class="risk-reason-tag">⚡ ${r}</span>`).join('')}
          </div>
          <div class="approval-actions">
            <input class="approver-name" id="approver-${a.id}" type="text" placeholder="Your name (approver)" />
            <button class="btn btn-approve" onclick="handleApproval('${a.id}', 'approve')">✅ Approve</button>
            <button class="btn btn-reject" onclick="handleApproval('${a.id}', 'reject')">🚫 Block</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Approvals load error:', err);
  }
}

async function handleApproval(approvalId, action) {
  const approverName = document.getElementById('approver-' + approvalId).value || 'Trusted Contact';
  try {
    const res = await fetch(API + `/api/approvals/${approvalId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approverName })
    });
    if (!res.ok) throw new Error('Failed');
    showToast(action === 'approve' ? '✅ Payment approved successfully!' : '🚫 Payment blocked successfully!');
    loadApprovals();
  } catch (err) {
    showToast('Error processing approval.');
  }
}

// LOAD HISTORY
async function loadHistory() {
  try {
    const txs = await fetch(API + '/api/transactions').then(r => r.json());
    renderHistory(txs, currentFilter);
  } catch (err) {
    console.error('History load error:', err);
  }
}

function renderHistory(txs, filter) {
  const filtered = filter === 'all' ? txs : txs.filter(t => t.status === filter);
  const tbody = document.getElementById('history-tbody');

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No transactions found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(tx => `
    <tr>
      <td style="color:var(--gray-500);font-size:13px;">${formatTime(tx.createdAt)}</td>
      <td><strong>${tx.recipient}</strong></td>
      <td><strong>${formatAmount(tx.amount)}</strong></td>
      <td style="color:var(--gray-500);">${tx.reference}</td>
      <td><span class="risk-${tx.riskLevel}" style="font-weight:700;">${tx.riskScore}</span></td>
      <td>${statusBadge(tx.status)}</td>
    </tr>
  `).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    const txs = await fetch(API + '/api/transactions').then(r => r.json());
    renderHistory(txs, currentFilter);
  });
});

// INIT
loadDashboard();
loadApprovalsCount();
setInterval(loadApprovalsCount, 5000);
