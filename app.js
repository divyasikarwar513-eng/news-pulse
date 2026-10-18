document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const newsFeed = document.getElementById('newsFeed') || document.getElementById('newsFeedContainer');
  const categoryButtons = document.querySelectorAll('.cat-btn');
  const modal = document.getElementById('articleModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalImage = document.getElementById('modalImage');
  const modalDescription = document.getElementById('modalDescription');
  const modalSourceLink = document.getElementById('modalSourceLink');
  const summaryBox = document.getElementById('summaryContent');
  const statusBadge = document.getElementById('summaryStatus');

  let currentArticles = [];

  // 1. Initial Load: Fetch default category
  fetchNews('/api/news?category=general');

  // 2. Category / Topic Click Listeners
  categoryButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      // Toggle active visual states
      categoryButtons.forEach((b) => b.classList.remove('active', 'bg-blue-600', 'text-white'));
      btn.classList.add('active', 'bg-blue-600', 'text-white');

      const type = btn.getAttribute('data-type') || 'category';
      const val = btn.getAttribute('data-val') || btn.innerText.trim().toLowerCase();

      let url = '/api/news';
      if (type === 'topic' || ['bollywood', 'tollywood', 'hollywood', 'cricket'].includes(val)) {
        url += `?topic=${encodeURIComponent(val)}`;
      } else {
        url += `?category=${encodeURIComponent(val)}`;
      }

      fetchNews(url);
    });
  });

  // 3. Fetch News from Express Backend
  async function fetchNews(url) {
    if (!newsFeed) return;
    newsFeed.innerHTML = `
      <div class="col-span-full text-center py-12 text-gray-500">
        <p class="animate-pulse">Loading live headlines...</p>
      </div>
    `;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data.articles || data.articles.length === 0) {
        newsFeed.innerHTML = `
          <div class="col-span-full text-center py-12 text-gray-500">
            <p>No headlines found in the last 24 hours.</p>
          </div>
        `;
        return;
      }

      currentArticles = data.articles;
      renderNewsCards(data.articles);
    } catch (err) {
      console.error('Fetch error:', err);
      newsFeed.innerHTML = `
        <div class="col-span-full text-center py-12 text-red-500">
          <p>Error loading news feed.</p>
        </div>
      `;
    }
  }

  // 4. Render News Cards
  function renderNewsCards(articles) {
    if (!newsFeed) return;
    newsFeed.innerHTML = '';

    articles.forEach((article, index) => {
      const card = document.createElement('div');
      card.className = 'news-card bg-white rounded-xl shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden border border-gray-100 flex flex-col';
      card.innerHTML = `
        <img src="${article.image || 'https://via.placeholder.com/400x200?text=News'}" 
             alt="${article.title}" 
             class="w-full h-44 object-cover" 
             onerror="this.src='https://via.placeholder.com/400x200?text=No+Image'"/>
        <div class="p-4 flex flex-col flex-grow">
          <span class="text-xs text-blue-600 font-semibold mb-1">${article.source?.name || 'NewsPulse'}</span>
          <h3 class="text-base font-bold text-gray-900 line-clamp-2 mb-2">${article.title}</h3>
          <p class="text-xs text-gray-600 line-clamp-3 mb-4 flex-grow">${article.description || ''}</p>
          <button class="text-xs font-semibold text-blue-600 hover:text-blue-800 text-left mt-auto">
            Read Highlights & Summary →
          </button>
        </div>
      `;

      card.addEventListener('click', () => openArticleModal(index));
      newsFeed.appendChild(card);
    });
  }

  // 5. Open Modal & Request Summary
  function openArticleModal(index) {
    const article = currentArticles[index];
    if (!article || !modal) return;

    if (modalTitle) modalTitle.innerText = article.title || '';
    if (modalImage) modalImage.src = article.image || '';
    if (modalDescription) modalDescription.innerText = article.description || article.content || '';
    if (modalSourceLink) {
      modalSourceLink.href = article.url || '#';
      modalSourceLink.target = '_blank';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Trigger Summary Generation
    loadArticleSummary(article);
  }

  // 6. Summarize Article via Backend
  async function loadArticleSummary(article) {
    if (summaryBox) {
      summaryBox.innerHTML = '<p class="italic text-gray-500">Generating 3-bullet recap...</p>';
    }
    if (statusBadge) {
      statusBadge.innerText = 'Summarizing...';
      statusBadge.className = 'bg-blue-600 text-white text-xs px-2.5 py-0.5 rounded-full font-medium';
    }

    // Check if pre-computed summary exists
    if (article.summary && article.summary !== 'Summary unavailable.') {
      displayFormattedSummary(article.summary);
      return;
    }

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title || '',
          description: article.description || '',
          content: article.content || ''
        })
      });

      const data = await res.json();

      if (res.ok && data.summary && data.summary !== 'Summary unavailable.') {
        article.summary = data.summary; // Cache in memory
        displayFormattedSummary(data.summary);
      } else {
        if (summaryBox) summaryBox.innerText = 'Summary unavailable.';
        if (statusBadge) {
          statusBadge.innerText = 'Unavailable';
          statusBadge.className = 'bg-gray-400 text-white text-xs px-2.5 py-0.5 rounded-full font-medium';
        }
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
      if (summaryBox) summaryBox.innerText = 'Summary unavailable.';
      if (statusBadge) {
        statusBadge.innerText = 'Unavailable';
        statusBadge.className = 'bg-gray-400 text-white text-xs px-2.5 py-0.5 rounded-full font-medium';
      }
    }
  }

  // 7. Format Bullets and Update Badge Status
  function displayFormattedSummary(rawText) {
    if (summaryBox) {
      const bulletPoints = rawText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => `<p class="py-0.5 leading-relaxed">${line.replace(/^[•\-\*]\s*/, '• ')}</p>`)
        .join('');

      summaryBox.innerHTML = bulletPoints || rawText;
    }

    if (statusBadge) {
      statusBadge.innerText = 'Done ✓';
      statusBadge.className = 'bg-green-600 text-white text-xs px-2.5 py-0.5 rounded-full font-medium';
    }
  }

  // 8. Close Modal Listeners
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }document.addEventListener('DOMContentLoaded', () => {
  const newsFeed = document.getElementById('newsFeed');
  const categoryButtons = document.querySelectorAll('.cat-btn');
  const modal = document.getElementById('articleModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalImage = document.getElementById('modalImage');
  const modalDescription = document.getElementById('modalDescription');
  const modalSourceLink = document.getElementById('modalSourceLink');
  const summaryBox = document.getElementById('summaryContent');
  const statusBadge = document.getElementById('summaryStatus');

  let currentArticles = [];

  // 1. Initial Load: Top Stories
  fetchNews('/api/news?category=general');

  // 2. Category & Topic Button Listeners
  categoryButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      categoryButtons.forEach((b) => {
        b.classList.remove('bg-blue-600', 'text-white', 'active');
        b.classList.add('bg-white', 'text-slate-700', 'border', 'border-slate-200');
      });

      btn.classList.remove('bg-white', 'text-slate-700', 'border', 'border-slate-200');
      btn.classList.add('bg-blue-600', 'text-white', 'active');

      const type = btn.getAttribute('data-type') || 'category';
      const val = btn.getAttribute('data-val') || btn.innerText.trim().toLowerCase();

      let url = '/api/news';
      if (type === 'topic' || ['bollywood', 'tollywood', 'hollywood', 'cricket'].includes(val)) {
        url += `?topic=${encodeURIComponent(val)}`;
      } else {
        url += `?category=${encodeURIComponent(val)}`;
      }

      fetchNews(url);
    });
  });

  // 3. Fetch Headlines from Server
  async function fetchNews(url) {
    if (!newsFeed) return;
    newsFeed.innerHTML = `
      <div class="col-span-full text-center py-16 text-slate-400">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
        <p class="text-sm font-medium">Fetching the latest headlines...</p>
      </div>
    `;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data.articles || data.articles.length === 0) {
        newsFeed.innerHTML = `
          <div class="col-span-full text-center py-16 text-slate-500">
            <p>No headlines found in the last 24 hours.</p>
          </div>
        `;
        return;
      }

      currentArticles = data.articles;
      renderArticles(data.articles);
    } catch (err) {
      console.error('Fetch error:', err);
      newsFeed.innerHTML = `
        <div class="col-span-full text-center py-16 text-red-500">
          <p>Error loading news feed.</p>
        </div>
      `;
    }
  }

  // 4. Render Article Cards
  function renderArticles(articles) {
    if (!newsFeed) return;
    newsFeed.innerHTML = '';

    articles.forEach((article, index) => {
      const card = document.createElement('div');
      card.className = 'news-card bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden border border-slate-200 flex flex-col group';
      card.innerHTML = `
        <div class="h-44 w-full bg-slate-100 overflow-hidden relative">
          <img src="${article.image || 'https://via.placeholder.com/600x400?text=News'}" 
               alt="${article.title}" 
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
               onerror="this.src='https://via.placeholder.com/600x400?text=No+Image'"/>
        </div>
        <div class="p-5 flex flex-col flex-grow">
          <span class="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-2">${article.source?.name || 'NewsPulse'}</span>
          <h3 class="text-base font-bold text-slate-900 line-clamp-2 mb-2 leading-snug">${article.title}</h3>
          <p class="text-xs text-slate-600 line-clamp-3 mb-4 flex-grow leading-relaxed">${article.description || ''}</p>
          <div class="pt-3 border-t border-slate-100 flex items-center justify-between mt-auto">
            <span class="text-xs font-semibold text-blue-600 group-hover:text-blue-800 transition">View Highlights & Summary →</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => openModal(index));
      newsFeed.appendChild(card);
    });
  }

  // 5. Open Modal & Fetch Summary
  function openModal(index) {
    const article = currentArticles[index];
    if (!article || !modal) return;

    if (modalTitle) modalTitle.innerText = article.title || '';
    if (modalImage) modalImage.src = article.image || 'https://via.placeholder.com/600x400?text=News';
    if (modalDescription) modalDescription.innerText = article.description || article.content || '';
    if (modalSourceLink) {
      modalSourceLink.href = article.url || '#';
      modalSourceLink.target = '_blank';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    loadSummary(article);
  }

  // 6. Generate and Display 3-Bullet Summary
  async function loadSummary(article) {
    if (summaryBox) {
      summaryBox.innerHTML = '<p class="italic text-slate-500">Generating 3-bullet recap...</p>';
    }
    if (statusBadge) {
      statusBadge.innerText = 'Summarizing...';
      statusBadge.className = 'bg-blue-600 text-white text-[11px] px-2.5 py-0.5 rounded-full font-medium';
    }

    // Check if summary was cached on this article object
    if (article.cachedSummary) {
      renderSummaryText(article.cachedSummary);
      return;
    }

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: article.title || '',
          description: article.description || '',
          content: article.content || ''
        })
      });

      const data = await response.json();

      if (response.ok && data.summary && data.summary !== 'Summary unavailable.') {
        article.cachedSummary = data.summary;
        renderSummaryText(data.summary);
      } else {
        if (summaryBox) summaryBox.innerText = 'Summary unavailable.';
        if (statusBadge) {
          statusBadge.innerText = 'Unavailable';
          statusBadge.className = 'bg-slate-400 text-white text-[11px] px-2.5 py-0.5 rounded-full font-medium';
        }
      }
    } catch (err) {
      console.error('Summary fetch error:', err);
      if (summaryBox) summaryBox.innerText = 'Summary unavailable.';
      if (statusBadge) {
        statusBadge.innerText = 'Unavailable';
        statusBadge.className = 'bg-slate-400 text-white text-[11px] px-2.5 py-0.5 rounded-full font-medium';
      }
    }
  }

  // 7. Render Formatted Bullets
  function renderSummaryText(text) {
    if (summaryBox) {
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const html = lines
        .map((line) => `<p class="py-0.5 leading-relaxed text-slate-800">${line.replace(/^[•\-\*]\s*/, '• ')}</p>`)
        .join('');

      summaryBox.innerHTML = html || text;
    }

    if (statusBadge) {
      statusBadge.innerText = 'Done ✓';
      statusBadge.className = 'bg-emerald-600 text-white text-[11px] px-2.5 py-0.5 rounded-full font-medium';
    }
  }

  // 8. Close Modal Controls
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', hideModal);
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideModal();
    });
  }

  function hideModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
});
});