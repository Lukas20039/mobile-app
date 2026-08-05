var exec = require('cordova/exec');

/**
 * Kept API-compatible with gitawego/cordova-screenshot on purpose: the callback receives
 * (error, result) and the result carries a human readable `filePath`.
 */
module.exports = {
    save: function(callback, format, quality, filename) {
        format = (format || 'jpg').toLowerCase();
        quality = parseInt(quality, 10);

        if (isNaN(quality) || quality < 1 || quality > 100) {
            quality = 100;
        }

        filename = filename || 'screenshot-' + new Date().getTime();

        exec(function(result) {
            if (callback) {
                callback(null, result);
            }
        }, function(error) {
            if (callback) {
                callback(error || 'Unknown screenshot error');
            }
        }, 'GrisuScreenshot', 'saveScreenshot', [format, quality, filename]);
    }
};
