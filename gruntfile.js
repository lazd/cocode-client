module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-rework');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-symlink');

  var reworkPlugins = [
    require('rework-import')({
      path: [
        'source/css/',
        'node_modules/'
      ]
    }),
    require('rework-inherit')(),
    require('rework-vars')(),
    require('rework-calc')
  ];

  var reworkFiles = {
    'build/index.css': 'source/css/index.css',
  };

  var browserifyFiles = {
    'build/index.js': 'source/js/index.js',
    'build/play.js': 'source/js/play.js'
  };

  var resourcesFiles = [
    '*.html',
    'images/*'
  ];

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    clean: {
      // Clean files in build/, but leave the folder intact
      build: [
        'build/**/*',
        '!build/results/**'
      ]
    },
    browserify: {
      options: {},
      dev: {
        options: {
          bundleOptions: {
            debug: true
          }
        },
        files: browserifyFiles
      },
      prod: {
        files: browserifyFiles
      },
      watch: {
        bundleOptions: {
          debug: true
        },
        options: {
          watch: true
        },
        files: browserifyFiles
      }
    },
    uglify: {
      prod: {
        files: {
          'build/index.js': 'build/index.js'
        }
      }
    },
    rework: {
      options: {
        use: reworkPlugins
      },
      dev: {
        files: reworkFiles,
        options: {
          toString: {
            sourcemap: true
          }
        }
      },
      prod: {
        files: reworkFiles,
        options: {
          toString: {
            compress: true
          }
        }
      }
    },
    symlink: {
      results: {
        src: '../results',
        dest: 'build/results/'
      }
    },
    copy: {
      resources: {
        cwd: 'source/',
        src: resourcesFiles,
        dest: 'build/',
        expand: true
      },
      icons: {
        // Separate config here
        // The location of the fonts/ folder was relative to icons/style.css
        // This changes after we @import icons/styles.css
        // So make the directory structure reflect that
        cwd: 'source/css/icons/fonts/',
        src: '**',
        dest: 'build/fonts/',
        expand: true
      }
    },
    watch: {
      resources: {
        // Use the same resrouces as the copy task, but tack the directory on there
        files: resourcesFiles.map(function(fileName) { return 'source/'+fileName; }),
        tasks: ['copy:resources']
      },
      icons: {
        files: ['source/css/icons/fonts/**'],
        tasks: ['copy:icons']
      },
      css: {
        files: 'source/css/**/*.css',
        tasks: ['rework:dev']
      }
    }
  });

  // Common tasks for all build types
  grunt.registerTask('build-common', ['clean', 'copy']);

  // Tasks to run before a dev build
  grunt.registerTask('build-dev-before', ['build-common', 'symlink', 'rework:dev']);
  grunt.registerTask('build-prod-before', ['build-common', 'rework:prod']);

  // Build types
  grunt.registerTask('build-dev', ['build-dev-before', 'browserify:dev']);
  grunt.registerTask('build-prod', ['build-prod-before', 'browserify:prod', 'uglify:prod']);

  // Default task - Build and watch in dev mode
  // Don't do a full dev build, browserify:watch will handle it
  grunt.registerTask('default', ['build-dev-before', 'browserify:watch', 'watch']);
};
