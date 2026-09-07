// Disable code inspecting and source viewing
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', function(e) {
    if (e.keyCode === 123) { e.preventDefault(); return false; } 
    if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) { e.preventDefault(); return false; } 
    if (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 83)) { e.preventDefault(); return false; } 
});

// Dropdown click outside closing fix for mobile devices
document.getElementById('dropdownToggle').addEventListener('click', function(e) {
    e.preventDefault();
    this.parentElement.classList.toggle('active');
});

document.addEventListener('click', function(e) {
    if (!e.target.closest('.dropdown')) {
        document.querySelector('.dropdown').classList.remove('active');
    }
});

let scale2015, scale2026Start, approxStep, bengaliOrdinals;
let appState = {};
let previewSlides = [];
let currentSlide = 0;

document.addEventListener("DOMContentLoaded", () => {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            scale2015 = data.scale2015;
            scale2026Start = data.scale2026Start;
            approxStep = data.approxStep;
            bengaliOrdinals = data.bengaliOrdinals;
            initApp();
        })
        .catch(error => console.error("Error loading JSON data:", error));
});

function toBengaliNum(num) {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/[0-9]/g, match => bengaliDigits[match]);
}

function initApp() {
    const gradeSelect = document.getElementById('grade');
    for (let i = 1; i <= 20; i++) {
        let option = document.createElement('option');
        option.value = i; 
        option.text = `${bengaliOrdinals[i]} গ্রেড`;
        gradeSelect.add(option);
    }
    let count = parseInt(localStorage.getItem('payCalcCount') || '0');
    document.getElementById('calcCount').textContent = toBengaliNum(count);
}

function populateSteps() {
    const grade = document.getElementById('grade').value;
    const basicSelect = document.getElementById('basic');
    basicSelect.innerHTML = '<option value="" disabled selected>ধাপ নির্বাচন করুন</option>';
    
    if (grade && scale2015[grade]) {
        scale2015[grade].forEach((amount, index) => {
            let option = document.createElement('option');
            option.value = amount;
            option.text = `ধাপ ${toBengaliNum(index + 1)}: ${formatMoney(amount)}`;
            basicSelect.add(option);
        });
    }
}

function formatMoney(n) {
    let engFormat = Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return toBengaliNum(engFormat) + ' ৳';
}

function nextHigherStep(base, grade) {
    const start = scale2026Start[grade];
    if (Math.abs(base - start) < 1) return start;
    const step = approxStep[grade] || 500;
    let current = start;
    while (current < base - 0.5) { current += step; }
    return Math.round(current);
}

function getHouseRent(targetBasic, location) {
    let rate = 0.40, min = 7000;
    if (location === 'DHAKA_City') { rate = 0.55; min = 9600; }
    else if (location === 'OTHER_CITY') { rate = 0.45; min = 8000; }
    else if (location === 'DISTRICT') { rate = 0.40; min = 7000; }
    else { rate = 0.40; min = 7000; }
    return Math.max(targetBasic * rate, min);
}

