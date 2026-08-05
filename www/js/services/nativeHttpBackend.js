/**
 * Routes cross-origin $http requests through cordova-plugin-advanced-http.
 *
 * Why this is needed: cordova-android >= 10 no longer serves the app from file://, it uses
 * a WebViewAssetLoader under the origin https://localhost. Every call to the WASTL API is
 * therefore a genuine cross-origin XHR, and since those endpoints send no
 * Access-Control-Allow-Origin header the WebView blocks all of them. Under the old file://
 * origin CORS was not enforced, which is why this app worked before the migration.
 *
 * The native HTTP stack is not subject to CORS, so delegating there restores the data flow
 * without touching a single call site.
 *
 * Only absolute http(s) URLs pointing somewhere other than the app's own origin are
 * delegated. Everything else - AngularJS templateUrl loads, and any other same-origin
 * request - stays on the normal XHR backend, because those are served by the asset loader
 * and are not reachable over a real socket.
 */
angular.module('grisu-noe').config(['$provide', function($provide) {
    $provide.decorator('$httpBackend', ['$delegate', '$rootScope', function($delegate, $rootScope) {

        function nativeHttp() {
            return window.cordova && window.cordova.plugin && window.cordova.plugin.http;
        }

        function isCrossOrigin(url) {
            if (!/^https?:\/\//i.test(url)) {
                return false;
            }
            return url.indexOf(window.location.origin + '/') !== 0;
        }

        // Signature per angular.js createHttpBackend: callback precedes headers. The trailing
        // withCredentials/responseType arguments are unused here but still forwarded to the
        // delegate via `arguments`.
        return function(method, url, post, callback, headers, timeout) {
            var http = nativeHttp();

            if (!http || !isCrossOrigin(url)) {
                return $delegate.apply(null, arguments);
            }

            // The callback runs from a native bridge callback, i.e. outside Angular's digest.
            function complete(status, data, responseHeaders) {
                callback(status, data, responseHeaders || {}, '');

                if (!$rootScope.$$phase) {
                    $rootScope.$apply();
                }
            }

            var options = {
                method: (method || 'GET').toLowerCase(),
                // $http has already serialized params into the URL.
                params: {},
                headers: headers || {},
                responseType: 'text'
            };

            if (angular.isNumber(timeout) && timeout > 0) {
                // advanced-http expects seconds, $http passes milliseconds.
                options.connectTimeout = timeout / 1000;
                options.readTimeout = timeout / 1000;
            }

            if (post !== undefined && post !== null) {
                options.data = post;
                // 'utf8' passes the body through verbatim. The app builds its one POST body
                // as a urlencoded string itself, so re-serializing it would corrupt it.
                options.serializer = angular.isString(post) ? 'utf8' : 'json';
            }

            try {
                http.sendRequest(url, options, function(response) {
                    complete(response.status, response.data, response.headers);
                }, function(response) {
                    complete(response.status || -1, response.error, response.headers);
                });
            } catch (e) {
                console.error('Native HTTP backend failed, falling back to XHR: ' + e.message);
                return $delegate.apply(null, arguments);
            }
        };
    }]);
}]);
