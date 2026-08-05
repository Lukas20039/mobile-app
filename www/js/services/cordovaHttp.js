/**
 * Angular bridge for cordova-plugin-advanced-http.
 *
 * The app originally depended on wymsee/cordova-HTTP, which shipped its own 'cordovaHTTP'
 * Angular module. That plugin is abandoned and no longer builds against modern
 * cordova-android, so it was replaced by the maintained cordova-plugin-advanced-http.
 *
 * This shim reproduces the call signature dataService already relies on:
 *
 *   cordovaHTTP.get(url, params, headers)
 *     -> resolves with { data: <string>, status: <number>, headers: {...} }
 *     -> rejects  with { status: <number>, error: <string> }
 *
 * advanced-http keeps responseType 'text' by default, so `data` stays a raw string and
 * the existing angular.fromJson() calls behave exactly as before. Its header merge also
 * gives precedence to explicitly passed headers, which is what keeps the WASTL
 * "magic cookie" (a manual Cookie header) working.
 */
angular.module('cordovaHTTP', []).factory('cordovaHTTP', function($q) {

    function nativeHttp() {
        return window.cordova && window.cordova.plugin && window.cordova.plugin.http;
    }

    function request(method, url, payload, headers) {
        var deferred = $q.defer();
        var http = nativeHttp();

        if (!http) {
            // Browser / `ionic serve`: no native HTTP. Callers guard on $window.cordova,
            // so this only trips if that guard is ever removed.
            deferred.reject({
                status: -1,
                error: 'cordova-plugin-advanced-http is not available'
            });
            return deferred.promise;
        }

        http[method](url, payload || {}, headers || {}, function(response) {
            deferred.resolve(response);
        }, function(response) {
            deferred.reject(response);
        });

        return deferred.promise;
    }

    return {
        get: function(url, params, headers) {
            return request('get', url, params, headers);
        },
        post: function(url, data, headers) {
            return request('post', url, data, headers);
        },
        put: function(url, data, headers) {
            return request('put', url, data, headers);
        },
        del: function(url, params, headers) {
            return request('delete', url, params, headers);
        },
        head: function(url, params, headers) {
            return request('head', url, params, headers);
        }
    };
});
