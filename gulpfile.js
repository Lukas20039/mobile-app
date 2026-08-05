var gulp = require('gulp');
var log = require('fancy-log');
var colors = require('ansi-colors');
var bower = require('bower');
var sass = require('gulp-sass')(require('sass'));
var cleanCss = require('gulp-clean-css');
var rename = require('gulp-rename');
var sh = require('shelljs');
var del = require('del');
var jshint = require('gulp-jshint');

// Plugins are resolved from npm. Versions are pinned so a fresh checkout builds
// reproducibly; see MODERNIZATION.md for why the previous GitHub URLs are gone.
var requiredCordovaPlugins = [
    'cordova-plugin-device@3.0.0',
    'cordova-plugin-statusbar@4.0.0',
    'cordova-plugin-geolocation@5.0.0',
    'cordova-plugin-inappbrowser@6.0.0',
    'cordova-plugin-android-permissions@1.1.5',
    'cordova-clipboard@1.3.0',
    'cordova-plugin-x-toast@2.7.3',
    'cordova-plugin-advanced-http@3.3.1',
    './local-plugins/cordova-plugin-grisu-screenshot'
];

function processSass() {
    return gulp.src('./scss/ionic.app.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(gulp.dest('./www/css/'))
        .pipe(cleanCss({ keepSpecialComments: 0 }))
        .pipe(rename({ extname: '.min.css' }))
        .pipe(gulp.dest('./www/css/'));
}

function printErrorMessageAndExit(msg) {
    log(colors.red(msg));
    process.exit(1);
}

gulp.task('sass', function() {
    return processSass();
});

gulp.task('sass:watch', function() {
    return gulp.watch('./scss/ionic.app.scss', gulp.series('sass'));
});

gulp.task('lint', function() {
    return gulp.src('./www/js/**/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('jshint-stylish'))
        .pipe(jshint.reporter('fail'));
});

gulp.task('bower', function(done) {
    bower.commands.install()
        .on('log', function(data) {
            log('bower', colors.cyan(data.id), data.message);
        }).on('end', function() {
            done();
        }).on('error', function() {
            printErrorMessageAndExit('ERROR: Bower install ended NOT OK!');
        });
});

gulp.task('cordova', function(done) {
    for (var i = 0; i < requiredCordovaPlugins.length; i++) {
        var plugin = requiredCordovaPlugins[i];
        if (sh.exec('npx cordova plugin add ' + plugin).code !== 0) {
            printErrorMessageAndExit('Error: Couldn\'t install Cordova plugin ' + plugin);
        }
    }
    done();
});

gulp.task('git:check', function(done) {
    if (!sh.which('git')) {
        printErrorMessageAndExit('Git is not installed.\n' +
            'Git, the version control system, is required to download Ionic.\n' +
            'Download git here: http://git-scm.com/downloads\n' +
            'Once git is installed, run \'gulp install\' again.'
        );
    }
    done();
});

gulp.task('clean', function() {
    return del([
        'node_modules/**',
        'plugins/**',
        'platforms/**',
        'www/css/**',
        'www/lib/**'
    ]);
});

gulp.task('install', gulp.series('git:check', 'cordova', 'bower', 'sass'));

gulp.task('default', gulp.series('sass'));
