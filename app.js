/* ================================================================
   DÖNÜŞÜM — NFC DİJİTAL KİTAP OKUYUCU | app.js
   ================================================================ */

// ---------------------------------------------------------------
// SUPABASE CONFIG
// ---------------------------------------------------------------
const SUPABASE_URL_KEY = 'donusum_sb_url';
const SUPABASE_KEY_KEY = 'donusum_sb_key';
const BOOK_ID = 'donusum';

// Varsayılan (hardcoded) — ayarlar ekranından override edilebilir
const DEFAULT_SUPABASE_URL = 'https://gjoulxeokwwrqfacdynb.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_Glu3hmdlStYHJXl2vHIgpQ_MpEaxLTP';

// PDF ve kapak: Supabase Storage (public)
const STORAGE_BASE = 'https://gjoulxeokwwrqfacdynb.supabase.co/storage/v1/object/public/kitaplar';
const DEFAULT_PDF_URL   = `${STORAGE_BASE}/Franz%20Kafka%20%20%20Donusum.pdf`;
const DEFAULT_COVER_URL = `${STORAGE_BASE}/Donusum_On_Kapak.png`;


// ---------------------------------------------------------------
// LOCALSTORAGE ANAHTARLARI
// ---------------------------------------------------------------
const LS_THEME    = 'donusum_theme';
const LS_PAGE     = 'donusum_page';
const LS_ZOOM     = 'donusum_zoom';
const LS_VOLUME   = 'donusum_radio_volume';
const LS_CHANNEL  = 'donusum_radio_channel';
const LS_BOOKMARKS= 'donusum_bookmarks';

// ---------------------------------------------------------------
// STATE
// ---------------------------------------------------------------
let state = {
  currentPage:   parseInt(localStorage.getItem(LS_PAGE)) || 1,
  totalPages:    0,
  zoom:          parseFloat(localStorage.getItem(LS_ZOOM)) || 1.0,
  theme:         localStorage.getItem(LS_THEME) || 'parchment',
  radioChannel:  localStorage.getItem(LS_CHANNEL) || 'off',
  radioVolume:   parseInt(localStorage.getItem(LS_VOLUME)) || 60,
  bookmarks:     JSON.parse(localStorage.getItem(LS_BOOKMARKS)) || [],
  pdfDoc:        null,
  isRendering:   false,
  supabase:      null,
  bookData:      null,
};

// ---------------------------------------------------------------
// AMBIYANS RADYO KAYNAKLARI (Google CDN - 100% Mobil Uyumlu)
// ---------------------------------------------------------------
const RADIO_SOURCES = {
  rain:   'https://actions.google.com/sounds/v1/weather/rain_heavy.ogg',
  cafe:   'https://actions.google.com/sounds/v1/ambiences/coffee_shop.ogg',
  nature: 'https://actions.google.com/sounds/v1/ambiences/outdoor_forest.ogg',
  piano:  'https://actions.google.com/sounds/v1/music/soothing_strings.ogg',
};

