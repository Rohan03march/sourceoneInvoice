import { db } from './firebase';
import { collection, query, orderBy, getDocs, limit, startAfter, endBefore, limitToLast } from 'firebase/firestore';

// --- Configuration ---
const PAGE_SIZE = 10;
let lastVisible = null;
let firstVisible = null;
let currentPage = 1;
let allInvoices = []; // For client-side search (simpler for small-medium datasets)
let filteredInvoices = [];

// --- Selectors ---
const ledgerBody = document.getElementById('ledger-body');
const searchInput = document.getElementById('ledger-search');
const dateFilterInput = document.getElementById('ledger-date-filter');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');
const totalCountDisplay = document.getElementById('total-count');

// --- Initialization ---
async function init() {
    await fetchAllInvoices();
    setupEventListeners();
    renderPage();
}

async function fetchAllInvoices() {
    try {
        const q = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        allInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        filteredInvoices = [...allInvoices];
        totalCountDisplay.textContent = filteredInvoices.length;
    } catch (error) {
        console.error("Error fetching invoices:", error);
        ledgerBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem; color: #ef4444;">Error loading invoices. Please check your connection.</td></tr>`;
    }
}

function filterData() {
    const searchVal = searchInput.value.toLowerCase().trim();
    const dateVal = dateFilterInput.value;

    filteredInvoices = allInvoices.filter(inv => {
        const matchesSearch = inv.invoiceNo.toLowerCase().includes(searchVal) ||
                             inv.companyName.toLowerCase().includes(searchVal);
        
        const matchesDate = !dateVal || inv.date === dateVal;
        
        return matchesSearch && matchesDate;
    });

    currentPage = 1;
    totalCountDisplay.textContent = filteredInvoices.length;
    renderPage();
}

function setupEventListeners() {
    searchInput.addEventListener('input', filterData);
    dateFilterInput.addEventListener('change', filterData);

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentPage * PAGE_SIZE < filteredInvoices.length) {
            currentPage++;
            renderPage();
        }
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}/${m}/${y.slice(-2)}`;
}

function renderPage() {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, filteredInvoices.length);
    const pageData = filteredInvoices.slice(startIndex, endIndex);

    ledgerBody.innerHTML = '';

    if (pageData.length === 0) {
        ledgerBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-light);">No invoices found.</td></tr>`;
    } else {
        pageData.forEach(inv => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(inv.date)}</td>
                <td class="bold">${inv.invoiceNo}</td>
                <td>
                    <span class="company-link" onclick="window.showInvoiceDetails('${inv.id}')">${inv.companyName}</span>
                </td>
                <td class="bold">₹${inv.totalAmount.toLocaleString('en-IN')}</td>
            `;
            ledgerBody.appendChild(tr);
        });
    }

    // Update pagination UI
    pageInfo.textContent = `Page ${currentPage} of ${Math.ceil(filteredInvoices.length / PAGE_SIZE) || 1}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage * PAGE_SIZE >= filteredInvoices.length;
}

// --- Modal Logic ---
const modal = document.getElementById('details-modal');
const closeModal = document.getElementById('close-modal');

window.showInvoiceDetails = (invoiceId) => {
    const inv = allInvoices.find(i => i.id === invoiceId);
    if (!inv) return;

    document.getElementById('modal-company-name').textContent = inv.companyName;
    document.getElementById('modal-invoice-no').textContent = `Invoice No: ${inv.invoiceNo}`;
    document.getElementById('modal-date').textContent = formatDate(inv.date);
    document.getElementById('modal-gstin').textContent = inv.companyGstin || '-';
    document.getElementById('modal-address').textContent = inv.companyAddress || '-';

    const staffList = document.getElementById('modal-staff-list');
    staffList.innerHTML = '';

    inv.staffRows.forEach(row => {
        if (row.designation || row.amount) {
            const li = document.createElement('li');
            li.innerHTML = `<span>${row.designation || '-'}</span> <span>₹${row.amount.toLocaleString('en-IN')}</span>`;
            staffList.appendChild(li);
        }
    });

    if (inv.serviceCharge > 0) {
        const li = document.createElement('li');
        li.innerHTML = `<span>Service Charge</span> <span>₹${inv.serviceCharge.toLocaleString('en-IN')}</span>`;
        staffList.appendChild(li);
    }

    if (inv.isGstIncluded) {
        // Calculate subtotal for GST breakdown
        let totalStaff = inv.staffRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
        let sub = totalStaff + (inv.serviceCharge || 0);
        let sgst = sub * 0.09;
        let cgst = sub * 0.09;

        const liS = document.createElement('li');
        liS.innerHTML = `<span>SGST (9%)</span> <span>₹${sgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>`;
        staffList.appendChild(liS);

        const liC = document.createElement('li');
        liC.innerHTML = `<span>CGST (9%)</span> <span>₹${cgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>`;
        staffList.appendChild(liC);
    }

    const totalLi = document.createElement('li');
    totalLi.innerHTML = `<span>Grand Total</span> <span>₹${inv.totalAmount.toLocaleString('en-IN')}</span>`;
    staffList.appendChild(totalLi);

    modal.style.display = 'flex';
};

closeModal.onclick = () => modal.style.display = 'none';
window.onclick = (event) => {
    if (event.target == modal) modal.style.display = 'none';
};

init();
