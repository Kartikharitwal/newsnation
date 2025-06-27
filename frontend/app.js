// News API Configuration
const NEWS_API_KEY = 'bb14e760e02946e4acd35d6359573042';
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// Translation API Configuration
const TRANSLATION_API_KEY = 'LqG449xAjnWVp62ESSaxIC4RUfajx9wO';
const TRANSLATION_API_URL = 'https://api.mymemory.translated.net/get';

// Global variables
let currentLanguage = 'en';
let currentCategory = 'general';
let currentPage = 1;
let savedArticles = [];
let allArticles = [];
let filteredNews = [];
let translationCache = new Map();

// Initialize saved articles without localStorage
function initializeSavedArticles() {
    savedArticles = [];
}

// DOM elements
const themeToggle = document.getElementById('themeToggle');
const languageSelector = document.getElementById('languageSelector');
const searchInput = document.getElementById('searchInput');
const newsGrid = document.getElementById('newsGrid');
const loadingIndicator = document.getElementById('loadingIndicator');
const savedList = document.getElementById('savedList');
const filterBtns = document.querySelectorAll('.filter-btn');
const navLinks = document.querySelectorAll('.nav-link');

// --- State News Feature ---
const stateSelector = document.getElementById('stateSelector');
const getStateNewsBtn = document.getElementById('getStateNewsBtn');
const stateNewsGrid = document.getElementById('stateNewsGrid');

// Enhanced language mapping with translation support
const languageMap = {
    'en': { code: 'en', name: 'English', flag: '🇺🇸', newsApi: 'en' },
    'hi': { code: 'hi', name: 'हिंदी', flag: '🇮🇳', newsApi: 'en' },
    'gu': { code: 'gu', name: 'ગુજરાતી', flag: '🇮🇳', newsApi: 'en' },
    'bn': { code: 'bn', name: 'বাংলা', flag: '🇧🇩', newsApi: 'en' },
    'ta': { code: 'ta', name: 'தமிழ்', flag: '🇮🇳', newsApi: 'en' },
    'te': { code: 'te', name: 'తెలుగు', flag: '🇮🇳', newsApi: 'en' },
    'mr': { code: 'mr', name: 'मराठी', flag: '🇮🇳', newsApi: 'en' },
    'es': { code: 'es', name: 'Español', flag: '🇪🇸', newsApi: 'es' },
    'fr': { code: 'fr', name: 'Français', flag: '🇫🇷', newsApi: 'fr' },
    'de': { code: 'de', name: 'Deutsch', flag: '🇩🇪', newsApi: 'de' },
    'ar': { code: 'ar', name: 'العربية', flag: '🇸🇦', newsApi: 'ar' },
    'zh': { code: 'zh', name: '中文', flag: '🇨🇳', newsApi: 'zh' },
    'ja': { code: 'ja', name: '日本語', flag: '🇯🇵', newsApi: 'en' },
    'ko': { code: 'ko', name: '한국어', flag: '🇰🇷', newsApi: 'en' },
    'pt': { code: 'pt', name: 'Português', flag: '🇧🇷', newsApi: 'pt' },
    'ru': { code: 'ru', name: 'Русский', flag: '🇷🇺', newsApi: 'ru' }
};

// Category mapping for News API
const categoryMap = {
    'all': 'general',
    'technology': 'technology',
    'business': 'business',
    'sports': 'sports',
    'science': 'science',
    'entertainment': 'entertainment',
    'politics': 'general'
};

