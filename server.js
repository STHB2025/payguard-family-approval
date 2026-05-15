const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let transactions = [];
let pendingApprovals = [];

function calculateRiskScore(transaction) {
  let score = 0;
  const reasons = [];

  if (transaction.isNewBeneficiary) {
    score += 40;
    reasons.push('New beneficiary (+40)');
  }
  if (transaction.amount > 5000) {
    score += 30;
    reasons.push('High transaction amount (+30)');
  }
  if (transaction.isFirstPaymentPattern) {
    score += 25;
    reasons.push('First-time payment pattern (+25)');
  }
  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) {
    score += 10;
    reasons.push('Unusual transaction timing (+10)');
  }

  return { score, reasons };
}

function getRiskLevel(score) {
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  return 'high';
}

app.post('/api/transactions', (req, res) => {
  const { recipient, amount, reference, isNewBeneficiary, isFirstPaymentPattern } = req.body;

  const { score, reasons } = calculateRiskScore({
    amount: parseFloat(amount),
    isNewBeneficiary,
    isFirstPaymentPattern
  });

  const riskLevel = getRiskLevel(score);
  const id = uuidv4();
  const now = new Date();

  let status;
  if (riskLevel === 'low') {
    status = 'approved';
  } else if (riskLevel === 'medium') {
    status = 'notified';
  } else {
    status = 'pending';
  }

  const transaction = {
    id,
    recipient,
    amount: parseFloat(amount),
    reference,
    isNewBeneficiary,
    isFirstPaymentPattern,
    riskScore: score,
    riskLevel,
    riskReasons: reasons,
    status,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  transactions.unshift(transaction);

  if (riskLevel === 'high') {
    pendingApprovals.unshift({
      id: uuidv4(),
      transactionId: id,
      transaction,
      requestedAt: now.toISOString()
    });
  }

  res.json({ success: true, transaction });
});

app.get('/api/transactions', (req, res) => {
  res.json(transactions);
});

app.get('/api/pending-approvals', (req, res) => {
  const pending = pendingApprovals.filter(a => {
    const tx = transactions.find(t => t.id === a.transactionId);
    return tx && tx.status === 'pending';
  });
  res.json(pending);
});

app.post('/api/approvals/:approvalId/approve', (req, res) => {
  const approval = pendingApprovals.find(a => a.id === req.params.approvalId);
  if (!approval) return res.status(404).json({ error: 'Approval not found' });

  const tx = transactions.find(t => t.id === approval.transactionId);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });

  tx.status = 'approved';
  tx.updatedAt = new Date().toISOString();
  tx.approvedBy = req.body.approverName || 'Trusted Contact';
  tx.approvedAt = new Date().toISOString();

  res.json({ success: true, transaction: tx });
});

app.post('/api/approvals/:approvalId/reject', (req, res) => {
  const approval = pendingApprovals.find(a => a.id === req.params.approvalId);
  if (!approval) return res.status(404).json({ error: 'Approval not found' });

  const tx = transactions.find(t => t.id === approval.transactionId);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });

  tx.status = 'blocked';
  tx.updatedAt = new Date().toISOString();
  tx.blockedBy = req.body.approverName || 'Trusted Contact';
  tx.blockedAt = new Date().toISOString();

  res.json({ success: true, transaction: tx });
});

app.get('/api/stats', (req, res) => {
  const total = transactions.length;
  const approved = transactions.filter(t => t.status === 'approved').length;
  const blocked = transactions.filter(t => t.status === 'blocked').length;
  const pending = transactions.filter(t => t.status === 'pending').length;
  const notified = transactions.filter(t => t.status === 'notified').length;
  const totalAmount = transactions
    .filter(t => t.status === 'approved')
    .reduce((sum, t) => sum + t.amount, 0);

  res.json({ total, approved, blocked, pending, notified, totalAmount });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PayGuard running on http://0.0.0.0:${PORT}`);
});
