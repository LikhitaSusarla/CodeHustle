const bankFees = Object.fromEntries(banksData.map(b=>[b, 2500]));
bankFees['HDFC Bank'] = 3000;
bankFees['State Bank of India'] = 2500;
bankFees['ICICI Bank'] = 2800;

// Loan configurations
const loanConfigs = {
  home:     { rate: 9, tenure: 20, tenureMax: 30, tickStep: 5 },
  car:      { rate: 9, tenure: 5,  tenureMax: 15, tickStep: 1 },
  personal: { rate: 11, tenure: 3, tenureMax: 15, tickStep: 1 }
};

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
  // Populate bank dropdown
  const bankSelect = document.getElementById('bankName');
  bankSelect.append(new Option('N/A', 'N/A', true, true));
  banksData.forEach(bank => bankSelect.append(new Option(bank, bank)));

  // Populate currency dropdown
  const currencySelect = document.getElementById('currency');
  currencySelect.append(new Option('Select currency', '', true, true));
  currenciesData.forEach(c => currencySelect.append(new Option(`${c.name} (${c.code})`, c.code)));

  setupLoanType();
});

// Loan type change
document.querySelectorAll('input[name="loanType"]').forEach(radio =>
  radio.addEventListener('change', setupLoanType)
);

function setupLoanType() {
  const type = document.querySelector('input[name="loanType"]:checked').value;
  const cfg = loanConfigs[type];

  // Interest slider
  const ir = document.getElementById('interestRateRange');
  ir.min = 5; ir.max = 25; ir.step = 0.1; ir.value = cfg.rate;
  document.getElementById('interestRate').value = cfg.rate;

  // Build interest labels
  const iLabels = document.getElementById('interestLabels');
  iLabels.innerHTML = '';
  for (let v = 5; v <= 25; v += 2.5) {
    iLabels.innerHTML += `<span>${v}%</span>`;
  }

  // Tenure slider
  const tr = document.getElementById('tenureRange');
  tr.min = type === 'home' ? 0 : 1;
  tr.max = cfg.tenureMax;
  tr.step = 1;
  tr.value = cfg.tenure;
  document.getElementById('loanTenure').value = cfg.tenure;

  // Build tenure labels
  const tLabels = document.getElementById('tenureLabels');
  tLabels.innerHTML = '';
  if (type === 'home') {
    for (let y = 0; y <= cfg.tenureMax; y += cfg.tickStep) {
      tLabels.innerHTML += `<span>${y}</span>`;
    }
  } else {
    for (let y = 1; y <= cfg.tenureMax; y++) {
      tLabels.innerHTML += `<span>${y}</span>`;
    }
  }
}

// Sync sliders & inputs
['interestRateRange','interestRate'].forEach(id => {
  document.getElementById(id).addEventListener('input', e => {
    const other = id === 'interestRateRange' ? 'interestRate' : 'interestRateRange';
    document.getElementById(other).value = e.target.value;
  });
});

['tenureRange','loanTenure'].forEach(id => {
  document.getElementById(id).addEventListener('input', e => {
    const other = id === 'tenureRange' ? 'loanTenure' : 'tenureRange';
    document.getElementById(other).value = e.target.value;
  });
});

// Navigation helpers
function showStep1() { toggleStep('step1'); }
function showStep2() { toggleStep('step2'); }
function showResult() { toggleStep('result'); }
function toggleStep(id) {
  ['step1','step2','result'].forEach(s =>
    document.getElementById(s).classList.toggle('active', s === id)
  );
}

// ROI type change
document.getElementById('roiType').addEventListener('change', e => {
  document.getElementById('avgIncreaseGroup').style.display =
    e.target.value === 'increasing' ? 'block' : 'none';
});

// Populate processing fee
document.getElementById('bankName').addEventListener('change', e => {
  const fee = bankFees[e.target.value] || 'N/A';
  document.getElementById('processingFees').value = fee;
});

// Update fees label
document.getElementById('currency').addEventListener('change', e => {
  const c = e.target.value || 'N/A';
  const label = c === 'N/A' ? 'Processing Fees' : `Processing Fees in ${c}`;
  document.getElementById('processingFeesLabel').innerText = label;
});

