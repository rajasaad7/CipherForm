// Shared OTP storage using Netlify Blobs (works across Netlify Functions)
const { getStore } = require('@netlify/blobs');

// Normalize email to use as key
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

// Get the OTP store with context
function getOTPStore(context) {
  return getStore({
    name: 'otp-verification',
    siteID: context.site?.id,
    token: context.token
  });
}

// Get the attempts store with context
function getAttemptsStore(context) {
  return getStore({
    name: 'otp-attempts',
    siteID: context.site?.id,
    token: context.token
  });
}

// Store OTP
async function setOTP(email, data, context) {
  const store = getOTPStore(context);
  const key = normalizeEmail(email);
  await store.set(key, JSON.stringify(data));
}

// Get OTP
async function getOTP(email, context) {
  const store = getOTPStore(context);
  const key = normalizeEmail(email);
  const data = await store.get(key);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Error parsing OTP:', error);
    return null;
  }
}

// Delete OTP
async function deleteOTP(email, context) {
  const store = getOTPStore(context);
  const key = normalizeEmail(email);
  await store.delete(key);
}

// Store attempt
async function setAttempt(email, data, context) {
  const store = getAttemptsStore(context);
  const key = normalizeEmail(email);
  await store.set(key, JSON.stringify(data));
}

// Get attempt
async function getAttempt(email, context) {
  const store = getAttemptsStore(context);
  const key = normalizeEmail(email);
  const data = await store.get(key);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Error parsing attempt:', error);
    return null;
  }
}

module.exports = {
  setOTP,
  getOTP,
  deleteOTP,
  setAttempt,
  getAttempt
};