// Translation function using MyMemory API
async function translateText(text, targetLang, sourceLang = 'en') {
    if (!text || targetLang === 'en') return text;
    
    // Check cache first
    const cacheKey = `${text}_${sourceLang}_${targetLang}`;
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey);
    }
    
    try {
        // Truncate text if too long (API limit is usually around 500 chars)
        const truncatedText = text.length > 400 ? text.substring(0, 400) + '...' : text;
        
        const url = `${TRANSLATION_API_URL}?q=${encodeURIComponent(truncatedText)}&langpair=${sourceLang}|${targetLang}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.responseStatus === 200 && data.responseData.translatedText) {
            const translatedText = data.responseData.translatedText;
            // Cache the translation
            translationCache.set(cacheKey, translatedText);
            return translatedText;
        } else {
            console.warn('Translation failed:', data);
            return text; // Return original text if translation fails
        }
    } catch (error) {
        console.error('Translation error:', error);
        return text; // Return original text if error occurs
    }
}

// Enhanced translate article function
async function translateArticle(article, targetLang) {
    if (targetLang === 'en') return article;
    
    try {
        const [translatedTitle, translatedDescription] = await Promise.all([
            translateText(article.title, targetLang),
            translateText(article.description || '', targetLang)
        ]);
        
        return {
            ...article,
            title: translatedTitle,
            description: translatedDescription,
            originalTitle: article.title,
            originalDescription: article.description
        };
    } catch (error) {
        console.error('Error translating article:', error);
        return article;
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
    setupEventListeners();
    fetchNews();
    renderSavedArticles();
});

function initializeApp() {
    // Initialize saved articles
    initializeSavedArticles();
    
    // Initialize theme - use memory storage instead of localStorage
    const savedTheme = 'light'; // default theme
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️ Light';
    }

    // Initialize language
    const savedLanguage = 'en'; // default language
    currentLanguage = savedLanguage;
    languageSelector.value = savedLanguage;
    
    // Populate language selector with enhanced options
    populateLanguageSelector();

    // Set active filter
    updateActiveFilterBtn('all');
}

function populateLanguageSelector() {
    languageSelector.innerHTML = '';
    Object.entries(languageMap).forEach(([code, info]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${info.flag} ${info.name}`;
        languageSelector.appendChild(option);
    });
    languageSelector.value = currentLanguage;
}

function setupEventListeners() {
    themeToggle.addEventListener('click', toggleTheme);
    languageSelector.addEventListener('change', changeLanguage);
    searchInput.addEventListener('input', debounce(handleSearch, 500));
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => filterByCategory(btn.dataset.filter));
    });
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            filterByCategory(link.dataset.category);
        });
    });

    if (getStateNewsBtn && stateSelector && stateNewsGrid) {
        getStateNewsBtn.addEventListener('click', async () => {
            const selectedState = stateSelector.value;
            stateNewsGrid.innerHTML = '';
            if (!selectedState) {
                showNotification('Please select a state.', 'warning');
                return;
            }
            stateNewsGrid.innerHTML = `<div class='loading'><div class='loading-spinner'></div><p>Loading news for ${selectedState}...</p></div>`;
            try {
                // Use relative path for backend
                const lang = currentLanguage || 'en';
                const response = await fetch(`/api/state-news/${encodeURIComponent(selectedState)}?language=${lang}`);
                const data = await response.json();
                if (data.status === 'success' && data.articles.length > 0) {
                    renderStateNews(data.articles, selectedState);
                    showNotification(`Showing news for ${selectedState}`, 'success');
                } else {
                    stateNewsGrid.innerHTML = `<div style='text-align:center; color:var(--text-secondary); padding:2rem;'>No news found for ${selectedState}.</div>`;
                }
            } catch (error) {
                stateNewsGrid.innerHTML = `<div style='text-align:center; color:var(--danger-color); padding:2rem;'>Failed to fetch state news.</div>`;
                showNotification('Failed to fetch state news.', 'error');
            }
        });
    }
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    themeToggle.textContent = newTheme === 'dark' ? '☀️ Light' : '🌙 Dark';
    // Note: Not using localStorage as per restrictions
}

async function changeLanguage() {
    const oldLanguage = currentLanguage;
    currentLanguage = languageSelector.value;
    
    // Show loading indicator
    showNotification('Changing language...', 'info');
    
    // If switching to a language that requires translation, translate existing articles
    if (currentLanguage !== 'en' && allArticles.length > 0) {
        try {
            const translatedArticles = await Promise.all(
                allArticles.map(article => translateArticle(article, currentLanguage))
            );
            allArticles = translatedArticles;
            filteredNews = [...allArticles];
            renderNews();
            showNotification(`Language changed to ${languageMap[currentLanguage].name}`, 'success');
        } catch (error) {
            console.error('Error translating articles:', error);
            showNotification('Translation failed, fetching new articles...', 'warning');
            fetchNews();
        }
    } else {
        // Fetch new news for the selected language
        fetchNews();
    }
    
    renderSavedArticles();
}

function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (searchTerm === '') {
        filteredNews = [...allArticles];
    } else {
        filteredNews = allArticles.filter(article =>
            article.title.toLowerCase().includes(searchTerm) ||
            (article.description && article.description.toLowerCase().includes(searchTerm))
        );
    }
    renderNews();
}

function filterByCategory(category) {
    currentCategory = category === 'all' ? 'general' : category;
    currentPage = 1;
    updateActiveFilterBtn(category);
    fetchNews();
}

