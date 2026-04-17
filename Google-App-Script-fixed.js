// Google App Script Security Improvements

// 1. Password Hashing Verification
function verifyPassword(inputPassword, storedHash) {
    var hashedInput = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, inputPassword);
    return Utilities.base64Encode(hashedInput) === storedHash;
}

// 2. Input Sanitization
function sanitizeInput(input) {
    return input.replace(/<[^>]*>/g, ''); // Remove HTML tags
}

// 3. Rate Limiting Preparation
var requestCount = 0;
var lastRequestTime = new Date().getTime();

function checkRateLimit() {
    var currentTime = new Date().getTime();
    if (currentTime - lastRequestTime < 60000) { // 1 minute
        requestCount++;
        if (requestCount > 100) { // Limit to 100 requests/minute
            throw new Error('Rate limit exceeded');
        }
    } else {
        requestCount = 1;
    }
    lastRequestTime = currentTime;
}

// 4. Enhanced Error Handling
function handleError(error) {
    Logger.log('Error: ' + error.message);
    // Additional error handling logic can be added here
}