function calculatePay(e) {
    e.preventDefault();

    const basic = parseFloat(document.getElementById('basic').value) || 0;
    const grade = parseInt(document.getElementById('grade').value) || 0;
    const location = document.getElementById('location').value;
    const eduCount = Math.min(2, Math.max(0, parseInt(document.getElementById('edu').value) || 0));
    const gpf = parseFloat(document.getElementById('gpf').value) || 0;
    const tax = parseFloat(document.getElementById('tax').value) || 0;

    if (grade < 1 || grade > 20 || basic < 5000) {
        alert('সঠিক গ্রেড (১-২০) ও মূল বেতন দিন।'); return false;
    }

    const start2015 = scale2015[grade][0];
    const start2026 = scale2026Start[grade];
    const earned = Math.max(0, basic - start2015);
    const baseAmount = start2026 + earned;
    const fixedBasic = nextHigherStep(baseAmount, grade);
    const totalIncrease = fixedBasic - basic;

    const welfare = 150, insurance = 100, stamp = 10;
    const totalDeduction = gpf + tax + welfare + insurance + stamp;

    const isPriority = grade >= 10;
    const stage1Pct = isPriority ? 0.50 : 0.40;
    const stage2Pct = isPriority ? 0.75 : 0.70;
    const p1Label = isPriority ? '৫০%' : '৪০%';
    const p2Label = isPriority ? '৭৫%' : '৭০%';

    const medical = 1500;
    const education = eduCount * 500;
    const oldHouseRent = getHouseRent(basic, location);
    const newHouseRent = getHouseRent(fixedBasic, location);
    
    const oldAllowances = oldHouseRent + medical + education;
    const newAllowances = newHouseRent + medical + education;
    
    const stage1Basic = basic + (totalIncrease * stage1Pct);
    const stage2Basic = basic + (totalIncrease * stage2Pct);
    const stage3Basic = fixedBasic; 
    const stage4Basic = fixedBasic;

    const stage1Net = (stage1Basic + oldAllowances) - totalDeduction;
    const stage2Net = (stage2Basic + oldAllowances) - totalDeduction;
    const stage3Net = (stage3Basic + oldAllowances) - totalDeduction;
    const stage4Net = (stage4Basic + newAllowances) - totalDeduction;
    const currentNet = (basic + oldAllowances) - totalDeduction;

    appState = {
        grade, basic, start2015, earned, start2026, baseAmount, fixedBasic, totalIncrease,
        oldAllowances, newAllowances, totalDeduction, gpf, tax, oldHouseRent, medical, education, welfare, insurance, stamp,
        p1Label, p2Label, stage1Pct, stage2Pct,
        stage1Basic, stage2Basic, stage3Basic, stage4Basic,
        stage1Net, stage2Net, stage3Net, stage4Net, currentNet
    };

    let count = parseInt(localStorage.getItem('payCalcCount') || '0') + 1;
    localStorage.setItem('payCalcCount', count);
    document.getElementById('calcCount').textContent = toBengaliNum(count);

    generateSlides();
    openPreviewModal();

    return false;
}

