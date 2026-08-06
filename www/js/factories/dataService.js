angular.module('grisu-noe').factory('dataService', function($http, $q, $window, storageService, cordovaHTTP) {
    var config = {
        districtMapMappings: {
            '01': 'amstetten',
            '02': 'baden',
            '03': 'bruck-leitha',
            '04': 'gaenserndorf',
            '05': 'gmuend',
            '061': 'klosterneuburg',
            '062': 'purkersdorf',
            '063': 'schwechat',
            '07': 'hollabrunn',
            '08': 'horn',
            '09': 'stockerau',
            '10': 'krems',
            '11': 'lilienfeld',
            '12': 'melk',
            '13': 'mistelbach',
            '14': 'moedling',
            '15': 'neunkirchen',
            '17': 'st-poelten',
            '18': 'scheibbs',
            '19': 'tulln',
            '20': 'waidhofen-thaya',
            '21': 'wr-neustadt',
            '22': 'zwettl'
        },
        warnStates: ['none', 'low', 'medium', 'high'],
        infoScreenBaseUrl: 'https://infoscreen.florian10.info/OWS/Infoscreen/',
        wastlMobileBaseUrl: 'https://infoscreen.florian10.info/OWS/wastlMobile/',
        // HTTPS is mandatory here: the plain http:// endpoint no longer accepts connections
        // and Android 9+ would block it anyway.
        bazInfoUrl: 'https://atlas.feuerwehr-krems.at/CodePages/Wastl/GetDaten/GetWastlMainS3.asp?Time',
        httpTimeout: 60000 // 60 seconds maximum request time
    };

    var cache = {
        mainData: null,
        mainDataCreated: null,
        bazInfo: null
    };

    var processMainData = function(data) {
        var extension = {
            departmentCount: 0,
            incidentCount: 0,
            districtCount: 0,
            mapColorStates: []
        };

        /*
         * The per-district incident count `e` is no longer populated by the WASTL API - it is
         * 0 for every district, which made "Aktuelle Einsätze" permanently show 0. The
         * state-wide total is still delivered in h1.s, so prefer that and only fall back to
         * summing `e` if h1 is missing.
         */
        if (data.h1 && angular.isNumber(data.h1.s)) {
            extension.incidentCount = data.h1.s;
        }

        angular.forEach(data.Bezirke, function(district) {
            extension.departmentCount += district.f;

            if (!(data.h1 && angular.isNumber(data.h1.s))) {
                extension.incidentCount += district.e;
            }

            // k = identifier of district, LWZ = 'Landeswarnzentrale', is not on map
            if (district.k === '') {
                district.k = 'LWZ';
            }

            if (district.z > 0) {
                extension.mapColorStates.push({
                    key: config.districtMapMappings[district.k],
                    value: config.warnStates[district.z]
                });
            }
        });

        extension.districtCount = extension.mapColorStates.length;

        console.debug('Extended WASTL data with', extension);
        return angular.extend(data, extension);
    };

    var processBazInfo = function(data) {
        var result = {};

        angular.forEach(data.root.aBAZID, function(baz) {
            var district = baz.cBezirk.toString() === '' ? 'LWZ' : baz.cBezirk.toString();
            result['d_' + district] = baz.nBAZStatus.toString() === 'ledgreen.gif';
        });

        console.debug('Processed BAZ info', result);
        return result;
    };

    /**
     * Loads info screen data through the native HTTP stack with an explicit Cookie header.
     * The WASTL server only recognizes an existing Infoscreen session if that cookie is sent
     * verbatim, which the WebView's $http can't do.
     *
     * The cookie jar of advanced-http keeps the xFFK_InfoScrCookie_TokenID that previous
     * responses set via Set-Cookie. That jar cookie would be merged with the explicit
     * Cookie header below and WIN over it, so the server would keep answering with the OLD
     * token. The jar cookies for this URL are therefore removed first (callback avoids a
     * race with the follow-up request).
     */
    var getInfoScreenDataWithCookie = function(url, params, cookie, deferred) {
        var http = $window.cordova && $window.cordova.plugin && $window.cordova.plugin.http;

        var performRequest = function() {
            cordovaHTTP.get(url, params || {}, {
                Cookie: cookie
            }).then(function(response) {
                var json = angular.fromJson(response.data);
                console.info('Cordova HTTP plugin: Extended info screen data loaded from server', json);
                deferred.resolve(json);
            }, function(response) {
                console.error('Cordova HTTP plugin error: ' + response.status + ', ' + response.error);
                deferred.reject(response.status, response.error);
            });
        };

        if (http && http.removeCookies) {
            http.removeCookies(url, performRequest);
        } else {
            performRequest();
        }
    };

    var createCurrentTimestamp = function() {
        return parseInt(Date.now() / 1000);
    };

    /**
     * Checks if cache is valid and if cache creation time isn't too old.
     */
    var isCacheAlive = function(cacheData, cacheTimestamp) {
        if (cacheData === null) {
            return false;
        }

        var nowTimestamp = createCurrentTimestamp();
        var timeDifference = nowTimestamp - cacheTimestamp;
        console.debug('Now timestamp', nowTimestamp);
        console.debug('Cache timestamp', cacheTimestamp);
        console.debug('Time difference in seconds', timeDifference);

        // max. age of cache is one minute
        return !(cacheTimestamp === null || timeDifference >= 60);
    };

    return {
        getMainData: function(loadFromCache) {
            var deferred = $q.defer();

            if (loadFromCache && isCacheAlive(cache.mainData, cache.mainDataCreated)) {
                console.info('Main data loaded from cache', cache.mainData);
                deferred.resolve(cache.mainData);
                return deferred.promise;
            }

            $http.get(config.wastlMobileBaseUrl + 'getMainData.ashx', { timeout: config.httpTimeout }).success(function(data) {
                console.info('Main data loaded from server', data);
                cache.mainData = processMainData(data);
                cache.mainDataCreated = createCurrentTimestamp();
                console.debug('Updated mainData cache with timestamp', cache.mainDataCreated);
                deferred.resolve(cache.mainData);
            }).error(function(data, code) {
                deferred.reject(code, data);
                console.error('Error loading main data. Error code', code);
            });

            return deferred.promise;
        },

        getActiveIncidents: function(districtId) {
            var deferred = $q.defer();

            $http.get(config.wastlMobileBaseUrl + 'getEinsatzAktiv.ashx', {
                timeout: config.httpTimeout,
                params: {
                    id: 'bezirk_' + districtId
                }
            }).success(function(data) {
                console.info('Incident data for district "' + districtId + '" loaded from server', data);
                deferred.resolve(data);
            }).error(function(data, code) {
                deferred.reject(code, data);
                console.error('Error loading incident data for district "' + districtId + '". Error code', code);
            });

            return deferred.promise;
        },

        getConfig: function() {
            return config;
        },

        getIncidentData: function(incidentId) {
            var deferred = $q.defer();

            $http.get(config.wastlMobileBaseUrl + 'geteinsatzdata.ashx', {
                timeout: config.httpTimeout,
                params: {
                    id: incidentId
                }
            }).success(function(data) {
                console.info('Detailed data for incidentId "' + incidentId + '" loaded from server', data);
                deferred.resolve(data);
            }).error(function(data, code) {
                deferred.reject(code, data);
                console.error('Error loading detailed data for incident "' + incidentId + '". Error code', code);
            });

            return deferred.promise;
        },

        getInfoScreenData: function(useDemoData) {
            var deferred = $q.defer();
            var magicCookie = storageService.getObject('magicCookie');
            var infoScreenToken = storageService.getObject('infoscreenToken');
            var url = config.infoScreenBaseUrl;
            var options = {
                timeout: config.httpTimeout
            };

            if (useDemoData) {
                url += 'demo.ashx';
                angular.extend(options, {
                    params: {
                        demo: 3
                    }
                });
            } else {
                url += 'Einsatz.ashx';
            }

            if ($window.cordova && magicCookie && magicCookie.value && magicCookie.value.length > 0 && magicCookie.active) {
                getInfoScreenDataWithCookie(url, options.params, 'xFFK_InfoScrCookie_SessionID=' + magicCookie.value, deferred);
            } else if ($window.cordova && infoScreenToken && infoScreenToken.value && infoScreenToken.value.length > 0) {
                /*
                 * Without this cookie the server hands out a BRAND NEW token on every request,
                 * so a reinstalled app would lose its unlocked code. Sending the stored token
                 * back makes the server recognize the old session and keep the same code.
                 */
                getInfoScreenDataWithCookie(url, options.params, 'xFFK_InfoScrCookie_TokenID=' + infoScreenToken.value, deferred);
            } else {
                $http.get(url, options).success(function(data) {
                    console.info('Extended info screen data loaded from server', data);
                    deferred.resolve(data);
                }).error(function (data, code) {
                    deferred.reject(code, data);
                    console.error('Error loading extended info screen data. Error code', code);
                });
            }

            return deferred.promise;
        },

        getInfoScreenHistory: function() {
            var deferred = $q.defer();

            $http.get(config.infoScreenBaseUrl + 'historic.ashx', { timeout: config.httpTimeout }).success(function(data) {
                console.info('Historic info screen data loaded from server', data);
                deferred.resolve(data);
            }).error(function(data, code) {
                deferred.reject(code, data);
                console.error('Error loading historic info screen data. Error code', code);
            });

            return deferred.promise;
        },

        getInfoMessages: function() {
            var deferred = $q.defer();

            $http.get(config.infoScreenBaseUrl + 'info.ashx', { timeout: config.httpTimeout }).success(function(data) {
                console.info('Info messages data loaded from server', data);
                deferred.resolve(data);
            }).error(function(data, code) {
                deferred.reject(code, data);
                console.error('Error loading info messages. Error code', code);
            });

            return deferred.promise;
        },

        getInfoscreenConfig: function() {
            var deferred = $q.defer();

            $http.get(config.infoScreenBaseUrl + 'config.ashx', { timeout: config.httpTimeout }).success(function(data) {
                console.info('Infoscreen config loaded from server', data);
                deferred.resolve(data);
            }).error(function(data, code) {
                deferred.reject(code, data);
                console.error('Error loading Infoscreen config. Error code', code);
            });

            return deferred.promise;
        },

        getBazInfo: function(loadFromCache) {
            var deferred = $q.defer();

            if (loadFromCache) {
                console.info('BAZ info loaded from cache', cache.bazInfo);
                deferred.resolve(cache.bazInfo);
                return deferred.promise;
            }

            $http.get(config.bazInfoUrl, { timeout: config.httpTimeout }).success(function(data) {
                console.info('BAZ info loaded from server', data);
                cache.bazInfo = processBazInfo(data);
                deferred.resolve(cache.bazInfo);
            }).error(function(data, code) {
                deferred.reject(code, data);
                console.error('Error loading BAZ info. Error code', code);
            });

            return deferred.promise;
        },

        postVoting: function(incidentNumber, answer) {
            var deferred = $q.defer();

            $http({
                method: 'POST',
                url: config.infoScreenBaseUrl + 'rsvp.ashx',
                data: 'einsatz=' + incidentNumber + '&answer=' + answer,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: config.httpTimeout
            }).success(function(data) {
                console.info('Successfully posted voting');
                deferred.resolve(data);
            }).error(function(data, code) {
                deferred.reject(code, data);
                console.error('Error with posting voting', code, data.status);
            });

            return deferred.promise;
        }
    };
});