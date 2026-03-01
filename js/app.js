/**
 * Job Application Tracker
 * A client-side application for tracking job applications.
 * Data is persisted in localStorage.
 */

(function () {
  'use strict';

  // ---- Constants ----
  var STORAGE_KEY = 'job_applications';
  var STATUSES = ['Applied', 'Phone Screen', 'Interview', 'Offer', 'Rejected', 'Withdrawn'];

  // ---- DOM References ----
  var dom = {
    tableBody: document.getElementById('applications-body'),
    table: document.getElementById('applications-table'),
    emptyState: document.getElementById('empty-state'),
    searchInput: document.getElementById('search-input'),
    filterStatus: document.getElementById('filter-status'),
    sortBy: document.getElementById('sort-by'),
    addBtn: document.getElementById('add-btn'),
    exportBtn: document.getElementById('export-btn'),
    // Modal elements
    modalOverlay: document.getElementById('modal-overlay'),
    modalTitle: document.getElementById('modal-title'),
    modalClose: document.getElementById('modal-close'),
    form: document.getElementById('application-form'),
    cancelBtn: document.getElementById('cancel-btn'),
    saveBtn: document.getElementById('save-btn'),
    // Form fields
    appId: document.getElementById('app-id'),
    appCompany: document.getElementById('app-company'),
    appPosition: document.getElementById('app-position'),
    appDate: document.getElementById('app-date'),
    appStatus: document.getElementById('app-status'),
    appLocation: document.getElementById('app-location'),
    appSalary: document.getElementById('app-salary'),
    appUrl: document.getElementById('app-url'),
    appNotes: document.getElementById('app-notes'),
    // Delete modal
    deleteOverlay: document.getElementById('delete-overlay'),
    deleteClose: document.getElementById('delete-close'),
    deleteCancelBtn: document.getElementById('delete-cancel-btn'),
    deleteConfirmBtn: document.getElementById('delete-confirm-btn'),
    // Stats
    statTotal: document.getElementById('stat-total'),
    statApplied: document.getElementById('stat-applied'),
    statPhoneScreen: document.getElementById('stat-phone-screen'),
    statInterview: document.getElementById('stat-interview'),
    statOffer: document.getElementById('stat-offer'),
    statRejected: document.getElementById('stat-rejected'),
    statWithdrawn: document.getElementById('stat-withdrawn'),
    statsBar: document.getElementById('stats-bar')
  };

  // ---- State ----
  var applications = [];
  var deleteTargetId = null;
  var activeStatusFilter = 'all';

  // ---- Storage ----
  function loadApplications() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load applications from localStorage:', e);
      return [];
    }
  }

  function saveApplications() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    } catch (e) {
      console.error('Failed to save applications to localStorage:', e);
    }
  }

  // ---- UUID ----
  function generateId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
  }

  // ---- Formatting ----
  function formatDate(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
  }

  function statusClass(status) {
    return 'status-' + status.toLowerCase().replace(/\s+/g, '-');
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ---- Stats ----
  function updateStats() {
    var counts = { total: applications.length };
    STATUSES.forEach(function (s) { counts[s] = 0; });
    applications.forEach(function (app) {
      if (counts[app.status] !== undefined) {
        counts[app.status]++;
      }
    });

    dom.statTotal.textContent = counts.total;
    dom.statApplied.textContent = counts['Applied'];
    dom.statPhoneScreen.textContent = counts['Phone Screen'];
    dom.statInterview.textContent = counts['Interview'];
    dom.statOffer.textContent = counts['Offer'];
    dom.statRejected.textContent = counts['Rejected'];
    dom.statWithdrawn.textContent = counts['Withdrawn'];
  }

  // ---- Filtering & Sorting ----
  function getFilteredApplications() {
    var search = dom.searchInput.value.toLowerCase().trim();
    var status = dom.filterStatus.value;
    var sortVal = dom.sortBy.value;

    // Sync status filter with stat card selection
    if (activeStatusFilter !== 'all' && status === 'all') {
      status = activeStatusFilter;
      dom.filterStatus.value = activeStatusFilter;
    }

    var filtered = applications.filter(function (app) {
      var matchesSearch = !search ||
        app.company.toLowerCase().indexOf(search) !== -1 ||
        app.position.toLowerCase().indexOf(search) !== -1 ||
        (app.location && app.location.toLowerCase().indexOf(search) !== -1);
      var matchesStatus = status === 'all' || app.status === status;
      return matchesSearch && matchesStatus;
    });

    filtered.sort(function (a, b) {
      switch (sortVal) {
        case 'date-desc': return b.dateApplied.localeCompare(a.dateApplied);
        case 'date-asc': return a.dateApplied.localeCompare(b.dateApplied);
        case 'company-asc': return a.company.localeCompare(b.company);
        case 'company-desc': return b.company.localeCompare(a.company);
        case 'status':
          return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
        default: return 0;
      }
    });

    return filtered;
  }

  // ---- Rendering ----
  function renderApplications() {
    var filtered = getFilteredApplications();

    if (applications.length === 0) {
      dom.table.style.display = 'none';
      dom.emptyState.classList.add('visible');
      updateStats();
      return;
    }

    dom.emptyState.classList.remove('visible');

    if (filtered.length === 0) {
      dom.table.style.display = 'none';
      dom.emptyState.classList.add('visible');
      dom.emptyState.querySelector('h3').textContent = 'No matching applications';
      dom.emptyState.querySelector('p').textContent = 'Try adjusting your search or filters.';
    } else {
      dom.table.style.display = 'table';
      dom.emptyState.classList.remove('visible');
      // Reset empty state text
      dom.emptyState.querySelector('h3').textContent = 'No applications yet';
      dom.emptyState.querySelector('p').textContent = 'Click "Add Application" to start tracking your job search.';
    }

    dom.tableBody.innerHTML = '';

    filtered.forEach(function (app) {
      var tr = document.createElement('tr');
      tr.dataset.id = app.id;

      var companyContent = app.url
        ? '<a href="' + escapeHtml(app.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(app.company) + '</a>'
        : escapeHtml(app.company);

      var notesHtml = app.notes
        ? ' <span class="notes-indicator" data-notes="' + escapeHtml(app.notes) + '" title="' + escapeHtml(app.notes) + '">&#128196;</span>'
        : '';

      tr.innerHTML =
        '<td class="company-cell">' + companyContent + notesHtml + '</td>' +
        '<td>' + escapeHtml(app.position) + '</td>' +
        '<td>' + formatDate(app.dateApplied) + '</td>' +
        '<td><span class="status-badge ' + statusClass(app.status) + '">' + escapeHtml(app.status) + '</span></td>' +
        '<td>' + escapeHtml(app.location || '-') + '</td>' +
        '<td>' + escapeHtml(app.salary || '-') + '</td>' +
        '<td class="action-btns">' +
          '<button class="action-btn edit-btn" data-id="' + app.id + '" title="Edit">Edit</button>' +
          '<button class="action-btn delete" data-id="' + app.id + '" title="Delete">Delete</button>' +
        '</td>';

      dom.tableBody.appendChild(tr);
    });

    updateStats();
  }

  // ---- Modal Management ----
  function openModal(editing) {
    dom.modalTitle.textContent = editing ? 'Edit Application' : 'Add Application';
    dom.saveBtn.textContent = editing ? 'Update Application' : 'Save Application';
    dom.modalOverlay.classList.add('open');
    dom.appCompany.focus();
  }

  function closeModal() {
    dom.modalOverlay.classList.remove('open');
    dom.form.reset();
    dom.appId.value = '';
  }

  function openDeleteModal(id) {
    deleteTargetId = id;
    dom.deleteOverlay.classList.add('open');
  }

  function closeDeleteModal() {
    deleteTargetId = null;
    dom.deleteOverlay.classList.remove('open');
  }

  // ---- CRUD ----
  function addApplication(data) {
    data.id = generateId();
    data.createdAt = new Date().toISOString();
    applications.push(data);
    saveApplications();
    renderApplications();
  }

  function updateApplication(id, data) {
    for (var i = 0; i < applications.length; i++) {
      if (applications[i].id === id) {
        data.id = id;
        data.createdAt = applications[i].createdAt;
        data.updatedAt = new Date().toISOString();
        applications[i] = data;
        break;
      }
    }
    saveApplications();
    renderApplications();
  }

  function deleteApplication(id) {
    applications = applications.filter(function (app) { return app.id !== id; });
    saveApplications();
    renderApplications();
  }

  function getFormData() {
    return {
      company: dom.appCompany.value.trim(),
      position: dom.appPosition.value.trim(),
      dateApplied: dom.appDate.value,
      status: dom.appStatus.value,
      location: dom.appLocation.value.trim(),
      salary: dom.appSalary.value.trim(),
      url: dom.appUrl.value.trim(),
      notes: dom.appNotes.value.trim()
    };
  }

  function populateForm(app) {
    dom.appId.value = app.id;
    dom.appCompany.value = app.company;
    dom.appPosition.value = app.position;
    dom.appDate.value = app.dateApplied;
    dom.appStatus.value = app.status;
    dom.appLocation.value = app.location || '';
    dom.appSalary.value = app.salary || '';
    dom.appUrl.value = app.url || '';
    dom.appNotes.value = app.notes || '';
  }

  // ---- Export CSV ----
  function exportToCsv() {
    if (applications.length === 0) return;

    var headers = ['Company', 'Position', 'Date Applied', 'Status', 'Location', 'Salary Range', 'URL', 'Notes'];
    var rows = applications.map(function (app) {
      return [
        app.company,
        app.position,
        app.dateApplied,
        app.status,
        app.location || '',
        app.salary || '',
        app.url || '',
        app.notes || ''
      ].map(function (field) {
        // Escape double quotes and wrap in quotes
        return '"' + String(field).replace(/"/g, '""') + '"';
      }).join(',');
    });

    var csv = headers.join(',') + '\n' + rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'job_applications_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  // ---- Event Listeners ----
  // Add button
  dom.addBtn.addEventListener('click', function () {
    dom.appDate.value = new Date().toISOString().slice(0, 10);
    openModal(false);
  });

  // Form submit
  dom.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = getFormData();
    var editId = dom.appId.value;

    if (editId) {
      updateApplication(editId, data);
    } else {
      addApplication(data);
    }

    closeModal();
  });

  // Cancel/close modal
  dom.cancelBtn.addEventListener('click', closeModal);
  dom.modalClose.addEventListener('click', closeModal);
  dom.modalOverlay.addEventListener('click', function (e) {
    if (e.target === dom.modalOverlay) closeModal();
  });

  // Delete modal
  dom.deleteClose.addEventListener('click', closeDeleteModal);
  dom.deleteCancelBtn.addEventListener('click', closeDeleteModal);
  dom.deleteOverlay.addEventListener('click', function (e) {
    if (e.target === dom.deleteOverlay) closeDeleteModal();
  });
  dom.deleteConfirmBtn.addEventListener('click', function () {
    if (deleteTargetId) {
      deleteApplication(deleteTargetId);
      closeDeleteModal();
    }
  });

  // Table action buttons (event delegation)
  dom.tableBody.addEventListener('click', function (e) {
    var btn = e.target;
    if (btn.classList.contains('edit-btn')) {
      var id = btn.dataset.id;
      var app = applications.find(function (a) { return a.id === id; });
      if (app) {
        populateForm(app);
        openModal(true);
      }
    } else if (btn.classList.contains('delete')) {
      openDeleteModal(btn.dataset.id);
    }
  });

  // Search & filter
  dom.searchInput.addEventListener('input', renderApplications);
  dom.filterStatus.addEventListener('change', function () {
    activeStatusFilter = dom.filterStatus.value;
    // Update stat card active state
    var cards = dom.statsBar.querySelectorAll('.stat-card');
    cards.forEach(function (card) {
      card.classList.toggle('active', card.dataset.status === activeStatusFilter);
    });
    renderApplications();
  });
  dom.sortBy.addEventListener('change', renderApplications);

  // Stats card click (filter shortcut)
  dom.statsBar.addEventListener('click', function (e) {
    var card = e.target.closest('.stat-card');
    if (!card) return;
    var status = card.dataset.status;
    activeStatusFilter = status;
    dom.filterStatus.value = status;

    var cards = dom.statsBar.querySelectorAll('.stat-card');
    cards.forEach(function (c) { c.classList.remove('active'); });
    card.classList.add('active');

    renderApplications();
  });

  // Export
  dom.exportBtn.addEventListener('click', exportToCsv);

  // Keyboard: Escape to close modals
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (dom.modalOverlay.classList.contains('open')) closeModal();
      if (dom.deleteOverlay.classList.contains('open')) closeDeleteModal();
    }
  });

  // ---- Initialize ----
  applications = loadApplications();
  renderApplications();
})();