function updateActiveFilterBtn(category) {
    filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === category);
    });
    navLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.category === category);
    });
}

// Enhanced fetch news with translation support
async function fetchNews() {
    loadingIndicator.style.display = 'block';
    newsGrid.innerHTML = '';

    try {
        const apiCategory = categoryMap[currentCategory] || 'general';
        const apiLanguage = languageMap[currentLanguage]?.newsApi || 'en';
        
        // Try multiple endpoints for better results
        const endpoints = [
            `${NEWS_API_BASE_URL}/top-headlines?category=${apiCategory}&language=${apiLanguage}&pageSize=20&page=${currentPage}&apiKey=${NEWS_API_KEY}`,
            `${NEWS_API_BASE_URL}/everything?q=${apiCategory}&language=${apiLanguage}&sortBy=publishedAt&pageSize=20&page=${currentPage}&apiKey=${NEWS_API_KEY}`,
            `${NEWS_API_BASE_URL}/top-headlines?country=us&category=${apiCategory}&pageSize=20&page=${currentPage}&apiKey=${NEWS_API_KEY}`
        ];

        let data = null;
        let lastError = null;

        // Try each endpoint
        for (let i = 0; i < endpoints.length; i++) {
            try {
                console.log(`Trying endpoint ${i + 1}:`, endpoints[i]);
                
                const proxyUrl = CORS_PROXY + encodeURIComponent(endpoints[i]);
                const response = await fetch(proxyUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const result = await response.json();
                console.log('API Response:', result);
                
                if (result.status === 'ok' && result.articles && result.articles.length > 0) {
                    data = result;
                    break;
                } else if (result.status === 'error') {
                    throw new Error(result.message || 'API returned error status');
                }
            } catch (error) {
                console.error(`Endpoint ${i + 1} failed:`, error);
                lastError = error;
                continue;
            }
        }

        if (!data) {
            throw new Error(lastError?.message || 'All endpoints failed');
        }
        
        // Filter and process articles
        let articles = data.articles.filter(article => 
            article.title && 
            article.title !== '[Removed]' &&
            article.description &&
            article.description !== '[Removed]' &&
            article.url &&
            !article.title.toLowerCase().includes('removed')
        );
        
        // If we still don't have articles, try with sample data
        if (articles.length === 0) {
            console.warn('No articles found, using sample data');
            articles = getSampleNews(apiCategory);
        }
        
        // Translate articles if needed
        if (currentLanguage !== 'en') {
            showNotification('Translating articles...', 'info');
            articles = await Promise.all(
                articles.map(article => translateArticle(article, currentLanguage))
            );
        }
        
        allArticles = articles;
        filteredNews = [...allArticles];
        renderNews();
        
        if (currentLanguage !== 'en') {
            showNotification(`Articles translated to ${languageMap[currentLanguage].name}`, 'success');
        }
        
    } catch (error) {
        console.error('Error fetching news:', error);
        
        // Show user-friendly error message with retry option
        newsGrid.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); padding: 2rem; grid-column: 1 / -1;">
                <h3>Unable to load news</h3>
                <p>We're having trouble connecting to the news service.</p>
                <p style="margin-top: 1rem; font-size: 0.9rem;">Error: ${error.message}</p>
                <div style="margin-top: 1.5rem;">
                    <button onclick="fetchNews()" style="margin-right: 1rem; padding: 0.5rem 1rem; background: var(--accent-color); color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Try Again
                    </button>
                    <button onclick="loadSampleNews()" style="padding: 0.5rem 1rem; background: var(--success-color); color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Load Sample News
                    </button>
                </div>
            </div>
        `;
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Enhanced sample news with multiple languages
function getSampleNews(category) {
    const sampleNews = {
        technology: [
            {
                title: "AI Revolution Continues with New Breakthrough in Machine Learning",
                description: "Researchers have announced a significant breakthrough in machine learning that could revolutionize how AI systems process information.",
                url: "https://example.com/ai-breakthrough",
                urlToImage: "https://via.placeholder.com/400x200/3b82f6/ffffff?text=AI+News",
                publishedAt: new Date().toISOString(),
                source: { name: "Tech Today" }
            },
            {
                title: "Quantum Computing Reaches New Milestone",
                description: "Scientists achieve unprecedented quantum coherence times, bringing practical quantum computers closer to reality.",
                url: "https://example.com/quantum-computing",
                urlToImage: "https://via.placeholder.com/400x200/8b5cf6/ffffff?text=Quantum",
                publishedAt: new Date().toISOString(),
                source: { name: "Science Daily" }
            }
        ],
        business: [
            {
                title: "Global Markets Show Strong Recovery",
                description: "International stock markets are showing signs of robust recovery as investor confidence returns.",
                url: "https://example.com/markets-recovery",
                urlToImage: "https://via.placeholder.com/400x200/10b981/ffffff?text=Markets",
                publishedAt: new Date().toISOString(),
                source: { name: "Financial Times" }
            }
        ],
        sports: [
            {
                title: "Championship Finals Set for Weekend",
                description: "Two powerhouse teams will face off in what promises to be an exciting championship final.",
                url: "https://example.com/championship-finals",
                urlToImage: "https://via.placeholder.com/400x200/ef4444/ffffff?text=Sports",
                publishedAt: new Date().toISOString(),
                source: { name: "Sports Network" }
            }
        ],
        general: [
            {
                title: "Breaking: Major Scientific Discovery Announced",
                description: "Researchers have made a groundbreaking discovery that could change our understanding of the natural world.",
                url: "https://example.com/scientific-discovery",
                urlToImage: "https://via.placeholder.com/400x200/f59e0b/ffffff?text=Science",
                publishedAt: new Date().toISOString(),
                source: { name: "Science Journal" }
            },
            {
                title: "Environmental Initiative Shows Promising Results",
                description: "A new environmental conservation program has shown significant positive impact in its first year.",
                url: "https://example.com/environment-initiative",
                urlToImage: "https://via.placeholder.com/400x200/10b981/ffffff?text=Environment",
                publishedAt: new Date().toISOString(),
                source: { name: "Green News" }
            }
        ]
    };
    
    return sampleNews[category] || sampleNews.general;
}

// Function to load sample news (called by button)
async function loadSampleNews() {
    const apiCategory = categoryMap[currentCategory] || 'general';
    let articles = getSampleNews(apiCategory);
    
    // Translate sample news if needed
    if (currentLanguage !== 'en') {
        showNotification('Translating sample articles...', 'info');
        articles = await Promise.all(
            articles.map(article => translateArticle(article, currentLanguage))
        );
    }
    
    allArticles = articles;
    filteredNews = [...allArticles];
    renderNews();
    showNotification('Sample news loaded successfully!', 'success');
}

// Enhanced render news function
function renderNews() {
    newsGrid.innerHTML = '';
    
    if (filteredNews.length === 0) {
        newsGrid.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); padding: 2rem; grid-column: 1 / -1;">
                <p>No news found matching your criteria.</p>
                <button onclick="loadSampleNews()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--accent-color); color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Load Sample News
                </button>
            </div>
        `;
        return;
    }

    filteredNews.forEach((article, index) => {
        const card = document.createElement('div');
        card.className = 'news-card fade-in';
        
        const isImageValid = article.urlToImage && !article.urlToImage.includes('removed');
        const isSaved = savedArticles.some(saved => saved.url === article.url);
        
        card.innerHTML = `
            ${isImageValid ? 
                `<img src="${article.urlToImage}" alt="${article.title}" style="width: 100%; height: 200px; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                 <div class="news-image" style="display: none;">📰 News Image</div>` :
                `<div class="news-image">📰 News Image</div>`
            }
            <div class="news-content">
                <span class="news-category">${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}</span>
                <h3 class="news-title">${article.title}</h3>
                <p class="news-summary">${article.description || 'No description available.'}</p>
                <div class="news-meta" style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.5rem 0;">
                    <span>${article.source?.name || 'Unknown Source'}</span>
                    ${currentLanguage !== 'en' ? '<span style="margin-left: 1rem;">🌍 Translated</span>' : ''}
                </div>
                <div class="news-actions">
                    <button class="read-more-btn" onclick="window.open('${article.url}', '_blank')">
                        Read More
                    </button>
                    <button class="save-btn ${isSaved ? 'saved' : ''}" onclick="toggleSaveArticle('${article.url.replace(/'/g, "\\'")}', ${index})">
                        ${isSaved ? '❤️ Saved' : '💾 Save'}
                    </button>
                </div>
            </div>
        `;
        
        newsGrid.appendChild(card);
    });
}

// Enhanced toggle save article
function toggleSaveArticle(articleUrl, index) {
    const article = filteredNews[index];
    const savedIndex = savedArticles.findIndex(saved => saved.url === articleUrl);
    
    if (savedIndex === -1) {
        // Save article
        const articleToSave = {
            title: article.title,
            description: article.description,
            url: article.url,
            urlToImage: article.urlToImage,
            publishedAt: article.publishedAt,
            source: article.source,
            category: currentCategory,
            language: currentLanguage,
            savedAt: new Date().toISOString()
        };
        
        savedArticles.push(articleToSave);
        showNotification('Article saved successfully!', 'success');
    } else {
        // Remove article
        savedArticles.splice(savedIndex, 1);
        showNotification('Article removed from saved!', 'success');
    }
    
    renderNews(); // Re-render to update button states
    renderSavedArticles();
}

// Enhanced render saved articles
function renderSavedArticles() {
    savedList.innerHTML = '';
    
    if (savedArticles.length === 0) {
        savedList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No saved articles yet. Save articles to read them later!</p>';
        return;
    }

    savedArticles.forEach((article, index) => {
        const card = document.createElement('div');
        card.className = 'saved-item';
        card.innerHTML = `
            <div style="flex: 1;">
                <h4 style="margin-bottom: 0.5rem; color: var(--text-primary);">${article.title}</h4>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">${article.description}</p>
                <div style="display: flex; gap: 1rem; font-size: 0.8rem; color: var(--text-secondary);">
                    <small>Saved: ${new Date(article.savedAt).toLocaleDateString()}</small>
                    <small>Language: ${languageMap[article.language]?.name || 'English'}</small>
                    <small>Category: ${article.category}</small>
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <button onclick="window.open('${article.url}', '_blank')" style="background: var(--accent-color); color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px; cursor: pointer;">
                    Read
                </button>
                <button class="remove-btn" onclick="removeSavedArticle(${index})">
                    Remove
                </button>
            </div>
        `;
        savedList.appendChild(card);
    });
}

// Remove saved article
function removeSavedArticle(index) {
    savedArticles.splice(index, 1);
    renderSavedArticles();
    renderNews(); // Update main grid to reflect changes
    showNotification('Article removed from saved!', 'success');
}

// Enhanced notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    
    const typeColors = {
        success: 'var(--success-color)',
        error: 'var(--danger-color)',
        warning: 'var(--warning-color)',
        info: 'var(--accent-color)'
    };
    
    const typeIcons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${typeColors[type] || typeColors.info};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        max-width: 300px;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;
    
    notification.innerHTML = `
        <span>${typeIcons[type] || typeIcons.info}</span>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add CSS for notifications and animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .fade-in {
        animation: fadeIn 0.5s ease-in;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .news-meta {
        border-top: 1px solid var(--border-color);
        padding-top: 0.5rem;
        margin-top: 1rem;
    }
    
    .translation-indicator {
        background: var(--accent-color);
        color: white;
        padding: 0.2rem 0.5rem;
        border-radius: 10px;
        font-size: 0.7rem;
        display: inline-block;
        margin-left: 0.5rem;
    }
`;
document.head.appendChild(style);

function renderStateNews(articles, stateName) {
    stateNewsGrid.innerHTML = '';
    if (!articles || articles.length === 0) {
        stateNewsGrid.innerHTML = `<div style='text-align:center; color:var(--text-secondary); padding:2rem;'>No news found for ${stateName}.</div>`;
        return;
    }
    articles.forEach((article, index) => {
        const card = document.createElement('div');
        card.className = 'news-card fade-in';
        const isImageValid = article.urlToImage && !article.urlToImage.includes('removed');
        card.innerHTML = `
            ${isImageValid ? 
                `<img src="${article.urlToImage}" alt="${article.title}" style="width: 100%; height: 200px; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                 <div class="news-image" style="display: none;">📰 News Image</div>` :
                `<div class="news-image">📰 News Image</div>`
            }
            <div class="news-content">
                <span class="news-category">${stateName}</span>
                <h3 class="news-title">${article.title}</h3>
                <p class="news-summary">${article.description || 'No description available.'}</p>
                <div class="news-meta" style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.5rem 0;">
                    <span>${article.source?.name || 'Unknown Source'}</span>
                    ${currentLanguage !== 'en' ? '<span style="margin-left: 1rem;">🌍 Translated</span>' : ''}
                </div>
                <div class="news-actions">
                    <button class="read-more-btn" onclick="window.open('${article.url}', '_blank')">
                        Read More
                    </button>
                </div>
            </div>
        `;
        stateNewsGrid.appendChild(card);
    });
}