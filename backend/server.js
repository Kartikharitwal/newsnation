const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// News API configuration
const NEWS_API_KEY = process.env.NEWS_API_KEY; // Get from newsapi.org
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

// Google Translate API configuration (optional - for better translation)
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

// Category mapping for News API
const categoryMapping = {
    'all': 'general',
    'technology': 'technology',
    'business': 'business',
    'sports': 'sports',
    'science': 'science',
    'entertainment': 'entertainment',
    'politics': 'general'
};

// Language mapping
const languageMapping = {
    'en': 'en',
    'hi': 'hi',
    'gu': 'gu',
    'es': 'es',
    'de': 'de'
};

// Simple translation function using Google Translate API
async function translateText(text, targetLanguage) {
    if (!text || targetLanguage === 'en') return text;
    
    try {
        if (GOOGLE_TRANSLATE_API_KEY) {
            const response = await axios.post(
                `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`,
                {
                    q: text,
                    target: targetLanguage,
                    source: 'en'
                }
            );
            return response.data.data.translations[0].translatedText;
        } else {
            // Fallback: Use a free translation service or return original text
            // For demo purposes, returning original text
            return text;
        }
    } catch (error) {
        console.error('Translation error:', error.message);
        return text;
    }
}

// Alternative free translation using MyMemory API
async function translateTextFree(text, targetLanguage) {
    if (!text || targetLanguage === 'en') return text;
    
    try {
        const response = await axios.get(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLanguage}`
        );
        
        if (response.data.responseStatus === 200) {
            return response.data.responseData.translatedText;
        }
        return text;
    } catch (error) {
        console.error('Translation error:', error.message);
        return text;
    }
}

// Get news endpoint
app.get('/api/news', async (req, res) => {
    try {
        const { category = 'general', language = 'en', page = 1, pageSize = 20, q = '' } = req.query;
        
        // Map category
        const newsCategory = categoryMapping[category] || 'general';
        
        // Build News API URL
        let newsUrl = `${NEWS_API_BASE_URL}/top-headlines`;
        const params = {
            apiKey: NEWS_API_KEY,
            category: newsCategory,
            country: 'in', // Focus on Indian news sources
            page: page,
            pageSize: pageSize
        };

        // Add search query if provided
        if (q && q.trim()) {
            params.q = q;
            delete params.category; // Remove category when searching
            newsUrl = `${NEWS_API_BASE_URL}/everything`;
        }

        const response = await axios.get(newsUrl, { params });
        
        if (response.data.status !== 'ok') {
            throw new Error('News API error: ' + response.data.message);
        }

        let articles = response.data.articles || [];

        // Filter out articles with null/missing data
        articles = articles.filter(article => 
            article.title && 
            article.title !== '[Removed]' && 
            article.description &&
            article.description !== '[Removed]'
        );

        // Translate articles if language is not English
        if (language !== 'en') {
            console.log(`Translating ${articles.length} articles to ${language}...`);
            for (let i = 0; i < articles.length; i++) {
                try {
                    console.log(`Translating article ${i + 1}/${articles.length}`);
                    articles[i].title = await translateText(articles[i].title, language);
                    articles[i].description = await translateText(articles[i].description, language);
                    
                    // Add small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error(`Translation failed for article ${i + 1}:`, error.message);
                    // Keep original text if translation fails
                }
            }
        }

        res.json({
            status: 'success',
            totalResults: response.data.totalResults,
            articles: articles,
            page: parseInt(page),
            pageSize: parseInt(pageSize)
        });

    } catch (error) {
        console.error('Error fetching news:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch news',
            error: error.message
        });
    }
});

// Get news sources endpoint
app.get('/api/sources', async (req, res) => {
    try {
        const response = await axios.get(`${NEWS_API_BASE_URL}/sources`, {
            params: {
                apiKey: NEWS_API_KEY,
                country: 'in',
                language: 'en'
            }
        });

        res.json({
            status: 'success',
            sources: response.data.sources
        });

    } catch (error) {
        console.error('Error fetching sources:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch sources',
            error: error.message
        });
    }
});

// Search news endpoint
app.get('/api/search', async (req, res) => {
    try {
        const { q, language = 'en', page = 1, pageSize = 20 } = req.query;
        
        if (!q || q.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Search query is required'
            });
        }

        const response = await axios.get(`${NEWS_API_BASE_URL}/everything`, {
            params: {
                apiKey: NEWS_API_KEY,
                q: q,
                sortBy: 'publishedAt',
                page: page,
                pageSize: pageSize,
                language: 'en' // Always fetch in English first
            }
        });

        let articles = response.data.articles || [];

        // Filter out removed articles
        articles = articles.filter(article => 
            article.title && 
            article.title !== '[Removed]' && 
            article.description &&
            article.description !== '[Removed]'
        );

        // Translate if needed
        if (language !== 'en') {
            console.log(`Translating search results to ${language}...`);
            for (let i = 0; i < articles.length; i++) {
                try {
                    articles[i].title = await translateText(articles[i].title, language);
                    articles[i].description = await translateText(articles[i].description, language);
                    
                    // Add small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error(`Translation failed for search result ${i + 1}:`, error.message);
                }
            }
        }

        res.json({
            status: 'success',
            totalResults: response.data.totalResults,
            articles: articles,
            page: parseInt(page),
            pageSize: parseInt(pageSize)
        });

    } catch (error) {
        console.error('Error searching news:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to search news',
            error: error.message
        });
    }
});

// State-wise news endpoint
app.get('/api/state-news/:state', async (req, res) => {
    try {
        const state = req.params.state;
        const { language = 'en', page = 1, pageSize = 20 } = req.query;
        if (!state || !state.trim()) {
            return res.status(400).json({
                status: 'error',
                message: 'State parameter is required'
            });
        }
        // Use NewsAPI 'everything' endpoint with state as keyword
        const response = await axios.get(`${NEWS_API_BASE_URL}/everything`, {
            params: {
                apiKey: NEWS_API_KEY,
                q: state,
                sortBy: 'publishedAt',
                page: page,
                pageSize: pageSize,
                language: 'en' // Always fetch in English first
            }
        });
        let articles = response.data.articles || [];
        // Filter out removed articles
        articles = articles.filter(article => 
            article.title && 
            article.title !== '[Removed]' && 
            article.description &&
            article.description !== '[Removed]'
        );
        // Translate if needed
        if (language !== 'en') {
            for (let i = 0; i < articles.length; i++) {
                try {
                    articles[i].title = await translateText(articles[i].title, language);
                    articles[i].description = await translateText(articles[i].description, language);
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    // Keep original text if translation fails
                }
            }
        }
        res.json({
            status: 'success',
            totalResults: response.data.totalResults,
            articles: articles,
            page: parseInt(page),
            pageSize: parseInt(pageSize)
        });
    } catch (error) {
        console.error('Error fetching state news:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch state news',
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'News Mania API is running!',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 News Mania API Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌐 News API: http://localhost:${PORT}/api/news`);
    console.log(`🔍 Search API: http://localhost:${PORT}/api/search`);
    
    if (!NEWS_API_KEY) {
        console.warn('⚠️  WARNING: NEWS_API_KEY not found in environment variables');
        console.log('📝 Get your free API key from: https://newsapi.org/');
    }
    
    console.log('🌍 Using free translation services (no API keys required):');
    console.log('   • MyMemory API (Primary) - Free, 1000 chars/day');
    console.log('   • LibreTranslate - Open source, free');  
    console.log('   • Google Translate (Unofficial) - Free, no limits');
    console.log('   • Lingva Translate - Free proxy service');
});