function generateSlides() {
    const s = appState;
    
    const slide1 = `
        <div class="sec-title">১. পে-ফিক্সেশন ও বর্ধিত বেতন নির্ণয়</div>
        <div class="item-row sub"><span>২০১৫ স্কেলে ${bengaliOrdinals[s.grade]} গ্রেডের প্রারম্ভিক ধাপ:</span><span>${formatMoney(s.start2015)}</span></div>
        <div class="item-row sub"><span>বর্তমান মূল বেতন:</span><span>${formatMoney(s.basic)}</span></div>
        <div class="item-row sub"><span>অর্জিত বৃদ্ধি:</span><span>${formatMoney(s.earned)}</span></div>
        <div class="item-row sub"><span>২০২৬ স্কেলের নতুন প্রারম্ভিক ধাপ:</span><span>${formatMoney(s.start2026)}</span></div>
        <div class="item-row"><span>২০২৬ স্কেলের ভিত্তি অঙ্ক:</span><span>${formatMoney(s.baseAmount)}</span></div>
        <div class="desc-box">
            <strong>নির্ধারিত পূর্ণাঙ্গ মূল বেতন:</strong> ${formatMoney(s.fixedBasic)}<br>
            <strong>মূল বেতনের মোট পার্থক্য:</strong> ${formatMoney(s.totalIncrease)}
        </div>
    `;

    const slide2 = `
        <div class="sec-title">২. বর্তমান ভাতা ও কর্তনসমূহ</div>
        <div class="item-row sub"><span>(+) বাড়িভাড়া ভাতা:</span><span>${formatMoney(s.oldHouseRent)}</span></div>
        <div class="item-row sub"><span>(+) চিকিৎসা ভাতা:</span><span>${formatMoney(s.medical)}</span></div>
        <div class="item-row sub"><span>(+) শিক্ষা ভাতা:</span><span>${formatMoney(s.education)}</span></div>
        <div class="item-row highlight"><span>মোট বহাল থাকা ভাতা:</span><span>${formatMoney(s.oldAllowances)}</span></div>
        
        <div class="item-row sub" style="margin-top: 5px;"><span>(-) মাসিক জিপিএফ (GPF):</span><span>${formatMoney(s.gpf)}</span></div>
        <div class="item-row sub"><span>(-) মাসিক আয়কর:</span><span>${formatMoney(s.tax)}</span></div>
        <div class="item-row sub"><span>(-) অন্যান্য তহবিল:</span><span>${formatMoney(s.welfare + s.insurance + s.stamp)}</span></div>
        <div class="item-row deduct"><span>মোট কর্তন:</span><span>${formatMoney(s.totalDeduction)}</span></div>
    `;

    const slide3 = `
        <div class="sec-title">৩. প্রস্তাবিত ধাপে বেতন বৃদ্ধি (২০২৬-২০২৭)</div>
        <p>* ছক অনুযায়ী গ্রেড ১০-২০ অগ্রাধিকার বিবেচনায় ৫০% ও ৭৫% হারে মূল বেতন বৃদ্ধি পাবে এবং গ্রেড ১-৯ ৪০% ও ৭০% হারে বৃদ্ধি পাবে।</p>
        <div class="stage-box">
            <div class="stage-header">
                <strong style="color: var(--primary);">১ম ধাপ (০১ জুলাই ২০২৬ - ৩১ ডিসে ২০২৬)</strong>
                <span class="badge">বৃদ্ধির ${s.p1Label}</span>
            </div>
            <div class="item-row sub"><span>কার্যকর মূল বেতন:</span><span>${formatMoney(s.stage1Basic)}</span></div>
            <div class="item-row"><span>উত্তোলনযোগ্য নিট বেতন:</span><span>${formatMoney(s.stage1Net)}</span></div>
        </div>
        <div class="stage-box">
            <div class="stage-header">
                <strong style="color: var(--primary);">২য় ধাপ (০১ জানুয়ারি ২০২৭ - ৩০ জুন ২০২৭)</strong>
                <span class="badge">বৃদ্ধির ${s.p2Label}</span>
            </div>
            <div class="item-row sub"><span>কার্যকর মূল বেতন:</span><span>${formatMoney(s.stage2Basic)}</span></div>
            <div class="item-row"><span>উত্তোলনযোগ্য নিট বেতন:</span><span>${formatMoney(s.stage2Net)}</span></div>
        </div>
    `;

    const slide4 = `
        <div class="sec-title">৪. পূর্ণাঙ্গ স্কেল ও চূড়ান্ত ধাপ (২০২৭-২০২৮)</div>
        <div class="stage-box" style="background: linear-gradient(to bottom right, #F2FDF7, #FFFFFF);">
            <div class="stage-header">
                <strong style="color: var(--info);">৩য় ধাপ (০১ জুলাই ২০২৭ - ৩১ ডিসে ২০২৭)</strong>
                <span class="badge" style="background: #D1FAE5; color: var(--primary); border: none;">১০০% স্কেল</span>
            </div>
            <div class="item-row sub"><span>কার্যকর পূর্ণাঙ্গ মূল বেতন:</span><span>${formatMoney(s.stage3Basic)}</span></div>
            <div class="item-row"><span>উত্তোলনযোগ্য নিট বেতন:</span><span>${formatMoney(s.stage3Net)}</span></div>
        </div>
        
        <div class="stage-box final">
            <div class="stage-header">
                <strong style="color: var(--success);">৪র্থ ধাপ (০১ জানুয়ারি ২০২৮ হতে)</strong>
                <span class="badge" style="background: var(--success); color: white; border: none;">নতুন ভাতা</span>
            </div>
            <p style="color: var(--success);">* সাম্ভাব্য (বিদ্যমান % অনুযায়ী)</p>
            <div class="item-row sub"><span>কার্যকর পূর্ণাঙ্গ মূল বেতন:</span><span>${formatMoney(s.stage4Basic)}</span></div>
            <div class="item-row sub" style="color: var(--success);"><span>নতুন বেসিক অনুযায়ী ভাতা:</span><span>${formatMoney(s.newAllowances)}</span></div>
            <div class="item-row"><span>উত্তোলনযোগ্য নিট বেতন:</span><span>${formatMoney(s.stage4Net)}</span></div>
            <div class="item-row highlight" style="background: var(--primary); color: white; margin-top: 10px;">
                <span>সর্বমোট নিট বৃদ্ধি (বর্তমানের চেয়ে):</span>
                <span>+${formatMoney(s.stage4Net - s.currentNet)}</span>
            </div>
        </div>
    `;

    previewSlides = [slide1, slide2, slide3, slide4];
}

