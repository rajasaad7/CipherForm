// Shared OTP storage using filesystem (works across Netlify Functions)
const fs = require('fs');
const path = require('path');

const STORAGE_DIR = '/tmp/otp-storage';
const ATTEMPTS_DIR = '/tmp/otp-attempts';

// Ensure storage directories exist
function ensureDirectories() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(ATTEMPTS_DIR)) {
    fs.mkdirSync(ATTEMPTS_DIR, { recursive: true });
  }
}

// Normalize email to use as filename
function normalizeEmail(email) {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// Store OTP
function setOTP(email, data) {
  ensureDirectories();
  const filename = path.join(STORAGE_DIR, `${normalizeEmail(email)}.json`);
  fs.writeFileSync(filename, JSON.stringify(data));
}

// Get OTP
function getOTP(email) {
  ensureDirectories();
  const filename = path.join(STORAGE_DIR, `${normalizeEmail(email)}.json`);

  if (!fs.existsSync(filename)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    return data;
  } catch (error) {
    console.error('Error reading OTP:', error);
    return null;
  }
}

// Delete OTP
function deleteOTP(email) {
  ensureDirectories();
  const filename = path.join(STORAGE_DIR, `${normalizeEmail(email)}.json`);

  if (fs.existsSync(filename)) {
    fs.unlinkSync(filename);
  }
}

// Store attempt
function setAttempt(email, data) {
  ensureDirectories();
  const filename = path.join(ATTEMPTS_DIR, `${normalizeEmail(email)}.json`);
  fs.writeFileSync(filename, JSON.stringify(data));
}

// Get attempt
function getAttempt(email) {
  ensureDirectories();
  const filename = path.join(ATTEMPTS_DIR, `${normalizeEmail(email)}.json`);

  if (!fs.existsSync(filename)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    return data;
  } catch (error) {
    console.error('Error reading attempt:', error);
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
