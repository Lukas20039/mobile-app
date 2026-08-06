angular.module('grisu-noe').controller('overviewTabController',
    function($scope, $rootScope, dataService, util, $ionicModal, $state,
             $window, storageService, $cordovaClipboard, $cordovaToast, $ionicPopover, md5, $cordovaSplashscreen) {

    var easterEggClickCount;
    var calculatedHashes;

    $scope.doRefresh = function(loadFromCache) {
        util.genericRefresh($scope, dataService.getMainData(loadFromCache), function(data) {
            $scope.mainData = data;

            var svg = document.getElementsByClassName('lower-austria-map');
            var warnStatesString = dataService.getConfig().warnStates.join(' ');

            // cleanup of css classes
            angular.forEach(svg[0].getElementsByTagName('path'), function(path) {
                angular.element(path).removeClass(warnStatesString);
            });

            // add new classes to colorize map
            angular.forEach(data.mapColorStates, function(colorState) {
                var paths = svg[0].getElementsByClassName(colorState.key);
                angular.forEach(paths, function(path) {
                    angular.element(path).addClass(colorState.value);
                });
            });
        });

        if (!$scope.settings.showExtendedIncidentData) {
            return;
        }

        util.genericRefresh($scope, dataService.getInfoMessages(), function(data) {
            if (data.CurrentState != 'data') {
                $scope.messagesError = true;
                return;
            }
            handleInfoMessages(data.Infos);
        }, { hideRefreshers: false });
    };

    function handleInfoMessages(messages) {
        var storedHashes = storageService.get('messages', []);
        $scope.hasNewMessages = false;
        calculatedHashes = [];

        angular.forEach(messages, function(message) {
            var hash = md5.createHash(message.Title + message.Text);
            calculatedHashes.push(hash);
            if (storedHashes.indexOf(hash) === -1) {
                $scope.hasNewMessages = true;
            }
        });

        $scope.infoMessages = messages;
    }

    /**
     * cordova-android >= 13 implements the Android 12+ SplashScreen API natively and
     * dismisses the splash itself, so navigator.splashscreen (and with it
     * $cordovaSplashscreen) only exists if the deprecated cordova-plugin-splashscreen
     * is installed - which it no longer is. Guard instead of removing the call, so a
     * future iOS build that still ships the plugin keeps working.
     */
    function hideSplashscreen() {
        if (!$window.cordova || !$window.navigator.splashscreen) {
            return;
        }

        setTimeout(function() {
            console.debug('hide splash screen');
            $cordovaSplashscreen.hide();
        }, 300);
    }

    $scope.$on('cordova.resume', function() {
        $scope.doRefresh(false);
    });

    $scope.$on('$ionicView.enter', function() {
        $scope.doRefresh(true);

        if (!$scope.settings.showExtendedIncidentData || !angular.isUndefinedOrNull($scope.homeAddress)) {
            return;
        }

        dataService.getInfoscreenConfig().then(function(data) {
            if (data.CurrentState != 'data') {
                return;
            }
            $scope.homeAddress = data.Config.HomeAddress;
        });
    });

    $scope.onMapClicked = function(event) {
        var district = event.target.classList[0];
        var mappings = dataService.getConfig().districtMapMappings;
        for (var key in mappings) {
            if (mappings.hasOwnProperty(key)) {
                if (mappings[key] === district) {
                    $state.go('tabs.overview-incidents', { id: key });
                }
            }
        }
    };

    $scope.$on('$ionicView.loaded', function() {
        easterEggClickCount = 0;
        $scope.settings = storageService.getObject('settings');
        $scope.magicCookie = storageService.getObject('magicCookie');

        hideSplashscreen();

        if ($scope.settings.jumpToDistrict === true &&
            $scope.settings.myDistrict.k !== 'LWZ' &&
            $rootScope.alreadyJumpedToDistrict !== true) {

            $rootScope.alreadyJumpedToDistrict = true;
            $state.go('tabs.overview-incidents', {
                id: $scope.settings.myDistrict.k
            });
        }

        $ionicModal.fromTemplateUrl('templates/about.html', {
            scope: $scope,
            animation: 'slide-in-up'
        }).then(function(modal) {
            $scope.date = new Date();
            $scope.aboutDialog = modal;
        });

        $ionicModal.fromTemplateUrl('templates/settings.html', {
            scope: $scope,
            animation: 'slide-in-up'
        }).then(function(modal) {
            if (!$scope.settings.myDistrict) {
                $scope.settings.myDistrict = {
                    k: 'LWZ'
                };
            }

            if (angular.isUndefinedOrNull($scope.settings.showIncidentDistance)) {
                $scope.settings.showIncidentDistance = true;
            }

            if (angular.isUndefinedOrNull($scope.settings.showIncidentHydrants)) {
                $scope.settings.showIncidentHydrants = true;
            }

            $scope.$watch('settings', function(newValue, oldValue) {
                console.debug('Settings changed', oldValue, newValue);
                storageService.setObject('settings', newValue);
            }, true);

            $scope.settingsDialog = modal;
        });

        $ionicModal.fromTemplateUrl('templates/info-messages.html', {
            scope: $scope,
            animation: 'slide-in-up'
        }).then(function(modal) {
            $scope.infoMessagesDialog = modal;
        });

        $ionicPopover.fromTemplateUrl('templates/magic-cookie.html', {
            scope: $scope
        }).then(function(popover) {
            // check for empty object
            if (angular.toJson($scope.magicCookie) === '{}') {
                $scope.magicCookie = {
                    value: '',
                    active: false
                };
            }

            $scope.$watch('magicCookie', function(newValue, oldValue) {
                console.debug('Magic cookie changed', oldValue, newValue);
                storageService.setObject('magicCookie', newValue);
            }, true);

            $scope.popover = popover;
        });
    });

    $scope.onExtendedIncidentDataChanged = function() {
        updateToken();
    };

    function updateToken() {
        if (!$scope.settings.showExtendedIncidentData) {
            return;
        }

        $scope.loadingTokenInfo = true;

        util.genericRefresh($scope, dataService.getInfoScreenData(false), function(data) {
            if (data.CurrentState == 'token' || data.CurrentState == 'waiting') {
                $scope.token = data.Token;
                $scope.waitForToken = true;
                storeToken(data.Token);
            } else if (isUnknownTokenError(data) && getStoredToken() !== null) {
                /*
                 * Error 1002 means the server no longer knows the stored code (revoked,
                 * expired or a typo while restoring). Keep the old code instead of
                 * silently generating a new one: roll back to the previous token if a
                 * restore attempt overwrote it, show the error and let the user
                 * explicitly request a fresh code via generateNewCode().
                 */
                $scope.codeRejected = true;
                if (!angular.isUndefinedOrNull($scope.previousToken) && $scope.previousToken.length > 0) {
                    storageService.setObject('infoscreenToken', { value: $scope.previousToken });
                }
                $scope.token = getStoredToken();
                showTokenInfo('Der Code wurde vom Server nicht erkannt.');
                $scope.loadingTokenInfo = false;
                return;
            } else {
                $scope.waitForToken = false;
            }

            $scope.loadingTokenInfo = false;
        });
    }

    function isUnknownTokenError(data) {
        if (data.CurrentState != 'error' || !angular.isArray(data.Errors)) {
            return false;
        }

        for (var i = 0; i < data.Errors.length; i++) {
            if (data.Errors[i].ErrorCode === 1002) {
                return true;
            }
        }

        return false;
    }

    function getStoredToken() {
        var stored = storageService.getObject('infoscreenToken');
        return stored && stored.value ? stored.value : null;
    }

    /**
     * The server issues a NEW code for every request that arrives without the
     * xFFK_InfoScrCookie_TokenID cookie, so the code has to be kept on our side: dataService
     * sends it back as that cookie, which keeps the unlocked code alive across reinstalls.
     */
    function storeToken(token) {
        if (angular.isUndefinedOrNull(token) || token.toString().length === 0) {
            return;
        }

        storageService.setObject('infoscreenToken', { value: token.toString() });
    }

    /**
     * Toast is only available on a device. In the browser the message is shown inline in the
     * settings dialog instead, so no code path depends on the plugin being present.
     */
    function showTokenInfo(message) {
        $scope.tokenInfoMessage = message;

        if ($window.cordova && $window.plugins && $window.plugins.toast) {
            $cordovaToast.showShortBottom(message);
        }
    }

    $scope.copyTokenToClipboard = function() {
        if (angular.isUndefinedOrNull($scope.token)) {
            return;
        }

        if (!$window.cordova || !$window.cordova.plugins || !$window.cordova.plugins.clipboard) {
            showTokenInfo('Zwischenablage steht hier nicht zur Verfügung. Code: ' + $scope.token);
            return;
        }

        $cordovaClipboard.copy($scope.token).then(function() {
            showTokenInfo('Code wurde in die Zwischenablage kopiert');
        });
    };

    $scope.restoreToken = function() {
        var token = '';
        if (!angular.isUndefinedOrNull($scope.restoreTokenModel) && !angular.isUndefinedOrNull($scope.restoreTokenModel.code)) {
            token = $scope.restoreTokenModel.code.trim();
        }

        if (token.length === 0) {
            showTokenInfo('Bitte zuerst einen Code eingeben.');
            return;
        }

        // remember the current code so a rejected restore attempt can roll back
        var current = getStoredToken();
        if (!angular.isUndefinedOrNull(current) && current.length > 0) {
            $scope.previousToken = current;
        }

        storeToken(token);
        $scope.restoreTokenModel.code = '';
        showTokenInfo('Code wird wiederhergestellt...');
        updateToken();
    };

    $scope.generateNewCode = function() {
        $scope.codeRejected = false;
        $scope.previousToken = null;
        storageService.setObject('infoscreenToken', {});
        showTokenInfo('Neuer Code wird erstellt...');
        updateToken();
    };

    $scope.openAboutDialog = function() {
        $scope.aboutDialog.show();
    };

    $scope.closeAboutDialog = function() {
        $scope.aboutDialog.hide();
    };
    
    $scope.openSettingsDialog = function() {
        $scope.tokenInfoMessage = null;
        // init on the controller scope, otherwise ng-model creates it on the modal's child scope
        if (angular.isUndefinedOrNull($scope.restoreTokenModel)) {
            $scope.restoreTokenModel = {};
        }
        $scope.codeRejected = false;
        updateToken();
        $scope.settingsDialog.show();
    };

    $scope.closeSettingsDialog = function() {
        $scope.settingsDialog.hide();
    };

    $scope.openInfoMessagesDialog = function() {
        storageService.setObject('messages', calculatedHashes);
        $scope.hasNewMessages = false;
        $scope.infoMessagesDialog.show();
    };

    $scope.closeInfoMessagesDialog = function() {
        $scope.infoMessagesDialog.hide();
    };

    $scope.$on('$destroy', function() {
        $scope.aboutDialog.remove();
        $scope.settingsDialog.remove();
        $scope.infoMessagesDialog.remove();
        $scope.popover.remove();
    });

    $scope.openPopover = function($event) {
        $scope.popover.show($event);
    };

    $scope.closePopover = function() {
        $scope.popover.hide();
    };

    $scope.onEasterEggClicked = function(event) {
        easterEggClickCount++;
        if (easterEggClickCount > 10) {
            easterEggClickCount = 0;
            $scope.openPopover(event);
        }
    };
});