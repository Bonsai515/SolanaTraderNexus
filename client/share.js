/**
 * Social Media Sharing Functionality
 * Provides one-click sharing of trading insights with dynamic previews
 */

class SocialMediaShare {
  constructor() {
    this.platformData = {
      twitter: {
        url: 'https://twitter.com/intent/tweet',
        width: 550,
        height: 420
      },
      telegram: {
        url: 'https://t.me/share/url',
        width: 550,
        height: 460
      },
      linkedin: {
        url: 'https://www.linkedin.com/shareArticle',
        width: 550,
        height: 475
      },
      discord: {
        url: 'https://discord.com/channels/@me',
        width: 550,
        height: 550
      }
    };
  }

  /**
   * Generate a shareable trading insight
   * @param {Object} data Performance data to share
   * @returns {Object} Formatted data for sharing
   */
  generateInsight(data = {}) {
    // Get current active strategies
    const strategies = this.getActiveStrategies();
    
    // Get performance metrics
    const performance = data.performance || {
      daily: document.querySelector('.card:nth-child(3) .card-value').textContent,
      strategies: strategies.length
    };
    
    // Format the insight message
    const insight = {
      title: 'Solana Trading Performance Update',
      message: `My Solana trading bot is currently running ${performance.strategies} strategies with a 24h performance of ${performance.daily}.`,
      hashtags: ['Solana', 'SolanaTrading', 'CryptoTrading', 'AlgoTrading', 'DeFi'].join(','),
      url: window.location.href
    };
    
    // If we have specific strategy performance, add it
    if (data.topStrategy) {
      insight.message += ` Top strategy: ${data.topStrategy.name} on ${data.topStrategy.pair} (${data.topStrategy.performance}).`;
    }
    
    return insight;
  }
  
  /**
   * Get active trading strategies from the DOM
   * @returns {Array} Array of strategy objects
   */
  getActiveStrategies() {
    const strategyCards = document.querySelectorAll('.strategy-card');
    const strategies = [];
    
    strategyCards.forEach(card => {
      // Only include active strategies
      const statusElement = card.querySelector('.strategy-status');
      if (statusElement && statusElement.classList.contains('status-active')) {
        strategies.push({
          name: card.querySelector('.strategy-name').textContent,
          pair: card.querySelector('.strategy-pair').textContent,
          description: card.querySelector('.strategy-description').textContent
        });
      }
    });
    
    return strategies;
  }

  /**
   * Generate an OpenGraph preview image URL (mock implementation)
   * @param {Object} data The data to include in the preview
   * @returns {String} URL for the preview image
   */
  generatePreviewImageUrl(data) {
    // In a real implementation, this would call a server endpoint to generate
    // a dynamic image. For now, we'll just return a static URL and add params.
    const params = new URLSearchParams({
      title: data.title,
      performance: data.performance?.daily || '0%',
      strategy_count: data.performance?.strategies || '0'
    });
    
    // This would be replaced with an actual server endpoint
    return `/api/generate-preview?${params.toString()}`;
  }

  /**
   * Share trading insight to a social platform
   * @param {String} platform Platform name (twitter, telegram, etc.)
   * @param {Object} data Optional custom data to share
   */
  shareToSocialMedia(platform, data = {}) {
    if (!this.platformData[platform]) {
      console.error(`Unsupported platform: ${platform}`);
      return false;
    }
    
    // Generate the insight to share
    const insight = this.generateInsight(data);
    
    // Configure parameters for each platform
    let shareUrl = this.platformData[platform].url;
    let params = new URLSearchParams();
    
    switch (platform) {
      case 'twitter':
        params.append('text', insight.message);
        params.append('url', insight.url);
        params.append('hashtags', insight.hashtags);
        break;
        
      case 'telegram':
        params.append('url', insight.url);
        params.append('text', `${insight.title}\n\n${insight.message}`);
        break;
        
      case 'linkedin':
        params.append('url', insight.url);
        params.append('title', insight.title);
        params.append('summary', insight.message);
        params.append('source', 'Solana Trading Platform');
        break;
        
      case 'discord':
        // Discord doesn't have a direct share URL, so we'll copy to clipboard
        this.copyToClipboard(`**${insight.title}**\n${insight.message}\n${insight.url}`);
        alert('Content copied to clipboard for Discord sharing!');
        return true;
    }
    
    // Open share dialog
    const shareWindow = window.open(
      `${shareUrl}?${params.toString()}`,
      `share_${platform}`,
      `width=${this.platformData[platform].width},height=${this.platformData[platform].height},menubar=no,toolbar=no`
    );
    
    return true;
  }
  
  /**
   * Copy text to clipboard
   * @param {String} text Text to copy
   */
  copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed'; // Prevent scrolling to bottom
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

// Initialize and export the sharing functionality
const socialMediaShare = new SocialMediaShare();
window.socialMediaShare = socialMediaShare;