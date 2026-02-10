/**
 * OTP Form Embed Script
 *
 * Usage:
 * 1. Add a div with id="otp-form-embed" to your page
 * 2. Include this script: <script src="https://your-domain.netlify.app/embed.js"></script>
 *
 * Options:
 * - data-width: iframe width (default: 100%)
 * - data-height: iframe height (default: 800px)
 * - data-style: custom CSS for container
 *
 * Example:
 * <div id="otp-form-embed" data-width="600px" data-height="900px"></div>
 * <script src="https://your-domain.netlify.app/embed.js"></script>
 */

(function() {
    'use strict';

    // Configuration
    const EMBED_CONTAINER_ID = 'otp-form-embed';
    const DEFAULT_WIDTH = '100%';
    const DEFAULT_HEIGHT = '800px';

    // Get the current script's URL to determine the base URL
    const currentScript = document.currentScript || (function() {
        const scripts = document.getElementsByTagName('script');
        return scripts[scripts.length - 1];
    })();

    const scriptSrc = currentScript.src;
    const baseUrl = scriptSrc.substring(0, scriptSrc.lastIndexOf('/'));

    /**
     * Initialize the embedded form
     */
    function initEmbed() {
        const container = document.getElementById(EMBED_CONTAINER_ID);

        if (!container) {
            console.error(`OTP Form Embed: Container with id="${EMBED_CONTAINER_ID}" not found`);
            return;
        }

        // Get configuration from data attributes
        const width = container.getAttribute('data-width') || DEFAULT_WIDTH;
        const height = container.getAttribute('data-height') || DEFAULT_HEIGHT;
        const customStyle = container.getAttribute('data-style') || '';

        // Create iframe
        const iframe = document.createElement('iframe');
        iframe.src = `${baseUrl}/index.html`;
        iframe.style.cssText = `
            width: ${width};
            height: ${height};
            border: none;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            ${customStyle}
        `;
        iframe.setAttribute('title', 'OTP Verification Form');
        iframe.setAttribute('loading', 'lazy');

        // Add responsive attributes
        iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');

        // Clear container and append iframe
        container.innerHTML = '';
        container.appendChild(iframe);

        console.log('OTP Form Embed: Initialized successfully');

        // Handle dynamic iframe height (responsive)
        setupDynamicHeight(iframe);
    }

    /**
     * Setup dynamic height adjustment for the iframe
     * This listens to messages from the iframe to adjust its height
     */
    function setupDynamicHeight(iframe) {
        window.addEventListener('message', function(event) {
            // Verify origin for security (in production, check against your domain)
            if (event.origin !== window.location.origin && !event.origin.includes('netlify.app')) {
                return;
            }

            // Handle height change message
            if (event.data && event.data.type === 'otp-form-height') {
                const newHeight = event.data.height;
                if (newHeight && typeof newHeight === 'number') {
                    iframe.style.height = `${newHeight}px`;
                }
            }

            // Handle form completion message (optional)
            if (event.data && event.data.type === 'otp-form-complete') {
                console.log('OTP Form: Submission completed');

                // Trigger custom event for parent page
                const completionEvent = new CustomEvent('otpFormComplete', {
                    detail: event.data.payload
                });
                window.dispatchEvent(completionEvent);
            }
        });
    }

    /**
     * Add utility CSS to the page
     */
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #${EMBED_CONTAINER_ID} {
                max-width: 100%;
                margin: 0 auto;
            }

            @media (max-width: 768px) {
                #${EMBED_CONTAINER_ID} iframe {
                    width: 100% !important;
                    height: auto !important;
                    min-height: 600px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Initialize when DOM is ready
     */
    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    // Initialize the embed
    onReady(function() {
        injectStyles();
        initEmbed();
    });

    // Expose public API (optional)
    window.OTPFormEmbed = {
        version: '1.0.0',
        reinit: initEmbed,
        reload: function() {
            const iframe = document.querySelector(`#${EMBED_CONTAINER_ID} iframe`);
            if (iframe) {
                iframe.src = iframe.src;
            }
        }
    };

})();
