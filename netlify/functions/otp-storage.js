// Shared OTP storage using Netlify Blobs (works across Netlify Functions)
const { getStore } = require('@netlify/blobs');

// Normalize email to use as key
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

// Get the OTP store - Netlify auto-detects environment
function getOTPStore() {
  return getStore('otp-verification');
}

// Get the attempts store - Netlify auto-detects environment
function getAttemptsStore() {
  return getStore('otp-attempts');
}

// Store OTP
async function setOTP(email, data) {
  const store = getOTPStore();
  const key = normalizeEmail(email);
  await store.set(key, JSON.stringify(data));
}

// Get OTP
async function getOTP(email) {
  const store = getOTPStore();
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
async function deleteOTP(email) {
  const store = getOTPStore();
  const key = normalizeEmail(email);
  await store.delete(key);
}

// Store attempt
async function setAttempt(email, data) {
  const store = getAttemptsStore();
  const key = normalizeEmail(email);
  await store.set(key, JSON.stringify(data));
}

// Get attempt
async function getAttempt(email) {
  const store = getAttemptsStore();
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