// ---------------------------------------------------------------
// DOM REFERANSLARI
// ---------------------------------------------------------------
const dom = {
  body:              document.body,
  screenLanding:     document.getElementById('screen-landing'),
  screenReader:      document.getElementById('screen-reader'),
  landingCover:      document.getElementById('landing-cover'),
  landingTitle:      document.getElementById('landing-title'),
  landingAuthor:     document.getElementById('landing-author'),
  landingQuote:      document.getElementById('landing-quote'),
  btnStartReading:   document.getElementById('btn-start-reading'),
  resumeBanner:      document.getElementById('resume-banner'),
  resumePageNum:     document.getElementById('resume-page-num'),
  btnBackHome:       document.getElementById('btn-back-home'),
  readerPageInfo:    document.getElementById('reader-page-indicator'),
  progressBar:       document.getElementById('reading-progress-bar'),
  pdfContainer:      document.getElementById('pdf-container'),
  pdfCanvas:         document.getElementById('pdf-render-canvas'),
  pdfSpinner:        document.getElementById('pdf-loading-spinner'),
  btnPrev:           document.getElementById('btn-prev-page'),
  btnNext:           document.getElementById('btn-next-page'),
  pageSlider:        document.getElementById('page-slider'),
  btnToggleRadio:    document.getElementById('btn-toggle-radio'),
  radioDot:          document.querySelector('.radio-dot'),
  btnToggleSettings: document.getElementById('btn-toggle-settings'),
  btnToggleBookmark: document.getElementById('btn-toggle-bookmark'),
  bookmarkIcon:      document.getElementById('bookmark-icon'),
  modalRadio:        document.getElementById('modal-radio'),
  modalSettings:     document.getElementById('modal-settings'),
  radioCards:        document.querySelectorAll('.radio-card'),
  radioVolume:       document.getElementById('radio-volume'),
  themeButtons:      document.querySelectorAll('.theme-btn'),
  btnZoomIn:         document.getElementById('btn-zoom-in'),
  btnZoomOut:        document.getElementById('btn-zoom-out'),
  zoomLevelText:     document.getElementById('zoom-level-text'),
  audioPlayer:       document.getElementById('audio-player'),
  cfgSupabaseUrl:    document.getElementById('cfg-supabase-url'),
  cfgSupabaseKey:    document.getElementById('cfg-supabase-key'),
  btnSaveSupabase:   document.getElementById('btn-save-supabase'),
};

// ================================================================
// SUPABASE BAŞLATMA
// ================================================================
async function initSupabase() {
  // localStorage'daki override varsa onu kullan, yoksa varsayılan
  const url = localStorage.getItem(SUPABASE_URL_KEY) || DEFAULT_SUPABASE_URL;
  const key = localStorage.getItem(SUPABASE_KEY_KEY) || DEFAULT_SUPABASE_KEY;

  if (url && key && window.supabase) {
    try {
      state.supabase = window.supabase.createClient(url, key);
      console.log('✅ Supabase bağlandı:', url);
      return true;
    } catch (e) {
      console.warn('⚠️ Supabase bağlantı hatası:', e.message);
    }
  }
  return false;
}

// ================================================================
// KİTAP VERİSİNİ YÜKLE (Supabase → Fallback: sabit değerler)
// ================================================================
async function loadBookData() {
  // Supabase varsa oradan çek
  if (state.supabase) {
    const { data, error } = await state.supabase
      .from('kitaplar')
      .select('*')
      .eq('id', BOOK_ID)
      .single();

    if (data && !error) {
      state.bookData = data;
      applyBookDataToUI(data);
      return data;
    } else {
      console.warn('Supabase veri alınamadı, fallback kullanılıyor:', error?.message);
    }
  }

  // Fallback: sabit veriler + Supabase Storage URL'leri
  const fallback = {
    id: 'donusum',
    baslik: 'Dönüşüm',
    yazar: 'Franz Kafka',
    yil: 1915,
    ozet: 'Bir sabah bunaltıcı düşlerden uyandığında, kendini yatağında devasa bir böceğe dönüşmüş olarak buldu.',
    sayfa_sayisi: 96,
    kapak_url: DEFAULT_COVER_URL,
    pdf_url:   DEFAULT_PDF_URL,
  };
  state.bookData = fallback;
  applyBookDataToUI(fallback);
  return fallback;
}

function applyBookDataToUI(data) {
  dom.landingTitle.textContent  = data.baslik  || 'Dönüşüm';
  dom.landingAuthor.textContent = data.yazar   || 'Franz Kafka';
  if (data.ozet) dom.landingQuote.textContent  = `"${data.ozet}"`;
  if (data.kapak_url) dom.landingCover.src     = data.kapak_url;
}