// EMI calc, chart & table
function calculateEMI() {
  // Validate
  let valid = true;
  ['loanAmount','currency','interestRate','loanTenure'].forEach(id => {
    const el = document.getElementById(id);
    const isInvalid = !el.value || (id === 'currency' && el.value === '');
    el.classList.toggle('invalid', isInvalid);
    if (isInvalid) valid = false;
  });
  if (!valid) { alert('Please fill all mandatory fields, including a valid currency.'); return; }

  // Inputs
  const P = parseFloat(document.getElementById('loanAmount').value);
  let rate = parseFloat(document.getElementById('interestRate').value);
  const months = document.getElementById('tenureType').value === 'years'
    ? parseFloat(document.getElementById('loanTenure').value) * 12
    : parseFloat(document.getElementById('loanTenure').value);
  const r = rate / (12 * 100);
  const interestType = document.getElementById('interestType').value;
  const roiType = document.getElementById('roiType').value;
  const avgI = parseFloat(document.getElementById('avgIncrease').value) || 0;
  if (roiType === 'increasing') rate += avgI * (months / 12);

  // EMI formula
  let EMI, totalPay, totalInt;
  if (interestType === 'compound') {
    EMI = (P * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
    totalPay = EMI * months;
    totalInt = totalPay - P;
  } else {
    totalInt = P * rate * (months / 12) / 100;
    totalPay = P + totalInt;
    EMI = totalPay / months;
  }

  // Show result container before rendering chart
  showResult();

  // Pie chart with percentages
  const total = P + totalInt;
  const principalPercent = (P / total * 100).toFixed(1);
  const interestPercent = (totalInt / total * 100).toFixed(1);
  const ctx = document.getElementById('paymentChart').getContext('2d');
  if (window._chart) window._chart.destroy();
  window._chart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: [`Principal (${principalPercent}%)`, `Interest (${interestPercent}%)`],
      datasets: [{ data: [P, totalInt], backgroundColor: ['#007bff','#dc3545'] }]
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      responsive: true,
      maintainAspectRatio: true
    }
  });

  // Amort table
  const schedule = []; let balance = P, cum = 0;
  const years = Math.ceil(months / 12);
  for (let y = 1; y <= years; y++) {
    let pY = 0, iY = 0;
    for (let m = 1; m <= 12; m++) {
      if ((y-1)*12 + m > months) break;
      const iAmt = balance * r;
      const pAmt = EMI - iAmt;
      balance -= pAmt;
      pY += pAmt;
      iY += iAmt;
      cum += EMI;
    }
    schedule.push({ year: y, principal: pY, interest: iY, total: pY + iY, balance: Math.max(balance, 0), paid: cum });
  }
  const tbody = document.querySelector('#amortTable tbody');
  tbody.innerHTML = schedule.map(r =>
    `<tr><td>${r.year}</td><td>${r.principal.toFixed(2)}</td><td>${r.interest.toFixed(2)}</td>` +
    `<td>${r.total.toFixed(2)}</td><td>${r.balance.toFixed(2)}</td><td>${r.paid.toFixed(2)}</td></tr>`
  ).join('');

  // Results text
  document.getElementById('results').innerHTML =
    `<p><strong>Monthly EMI:</strong> ${EMI.toFixed(2)}</p>` +
    `<p><strong>Total Payment:</strong> ${totalPay.toFixed(2)}</p>` +
    `<p><strong>Total Interest:</strong> ${totalInt.toFixed(2)}</p>`;
}

// Like, comment, and rating DOM access
document.addEventListener("DOMContentLoaded", () => {
  const likeButton = document.getElementById('likeButton');
  const likeCountSpan = document.getElementById('likeCount');
  const commentsList = document.getElementById('commentsList');
  const commentForm = document.getElementById('commentForm');
  const commentInput = document.getElementById('commentInput');
  const stars = document.querySelectorAll('#starRating span');
  let selectedRating = 0;

  // Load existing data
  db.ref('reviews').once('value').then(snapshot => {
    const data = snapshot.val();
    if (data) {
      // Likes
      if (data.likes !== undefined) {
        likeCountSpan.textContent = data.likes;
      }
      // Comments
      if (data.comments) {
        Object.values(data.comments).forEach(text => {
          const div = document.createElement('div');
          div.className = 'comment';
          div.textContent = text;
          commentsList.appendChild(div);
        });
      }
      // Ratings
      if (data.rating) {
        selectedRating = data.rating;
        highlightStars(selectedRating);
      }
    }
  });

  // Like handler
  likeButton.addEventListener('click', () => {
    let count = parseInt(likeCountSpan.textContent) || 0;
    count++;
    likeCountSpan.textContent = count;
    db.ref('reviews/likes').set(count);
  });

});
