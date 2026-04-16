import { db } from './firebase';
import { collection, addDoc, getDocs, onSnapshot, doc, updateDoc, query, where } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// --- Global State ---
let staffRows = [{ id: Date.now(), designation: '', amount: 0 }];
let companies = [];

// --- Selectors ---
const invoiceNoInput = document.getElementById('invoice-no');
const invoiceDateInput = document.getElementById('invoice-date');
const companyNameInput = document.getElementById('company-name');
const companyAddressInput = document.getElementById('company-address');
const companyGstinInput = document.getElementById('company-gstin');
const serviceChargeInput = document.getElementById('service-charge');
const staffRowsContainer = document.getElementById('staff-rows');
const addRowBtn = document.getElementById('add-row-btn');
const addCompanyBtn = document.getElementById('add-company-btn');
const generatePdfBtn = document.getElementById('generate-pdf-btn');
const companyResults = document.getElementById('company-results');

// --- Preview Selectors ---
const previewNo = document.getElementById('preview-no-val');
const previewDate = document.getElementById('preview-date-val');
const previewCompanyName = document.getElementById('preview-company-name');
const previewCompanyAddress = document.getElementById('preview-company-address');
const previewCompanyGstin = document.getElementById('preview-company-gstin');
const previewTableBody = document.getElementById('preview-table-body');
const previewTotal = document.getElementById('preview-total');
const previewServiceCharge = document.getElementById('preview-service-charge');
const previewSubtotal = document.getElementById('preview-subtotal');
const previewSgst = document.getElementById('preview-sgst');
const previewCgst = document.getElementById('preview-cgst');
const previewGrandTotal = document.getElementById('preview-grand-total');
const previewWords = document.getElementById('preview-words');

// --- Initialization ---
async function init() {
    setupEventListeners();
    fetchCompanies();
    renderStaffRows();
    updatePreview();
}

// --- Firebase Logic ---
async function fetchCompanies() {
    const q = collection(db, "companies");
    onSnapshot(q, (snapshot) => {
        companies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
}

const toggleCompaniesBtn = document.getElementById('toggle-companies');

// Custom Dropdown Logic
const renderResults = (list) => {
    companyResults.innerHTML = '';
    if (list.length > 0) {
        list.forEach(company => {
            const div = document.createElement('div');
            div.className = 'result-item';
            div.innerHTML = `<span class="icon">🏢</span> ${company.name}`;
            div.onmousedown = (event) => {
                event.preventDefault();
                companyNameInput.value = company.name;
                companyAddressInput.value = company.address || '';
                companyGstinInput.value = company.gstin || '';
                companyResults.classList.add('hidden');
                updatePreview();
            };
            companyResults.appendChild(div);
        });
        companyResults.classList.remove('hidden');
    } else {
        const div = document.createElement('div');
        div.className = 'result-item no-results';
        div.textContent = 'No results found';
        companyResults.appendChild(div);
        companyResults.classList.remove('hidden');
    }
};

const handleSearch = (e) => {
    const value = companyNameInput.value.toLowerCase().trim();
    if (!value) {
        renderResults(companies); // Show all companies if input is empty
        return;
    }
    const filtered = companies.filter(c => c.name.toLowerCase().includes(value));
    renderResults(filtered);
};

toggleCompaniesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (companyResults.classList.contains('hidden')) {
        renderResults(companies);
    } else {
        companyResults.classList.add('hidden');
    }
});

companyNameInput.addEventListener('input', handleSearch);
companyNameInput.addEventListener('focus', handleSearch);



// Close search results when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        companyResults.classList.add('hidden');
    }
});

addCompanyBtn.addEventListener('click', async () => {
    const name = companyNameInput.value;
    const address = companyAddressInput.value;
    const gstin = companyGstinInput.value;

    if (!name) return alert('Company name is required');

    const existingCompany = companies.find(c => c.name.toLowerCase() === name.toLowerCase());

    try {
        if (existingCompany) {
            await updateDoc(doc(db, "companies", existingCompany.id), { address, gstin });
            alert('Company updated successfully!');
        } else {
            await addDoc(collection(db, "companies"), { name, address, gstin });
            alert('New company added successfully!');
        }
    } catch (e) {
        console.error("Error saving company: ", e);
        alert('Error saving company');
    }
});

// Auto-fill logic (triggered after selection or on blur if exact match)
const autoFill = () => {
    const name = companyNameInput.value.trim().toLowerCase();
    if (!name) return;
    
    const found = companies.find(c => c.name.toLowerCase() === name);
    if (found) {
        companyAddressInput.value = found.address || '';
        companyGstinInput.value = found.gstin || '';
        updatePreview();
    }
};

companyNameInput.addEventListener('blur', () => {
    // Small delay to allow click on results list
    setTimeout(() => {
        companyResults.classList.add('hidden');
        autoFill();
    }, 200);
});


