import { db } from './firebase';
import { collection, query, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';

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
const startDateInput = document.getElementById('ledger-start-date');
const endDateInput = document.getElementById('ledger-end-date');
const prevBtn = document.getElementById('prev-page');
const nextBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');
const totalCountDisplay = document.getElementById('total-count');
const downloadCsvBtn = document.getElementById('download-csv');

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
    const startVal = startDateInput.value;
    const endVal = endDateInput.value;

    filteredInvoices = allInvoices.filter(inv => {
        const matchesSearch = inv.invoiceNo.toLowerCase().includes(searchVal) ||
                             inv.companyName.toLowerCase().includes(searchVal);
        
        let matchesDate = true;
        if (startVal && inv.date < startVal) matchesDate = false;
        if (endVal && inv.date > endVal) matchesDate = false;
        
        return matchesSearch && matchesDate;
    });

    currentPage = 1;
    totalCountDisplay.textContent = filteredInvoices.length;
    renderPage();
}

function setupEventListeners() {
    searchInput.addEventListener('input', filterData);
    startDateInput.addEventListener('change', filterData);
    endDateInput.addEventListener('change', filterData);
    downloadCsvBtn.addEventListener('click', exportToExcel);

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

function exportToExcel() {
    if (filteredInvoices.length === 0) {
        alert('No data to export.');
        return;
    }

    const startVal = startDateInput.value || 'All Time';
    const endVal = endDateInput.value || 'Present';

    // Prepare report headers and data
    const headers = ["Date", "Invoice No", "Company", "GSTIN", "Total Amount"];
    const reportInfo = [
        ["SOURCEONE INVOICE LEDGER"],
        [`Report Period: ${startVal} to ${endVal}`],
        [`Generated On: ${new Date().toLocaleString()}`],
        [] // Spacer
    ];

    const dataRows = filteredInvoices.map(inv => [
        inv.date,
        inv.invoiceNo,
        inv.companyName,
        inv.companyGstin || '-',
        inv.totalAmount
    ]);

    // Calculate Total
    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalRow = [
        [],
        ["", "", "", "GRAND TOTAL", totalAmount]
    ];

    // Combine all into a single array of arrays (AOA)
    const aoa = [
        ...reportInfo,
        headers,
        ...dataRows,
        ...totalRow
    ];

    // Create workbook and worksheet
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger Report");

    // Merge header cells for better presentation
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Title
        { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // Period
        { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }  // Generation Date
    ];

    // Set column widths
    ws['!cols'] = [
        { wch: 12 }, // Date
        { wch: 18 }, // Invoice No
        { wch: 35 }, // Company
        { wch: 20 }, // GSTIN
        { wch: 15 }  // Total Amount
    ];

    // Trigger download
    const fileName = `SourceOne_Ledger_${startVal}_to_${endVal}.xlsx`;
    XLSX.writeFile(wb, fileName);
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
        ledgerBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-light);">No invoices found.</td></tr>`;
    } else {
        pageData.forEach(inv => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(inv.date)}</td>
                <td class="bold">${inv.invoiceNo}</td>
                <td>${inv.companyName}</td>
                <td class="bold">₹${inv.totalAmount.toLocaleString('en-IN')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="view-btn" onclick="window.showInvoiceDetails('${inv.id}')">View</button>
                        <button class="delete-btn-ledger" onclick="window.deleteInvoice('${inv.id}')">Delete</button>
                    </div>
                </td>
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

window.deleteInvoice = async (invoiceId) => {
    if (confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
        try {
            await deleteDoc(doc(db, "invoices", invoiceId));
            
            // Update local arrays
            allInvoices = allInvoices.filter(i => i.id !== invoiceId);
            filteredInvoices = filteredInvoices.filter(i => i.id !== invoiceId);
            
            // Update UI
            totalCountDisplay.textContent = filteredInvoices.length;
            renderPage();
            
            alert('Invoice deleted successfully.');
        } catch (error) {
            console.error("Error deleting invoice:", error);
            alert('Error deleting invoice. Please try again.');
        }
    }
};

init();