// ================================================================
// PDF YÜKLEME VE RENDER
// ================================================================
async function loadPDF(url) {
  showSpinner(true);
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  try {
    const loadingTask = pdfjsLib.getDocument(url);
    state.pdfDoc = await loadingTask.promise;
    state.totalPages = state.pdfDoc.numPages;

    // Slider max ayarla
    dom.pageSlider.max = state.totalPages;

    // Eğer kayıtlı sayfa toplam sayfayı geçiyorsa 1'e sıfırla
    if (state.currentPage > state.totalPages) state.currentPage = 1;

    await renderPage(state.currentPage);
    showSpinner(false);
  } catch (err) {
    showSpinner(false);
    dom.pdfSpinner.querySelector('p').textContent = '❌ PDF yüklenemedi. Dosyayı kontrol et.';
    dom.pdfSpinner.classList.remove('hidden');
    console.error('PDF Yükleme Hatası:', err);
  }
}

async function renderPage(num) {
  if (state.isRendering) return;
  state.isRendering = true;

  const page = await state.pdfDoc.getPage(num);

  // Container genişliğine göre otomatik ölçekle
  const containerWidth = dom.pdfContainer.clientWidth - 32; // padding
  const viewport0 = page.getViewport({ scale: 1 });
  const autoScale = containerWidth / viewport0.width;
  const finalScale = autoScale * state.zoom;

  const viewport = page.getViewport({ scale: finalScale });

  dom.pdfCanvas.height = viewport.height;
  dom.pdfCanvas.width  = viewport.width;

  const ctx = dom.pdfCanvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;

  state.currentPage = num;
  state.isRendering = false;

  // UI güncelle
  updatePageUI();
  localStorage.setItem(LS_PAGE, num);
}

function updatePageUI() {
  const { currentPage, totalPages } = state;
  dom.readerPageInfo.textContent = `Sayfa ${currentPage} / ${totalPages}`;
  dom.pageSlider.value = currentPage;

  const pct = totalPages ? ((currentPage / totalPages) * 100).toFixed(1) : 0;
  dom.progressBar.style.width = pct + '%';

  // Yer imi ikonu
  const isBookmarked = state.bookmarks.includes(currentPage);
  dom.bookmarkIcon.className = isBookmarked ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';

  // Önceki / sonraki butonları
  dom.btnPrev.disabled = (currentPage <= 1);
  dom.btnNext.disabled = (currentPage >= totalPages);

  // Tarayıcı başlığını güncelle
  document.title = `Dönüşüm — Sayfa ${currentPage}/${totalPages}`;
}

function showSpinner(show) {
  dom.pdfSpinner.style.display = show ? 'flex' : 'none';
}

// ================================================================
// TEMA SİSTEMİ
// ================================================================
function applyTheme(themeName) {
  dom.body.className = `theme-${themeName}`;
  state.theme = themeName;
  localStorage.setItem(LS_THEME, themeName);

  dom.themeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === themeName);
  });
}

// ================================================================
// RADYO SİSTEMİ
// ================================================================
function playChannel(channel) {
  dom.radioCards.forEach(card => card.classList.remove('active'));
  const activeCard = document.querySelector(`.radio-card[data-channel="${channel}"]`);
  if (activeCard) activeCard.classList.add('active');

  state.radioChannel = channel;
  localStorage.setItem(LS_CHANNEL, channel);

  if (channel === 'off') {
    dom.audioPlayer.pause();
    dom.audioPlayer.src = '';
    dom.radioDot.classList.add('hidden');
    dom.btnToggleRadio.style.color = '';
    return;
  }

  const src = RADIO_SOURCES[channel];
  if (!src) return;

  dom.audioPlayer.src = src;
  dom.audioPlayer.volume = (state.radioVolume / 100);
  
  // Mobil Chrome & iOS için doğrudan tetikleme
  const playPromise = dom.audioPlayer.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      console.log('🎵 Radyo çalıyor:', channel);
      dom.radioDot.classList.remove('hidden');
      dom.btnToggleRadio.style.color = 'var(--accent-color)';
    }).catch(err => {
      console.warn('⚠️ Ses çalma engellendi:', err);
      showToast('Sese dokunarak oynatmayı başlatın');
    });
  }
}