// --- Staff Rows Logic ---
function renderStaffRows() {
    staffRowsContainer.innerHTML = '';
    staffRows.forEach((row, index) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'staff-row';
        rowDiv.innerHTML = `
            <div class="form-group">
                <label>Designation</label>
                <input type="text" value="${row.designation}" oninput="updateRow(${row.id}, 'designation', this.value)" placeholder="e.g. Senior Dev">
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input type="number" value="${row.amount}" oninput="updateRow(${row.id}, 'amount', this.value)" placeholder="0">
            </div>
            <button class="delete-btn" onclick="deleteRow(${row.id})">×</button>
        `;
        staffRowsContainer.appendChild(rowDiv);
    });
}

window.updateRow = (id, field, value) => {
    const row = staffRows.find(r => r.id === id);
    if (row) {
        row[field] = field === 'amount' ? parseFloat(value) || 0 : value;
        updatePreview();
    }
};

window.deleteRow = (id) => {
    if (staffRows.length === 1) return alert('At least one row is required');
    staffRows = staffRows.filter(r => r.id !== id);
    renderStaffRows();
    updatePreview();
};

addRowBtn.addEventListener('click', () => {
    staffRows.push({ id: Date.now(), designation: '', amount: 0 });
    renderStaffRows();
    updatePreview();
});

// --- Calculation & Preview ---
function setupEventListeners() {
    [invoiceNoInput, invoiceDateInput, companyNameInput, companyAddressInput, companyGstinInput, serviceChargeInput].forEach(el => {
        el.addEventListener('input', updatePreview);
    });
}

function updatePreview() {
    previewNo.textContent = invoiceNoInput.value || '-';
    const dateValue = invoiceDateInput.value;
    if (dateValue) {
        const [y, m, d] = dateValue.split('-');
        previewDate.textContent = `${d}-${m}-${y}`;
    } else {
        previewDate.textContent = '-';
    }
    previewCompanyName.textContent = companyNameInput.value || '-';
    previewCompanyAddress.textContent = companyAddressInput.value || '-';
    previewCompanyGstin.textContent = companyGstinInput.value || '-';

    // Staff Table
    previewTableBody.innerHTML = '';
    let totalAmt = 0;
    staffRows.forEach((row, i) => {
        totalAmt += row.amount;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${row.designation || '-'}</td>
            <td>₹${row.amount.toLocaleString('en-IN')}</td>
        `;
        previewTableBody.appendChild(tr);
    });

    const serviceCharge = parseFloat(serviceChargeInput.value) || 0;
    const subtotal = totalAmt + serviceCharge;
    const sgst = subtotal * 0.09;
    const cgst = subtotal * 0.09;
    const grandTotal = subtotal + sgst + cgst;

    previewTotal.textContent = `₹${totalAmt.toLocaleString('en-IN')}`;
    previewServiceCharge.textContent = `₹${serviceCharge.toLocaleString('en-IN')}`;
    previewSubtotal.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
    previewSgst.textContent = `₹${sgst.toLocaleString('en-IN')}`;
    previewCgst.textContent = `₹${cgst.toLocaleString('en-IN')}`;
    previewGrandTotal.textContent = `₹${Math.round(grandTotal).toLocaleString('en-IN')}`;
    
    previewWords.textContent = numberToWords(Math.round(grandTotal)) + " Only";
}

// Amount to words simple utility (or import)
function numberToWords(num) {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if ((num = num.toString()).length > 9) return 'overflow';
    let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ''; 
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim();
}

// --- PDF Generation (Modular Multi-Page) ---
generatePdfBtn.addEventListener('click', async () => {
    generatePdfBtn.disabled = true;
    generatePdfBtn.textContent = 'Generating...';

    try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        const previewContainer = document.getElementById('invoice-preview');
        const originalWidth = previewContainer.style.width;
        const originalHeight = previewContainer.style.height;
        
        // Setup for HQ Capture
        previewContainer.style.width = '210mm';
        previewContainer.style.height = 'auto';

        const canvas = await html2canvas(previewContainer, { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            windowWidth: 1200
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // If content is taller than A4, scale it down to fit on one page
        if (imgHeight > pageHeight) {
            const ratio = pageHeight / imgHeight;
            pdf.addImage(imgData, 'PNG', (pageWidth - (imgWidth * ratio)) / 2, 0, imgWidth * ratio, pageHeight);
        } else {
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        }

        // Restore original UI styling
        previewContainer.style.width = '';
        previewContainer.style.height = '';

        pdf.save(`Invoice_${invoiceNoInput.value || 'Draft'}.pdf`);
    } catch (e) {
        console.error("PDF generation failed: ", e);
        alert('Failed to generate PDF');
    } finally {
        generatePdfBtn.disabled = false;
        generatePdfBtn.textContent = 'Generate A4 PDF';
    }
});

init();
