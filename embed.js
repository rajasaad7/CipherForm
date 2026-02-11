/**
 * CipherBC Contact Form - Embed Script
 * Usage: <div id="cipherbc-form"></div><script src="https://form.cipherbc.com/embed.js"></script>
 */
(function() {
  // Find the container
  var container = document.getElementById('cipherbc-form');

  if (!container) {
    console.error('CipherBC Form: Container element with id="cipherbc-form" not found');
    return;
  }

  // Get custom options from data attributes
  var height = container.getAttribute('data-height') || '900px';
  var width = container.getAttribute('data-width') || '100%';

  // Build iframe URL with parent page tracking data
  var iframeUrl = 'https://form.cipherbc.com';
  var params = new URLSearchParams();

  // Pass parent page's full URL (for redirect detection)
  params.append('parent_url', window.location.href);

  // Pass parent page's referrer
  if (document.referrer) {
    params.append('parent_referrer', document.referrer);
  }

  // Pass UTM parameters from parent page if present
  var parentParams = new URLSearchParams(window.location.search);
  var utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

  utmParams.forEach(function(param) {
    var value = parentParams.get(param);
    if (value) {
      params.append(param, value);
    }
  });

  // Add parameters to iframe URL if any exist
  var queryString = params.toString();
  if (queryString) {
    iframeUrl += '?' + queryString;
  }

  // Create iframe
  var iframe = document.createElement('iframe');
  iframe.src = iframeUrl;
  iframe.style.width = width;
  iframe.style.height = height;
  iframe.style.border = 'none';
  iframe.style.borderRadius = '8px';
  iframe.setAttribute('scrolling', 'auto');
  iframe.setAttribute('title', 'CipherBC Contact Form');

  // Listen for success redirect from form
  window.addEventListener('message', function(event) {
    // Only accept messages from our domain
    if (event.origin !== 'https://form.cipherbc.com') return;

    if (event.data.type === 'form-submitted') {
      console.log('CipherBC Form: Submission successful');
      // You can add custom behavior here (e.g., show thank you message)
    }
  });

  // Append iframe to container
  container.appendChild(iframe);
})();