// ================================================================
// YER İMİ
// ================================================================
function toggleBookmark() {
  const page = state.currentPage;
  const idx = state.bookmarks.indexOf(page);

  if (idx >= 0) {
    state.bookmarks.splice(idx, 1);
    showToast(`Sayfa ${page} yer iminden kaldırıldı`);
  } else {
    state.bookmarks.push(page);
    showToast(`Sayfa ${page} yer imine eklendi 🔖`);
  }

  localStorage.setItem(LS_BOOKMARKS, JSON.stringify(state.bookmarks));
  updatePageUI();
}

// ================================================================
// EKRAN GEÇİŞLERİ
// ================================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ================================================================
// DRAWER (MODAL) YÖNETİMİ
// ================================================================
function toggleDrawer(modalEl) {
  const isHidden = modalEl.classList.contains('hidden');
  // Önce hepsini kapat
  document.querySelectorAll('.drawer-modal').forEach(m => m.classList.add('hidden'));
  if (isHidden) modalEl.classList.remove('hidden');
}

// ================================================================
// TOAST BİLDİRİMİ
// ================================================================
function showToast(msg) {
  let toast = document.getElementById('toast-el');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-el';
    toast.style.cssText = `
      position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
      background:var(--text-primary); color:var(--bg-primary);
      padding:8px 18px; border-radius:20px;
      font-family:var(--font-ui); font-size:13px; font-weight:600;
      z-index:9999; opacity:0; transition:opacity 0.3s ease;
      max-width:280px; text-align:center; pointer-events:none;
    `;
    document.body.appendChild(toast);
  }

  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

// ================================================================
// EVENT LİSTENERS
// ================================================================
function bindEvents() {

  // --- LANDING ---
  dom.btnStartReading.addEventListener('click', () => {
    showScreen('screen-reader');
    if (!state.pdfDoc && state.bookData) {
      loadPDF(state.bookData.pdf_url);
    }
  });

  dom.btnBackHome.addEventListener('click', () => {
    showScreen('screen-landing');
  });

  // --- SAYFA GEÇİŞ ---
  dom.btnPrev.addEventListener('click', () => {
    if (state.currentPage > 1) renderPage(state.currentPage - 1);
  });

  dom.btnNext.addEventListener('click', () => {
    if (state.currentPage < state.totalPages) renderPage(state.currentPage + 1);
  });

  dom.pageSlider.addEventListener('input', () => {
    const targetPage = parseInt(dom.pageSlider.value);
    if (targetPage !== state.currentPage) renderPage(targetPage);
  });

  // Klavye tuşları (masaüstü için de çalışsın)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (state.currentPage < state.totalPages) renderPage(state.currentPage + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (state.currentPage > 1) renderPage(state.currentPage - 1);
    }
  });

  // Dokunmatik swipe (mobil)
  let touchStartX = 0;
  dom.pdfContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  dom.pdfContainer.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 60) {
      if (diff > 0 && state.currentPage < state.totalPages) renderPage(state.currentPage + 1);
      if (diff < 0 && state.currentPage > 1) renderPage(state.currentPage - 1);
    }
  }, { passive: true });

  // --- DRAWER TOGGLE ---
  dom.btnToggleRadio.addEventListener('click', () => toggleDrawer(dom.modalRadio));
  dom.btnToggleSettings.addEventListener('click', () => toggleDrawer(dom.modalSettings));

  // Overlay tıklamayla kapat
  document.querySelectorAll('.drawer-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
      document.querySelectorAll('.drawer-modal').forEach(m => m.classList.add('hidden'));
    });
  });

  // Kapatma butonları
  document.querySelectorAll('.btn-close-drawer').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.drawer-modal').forEach(m => m.classList.add('hidden'));
    });
  });

  // --- RADYO ---
  dom.radioCards.forEach(card => {
    card.addEventListener('click', () => {
      playChannel(card.dataset.channel);
    });
  });

  dom.radioVolume.addEventListener('input', () => {
    state.radioVolume = parseInt(dom.radioVolume.value);
    localStorage.setItem(LS_VOLUME, state.radioVolume);
    dom.audioPlayer.volume = state.radioVolume / 100;
  });

  // --- TEMALAR ---
  dom.themeButtons.forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
  });

  // --- ZOOM ---
  dom.btnZoomIn.addEventListener('click', () => {
    if (state.zoom < 2.0) {
      state.zoom = parseFloat((state.zoom + 0.1).toFixed(1));
      localStorage.setItem(LS_ZOOM, state.zoom);
      dom.zoomLevelText.textContent = Math.round(state.zoom * 100) + '%';
      if (state.pdfDoc) renderPage(state.currentPage);
    }
  });

  dom.btnZoomOut.addEventListener('click', () => {
    if (state.zoom > 0.5) {
      state.zoom = parseFloat((state.zoom - 0.1).toFixed(1));
      localStorage.setItem(LS_ZOOM, state.zoom);
      dom.zoomLevelText.textContent = Math.round(state.zoom * 100) + '%';
      if (state.pdfDoc) renderPage(state.currentPage);
    }
  });

  // --- YER İMİ ---
  dom.btnToggleBookmark.addEventListener('click', toggleBookmark);

  // --- SUPABASE AYARLARI ---
  dom.btnSaveSupabase.addEventListener('click', async () => {
    const url = dom.cfgSupabaseUrl.value.trim();
    const key = dom.cfgSupabaseKey.value.trim();
    if (!url || !key) {
      showToast('URL ve Key gerekli!');
      return;
    }
    localStorage.setItem(SUPABASE_URL_KEY, url);
    localStorage.setItem(SUPABASE_KEY_KEY, key);
    showToast('Kaydedildi! Yenileniyor...');
    setTimeout(() => location.reload(), 1500);
  });
}