function openContactModal() { document.getElementById('contactModal').style.display = 'flex'; }
function closeContactModal() { document.getElementById('contactModal').style.display = 'none'; }

function openPreviewModal() {
    currentSlide = 0; updateSlideView();
    document.getElementById('previewModal').style.display = 'flex';
}
function closePreviewModal() { document.getElementById('previewModal').style.display = 'none'; }

function changeSlide(direction) {
    currentSlide += direction;
    if (currentSlide < 0) currentSlide = 0;
    if (currentSlide >= previewSlides.length) currentSlide = previewSlides.length - 1;
    updateSlideView();
}

function updateSlideView() {
    const slideContent = document.getElementById('slideContent');
    // Remove class and re-add for animation trigger
    slideContent.classList.remove('fade-in');
    void slideContent.offsetWidth; // Force Reflow
    
    slideContent.innerHTML = previewSlides[currentSlide];
    slideContent.classList.add('fade-in');

    document.getElementById('slideCounter').textContent = `ধাপ: ${toBengaliNum(currentSlide + 1)}/${toBengaliNum(previewSlides.length)}`;
    
    document.getElementById('prevBtn').style.display = currentSlide === 0 ? 'none' : 'block';
    
    if (currentSlide === previewSlides.length - 1) {
        document.getElementById('nextBtn').style.display = 'none';
        document.getElementById('printStartBtn').style.display = 'block';
    } else {
        document.getElementById('nextBtn').style.display = 'block';
        document.getElementById('printStartBtn').style.display = 'none';
    }
}

function openPrintModal() {
    closePreviewModal();
    document.getElementById('printModal').style.display = 'flex';
}
function closePrintModal() { document.getElementById('printModal').style.display = 'none'; }

