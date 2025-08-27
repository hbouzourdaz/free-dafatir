(function () {
  const viewerSection = document.getElementById('viewerSection');
  const pdfFrame = document.getElementById('pdfFrame');
  const pdfCanvasContainer = document.getElementById('pdfCanvasContainer');
  const viewerTitle = document.getElementById('viewerTitle');
  const closeViewer = document.getElementById('closeViewer');
  const yearEl = document.getElementById('year');
  const cardsGrid = document.getElementById('cardsGrid');
  const rolePrompt = document.getElementById('rolePrompt');
  const roleButtons = document.querySelectorAll('.role-btn');
  const viewerLoader = document.getElementById('viewerLoader');
  const cardsCount = document.getElementById('cardsCount');
  const siteHeader = document.getElementById('siteHeader');
  const roleSection = document.getElementById('roleSection');
  const siteFooter = document.getElementById('siteFooter');
  // Notice modal elements
  const noticeModal = document.getElementById('noticeModal');
  const noticeOk = document.getElementById('noticeOk');
  const noticeBackdrop = document.getElementById('noticeBackdrop');
  // PDF.js state
  let currentPdfLoadingTask = null;

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Helpers: allow interactions inside inputs/areas or .allow-select
  function isAllowedTarget(el) {
    if (!el) return false;
    const editable = el.closest('input, textarea, [contenteditable="true"], .allow-select');
    return !!editable;
  }

  // Context menu and drag/select deterrents
  document.addEventListener('contextmenu', (e) => {
    if (!isAllowedTarget(e.target)) e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => {
    if (!isAllowedTarget(e.target)) e.preventDefault();
  });
  document.addEventListener('selectstart', (e) => {
    if (!isAllowedTarget(e.target)) e.preventDefault();
  });
  // Clipboard events
  ['copy', 'cut', 'paste'].forEach((type) => {
    document.addEventListener(type, (e) => {
      if (!isAllowedTarget(e.target)) e.preventDefault();
    });
  });

  // Block common shortcuts (Ctrl/Meta + C/X/V/S/P/U, Ctrl+Shift+I/J, F12)
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && ['c', 'x', 'v', 's', 'p', 'u'].includes(k)) {
      if (!isAllowedTarget(e.target)) e.preventDefault();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === 'i' || k === 'j')) {
      e.preventDefault();
    }
    if (e.key === 'F12') {
      e.preventDefault();
    }
  }, true);

  // Show notice modal once per session: commercial use forbidden, personal use only
  function showNotice() {
    if (!noticeModal) return;
    noticeModal.classList.remove('hidden');
    // Prevent background scroll while modal open
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    // Focus the OK button for accessibility
    try { noticeOk && noticeOk.focus(); } catch {}
  }

  function hideNotice() {
    if (!noticeModal) return;
    noticeModal.classList.add('hidden');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  try {
    if (!sessionStorage.getItem('noticeShown')) {
      window.addEventListener('load', () => {
        showNotice();
        sessionStorage.setItem('noticeShown', '1');
      });
    }
  } catch {
    window.addEventListener('load', showNotice);
  }

  // Notice modal interactions
  if (noticeOk) noticeOk.addEventListener('click', hideNotice);
  if (noticeBackdrop) noticeBackdrop.addEventListener('click', hideNotice);

  // Try configure PDF.js worker if available
  try {
    if (window.pdfjsLib) {
      // Use CDN worker matching the included version
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
  } catch {}

  async function renderPdfWithPdfJs(url) {
    if (!window.pdfjsLib || !pdfCanvasContainer) throw new Error('PDF.js unavailable');

    // Clear previous content
    pdfCanvasContainer.innerHTML = '';
    pdfCanvasContainer.classList.remove('hidden');
    pdfFrame && pdfFrame.classList.add('hidden');

    // Start loading
    const encoded = encodeURI(url);
    const loadingTask = window.pdfjsLib.getDocument({ url: encoded });
    currentPdfLoadingTask = loadingTask;
    const pdfDoc = await loadingTask.promise;

    // Render pages sequentially
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      // If a new task started, stop rendering this one
      if (currentPdfLoadingTask !== loadingTask) return;
      const page = await pdfDoc.getPage(pageNum);

      // Fit to container width
      const containerWidth = Math.max(320, pdfCanvasContainer.clientWidth || 800);
      const initialViewport = page.getViewport({ scale: 1 });
      const scale = (containerWidth - 24) / initialViewport.width; // account for padding
      const viewport = page.getViewport({ scale: Math.max(0.8, scale) });

      const canvas = document.createElement('canvas');
      canvas.dir = 'rtl';
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      canvas.className = 'mx-auto block rounded-lg bg-slate-900 shadow border border-slate-800';
      const context = canvas.getContext('2d');

      // Handle HiDPI displays
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

      pdfCanvasContainer.appendChild(canvas);

      await page.render({ canvasContext: context, viewport }).promise;
    }
  }

  function openViewer(title, src) {
    if (!viewerSection || !pdfFrame) return;
    viewerTitle.textContent = title || 'معاينة';
    // Use encodeURI to safely handle spaces and non-latin characters
    if (viewerLoader) viewerLoader.classList.remove('hidden');
    // Prefer PDF.js rendering when available and not on file://
    const isFileProtocol = location.protocol === 'file:';
    if (!isFileProtocol && window.pdfjsLib && pdfCanvasContainer) {
      renderPdfWithPdfJs(src)
        .then(() => {
          if (viewerLoader) viewerLoader.classList.add('hidden');
        })
        .catch(() => {
          // Fallback to iframe on failure
          if (pdfCanvasContainer) pdfCanvasContainer.classList.add('hidden');
          pdfFrame.classList.remove('hidden');
          pdfFrame.src = encodeURI(src);
        })
        .finally(() => {
          viewerSection.classList.remove('hidden');
          // focus for accessibility
          closeViewer && closeViewer.focus();
          try { viewerSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
          // Hide other sections to focus on PDF only
          siteHeader && siteHeader.classList.add('hidden');
          roleSection && roleSection.classList.add('hidden');
          cardsGrid && cardsGrid.classList.add('hidden');
          siteFooter && siteFooter.classList.add('hidden');
        });
    } else {
      // No PDF.js available -> iframe fallback
      pdfFrame.classList.remove('hidden');
      pdfFrame.src = encodeURI(src);
      viewerSection.classList.remove('hidden');
      // focus for accessibility
      closeViewer && closeViewer.focus();
      try { viewerSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
      // Hide other sections to focus on PDF only
      siteHeader && siteHeader.classList.add('hidden');
      roleSection && roleSection.classList.add('hidden');
      cardsGrid && cardsGrid.classList.add('hidden');
      siteFooter && siteFooter.classList.add('hidden');
    }
  }

  function closeViewerFn() {
    if (!viewerSection || !pdfFrame) return;
    viewerSection.classList.add('hidden');
    // Unload PDF
    pdfFrame.src = 'about:blank';
    pdfFrame.classList.add('hidden');
    if (pdfCanvasContainer) {
      // Cancel any ongoing PDF.js task and clear canvases
      try { if (currentPdfLoadingTask && currentPdfLoadingTask.destroy) currentPdfLoadingTask.destroy(); } catch {}
      currentPdfLoadingTask = null;
      pdfCanvasContainer.innerHTML = '';
      pdfCanvasContainer.classList.add('hidden');
    }
    if (viewerLoader) viewerLoader.classList.remove('hidden');

    // Restore sections
    siteHeader && siteHeader.classList.remove('hidden');
    roleSection && roleSection.classList.remove('hidden');
    // Only show cardsGrid if a role was chosen previously
    try {
      const saved = localStorage.getItem('role');
      if (saved === 'male' || saved === 'female') {
        cardsGrid && cardsGrid.classList.remove('hidden');
      }
    } catch {
      // fallback: show grid
      cardsGrid && cardsGrid.classList.remove('hidden');
    }
    siteFooter && siteFooter.classList.remove('hidden');
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-btn');
    if (btn) {
      const card = btn.closest('article[data-src]');
      if (!card) return;
      const src = card.getAttribute('data-src');
      const title = card.getAttribute('data-title') || 'معاينة';
      if (src) openViewer(title, src);
    }
  });

  closeViewer && closeViewer.addEventListener('click', closeViewerFn);

  // hide loader once iframe finishes loading
  if (pdfFrame) {
    pdfFrame.addEventListener('load', () => {
      if (viewerLoader) viewerLoader.classList.add('hidden');
    });
  }

  // Role selection and filtering
  function setActiveRole(role) {
    // style buttons
    roleButtons.forEach((b) => {
      const isActive = b.dataset.role === role;
      b.classList.toggle('bg-brand-500', isActive);
      b.classList.toggle('text-white', isActive);
      b.classList.toggle('hover:bg-brand-600', isActive);
    });

    if (cardsGrid) cardsGrid.classList.remove('hidden');
    if (rolePrompt) rolePrompt.classList.add('hidden');

    // Toggle page theme colors
    try {
      document.body.classList.remove('theme-male', 'theme-female');
      if (role === 'male') document.body.classList.add('theme-male');
      if (role === 'female') document.body.classList.add('theme-female');
    } catch {}

    // filter articles
    const items = document.querySelectorAll('#cardsGrid article');
    let visible = 0;
    items.forEach((el) => {
      const g = el.getAttribute('data-gender');
      if (!g) return;
      if (g === role) {
        el.classList.remove('hidden');
        visible++;
      } else {
        el.classList.add('hidden');
      }
    });

    // update count
    if (cardsCount) {
      cardsCount.classList.remove('hidden');
      cardsCount.textContent = visible + ' عناصر';
    }

    // close viewer if open
    closeViewerFn();

    // persist
    try { localStorage.setItem('role', role); } catch {}
  }

  roleButtons.forEach((btn) => {
    btn.addEventListener('click', () => setActiveRole(btn.dataset.role));
  });

  // initialize from storage
  try {
    const saved = localStorage.getItem('role');
    if (saved === 'male' || saved === 'female') {
      setActiveRole(saved);
    }
  } catch {}

  // Escape key to close viewer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Close notice modal first if open
      if (noticeModal && !noticeModal.classList.contains('hidden')) {
        hideNotice();
        return;
      }
      closeViewerFn();
    }
  });
})();