// ================================================================
// BAŞLANGIÇ: KARIIŞLAMA EKRANI HAZIRLIĞI
// ================================================================
function setupLandingScreen() {
  const savedPage = parseInt(localStorage.getItem(LS_PAGE)) || 0;

  if (savedPage > 1) {
    dom.resumeBanner.classList.remove('hidden');
    dom.resumePageNum.textContent = savedPage;
  }
}

// ================================================================
// ANA BAŞLATMA FONKSİYONU
// ================================================================
async function init() {
  // 1. Temayı uygula
  applyTheme(state.theme);

  // 2. Zoom metin göster
  dom.zoomLevelText.textContent = Math.round(state.zoom * 100) + '%';

  // 3. Radio volume
  dom.radioVolume.value = state.radioVolume;

  // 4. Supabase config inputları doldur (varsa)
  dom.cfgSupabaseUrl.value = localStorage.getItem(SUPABASE_URL_KEY) || '';
  dom.cfgSupabaseKey.value = localStorage.getItem(SUPABASE_KEY_KEY) || '';

  // 5. Supabase başlat
  await initSupabase();

  // 6. Kitap verisini yükle (Supabase veya fallback)
  await loadBookData();

  // 7. Landing ekran ayarları
  setupLandingScreen();

  // 8. Tüm eventleri bağla
  bindEvents();

  // 9. Eğer önceki oturumda radyo açıksa yeniden başlat
  if (state.radioChannel !== 'off') {
    const activeCard = document.querySelector(`.radio-card[data-channel="${state.radioChannel}"]`);
    if (activeCard) activeCard.classList.add('active');
    dom.radioDot.classList.remove('hidden');
    dom.btnToggleRadio.style.color = 'var(--accent-color)';
    // Not: autoplay policy nedeniyle kullanıcı etkileşimi olmadan çalmayacak
    // İlk sayfa geçişinde veya reader açılışında başlatılacak
  }

  console.log('📖 Dönüşüm Dijital Kitap Okuyucu başlatıldı.');
}

// Uygulama başlat
document.addEventListener('DOMContentLoaded', init);