function executePrint(e) {
    e.preventDefault();
    closePrintModal();

    const name = document.getElementById('p_name').value;
    const desig = document.getElementById('p_desig').value;
    const workplace = document.getElementById('p_workplace').value;
    
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true };
    const rawDateStr = new Intl.DateTimeFormat('bn-BD', options).format(new Date());
    const dateStr = toBengaliNum(rawDateStr);
    const s = appState;

    const printHTML = `
        <div class="print-watermark">
            <img src="https://raw.githubusercontent.com/nasimchapaipoly/nasim/refs/heads/main/payscale/file_00000000b7fc820888f08e0e1a23aca3.png" alt="NasimSoft Watermark">
        </div>

        <div class="print-header">
            <div class="print-logo-left">
                <img src="https://raw.githubusercontent.com/nasimchapaipoly/nasim/refs/heads/main/payscale/Government_Seal_of_Bangladesh.svg.png" alt="Govt Logo">
            </div>
            <div class="print-title">
                <h1>জাতীয় বেতনস্কেল ২০২৬ (প্রস্তাবিত)</h1>
                <p>বেতন প্রাক্কলন প্রতিবেদন</p>
            </div>
            <div class="print-logo-right">
                <img src="https://raw.githubusercontent.com/nasimchapaipoly/nasim/refs/heads/main/payscale/file_00000000b7fc820888f08e0e1a23aca3.png" alt="NasimSoft Logo">
            </div>
        </div>

        <table class="info-table">
            <tr><td width="15%"><strong>নাম:</strong></td><td width="45%">${name}</td><td width="15%"><strong>গ্রেড:</strong></td><td width="25%">${bengaliOrdinals[s.grade]} গ্রেড</td></tr>
            <tr><td><strong>পদবি:</strong></td><td>${desig}</td><td><strong>বর্তমান মূল বেতন:</strong></td><td>${formatMoney(s.basic)}</td></tr>
            <tr><td><strong>কর্মস্থল:</strong></td><td>${workplace}</td><td><strong>রিপোর্টের তারিখ:</strong></td><td>${dateStr}</td></tr>
        </table>

        <h3 style="margin-bottom: 10px;">১. পে-ফিক্সেশন ও বর্ধিত বেতন নির্ণয়</h3>
        <table class="data-table">
            <tr><th>বিবরণ</th><th>টাকার পরিমাণ</th></tr>
            <tr><td>২০১৫ স্কেলে গ্রেডের প্রারম্ভিক ধাপ</td><td>${formatMoney(s.start2015)}</td></tr>
            <tr><td>বর্তমান মূল বেতন</td><td>${formatMoney(s.basic)}</td></tr>
            <tr><td>অর্জিত বৃদ্ধি</td><td>${formatMoney(s.earned)}</td></tr>
            <tr><td>২০২৬ স্কেলের নতুন প্রারম্ভিক ধাপ</td><td>${formatMoney(s.start2026)}</td></tr>
            <tr><td><strong>নির্ধারিত পূর্ণাঙ্গ মূল বেতন</strong></td><td><strong>${formatMoney(s.fixedBasic)}</strong></td></tr>
            <tr><td>মূল বেতনের মোট পার্থক্য</td><td>${formatMoney(s.totalIncrease)}</td></tr>
        </table>

        <h3 style="margin-top: 20px; margin-bottom: 10px;">২. প্রস্তাবিত ধাপে বেতন ও নিট বৃদ্ধি (২০২৬-২০২৮)</h3>
        <table class="data-table">
            <tr><th>ধাপ ও সময়কাল</th><th>কার্যকর মূল বেতন</th><th>ভাতাসমূহ</th><th>মোট কর্তন</th><th>নিট বেতন</th></tr>
            <tr>
                <td><strong>১ম ধাপ</strong> (০১ জুলাই ২০২৬ - ৩১ ডিসে ২০২৬)<br><small>মূল বেতনের বৃদ্ধির ${s.p1Label}</small></td>
                <td>${formatMoney(s.stage1Basic)}</td><td>${formatMoney(s.oldAllowances)}</td><td>${formatMoney(s.totalDeduction)}</td><td><strong>${formatMoney(s.stage1Net)}</strong></td>
            </tr>
            <tr>
                <td><strong>২য় ধাপ</strong> (০১ জানু ২০২৭ - ৩০ জুন ২০২৭)<br><small>মূল বেতনের বৃদ্ধির ${s.p2Label}</small></td>
                <td>${formatMoney(s.stage2Basic)}</td><td>${formatMoney(s.oldAllowances)}</td><td>${formatMoney(s.totalDeduction)}</td><td><strong>${formatMoney(s.stage2Net)}</strong></td>
            </tr>
            <tr>
                <td><strong>৩য় ধাপ</strong> (০১ জুলাই ২০২৭ - ৩১ ডিসে ২০২৭)<br><small>১০০% পূর্ণাঙ্গ স্কেল</small></td>
                <td>${formatMoney(s.stage3Basic)}</td><td>${formatMoney(s.oldAllowances)}</td><td>${formatMoney(s.totalDeduction)}</td><td><strong>${formatMoney(s.stage3Net)}</strong></td>
            </tr>
            <tr>
                <td><strong>৪র্থ ধাপ</strong> (০১ জানুয়ারি ২০২৮ হতে)<br><small>সাম্ভাব্য (বিদ্যমান % অনুযায়ী)</small></td>
                <td>${formatMoney(s.stage4Basic)}</td><td>${formatMoney(s.newAllowances)}</td><td>${formatMoney(s.totalDeduction)}</td><td><strong>${formatMoney(s.stage4Net)}</strong></td>
            </tr>
        </table>

        <div class="signature-area"><div></div><div class="signature-box">স্বাক্ষর</div></div>

        <div class="print-footer">
            <p><strong>বি:দ্র:</strong> এই সাইটটি শুধুমাত্র বেতন নির্ধারনি হিসাবের সুবিধার্থে তৈরি করা হয়েছে, অর্থ মন্ত্রণালয়ের সাথে এর কোন আনুষ্ঠানিক সম্পর্ক নেই। বাংলাদেশের পে স্কেলের গেজেট অনুযায়ী হিসাব করা হয়েছে।</p>
            <p style="margin-top: 8px; font-weight: bold; font-size: 13pt;">NasimSoft ব্যবহারের জন্য আপনাকে ধন্যবাদ।</p>
        </div>
    `;

    const printArea = document.getElementById('print-area');
    printArea.innerHTML = printHTML;
    setTimeout(() => { window.print(); }, 300);
}
